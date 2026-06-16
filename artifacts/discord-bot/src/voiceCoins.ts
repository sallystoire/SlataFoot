import { type Client } from "discord.js";
import { db, usersTable, settingsTable } from "./db.js";
import { eq, isNotNull } from "drizzle-orm";

export function startVoiceCoinLoop(client: Client) {
  setInterval(async () => {
    try {
      const allSettings = await db.query.settingsTable.findMany();

      for (const settings of allSettings) {
        const guild = client.guilds.cache.get(settings.guildId);
        if (!guild) continue;

        const voiceUsers = await db.query.usersTable.findMany({
          where: isNotNull(usersTable.voiceJoinedAt),
        });

        for (const user of voiceUsers) {
          const member = guild.members.cache.get(user.discordId);
          if (!member?.voice.channelId) continue;

          const joinedAt = user.voiceJoinedAt;
          if (!joinedAt) continue;

          const minutesInVoice = (Date.now() - joinedAt.getTime()) / 1000 / 60;

          if (minutesInVoice < settings.voiceCoinsInterval) continue;

          let multiplier = 1;
          if (user.isStreaming && user.hasCamera) {
            multiplier = 2;
          } else if (user.isStreaming) {
            multiplier = 1.5;
          }

          const coinsToAdd = Math.floor(settings.voiceCoinsAmount * multiplier);
          const xpToAdd = 5;

          await db.update(usersTable).set({
            coins: user.coins + coinsToAdd,
            xp: user.xp + xpToAdd,
            voiceJoinedAt: new Date(),
          }).where(eq(usersTable.discordId, user.discordId));
        }
      }
    } catch (err) {
      console.error("[VoiceCoinLoop Error]", err);
    }
  }, 60 * 1000);
}
