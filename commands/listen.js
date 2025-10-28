const { SlashCommandBuilder } = require("discord.js");
const {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
} = require("@discordjs/voice");
const { request } = require("undici");
const fs = require("node:fs");
const path = require("node:path");

// Store active voice connections
const activeConnections = new Map();

module.exports = {
  cooldown: "10", // 10 seconds cooldown
  data: new SlashCommandBuilder()
    .setName("listen")
    .setDescription(
      "Rejoindre un salon vocal et écouter les utilisateurs qui parlent"
    )
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action à effectuer")
        .setRequired(true)
        .addChoices(
          { name: "Démarrer l'écoute", value: "start" },
          { name: "Arrêter l'écoute", value: "stop" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const action = interaction.options.getString("action");
    const guildId = interaction.guildId;

    if (action === "stop") {
      return await stopListening(interaction, guildId);
    }

    // Check if user is in a voice channel
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return await interaction.editReply({
        content:
          "Tu dois être dans un salon vocal pour que je puisse t'écouter !",
      });
    }

    // Check if already listening in this guild
    if (activeConnections.has(guildId)) {
      return await interaction.editReply({
        content: "Je suis déjà en train d'écouter dans ce serveur !",
      });
    }

    try {
      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false, // CRITICAL: Must be false to receive audio
        selfMute: false,
      });

      // Wait for connection to be ready
      connection.on(VoiceConnectionStatus.Ready, () => {
        console.log(
          `Connected to voice channel in guild ${guildId}, ready to receive audio`
        );
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`Disconnected from voice channel in guild ${guildId}`);
        activeConnections.delete(guildId);
      });

      connection.on("error", (error) => {
        console.error(`Voice connection error in guild ${guildId}:`, error);
        activeConnections.delete(guildId);
      });

      // Access the receiver
      const receiver = connection.receiver;

      // Store connection info
      activeConnections.set(guildId, {
        connection,
        receiver,
        channel: interaction.channel,
      });

      // Listen to speaking events
      receiver.speaking.on("start", async (userId) => {
        console.log(`User ${userId} started speaking`);

        // Subscribe to their audio stream
        const audioStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 300, // 300ms of silence before ending stream
          },
        });

        // Collect audio chunks
        const audioChunks = [];
        audioStream.on("data", (chunk) => {
          audioChunks.push(chunk);
        });

        // When user stops speaking, process the audio
        audioStream.on("end", async () => {
          console.log(
            `User ${userId} stopped speaking, collected ${audioChunks.length} audio chunks`
          );

          if (audioChunks.length === 0) {
            return; // No audio to process
          }

          try {
            // Get user info
            const user = await interaction.client.users.fetch(userId);
            console.log(`Processing audio from ${user.username}`);

            // Combine all audio chunks into a single buffer
            const audioBuffer = Buffer.concat(audioChunks);

            // Save temporarily (Opus format)
            const tempDir = path.join(__dirname, "../../temp");
            if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const tempFile = path.join(
              tempDir,
              `voice_${userId}_${timestamp}.opus`
            );
            fs.writeFileSync(tempFile, audioBuffer);

            console.log(`Saved audio to ${tempFile}, sending to Whisper API`);

            // Transcribe with OpenAI Whisper
            const transcription = await transcribeAudio(tempFile);

            // Clean up temp file
            fs.unlinkSync(tempFile);

            if (transcription) {
              // Send transcription to channel
              const connectionData = activeConnections.get(guildId);
              if (connectionData) {
                await connectionData.channel.send(
                  `🎤 **${user.username}** a dit : "${transcription}"`
                );
              }
            }
          } catch (error) {
            console.error("Error processing audio:", error);
          }
        });

        audioStream.on("error", (error) => {
          console.error(`Audio stream error for user ${userId}:`, error);
        });
      });

      receiver.speaking.on("end", (userId) => {
        console.log(`User ${userId} stopped speaking (speaking event)`);
      });

      await interaction.editReply({
        content: `✅ Je suis maintenant dans <#${voiceChannel.id}> et j'écoute !
        
🎤 Parle dans le salon et je transcrirai ce que tu dis.
💡 Utilise \`/listen stop\` pour arrêter l'écoute.`,
      });
    } catch (error) {
      console.error("Error joining voice channel:", error);
      activeConnections.delete(guildId);
      await interaction.editReply({
        content:
          "Une erreur est survenue en rejoignant le salon vocal. Vérifie que j'ai les permissions nécessaires !",
      });
    }
  },
};

async function stopListening(interaction, guildId) {
  const connectionData = activeConnections.get(guildId);

  if (!connectionData) {
    return await interaction.editReply({
      content: "Je ne suis pas en train d'écouter dans ce serveur.",
    });
  }

  try {
    connectionData.connection.destroy();
    activeConnections.delete(guildId);

    await interaction.editReply({
      content: "✅ J'ai quitté le salon vocal et arrêté l'écoute.",
    });
  } catch (error) {
    console.error("Error stopping voice connection:", error);
    await interaction.editReply({
      content: "Une erreur est survenue en quittant le salon vocal.",
    });
  }
}

async function transcribeAudio(audioFilePath) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured");
    return null;
  }

  try {
    // Read the audio file
    const audioFile = fs.readFileSync(audioFilePath);

    // Create form data for the API request
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioFile], { type: "audio/opus" }),
      "audio.opus"
    );
    formData.append("model", "whisper-1");
    formData.append("language", "fr"); // French language

    const response = await request(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    const data = await response.body.json();
    return data.text || null;
  } catch (error) {
    console.error("Error transcribing audio with Whisper:", error);
    return null;
  }
}
