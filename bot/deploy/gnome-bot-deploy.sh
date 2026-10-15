#!/usr/bin/env bash
# Pull-based deploy for the bot in the TrueNAS LXC container, run every few
# minutes by gnome-bot-deploy.timer. GitHub cannot reach the container, so the
# container polls GitHub instead:
#
#   1. Fetch main. If nothing the bot runs on changed since the last deployed
#      commit, fast-forward the checkout (to pick up docs and this script) and stop.
#   2. Otherwise ask the GitHub API for the latest push run of the bot's CI
#      workflow on main. Wait while it runs; hold the current version if it failed.
#   3. Fast-forward to the commit that run tested, `npm ci` only if the lockfile
#      changed, build, re-register slash commands only if they changed, restart
#      the pm2 process and wait for /health to report the bot connected.
#
# The first run has no record of what is running, so it does a full deploy:
# npm ci, build, slash commands and restart.
#
# Usage: gnome-bot-deploy.sh [--dry-run] [--force]
#   --dry-run  report what would be deployed without touching anything
#   --force    retry a commit that already failed to deploy
#
# Every setting below can be overridden in /etc/default/gnome-bot-deploy.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/opt/gnome}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-gnome-bot}"
GITHUB_REPO="${GITHUB_REPO:-Couvbat/Gnome}"
CI_WORKFLOW="${CI_WORKFLOW:-bot-build.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
STATE_DIR="${STATE_DIR:-/var/lib/gnome-bot-deploy}"
# Optional. The public repo needs no token, but unauthenticated API calls share
# a 60/hour limit per public IP; a read-only token raises it.
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# What the running bot is built from. Tests, docs and this deploy tooling are
# left out so that changing them does not restart the bot.
BOT_PATHS=(bot ':(exclude)bot/deploy' ':(exclude)bot/__tests__' ':(exclude)bot/README.md')
# What `npm run deploy` registers with Discord.
COMMAND_PATHS=(bot/commands bot/deploy-commands.ts)

DRY_RUN=0
FORCE=0

log() { echo "$*"; }

short() { echo "${1:0:7}"; }

# Prints "<sha> <status> <conclusion> <url>" for the newest push run of the CI
# workflow on the branch, or nothing when there is none.
latest_ci_run() {
  local url="https://api.github.com/repos/$GITHUB_REPO/actions/workflows/$CI_WORKFLOW/runs?branch=$BRANCH&event=push&per_page=1"
  local auth=()
  [ -n "$GITHUB_TOKEN" ] && auth=(-H "Authorization: Bearer $GITHUB_TOKEN")
  curl -fsS --max-time 30 -H "Accept: application/vnd.github+json" "${auth[@]}" "$url" |
    node -e '
      let body = "";
      process.stdin.on("data", (chunk) => (body += chunk)).on("end", () => {
        const run = JSON.parse(body).workflow_runs?.[0];
        if (run) console.log(run.head_sha, run.status, run.conclusion ?? "none", run.html_url);
      });
    '
}

wait_for_health() {
  [ -n "$HEALTH_URL" ] || return 0
  for _ in $(seq 1 12); do
    if curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null | grep -q '"bot":"connected"'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# $1 is the commit the running bot was built from, empty when unknown (first
# run), in which case everything is reinstalled and re-registered.
deploy() {
  local from="$1" to="$2" install=yes commands=yes running="unknown (first run)"

  if [ -n "$from" ]; then
    running=$(short "$from")
    git diff --quiet "$from" "$to" -- bot/package-lock.json && install=no
    git diff --quiet "$from" "$to" -- "${COMMAND_PATHS[@]}" && commands=no
  fi
  [ -d bot/node_modules ] || install=yes

  if [ "$DRY_RUN" = 1 ]; then
    log "[dry-run] Would deploy $(short "$to") (running $running): npm ci=$install, slash commands=$commands"
    [ -z "$from" ] || git log --oneline "$from..$to" -- "${BOT_PATHS[@]}"
    return 0
  fi

  log "Deploying $(short "$to") (running $running): npm ci=$install, slash commands=$commands"
  # Cleared once the bot is back up; until then the commit is not retried.
  echo "$to" > "$STATE_DIR/failed"

  git merge --ff-only --quiet "$to"

  (
    cd bot
    [ "$install" = no ] || npm ci --no-audit --no-fund
    if [ "$commands" = yes ]; then
      npm run deploy   # builds, then registers the slash commands
    else
      npm run build
    fi
  )

  pm2 restart "$PM2_APP"

  if ! wait_for_health; then
    log "ERROR: $(short "$to") is running but $HEALTH_URL never reported the bot connected. Check: pm2 logs $PM2_APP"
    return 1
  fi

  echo "$to" > "$STATE_DIR/deployed"
  rm -f "$STATE_DIR/failed"
  log "Deployed $(short "$to")"
}

main() {
  for arg in "$@"; do
    case "$arg" in
      --dry-run) DRY_RUN=1 ;;
      --force) FORCE=1 ;;
      *) log "Unknown option: $arg"; exit 2 ;;
    esac
  done

  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  if ! flock -n 9; then
    log "Another deploy is already running"
    exit 0
  fi

  cd "$REPO_DIR"
  git fetch --quiet origin "$BRANCH"

  local remote head deployed
  remote=$(git rev-parse "origin/$BRANCH")
  head=$(git rev-parse HEAD)
  # Empty on the first run: a checkout that was pulled but never rebuilt looks
  # exactly like a deployed one, so nothing is assumed and the first run does
  # a full deploy.
  deployed=$(cat "$STATE_DIR/deployed" 2>/dev/null || true)

  if [ -n "$deployed" ] && git diff --quiet "$deployed" "$remote" -- "${BOT_PATHS[@]}"; then
    if [ "$head" = "$remote" ] && [ "$deployed" = "$remote" ]; then
      [ "$DRY_RUN" = 0 ] || log "[dry-run] Up to date at $(short "$remote")"
      exit 0
    fi
    if [ "$DRY_RUN" = 1 ]; then
      log "[dry-run] No bot changes; would fast-forward the checkout to $(short "$remote")"
      exit 0
    fi
    git merge --ff-only --quiet "$remote"
    echo "$remote" > "$STATE_DIR/deployed"
    log "Fast-forwarded to $(short "$remote") (no bot changes)"
    exit 0
  fi

  local run sha status conclusion url
  run=$(latest_ci_run)
  if [ -z "$run" ]; then
    log "Bot changes are waiting on $BRANCH, but $CI_WORKFLOW has no push run there yet"
    exit 0
  fi
  read -r sha status conclusion url <<<"$run"

  if [ "$status" != completed ]; then
    log "Waiting for CI on $(short "$sha") ($status): $url"
    exit 0
  fi
  if [ "$conclusion" != success ]; then
    log "CI $conclusion on $(short "$sha"), not deploying: $url"
    exit 0
  fi
  if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    log "CI passed on $(short "$sha"), which is not fetched yet; retrying next run"
    exit 0
  fi
  # A push's run is created a few seconds after the push, so the newest green
  # run can still be the one for what is already deployed.
  if [ -n "$deployed" ] && git diff --quiet "$deployed" "$sha" -- "${BOT_PATHS[@]}"; then
    log "Bot changes on $(short "$remote") have no CI run yet; waiting"
    exit 0
  fi

  local target="$sha"
  if ! git merge-base --is-ancestor HEAD "$sha"; then
    # A checkout pulled by hand past the tested commit is fine as long as the
    # bot code in it is exactly what CI tested.
    if git merge-base --is-ancestor "$sha" HEAD && git diff --quiet "$sha" HEAD -- "${BOT_PATHS[@]}"; then
      target="$head"
    else
      log "ERROR: the checkout at $(short "$head") has diverged from the CI-tested $(short "$sha") (local commits or rewritten history). Fix $REPO_DIR by hand."
      exit 1
    fi
  fi
  if [ "$FORCE" = 0 ] && [ "$(cat "$STATE_DIR/failed" 2>/dev/null)" = "$target" ]; then
    log "$(short "$target") already failed to deploy; push a fix or rerun with --force"
    exit 0
  fi

  deploy "$deployed" "$target"
}

trap 'log "ERROR: deploy stopped at line $LINENO"' ERR

# Everything runs from inside main(), which bash has parsed in full before the
# fast-forward can replace this file on disk.
main "$@"; exit $?
