# 🎨 Assets management guide

> **Complete guide** for managing visual assets in the RPG system for "La Taverne Dorée du Gnome"

This guide covers how to source, organize, name, and use visual assets — character portraits, item icons, casino UI elements, and sprites — across the bot and Discord Activity frontend.

## 📚 Table of contents

1. [Getting started](#getting-started)
2. [Directory organization](#directory-organization)
3. [Naming conventions](#naming-conventions)
4. [Technical specifications](#technical-specifications)
5. [Free resources](#free-resources)
6. [Asset manager utility](#asset-manager-utility)
7. [Tasks & priorities](#tasks--priorities)

## Getting started

### Step 1: Visit Kenney.nl (recommended)

1. Go to https://kenney.nl/assets/rpg-pack
2. Click "Download" button (CC0 - Public Domain, free to use!)
3. Extract the ZIP file
4. You'll find hundreds of 16x16 pixel RPG items

### Step 2: Organize the assets

From the downloaded Kenney RPG Pack, copy files to:

```text
Downloaded: Kenney RPG Pack/Items/
Copy to: bot/assets/items/

Examples:
- sword*.png → bot/assets/items/weapons/
- potion*.png → bot/assets/items/consumables/
- armor*.png → bot/assets/items/armor/
- gem*.png → bot/assets/items/materials/
```

### Step 3: Rename files with rarity

Rename files to include rarity tier:

**Original:** `sword1.png`  
**Rename to:** `sword_common.png`

**Original:** `sword2.png`  
**Rename to:** `sword_uncommon.png`

**Rarities:** common, uncommon, rare, epic, legendary

### Step 4: Setup (starter pack)

Here's a minimal set to get started:

**Weapons (5 items)**
- `sword_common.png` - Basic sword
- `sword_rare.png` - Better sword
- `staff_uncommon.png` - Magic staff
- `dagger_common.png` - Rogue weapon
- `bow_rare.png` - Ranged weapon

**Armor (5 items)**
- `helmet_common.png` - Basic helmet
- `armor_uncommon.png` - Leather armor
- `shield_rare.png` - Shield
- `boots_common.png` - Boots
- `gloves_uncommon.png` - Gloves

**Consumables (3 items)**
- `health_potion_common.png` - Red potion
- `mana_potion_common.png` - Blue potion
- `elixir_rare.png` - Buff potion

**Materials (3 items)**
- `iron_ore_common.png` - Crafting material
- `wood_common.png` - Crafting material
- `gem_rare.png` - Rare material

## Directory organization

```text
bot/assets/
├── 🏛️ characters/        # Portraits de classes et sprites personnages
│   ├── portraits/        # Portraits HD pour sélection classe (256x256)
│   ├── avatars/         # Avatars Discord embeds (64x64)
│   └── sprites/         # Sprites pixel art pour jeux (32x32)
├── 🗡️ items/             # Objets et équipements RPG
│   ├── weapons/         # Armes (épées, bâtons, dagues, arcs)
│   ├── armor/           # Armures (casques, plastrons, boucliers)
│   ├── accessories/     # Accessoires (anneaux, amulettes, capes)
│   ├── consumables/     # Consommables (potions, parchemins)
│   └── casino/          # Objets casino spéciaux (pièces chance, etc.)
├── 👹 monsters/          # Créatures et ennemis (futurs combats PvE)
├── 🎰 casino/            # Assets spécifiques casino
│   ├── machines/        # Machines à sous thématiques
│   ├── tables/          # Tables de jeu (blackjack, roulette)
│   ├── cards/           # Cartes de jeu et jetons
│   └── effects/         # Effets visuels (jackpot, gains)
├── 🎭 ui/                # Éléments d'interface utilisateur
│   ├── buttons/         # Boutons et contrôles
│   ├── frames/          # Cadres et bordures
│   ├── icons/           # Icônes système (stats, navigation)
│   └── backgrounds/     # Arrière-plans et textures
└── ✨ effects/           # Effets visuels et animations
    ├── particles/       # Particules magiques et casino
    ├── spells/          # Effets de sorts et capacités
    └── celebrations/    # Animations de victoire et level-up
```

## Naming conventions

### 🎭 Character classes

Format: `<classe>_<type>_<variant>.png`

**Classes disponibles:**
- `warrior` - Guerrier 🗡️
- `mage` - Mage 🔮  
- `rogue` - Voleur 🥷
- `merchant` - Marchand 💰
- `bard` - Barde 🎵
- `paladin` - Paladin ⚔️

**Types:**
- `portrait` - Portrait haute qualité (sélection classe)
- `avatar` - Avatar Discord embed (64x64)
- `sprite` - Sprite pixel art (jeux)

**Examples:**
```text
warrior_portrait_male.png
mage_avatar_female.png
rogue_sprite_idle.png
```

### 🗡️ Items & equipment

Format: `<objet>_<rareté>_<variant>.png`

**Rarity levels:**
- `common` - Commun (Gris/Blanc)
- `uncommon` - Peu commun (Vert)
- `rare` - Rare (Bleu)
- `epic` - Épique (Violet)
- `legendary` - Légendaire (Orange/Doré)

**Examples:**
```text
sword_legendary_fire.png
health_potion_common.png
dragon_helmet_epic.png
luck_charm_rare.png
```

### 🎰 Casino assets

Format: `<type>_<thème>_<état>.png`

**Casino themes:**
- `crystal` - Cristaux magiques
- `dragon` - Thème dragon
- `tavern` - Ambiance taverne
- `golden` - Doré/luxueux

**Examples:**
```text
slot_machine_crystal_idle.png
roulette_table_golden.png
blackjack_card_back.png
```

## Technical specifications

### 🖼️ Item icons & UI
- **Size:** 64x64 pixels (standard Discord embed)
- **Format:** PNG with transparency
- **File size:** Max 256KB (Discord limit)
- **Background:** Transparent
- **Style:** Consistent pixel art or semi-realistic

### 👤 Character portraits
- **Size:** 256x256 pixels (high quality)
- **Format:** PNG with transparency
- **Usage:** Class selection, profiles
- **Style:** Detailed, fantasy art

### 🎮 Game sprites
- **Size:** 32x32 pixels (classic pixel art)
- **Format:** PNG with transparency
- **Animations:** Horizontal sprite sheets 32x32 per frame
- **Usage:** Discord Activity, mini-games

### 🎰 Casino Discord Activity assets
- **Size:** Variable depending on context (maintain proportions)
- **Format:** PNG with transparency
- **Optimization:** Compressed for fast web loading
- **Consistency:** Uniform style with tavern theme

## Free resources

### 🏆 Top sources (tested & approved)

#### 1. **Kenney.nl** ⭐⭐⭐⭐⭐
- **URL:** https://kenney.nl/assets
- **License:** CC0 (public domain)
- **Recommended packs:** 
  - "RPG Pack" (fantasy equipment)
  - "Pixel UI Pack" (interface elements)
  - "Roguelike/RPG Characters" (characters)

#### 2. **OpenGameArt.org** ⭐⭐⭐⭐
- **URL:** https://opengameart.org
- **License:** CC0/CC-BY depending on assets
- **Searches:** "RPG items", "casino icons", "character portraits"
- **Advantage:** Huge variety, active community

#### 3. **Game-icons.net** ⭐⭐⭐⭐
- **URL:** https://game-icons.net
- **Collection:** 4,000+ vector icons
- **License:** CC-BY 3.0 (attribution required)
- **Export:** Customizable PNG (32x32 to 256x256)

#### 4. **Itch.io free assets** ⭐⭐⭐
- **URL:** https://itch.io/game-assets/free/tag-pixel-art
- **Filter:** Free + Pixel Art + RPG
- **Advantage:** Cohesive themed packs


### 🤖 AI generation (alternative)

**DALL-E 3:**
```prompt
"32x64 pixel art [object] icon, transparent background, RPG fantasy style, tavern theme"
```

**Stable Diffusion:**
- Specialized pixel art models
- LoRA RPG/Fantasy assets

**Scenario.gg:**
- Specialized game assets
- Guaranteed stylistic consistency

**Gamelab Studio:**
- AI-generated game assets
- Customizable styles
- VScode extension for asset generation
- URL: https://gamelabstudio.co/

### Alternative: Game-icons.net (no download needed)

For testing without downloads:

1. Visit https://game-icons.net
2. Search for an icon (e.g., "sword")
3. Click the icon
4. Set color, background
5. Download as PNG (64x64)
6. Save to `bot/assets/items/weapons/sword_legendary.png`

**Pros:** Instant, huge library, consistent style  
**Cons:** Not pixel art (but works great for icons)

## Asset manager utility

### 🔧 Usage examples

```typescript
import { AssetManager } from './utils/assetManager';

// Item icon for Discord embed
const iconUrl = AssetManager.getItemIcon('sword', 'legendary');

// Class portrait for character selection
const classPortrait = AssetManager.getClassPortrait('warrior', 'male');

// Sprite for Discord Activity
const monsterSprite = AssetManager.getMonsterSprite('dragon_boss');

// Discord embed integration
const embed = new EmbedBuilder()
  .setThumbnail(iconUrl)
  .setTitle('Épée Légendaire du Dragon')
  .setColor(AssetManager.getRarityColor('legendary')); // Orange/gold
```

### 🎨 Rarity color system

```typescript
const rarityColors = {
  common: '#9D9D9D',     // Gray
  uncommon: '#1EFF00',   // Green
  rare: '#0099CC',       // Blue  
  epic: '#CC00FF',       // Purple
  legendary: '#FF8000'   // Orange/Gold
};
```

### Example command usage

```typescript
import { AssetManager } from '../utils/assetManager';
import { EmbedBuilder } from 'discord.js';

// Get a legendary sword icon
const swordIcon = AssetManager.getItemIcon('weapons', 'sword', 'legendary');

// Create embed with the icon
const embed = new EmbedBuilder()
  .setTitle('⚔️ Legendary Dragon Sword')
  .setDescription('A mighty blade forged in dragon fire!')
  .setColor(AssetManager.getRarityColor('legendary'))
  .setThumbnail(swordIcon);

await interaction.reply({ embeds: [embed] });
```

## Discord upload method (advanced)

Host assets on Discord's CDN for free:

1. Create a private channel in your server
2. Upload all your assets there
3. Right-click → Copy Link
4. Use those CDN URLs in your bot

**Benefits:** Free hosting, fast loading, no local files needed

## Attribution & licenses

If you use CC-BY assets, maintain attribution here:

### 🎨 Current assets

```markdown
<!-- Format example:
Asset Name - Artist - License - Source URL
health_potion_common.png - Kenney - CC0 - https://kenney.nl/assets/rpg-pack
warrior_portrait.png - Artist Name - CC-BY 3.0 - https://opengameart.org/...
-->

🚧 Assets to add - See TODO section below
```

## Tasks & priorities

### 🔥 High priority (week 1)

- [ ] **Character classes** (6 portraits + 6 avatars)
  - [ ] Warrior male/female portraits (256x256)
  - [ ] Mage male/female portraits (256x256)  
  - [ ] Rogue, Merchant, Bard, Paladin portraits
  - [ ] 6 corresponding Discord avatars (64x64)

- [ ] **Basic equipment** (15-20 items)
  - [ ] 5 main weapons (sword, staff, dagger, bow, hammer)
  - [ ] 5 armor pieces (helmet, chestplate, gloves, boots, shield)
  - [ ] 5 accessories (ring, amulet, cape, belt, pouch)

### 🎯 Medium priority (week 2)

- [ ] **Consumables & casino** (10-15 items)
  - [ ] 5 potions (health, mana, luck, strength, speed)
  - [ ] 5 casino items (luck coin, golden dice, lucky card)

- [ ] **Casino Activity UI** (20-30 elements)
  - [ ] Buttons (join, bet, quit)
  - [ ] Tables (Blackjack, Roulette, slot machines)
  - [ ] Cards and chips
  - [ ] Visual effects (wins, jackpot, level-up)

### 🔮 Low priority (week 3+)

- [ ] **PvE monsters** (future combat system)
- [ ] **Advanced animations** (sprite sheets)
- [ ] **Themed backgrounds** (tavern, casino)
- [ ] **Particles and effects** (magic, celebrations)

## Tips for managing assets

### Start small

Don't try to download everything at once:

1. ✅ Get 5-10 weapon icons
2. ✅ Get 5 potion icons
3. ✅ Get 3-5 armor pieces
4. ✅ Test in Discord bot
5. ✅ Expand as needed

## Important constraints

- **Discord testing:** Test all assets in Discord embeds before committing
- **Stylistic consistency:** Maintain uniform style throughout the project
- **Web performance:** Compress assets for Discord Activity (fast loading)
- **Backup:** Keep high-quality sources separately
- **Versioning:** Commit assets in logical batches (by theme/rarity)

## Getting help

Check these resources:
- Asset manager utility code (when implemented)
- Asset helper scripts (when implemented)
- This documentation for all specifications

**🎨 Ready to bring La Taverne Dorée to life!**  
*From pixels to experience, every detail counts*
