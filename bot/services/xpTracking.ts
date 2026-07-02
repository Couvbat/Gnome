import { Client, Events, Message, VoiceState } from 'discord.js';
import { userLevelsDb } from '../database/db';

// Track users in voice channels (userId -> { guildId, joinTime })
const voiceActivityTracker = new Map<string, { guildId: string; joinTime: number }>();

// Cooldown for message XP (prevent spam)
const messageXpCooldowns = new Map<string, number>();
const MESSAGE_XP_COOLDOWN = 30000; // 30 seconds

/**
 * Initialize XP tracking for messages and voice activity
 */
export function initXpTracking(client: Client): void {
  // Track message XP
  client.on(Events.MessageCreate, async (message: Message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guildId) return;

    const userId = message.author.id;
    const guildId = message.guildId;
    const cooldownKey = `${userId}-${guildId}`;

    // Check cooldown
    const lastMessageTime = messageXpCooldowns.get(cooldownKey) || 0;
    const now = Date.now();

    if (now - lastMessageTime < MESSAGE_XP_COOLDOWN) {
      return; // Still in cooldown
    }

    messageXpCooldowns.set(cooldownKey, now);

    try {
      // Award 15-25 XP per message (random for variety)
      const xpGain = Math.floor(Math.random() * 11) + 5;
      
      const result = await userLevelsDb.addXp(userId, guildId, xpGain);

      // Update message count
      await userLevelsDb.upsert({
        userId,
        guildId,
        totalMessages: (result.totalMessages || 0) + 1,
        lastMessageTimestamp: now,
      });

      // Check if user leveled up
      if (result.leveledUp) {
        // Award coins for leveling up (50 coins per level)
        const coinsReward = result.level * 50;
        
        try {
          await userLevelsDb.addCoins(userId, guildId, coinsReward);
          console.log(`[XP] ${message.author.username} leveled up to ${result.level} and earned ${coinsReward} coins`);
        } catch (coinError) {
          console.error(`[XP Tracking] Error awarding coins for level up: ${coinError}`);
        }

        // Send level up message with better error handling
        try {
          if (message.channel && 'send' in message.channel && message.channel.isTextBased()) {
            await message.channel.send(
              `🎉 Félicitations <@${userId}> ! Tu viens d'atteindre le niveau **${result.level}** ! 🎉\n💰 Tu gagnes **${coinsReward}** pièces !`
            );
          } else {
            console.log(`[XP] Level up message not sent - channel type: ${message.channel?.type || 'unknown'}`);
          }
        } catch (messageError) {
          console.error(`[XP Tracking] Error sending level up message: ${messageError}`);
        }
      }
    } catch (error) {
      console.error('[XP Tracking] Error adding message XP:', error);
    }
  });

  // Track voice activity
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const userId = newState.id;
    const guildId = newState.guild.id;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      voiceActivityTracker.set(userId, {
        guildId,
        joinTime: Date.now(),
      });
      console.log(`[XP] ${newState.member?.user.username} joined voice channel`);
    }

    // User left a voice channel
    if (oldState.channelId && !newState.channelId) {
      const activity = voiceActivityTracker.get(userId);
      
      if (activity) {
        const timeInVoice = Date.now() - activity.joinTime;
        const minutesInVoice = Math.floor(timeInVoice / 60000);

        if (minutesInVoice > 0) {
          try {
            // Award 5 XP per minute in voice
            const xpGain = minutesInVoice * 5;
            
            const result = await userLevelsDb.addXp(userId, guildId, xpGain);

            // Update voice time
            await userLevelsDb.upsert({
              userId,
              guildId,
              totalVoiceMinutes: (result.totalVoiceMinutes || 0) + minutesInVoice,
              lastVoiceTimestamp: Date.now(),
            });

            console.log(`[XP] ${newState.member?.user.username} earned ${xpGain} XP from ${minutesInVoice} minutes in voice`);

            // Check if user leveled up
            if (result.leveledUp) {
              // Award coins for leveling up (50 coins per level)
              const coinsReward = result.level * 50;
              
              try {
                await userLevelsDb.addCoins(userId, guildId, coinsReward);
                console.log(`[XP] ${newState.member?.user.username} leveled up to ${result.level} from voice activity and earned ${coinsReward} coins`);
              } catch (coinError) {
                console.error(`[XP Tracking] Error awarding coins for voice level up: ${coinError}`);
              }

              // Try to send message in a text channel with better error handling
              try {
                const guild = newState.guild;
                const channel = guild.channels.cache.find(ch => 
                  (ch.name === 'general' || ch.name === 'général') && ch.isTextBased()
                ) || guild.channels.cache.find(ch => ch.isTextBased());

                if (channel && channel.isTextBased()) {
                  await channel.send(
                    `🎉 Félicitations <@${userId}> ! Tu viens d'atteindre le niveau **${result.level}** ! 🎉\n💰 Tu gagnes **${coinsReward}** pièces !`
                  );
                } else {
                  console.log(`[XP] Voice level up message not sent - no suitable text channel found`);
                }
              } catch (messageError) {
                console.error(`[XP Tracking] Error sending voice level up message: ${messageError}`);
              }
            }
          } catch (error) {
            console.error('[XP Tracking] Error adding voice XP:', error);
          }
        }

        voiceActivityTracker.delete(userId);
      }
    }

    // User switched channels (optional: don't reset timer)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      // Keep the same join time, user is still in voice
      console.log(`[XP] ${newState.member?.user.username} switched voice channels`);
    }
  });

  // Periodic cleanup for memory management
  const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
  setInterval(() => {
    try {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      let cleanedCooldowns = 0;
      let cleanedVoiceTrackers = 0;

      // Clean up old message XP cooldowns (older than 1 hour)
      messageXpCooldowns.forEach((timestamp, key) => {
        if (timestamp < oneHourAgo) {
          messageXpCooldowns.delete(key);
          cleanedCooldowns++;
        }
      });

      // Clean up stale voice activity trackers (users who've been tracked for more than 6 hours)
      const sixHoursAgo = now - 6 * 60 * 60 * 1000;
      voiceActivityTracker.forEach((data, userId) => {
        if (data.joinTime < sixHoursAgo) {
          voiceActivityTracker.delete(userId);
          cleanedVoiceTrackers++;
        }
      });

      if (cleanedCooldowns > 0 || cleanedVoiceTrackers > 0) {
        console.log(`[XP Tracking] Cleanup: removed ${cleanedCooldowns} old cooldowns and ${cleanedVoiceTrackers} stale voice trackers`);
      }
    } catch (error) {
      console.error('[XP Tracking] Error during cleanup:', error);
    }
  }, CLEANUP_INTERVAL);

  console.log('[XP Tracking] Message and voice XP tracking initialized');
}
