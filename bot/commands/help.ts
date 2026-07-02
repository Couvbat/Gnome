import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AutocompleteInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../types/command";

// Category definitions with emoji icons
const CATEGORIES = {
  utility: { name: "🛠️ Utilitaire", emoji: "🛠️" },
  ai: { name: "🤖 IA & Conversation", emoji: "🤖" },
  lol: { name: "🎮 League of Legends", emoji: "🎮" },
  music: { name: "🎵 Musique", emoji: "🎵" },
  economy: { name: "💰 Économie & Niveau", emoji: "💰" },
  casino: { name: "🎰 Casino", emoji: "🎰" },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

// Static mapping of commands to categories
const COMMAND_CATEGORIES: Record<string, CategoryKey> = {
  // Utility
  ping: "utility",
  echo: "utility",
  birthday: "utility",
  book: "utility",

  // AI/Conversation
  mistral: "ai",
  conversation: "ai",
  listen: "ai",

  // League of Legends
  "lol-stats": "lol",
  "lol-matches": "lol",
  "lol-rotation": "lol",
  "lol-lastgame": "lol",

  // Music
  play: "music",
  playlist: "music",
  pause: "music",
  resume: "music",
  skip: "music",
  stop: "music",
  queue: "music",
  nowplaying: "music",
  loop: "music",

  // Economy/Leveling
  balance: "economy",
  rank: "economy",
  leaderboard: "economy",
  daily: "economy",
  give: "economy",

  // Casino/Gambling
  slots: "casino",
  blackjack: "casino",
  roulette: "casino",
  dice: "casino",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche la liste des commandes disponibles")
    .addStringOption((option) =>
      option
        .setName("commande")
        .setDescription("Nom de la commande ou catégorie à afficher")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const filter = interaction.options.getString("commande");
    const client = interaction.client;

    // If no filter, show paginated category overview
    if (!filter) {
      await showPaginatedHelp(interaction, client);
      return;
    }

    // Check if filter is a category key (exact match first)
    let categoryKey = Object.keys(CATEGORIES).find(
      (key) => key === filter.toLowerCase()
    ) as CategoryKey | undefined;
    
    // If no exact match, try partial name match
    if (!categoryKey) {
      categoryKey = Object.keys(CATEGORIES).find(
        (key) => CATEGORIES[key as CategoryKey].name.toLowerCase().includes(filter.toLowerCase())
      ) as CategoryKey | undefined;
    }

    if (categoryKey) {
      const embed = buildCategoryEmbed(client, categoryKey);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Check if filter is a specific command
    const targetCommand = client.commands.get(filter.toLowerCase());
    if (targetCommand) {
      const embed = buildCommandDetailEmbed(targetCommand);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Not found
    await interaction.reply({
      content: `❌ Commande ou catégorie "${filter}" introuvable. Utilisez \`/help\` sans argument pour voir toutes les commandes disponibles.`,
      ephemeral: true,
    });
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const client = interaction.client;

    // Build choices: categories + all command names
    const choices: { name: string; value: string }[] = [];

    // Add categories
    Object.entries(CATEGORIES).forEach(([key, category]) => {
      choices.push({
        name: `${category.name} (catégorie)`,
        value: key,
      });
    });

    // Add all commands
    client.commands.forEach((cmd) => {
      choices.push({
        name: `/${cmd.data.name} - ${cmd.data.description}`,
        value: cmd.data.name,
      });
    });

    // Filter by focused value
    const filtered = choices
      .filter((choice) =>
        choice.name.toLowerCase().includes(focusedValue) ||
        choice.value.toLowerCase().includes(focusedValue)
      )
      .slice(0, 25); // Discord limit

    await interaction.respond(filtered);
  },

  cooldown: 5,
};

/**
 * Show paginated help with navigation buttons
 */
async function showPaginatedHelp(
  interaction: ChatInputCommandInteraction,
  client: ChatInputCommandInteraction["client"]
): Promise<void> {
  const categoryKeys = Object.keys(CATEGORIES) as CategoryKey[];
  let currentPage = 0;

  // Build embeds for each category + overview page
  const embeds: EmbedBuilder[] = [];
  
  // Overview page (page 0)
  embeds.push(buildOverviewEmbed(client));
  
  // Category pages (pages 1-6)
  categoryKeys.forEach((categoryKey) => {
    embeds.push(buildCategoryEmbed(client, categoryKey));
  });

  const getButtons = (page: number) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("help_first")
        .setLabel("⏮️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("help_prev")
        .setLabel("◀️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("help_home")
        .setLabel("🏠 Accueil")
        .setStyle(ButtonStyle.Success)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("help_next")
        .setLabel("▶️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === embeds.length - 1),
      new ButtonBuilder()
        .setCustomId("help_last")
        .setLabel("⏭️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === embeds.length - 1)
    );
  };

  const response = await interaction.reply({
    embeds: [embeds[currentPage]],
    components: [getButtons(currentPage)],
  });

  // Button collector - 5 minutes timeout
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300_000, // 5 minutes
  });

  collector.on("collect", async (i) => {
    // Only allow the user who triggered the command to use buttons
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: "❌ Utilisez `/help` pour créer votre propre menu d'aide.",
        ephemeral: true,
      });
      return;
    }

    switch (i.customId) {
      case "help_first":
        currentPage = 0;
        break;
      case "help_prev":
        currentPage = Math.max(0, currentPage - 1);
        break;
      case "help_home":
        currentPage = 0;
        break;
      case "help_next":
        currentPage = Math.min(embeds.length - 1, currentPage + 1);
        break;
      case "help_last":
        currentPage = embeds.length - 1;
        break;
    }

    await i.update({
      embeds: [embeds[currentPage]],
      components: [getButtons(currentPage)],
    });
  });

  collector.on("end", async () => {
    // Disable all buttons when collector expires
    try {
      await interaction.editReply({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("help_first")
              .setLabel("⏮️")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("help_prev")
              .setLabel("◀️")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("help_home")
              .setLabel("🏠 Accueil")
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("help_next")
              .setLabel("▶️")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("help_last")
              .setLabel("⏭️")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          ),
        ],
      });
    } catch (error) {
      // Message might have been deleted
      console.error("Failed to disable help buttons:", error);
    }
  });
}

/**
 * Build overview embed showing category list
 */
function buildOverviewEmbed(client: ChatInputCommandInteraction["client"]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle("🎩 Le Gnome - Guide des Commandes")
    .setDescription(
      "Bienvenue dans le menu d'aide du Gnome ! Utilisez les boutons ci-dessous pour naviguer entre les catégories.\n\n" +
      "**Navigation :**\n" +
      "• ⏮️ / ⏭️ - Première / Dernière page\n" +
      "• ◀️ / ▶️ - Page précédente / suivante\n" +
      "• 🏠 - Retour à l'accueil\n\n" +
      "**Catégories disponibles :**"
    )
    .setFooter({ text: `${client.commands.size} commandes disponibles | Utilisez /help <commande> pour plus de détails` })
    .setTimestamp();

  // Add category overview
  const categoryKeys = Object.keys(CATEGORIES) as CategoryKey[];
  categoryKeys.forEach((key) => {
    const category = CATEGORIES[key];
    const commandCount = Array.from(client.commands.values()).filter(
      (cmd) => COMMAND_CATEGORIES[cmd.data.name] === key
    ).length;
    
    embed.addFields({
      name: category.name,
      value: `${commandCount} commande${commandCount > 1 ? 's' : ''}`,
      inline: true,
    });
  });

  return embed;
}

/**
 * Build embed showing commands for a specific category
 */
function buildCategoryEmbed(client: ChatInputCommandInteraction["client"], categoryKey: CategoryKey): EmbedBuilder {
  const category = CATEGORIES[categoryKey];
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`${category.name}`)
    .setDescription(`Toutes les commandes de la catégorie **${category.name}**`)
    .setTimestamp();

  const commands: string[] = [];
  client.commands.forEach((cmd: Command) => {
    const commandName = cmd.data.name;
    if (COMMAND_CATEGORIES[commandName] === categoryKey) {
      let commandInfo = `**/${commandName}**\n${cmd.data.description}`;
      
      // Add cooldown info if present
      if (cmd.cooldown && cmd.cooldown !== 3) {
        commandInfo += `\n⏱️ Cooldown: ${cmd.cooldown}s`;
      }
      
      commands.push(commandInfo);
    }
  });

  if (commands.length > 0) {
    embed.addFields({
      name: "Commandes disponibles",
      value: commands.join("\n\n"),
      inline: false,
    });
  } else {
    embed.setDescription("Aucune commande dans cette catégorie.");
  }

  return embed;
}

/**
 * Build detailed embed for a specific command
 */
function buildCommandDetailEmbed(cmd: Command): EmbedBuilder {
  const commandName = cmd.data.name;
  const category = COMMAND_CATEGORIES[commandName];
  const categoryInfo = category ? CATEGORIES[category] : null;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`/${commandName}`)
    .setDescription(cmd.data.description)
    .setTimestamp();

  // Add category
  if (categoryInfo) {
    embed.addFields({
      name: "Catégorie",
      value: categoryInfo.name,
      inline: true,
    });
  }

  // Add cooldown
  const cooldown = cmd.cooldown || 3;
  embed.addFields({
    name: "⏱️ Cooldown",
    value: `${cooldown} seconde${cooldown > 1 ? "s" : ""}`,
    inline: true,
  });

  // Extract options from SlashCommandBuilder
  const commandJSON = cmd.data.toJSON();
  
  // Add options if present
  if (commandJSON.options && commandJSON.options.length > 0) {
    const optionsText = commandJSON.options
      .map((opt: any) => {
        const required = opt.required ? "**[Requis]**" : "[Optionnel]";
        
        // Handle subcommands
        if (opt.type === 1) { // SUB_COMMAND type
          return `• **${opt.name}** (sous-commande) - ${opt.description}`;
        }
        
        return `• **${opt.name}** ${required} - ${opt.description}`;
      })
      .join("\n");

    embed.addFields({
      name: "📝 Options",
      value: optionsText,
      inline: false,
    });
  }

  // Add usage examples based on command
  const usageExamples = getUsageExamples(commandName);
  if (usageExamples) {
    embed.addFields({
      name: "💡 Exemples d'utilisation",
      value: usageExamples,
      inline: false,
    });
  }

  return embed;
}

/**
 * Get usage examples for specific commands
 */
function getUsageExamples(commandName: string): string | null {
  const examples: Record<string, string> = {
    // Utility Commands
    ping: "`/ping`\nTeste la latence du bot avec Discord",
    
    echo: "`/echo texte:Bonjour tout le monde!`\nLe bot répète exactement votre message",
    
    birthday: "`/birthday set jour:15 mois:3`\nDéfinit votre anniversaire au 15 mars\n\n`/birthday check user:@Ami`\nVérifie l'anniversaire d'un membre\n\n`/birthday list`\nAffiche tous les anniversaires du serveur\n\n`/birthday remove`\nSupprime votre anniversaire",
    
    book: "`/book recherche:Harry Potter`\nRecherche des livres par titre/auteur\n\n`/book sujet:programming`\nTrouve des livres sur un sujet spécifique",
    
    // AI/Conversation Commands
    mistral: "`/mistral prompt:Explique-moi le TypeScript en 3 points`\nPose une question unique à Mistral AI\n\n`/mistral prompt:Donne-moi une recette de cookies`\nObtiens des conseils créatifs\n\n`/mistral prompt:Debug ce code: const x = [1,2,3]; x.map(y => y+)`\nAide au développement",
    
    conversation: "`/conversation prompt:Parlons de développement web`\nDémarre une conversation interactive dans un thread\n\n`/conversation prompt:Aide-moi à apprendre Python`\nDiscussion approfondie avec contexte (15min)",
    
    listen: "`/listen`\nDémarre une conversation vocale avec l'IA\nRejoignez un salon vocal puis lancez la commande\n\n**Fonctionnalités:**\n• Transcription automatique (Whisper)\n• Réponses vocales par TTS\n• Conversation naturelle mains-libres",
    
    // League of Legends Commands
    "lol-stats": "`/lol-stats pseudo:Faker tag:KR1`\nAffiche les stats ranked d'un joueur LoL\n\n`/lol-stats pseudo:Doublelift tag:NA1`\nRang, winrate, champions maîtrisés",
    
    "lol-matches": "`/lol-matches pseudo:Caps tag:EUW`\nHistorique des 10 dernières parties\n\n**Navigation:**\nUtilise les boutons ◀️ ▶️ pour parcourir les matchs",
    
    "lol-rotation": "`/lol-rotation`\nAffiche les champions gratuits de la semaine\nMis à jour automatiquement chaque mardi",
    
    "lol-lastgame": "`/lol-lastgame pseudo:Rekkles tag:EUW`\nAnalyse détaillée de la dernière partie\n\n**Inclut:**\n• Stats complètes (KDA, farm, dégâts)\n• Analyse IA des performances\n• Conseils d'amélioration",
    
    // Music Commands
    play: "`/play recherche:Imagine Dragons`\nJoue de la musique depuis YouTube/SoundCloud\n\n`/play recherche:https://youtu.be/dQw4w9WgXcQ`\nUtilise directement un lien\n\n`/play recherche:lofi hip hop radio`\nRecherche automatique du meilleur résultat",
    
    playlist: "`/playlist url:https://youtube.com/playlist?list=...`\nAjoute toute une playlist YouTube/SoundCloud\n\n**Astuce:** Les playlists sont ajoutées à la file d'attente",
    
    pause: "`/pause`\nMet en pause la musique en cours\nUtilise `/resume` pour reprendre",
    
    resume: "`/resume`\nReprend la lecture après une pause",
    
    skip: "`/skip`\nPasse à la musique suivante dans la file\n\n**Note:** Fonctionne uniquement s'il y a une file d'attente",
    
    stop: "`/stop`\nArrête la musique et quitte le salon vocal\nVide complètement la file d'attente",
    
    queue: "`/queue`\nAffiche la file d'attente musicale\n\n**Navigation:**\nUtilise les boutons pour parcourir la liste\nAffiche 10 musiques par page",
    
    nowplaying: "`/nowplaying`\nAffiche la musique en cours de lecture\nMontre la durée et la source",
    
    loop: "`/loop`\nActive/désactive la répétition de la musique actuelle\n\n**États:**\n🔁 Activé - La musique se répète à l'infini\n▶️ Désactivé - Lecture normale",
    
    // Economy/Leveling Commands
    balance: "`/balance`\nAffiche votre solde de pièces\n\n`/balance user:@Joueur`\nVérifie le solde d'un autre membre\n\n**Info:** Les pièces s'obtiennent via messages, daily, et jeux",
    
    rank: "`/rank`\nAffiche votre rang et XP sur le serveur\n\n`/rank user:@Membre`\nVérifie le rang d'un autre membre\n\n**Progression:**\nBarre de progression vers le prochain niveau",
    
    leaderboard: "`/leaderboard`\nClassement des membres par niveau/XP\n\n**Top 10:**\nAffiche les membres les plus actifs du serveur",
    
    daily: "`/daily`\nRécupère ta récompense quotidienne\n\n**Bonus:**\n• Base: 100 pièces\n• +10 pièces par niveau\n• Cooldown: 24h",
    
    give: "`/give user:@Ami montant:100`\nTransfère 100 pièces à un ami\n\n**Limites:**\n• Minimum: 1 pièce\n• Tu dois avoir assez de fonds\n• Impossible de s'envoyer à soi-même",
    
    // Casino/Gambling Commands
    slots: "`/slots bet:50`\nJoue aux machines à sous avec 50 pièces\n\n**Mise minimum:** 10 pièces\n\n**Symboles:**\n🍒🍒🍒 = x3\n🍋🍋🍋 = x5\n⭐⭐⭐ = x10\n💎💎💎 = x20",
    
    blackjack: "`/blackjack bet:100`\nJoue au Blackjack contre le croupier\n\n**Mise minimum:** 10 pièces\n\n**Règles:**\n• Rapproche-toi de 21 sans dépasser\n• Blackjack (21 avec 2 cartes) = x1.5\n• Hit (tirer) ou Stand (rester)\n• As = 1 ou 11 (automatique)",
    
    roulette: "`/roulette bet:75 mise:rouge`\nParie sur la roulette européenne\n\n**Types de paris:**\n• `rouge/noir` - x2\n• `pair/impair` - x2\n• Numéro (0-36) - x36\n\n**Mise minimum:** 10 pièces",
    
    dice: "`/dice bet:50`\nLance les dés et tente ta chance\n\n**Mise minimum:** 10 pièces\n\n**Gains:**\n• 2 ou 12 = x7\n• 3 ou 11 = x4  \n• 4 ou 10 = x3\n• 5 ou 9 = x2\n• 6 ou 8 = x2\n• 7 = x0 (perte)",
  };

  return examples[commandName] || null;
}

// For backward compatibility with CommonJS require()
module.exports = command;
