# Gnome Discord Bot

Un bot Discord avec intégration Mistral AI et fonctionnalités vocales.

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone <repo-url>
   cd gnome
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration**
   
   Copier `.env.example` vers `.env` et remplir avec vos clés:
   ```bash
   cp .env.example .env
   ```
   
   Éditer `.env`:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_GUILD_ID=your_guild_id
   MISTRAL_API_KEY=your_mistral_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Déployer les commandes**
   ```bash
   node deploy-commands.js
   ```

5. **Lancer le bot**
   ```bash
   node index.js
   ```

## Commandes

- `/ping` - Test de latence
- `/echo` - Répète un message
- `/user` - Informations sur l'utilisateur
- `/server` - Informations sur le serveur
- `/mistral` - Question simple à Mistral AI
- `/conversation` - Conversation multi-tours avec Mistral AI dans un thread
- `/listen` - Écouter un salon vocal et transcrire (nécessite OpenAI API)

## Fonctionnalités

### IA Conversationnelle
- Intégration Mistral AI pour réponses intelligentes
- Mode conversation avec historique dans des threads
- Personnalité "Le Gnome" (amical mais sarcastique)

### Vocal
- Rejoindre les salons vocaux
- Transcrire la parole en temps réel (Whisper API)
- Détection automatique de début/fin de parole

## Structure

```
gnome/
├── commands/
│   └── utility/        # Commandes slash
├── .env                # Configuration (gitignored)
├── .env.example        # Template de configuration
├── index.js            # Point d'entrée du bot
└── deploy-commands.js  # Script de déploiement des commandes
```

## Développement

Voir `.github/copilot-instructions.md` pour les conventions et patterns du projet.
