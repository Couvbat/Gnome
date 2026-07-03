import { SlashCommandBuilder, CommandInteraction, GuildMember, TextChannel } from "discord.js";
import {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
  VoiceConnection,
  VoiceReceiver,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  AudioPlayer,
} from "@discordjs/voice";
import { request } from "undici";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Command } from "../types/command";

// Lazy-load heavy dependencies only when needed
let ffmpegPath: string | null = null;
let prism: any = null;

function getFFmpegPath(): string {
  if (!ffmpegPath) {
    ffmpegPath = require("ffmpeg-static");
  }
  return ffmpegPath as string;
}

function getPrism(): any {
  if (!prism) {
    prism = require("prism-media");
  }
  return prism;
}

interface ConnectionData {
  connection: VoiceConnection;
  receiver: VoiceReceiver;
  channel: TextChannel;
  conversationHistory: MistralMessage[];
  audioPlayer: AudioPlayer;
  // Serializes processing (transcription + Mistral + TTS) of overlapping
  // speaking events for this guild, one at a time — mirrors the pattern used
  // in commands/conversation.ts. Without this, two users speaking around the
  // same time can race on conversationHistory and the shared audioPlayer.
  processingChain: Promise<void>;
}

interface WhisperResponse {
  text?: string;
}

interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Store active voice connections
const activeConnections = new Map<string, ConnectionData>();

// Configuration for audio processing
const TEMP_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
const TEMP_FILE_MAX_AGE = 60 * 60 * 1000; // 1 hour

// Hard cap on a single utterance's recording length, independent of silence
// detection. Without this, a stuck stream (or someone who just never stops
// talking) can hold the capture pipeline open indefinitely.
const MAX_RECORDING_DURATION_MS = 90 * 1000; // 90 seconds

// Cleanup old temp files periodically
setInterval(() => {
  try {
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) return;

    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (file.startsWith('voice_') || file.startsWith('tts_')) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        // Delete files older than 1 hour
        if (fileAge > TEMP_FILE_MAX_AGE) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`[Listen] Cleaned up ${deletedCount} old temp audio files`);
    }
  } catch (error) {
    console.error('[Listen] Error during temp file cleanup:', error);
  }
}, TEMP_CLEANUP_INTERVAL);

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("listen")
    .setDescription(
      "Discute avec le Gnome dans un salon vocal."
    )
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action à effectuer")
        .setRequired(true)
        .addChoices(
          { name: "Démarrer", value: "start" },
          { name: "Arrêter", value: "stop" }
        )
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    // CRITICAL: Defer IMMEDIATELY before ANY type checking or logic
    // This MUST be the first line to avoid 3-second timeout
    try {
      await interaction.deferReply();
    } catch (error) {
      console.error('[Listen] Failed to defer reply:', error);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const action = interaction.options.getString("action", true);
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.editReply({
        content: "Cette commande doit être utilisée dans un serveur.",
      });
      return;
    }

    if (action === "stop") {
      await stopListening(interaction, guildId);
      return;
    }

    // Check if user is in a voice channel
    const member = interaction.member as GuildMember | null;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      await interaction.editReply({
        content:
          "Tu dois être dans un salon vocal pour que je puisse t'écouter !",
      });
      return;
    }

    // Check if already listening in this guild
    if (activeConnections.has(guildId)) {
      await interaction.editReply({
        content: "Je suis déjà en train d'écouter dans ce serveur !",
      });
      return;
    }

    try {
      // Join the voice channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator as any,
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
        console.log(`[Listen] Disconnected from voice channel in guild ${guildId}`);
        // Clean up event listeners to prevent memory leaks
        const connectionData = activeConnections.get(guildId);
        if (connectionData) {
          connectionData.connection.removeAllListeners();
          connectionData.receiver.speaking.removeAllListeners();
          connectionData.audioPlayer.stop();
          connectionData.audioPlayer.removeAllListeners();
        }
        activeConnections.delete(guildId);
        console.log(`[Listen] Removed connection data for guild ${guildId}`);
      });

      connection.on("error", (error: Error) => {
        console.error(`[Listen] Voice connection error in guild ${guildId}:`, error);
        // Clean up event listeners to prevent memory leaks
        const connectionData = activeConnections.get(guildId);
        if (connectionData) {
          connectionData.connection.removeAllListeners();
          connectionData.receiver.speaking.removeAllListeners();
          connectionData.audioPlayer.stop();
          connectionData.audioPlayer.removeAllListeners();
        }
        activeConnections.delete(guildId);
        console.log(`[Listen] Removed connection data for guild ${guildId} due to error`);
      });

      // Access the receiver
      const receiver = connection.receiver;

      // Create audio player for TTS responses
      const audioPlayer = createAudioPlayer();
      connection.subscribe(audioPlayer);

      // Handle audio player events
      audioPlayer.on(AudioPlayerStatus.Playing, () => {
        console.log(`[Listen] Audio player started playing in guild ${guildId}`);
      });

      audioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log(`[Listen] Audio player finished playing in guild ${guildId}`);
      });

      audioPlayer.on("error", (error) => {
        console.error(`[Listen] Audio player error in guild ${guildId}:`, error);
      });

      // Store connection info - ensure we have a valid text channel
      if (!interaction.channel || !("send" in interaction.channel)) {
        connection.destroy();
        await interaction.editReply({
          content: "Impossible d'accéder au canal pour envoyer les transcriptions. Utilise cette commande dans un canal textuel.",
        });
        return;
      }

      // Re-check for a race right before claiming the guild slot. The initial
      // check (above) happens before all of the async/setup work above it, so
      // two near-simultaneous /listen start invocations can both pass it and
      // both get this far. Whichever call wins this second check keeps its
      // connection; the loser tears down the one it just built instead of
      // clobbering the winner's entry (which would leak the winner's voice
      // connection — it'd stay connected but no longer be tracked/stoppable).
      if (activeConnections.has(guildId)) {
        console.warn(`[Listen] Lost the join race for guild ${guildId}; another invocation is already listening. Cleaning up.`);
        connection.removeAllListeners();
        audioPlayer.removeAllListeners();
        connection.destroy();
        await interaction.editReply({
          content: "Je suis déjà en train d'écouter dans ce serveur !",
        });
        return;
      }

      activeConnections.set(guildId, {
        connection,
        receiver,
        channel: interaction.channel as TextChannel,
        audioPlayer,
        processingChain: Promise.resolve(),
        conversationHistory: [
          {
            role: "system",
            content: `Tu es "Le Gnome", un bot Discord dans "La zone". Tu réponds de manière concise et directe aux messages vocaux. Tu peux aider avec les jeux vidéos (surtout LoL), le développement web, les IA, la musique, et tu gères un système de pièces/niveaux/paris. Reste amical mais avec un sarcasme léger. Évite les réponses trop longues.`,
          },
        ],
      });

      console.log(`[Listen] Stored connection for guild ${guildId}, channel ${interaction.channel.id}`);

      // Listen to speaking events
      receiver.speaking.on("start", (userId: string) => {
        console.log(`[Listen] User ${userId} started speaking in guild ${guildId}`);

        // Create temp directory inside bot folder if needed
        const tempDir = path.join(__dirname, "../temp");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const pcmFile = path.join(tempDir, `voice_${userId}_${timestamp}.pcm`);
        const outputFile = path.join(tempDir, `voice_${userId}_${timestamp}.ogg`);

        // Subscribe to their audio stream (raw Opus packets)
        const opusStream = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000, // 1 second of silence before ending stream (increased from 300ms)
          },
        });

        console.log(`[Listen] Subscribed to audio stream for user ${userId}, decoding to PCM: ${pcmFile}`);

        // Force-stop capture even if silence detection never fires (e.g. the
        // user never stops talking, or leaves the mic open), so a single
        // utterance can't hold the pipeline open indefinitely.
        const maxDurationTimer = setTimeout(() => {
          console.log(`[Listen] Max recording duration (${MAX_RECORDING_DURATION_MS}ms) reached for user ${userId}, forcing stream to end`);
          opusStream.destroy();
        }, MAX_RECORDING_DURATION_MS);
        opusStream.once('close', () => clearTimeout(maxDurationTimer));

        // Lazy-load prism-media only when needed (avoids slow startup)
        const PrismMedia = getPrism();

        // Decode Opus to PCM using prism-media
        const decoder = new PrismMedia.opus.Decoder({
          rate: 48000,  // Discord uses 48kHz
          channels: 2,  // Discord uses stereo
          frameSize: 960
        });

        // Write PCM data to file
        const writeStream = fs.createWriteStream(pcmFile);
        let bytesReceived = 0;
        let chunkCount = 0;

        decoder.on('data', (pcmChunk: Buffer) => {
          bytesReceived += pcmChunk.length;
          chunkCount++;
          // Log every 50 chunks instead of every chunk to reduce spam
          if (chunkCount % 50 === 0) {
            console.log(`[Listen] Decoded ${chunkCount} PCM chunks (total: ${bytesReceived} bytes)`);
          }
        });

        decoder.on('error', (error: Error) => {
          console.error(`[Listen] Decoder error:`, error);
        });

        writeStream.on('error', (error) => {
          console.error(`[Listen] Write stream error:`, error);
        });

        // Pipe: Opus stream → Decoder → File
        opusStream.pipe(decoder).pipe(writeStream);

        // When decoding is complete, queue the heavy processing (transcription,
        // Mistral, TTS playback) behind any other utterance already in flight
        // for this guild. Recording itself can happen concurrently for
        // multiple speakers, but the shared conversation history array and the
        // shared AudioPlayer must only ever be touched by one utterance's
        // processing at a time — otherwise overlapping speaking events race on
        // both.
        writeStream.on('finish', () => {
          clearTimeout(maxDurationTimer);
          console.log(`[Listen] PCM decode finished for user ${userId}, total bytes: ${bytesReceived}`);

          const connectionData = activeConnections.get(guildId);
          if (!connectionData) {
            // Connection was torn down while we were recording; just clean up.
            if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
            return;
          }

          connectionData.processingChain = connectionData.processingChain
            .then(() => processRecordedAudio(guildId, userId, pcmFile, outputFile, bytesReceived, interaction))
            .catch((err) => console.error('[Listen] Error in speaking processing chain:', err));
        });
      });

      receiver.speaking.on("end", (userId: string) => {
        console.log(`User ${userId} stopped speaking (speaking event)`);
      });

      await interaction.editReply({
        content: `✅ Je suis maintenant dans <#${voiceChannel.id}> et j'écoute !
        
🎤 Parle dans le salon et j'aurai une conversation vocale avec toi.
🤖 Je transcrirai tes paroles, te répondrai via Mistral AI, et parlerai ma réponse !
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

  cooldown: 10,
};

/**
 * Convert raw PCM audio to optimized OGG/Opus format for Whisper API
 * Takes the decoded PCM from Discord voice and converts it to a format Whisper prefers
 */
async function convertPcmToWhisperFormat(inputPath: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ffmpegBinary = getFFmpegPath();
    if (!ffmpegBinary) {
      console.error('[Listen] ffmpeg-static path not found');
      reject(new Error('ffmpeg not available'));
      return;
    }

    console.log(`[Listen] Converting ${inputPath} (PCM) to Whisper-optimized format: ${outputPath}`);

    // Input is raw PCM: 48kHz, stereo (2 channels), signed 16-bit little-endian
    const ffmpeg = spawn(ffmpegBinary, [
      '-f', 's16le',             // Input format: signed 16-bit little-endian PCM
      '-ar', '48000',            // Input sample rate: 48kHz (Discord default)
      '-ac', '2',                // Input channels: stereo
      '-i', inputPath,           // Input file
      '-ar', '16000',            // Whisper prefers 16kHz sample rate
      '-ac', '1',                // Convert to mono (Whisper works better with mono)
      '-c:a', 'libopus',         // Encode with Opus codec
      '-b:a', '64k',             // Bitrate: 64kbps (good quality for speech)
      '-vbr', 'on',              // Variable bitrate
      '-compression_level', '10', // Maximum compression
      '-f', 'ogg',               // Output format OGG container
      '-y',                      // Overwrite output file if exists
      outputPath                 // Output file
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`[Listen] Audio conversion successful`);
        resolve(true);
      } else {
        console.error(`[Listen] ffmpeg conversion failed with code ${code}`);
        console.error(`[Listen] ffmpeg stderr: ${stderr}`);
        resolve(false); // Return false instead of rejecting to handle gracefully
      }
    });

    ffmpeg.on('error', (error) => {
      console.error(`[Listen] ffmpeg process error:`, error);
      resolve(false); // Return false instead of rejecting
    });
  });
}

async function stopListening(
  interaction: CommandInteraction,
  guildId: string
): Promise<void> {
  console.log(`[Listen] Stop requested for guild ${guildId}, active connections: ${Array.from(activeConnections.keys()).join(', ')}`);
  
  const connectionData = activeConnections.get(guildId);

  if (!connectionData) {
    await interaction.editReply({
      content: "Je ne suis pas en train d'écouter dans ce serveur.",
    });
    return;
  }

  try {
    // Stop audio player and remove all event listeners before destroying to prevent memory leaks
    connectionData.audioPlayer.stop();
    connectionData.audioPlayer.removeAllListeners();
    connectionData.connection.removeAllListeners();
    connectionData.receiver.speaking.removeAllListeners();
    
    connectionData.connection.destroy();
    activeConnections.delete(guildId);

    await interaction.editReply({
      content: "✅ J'ai quitté le salon vocal et arrêté l'écoute.",
    });
  } catch (error) {
    console.error("Error stopping voice connection:", error);
    // Still try to clean up
    activeConnections.delete(guildId);
    await interaction.editReply({
      content: "Une erreur est survenue en quittant le salon vocal.",
    });
  }
}

/**
 * Validate, transcribe, and respond to one recorded utterance. This is the
 * "heavy" part of the pipeline (touches the shared conversation history and
 * the shared AudioPlayer for the guild), so callers must always run it
 * through a guild's `processingChain` rather than calling it directly —
 * otherwise overlapping speaking events can interleave their Mistral calls
 * and audio playback.
 */
async function processRecordedAudio(
  guildId: string,
  userId: string,
  pcmFile: string,
  outputFile: string,
  bytesReceived: number,
  interaction: CommandInteraction
): Promise<void> {
  // Check if file exists and has content
  if (!fs.existsSync(pcmFile)) {
    console.log(`[Listen] PCM file does not exist: ${pcmFile}`);
    return;
  }

  const fileStats = fs.statSync(pcmFile);
  console.log(`[Listen] PCM file size: ${fileStats.size} bytes`);

  // Check if we have enough audio data for meaningful speech
  // 48kHz stereo 16-bit PCM = 192,000 bytes/second
  // Minimum 1 second of audio = 192KB
  const minBytes = 192000; // 1 second
  if (fileStats.size < minBytes) {
    console.log(`[Listen] PCM file too small (${fileStats.size} bytes, need ${minBytes}), likely just noise or short sound. Ignoring.`);
    if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
    return;
  }

  try {
    // Get user info
    const user = await interaction.client.users.fetch(userId);
    console.log(`[Listen] Processing audio from ${user.username} (${bytesReceived} bytes decoded)`);

    // Convert PCM to OGG/Opus optimized for Whisper
    const conversionSuccess = await convertPcmToWhisperFormat(pcmFile, outputFile);

    if (!conversionSuccess) {
      console.error(`[Listen] Audio conversion failed for user ${userId}`);
      // Clean up temp files
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      return;
    }

    // Verify the output file exists and has reasonable size
    if (!fs.existsSync(outputFile)) {
      console.error(`[Listen] Converted OGG file does not exist: ${outputFile}`);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
      return;
    }

    const oggStats = fs.statSync(outputFile);
    console.log(`[Listen] Converted OGG file size: ${oggStats.size} bytes`);

    // Check if converted file is too small (likely corrupted or just noise)
    if (oggStats.size < 2000) {
      console.log(`[Listen] Converted audio file too small (${oggStats.size} bytes), likely corrupted or just noise. Ignoring.`);
      if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
      if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      return;
    }

    // Transcribe with OpenAI Whisper using OGG file
    const transcription = await transcribeAudio(outputFile);

    // Clean up temp files
    if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

    console.log(`[Listen] Transcription result for ${user.username}: ${transcription ? `"${transcription}"` : 'null/empty'}`);

    if (!transcription) return;

    // Re-fetch the connection data — some time has passed since we started,
    // and it's the shared, mutable state this function's caller is
    // serializing access to via the per-guild processing chain.
    const connectionData = activeConnections.get(guildId);
    if (!connectionData) return;

    // Show transcription
    await connectionData.channel.send(
      `🎤 **${user.username}** : "${transcription}"`
    );

    // Get AI response
    const aiResponse = await getMistralResponse(transcription, connectionData);

    console.log(`[Listen] Mistral response for "${transcription}": ${aiResponse ? `"${aiResponse.substring(0, 100)}..."` : 'null/empty'}`);

    if (!aiResponse) return;

    // Show AI response in text
    await connectionData.channel.send(`🤖 **Le Gnome** : ${aiResponse}`);

    // Generate TTS audio and play it in voice channel
    const ttsAudioPath = await generateTTS(aiResponse, guildId);
    if (!ttsAudioPath) return;

    try {
      const resource = createAudioResource(ttsAudioPath);
      connectionData.audioPlayer.play(resource);
      console.log(`[Listen] Playing TTS response in guild ${guildId}`);

      // Clean up TTS file after playback finishes
      connectionData.audioPlayer.once(AudioPlayerStatus.Idle, () => {
        try {
          if (fs.existsSync(ttsAudioPath)) {
            fs.unlinkSync(ttsAudioPath);
            console.log(`[Listen] Cleaned up TTS file: ${ttsAudioPath}`);
          }
        } catch (err) {
          console.error(`[Listen] Error cleaning up TTS file:`, err);
        }
      });
    } catch (error) {
      console.error(`[Listen] Error playing TTS audio:`, error);
      // Clean up on error
      if (fs.existsSync(ttsAudioPath)) {
        fs.unlinkSync(ttsAudioPath);
      }
    }
  } catch (error) {
    console.error("Error processing audio:", error);
    // Clean up on error
    if (fs.existsSync(pcmFile)) fs.unlinkSync(pcmFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  }
}

async function transcribeAudio(audioFilePath: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured");
    return null;
  }

  try {
    console.log(`[Whisper] Starting transcription for file: ${audioFilePath}`);
    
    // Read the audio file
    const audioFile = fs.readFileSync(audioFilePath);
    console.log(`[Whisper] Audio file read, size: ${audioFile.length} bytes`);

    // Determine file extension and MIME type
    const fileExt = path.extname(audioFilePath).toLowerCase();
    const mimeType = fileExt === '.ogg' ? 'audio/ogg' : 'audio/opus';
    const fileName = `audio${fileExt}`;

    console.log(`[Whisper] File type: ${fileName} (${mimeType})`);

    // Create form data for the API request
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([audioFile as any], { type: mimeType }),
      fileName
    );
    formData.append("model", "whisper-1");
    formData.append("language", "fr"); // French language

    console.log(`[Whisper] Sending request to OpenAI API...`);
    
    const response = await request(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData as any,
      }
    );

    console.log(`[Whisper] Response status code: ${response.statusCode}`);

    if (response.statusCode !== 200) {
      const errorBody = await response.body.text();
      console.error(`[Whisper] API error (${response.statusCode}): ${errorBody}`);
      return null;
    }

    const data = (await response.body.json()) as WhisperResponse;
    console.log(`[Whisper] Transcription successful: "${data.text}"`);
    
    // Common Whisper hallucinations when audio is empty/corrupted
    const hallucinations = [
      'Sous-titres réalisés para la communauté d\'Amara.org',
      'Sous-titrage ST\' 501',
      'Merci d\'avoir regardé cette vidéo',
      'Merci de nous suivre',
      'Transcription par',
      'sous-titres',
      'Thanks for watching',
      'Subscribe',
      'Like and subscribe',
    ];

    // Check if transcription is a hallucination (case-insensitive)
    if (data.text) {
      const lowerText = data.text.toLowerCase();
      const isHallucination = hallucinations.some(phrase => 
        lowerText.includes(phrase.toLowerCase())
      );

      if (isHallucination) {
        console.log(`[Whisper] Detected hallucination, ignoring: "${data.text}"`);
        return null;
      }

      // Also check for very short transcriptions (likely noise)
      if (data.text.trim().length < 3) {
        console.log(`[Whisper] Transcription too short (${data.text.trim().length} chars), ignoring: "${data.text}"`);
        return null;
      }
    }
    
    return data.text || null;
  } catch (error) {
    console.error("Error transcribing audio with Whisper:", error);
    if (error instanceof Error) {
      console.error(`[Whisper] Error details: ${error.message}`);
      console.error(`[Whisper] Stack trace:`, error.stack);
    }
    return null;
  }
}

async function getMistralResponse(
  userMessage: string,
  connectionData: ConnectionData
): Promise<string | null> {
  if (!process.env.MISTRAL_API_KEY) {
    console.error("[Listen] Mistral API key not configured");
    return null;
  }

  try {
    // Add user message to conversation history
    connectionData.conversationHistory.push({
      role: "user",
      content: userMessage,
    });

    // Make the Mistral API request
    const response = await request(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: connectionData.conversationHistory,
          temperature: 0.7,
          top_p: 1,
          max_tokens: 2048,
        }),
      }
    );

    // Check for errors
    if (response.statusCode === 429) {
      console.warn("[Listen] Mistral API rate limit hit");
      return "⏱️ Trop de requêtes. Attends un peu.";
    }

    if (response.statusCode !== 200) {
      console.error(`[Listen] Mistral API error: ${response.statusCode}`);
      return null;
    }

    // Parse the response
    const body = (await response.body.json()) as MistralResponse;

    if (!body.choices || !body.choices[0]?.message?.content) {
      console.error("[Listen] Invalid response structure from Mistral API");
      return null;
    }

    const reply = body.choices[0].message.content;

    // Add assistant response to conversation history
    connectionData.conversationHistory.push({
      role: "assistant",
      content: reply,
    });

    // Keep conversation history manageable (last 20 messages + system prompt)
    if (connectionData.conversationHistory.length > 21) {
      connectionData.conversationHistory = [
        connectionData.conversationHistory[0], // Keep system prompt
        ...connectionData.conversationHistory.slice(-20), // Keep last 20 messages
      ];
    }

    console.log(`[Listen] Generated AI response, history size: ${connectionData.conversationHistory.length}`);
    return reply;
  } catch (error) {
    console.error("[Listen] Error getting Mistral response:", error);
    return null;
  }
}

async function generateTTS(text: string, guildId: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[Listen] OpenAI API key not configured for TTS");
    return null;
  }

  try {
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `tts_${guildId}_${timestamp}.mp3`);

    console.log(`[Listen] Generating TTS for text: "${text.substring(0, 50)}..."`);

    // Call OpenAI TTS API
    const response = await request("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "onyx", // Options: alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 1.0,
      }),
    });

    if (response.statusCode !== 200) {
      console.error(`[Listen] OpenAI TTS API error: ${response.statusCode}`);
      return null;
    }

    // Write the audio data to file
    const audioBuffer = Buffer.from(await response.body.arrayBuffer());
    fs.writeFileSync(outputPath, audioBuffer);

    console.log(`[Listen] TTS audio saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("[Listen] Error generating TTS:", error);
    return null;
  }
}

// For backward compatibility with CommonJS
module.exports = command;
