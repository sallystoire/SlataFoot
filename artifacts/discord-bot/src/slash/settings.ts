import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "../db.js";
import { getOrCreateSettings } from "../utils/settings.js";

export async function slashSettings(i: ChatInputCommandInteraction) {
  if (!i.guild) return i.reply({ content: "❌ Serveur requis.", ephemeral: true });

  const sub = i.options.getSubcommand();
  const settings = await getOrCreateSettings(i.guild.id);

  if (sub === "view") {
    const embed = new EmbedBuilder()
      .setTitle("⚙️ Paramètres du serveur")
      .setColor(0x95a5a6)
      .addFields(
        { name: "🎙️ Intervalle vocal", value: `**${settings.voiceCoinsInterval} min**`, inline: true },
        { name: "🪙 Coins vocal", value: `**${settings.voiceCoinsAmount} 🪙** / intervalle`, inline: true },
        { name: "💬 Coins message", value: `**${settings.chatCoinsAmount} 🪙**`, inline: true },
        { name: "📹 Stream", value: "**x1.5** coins", inline: true },
        { name: "📸 Cam + Stream", value: "**x2** coins", inline: true },
      )
      .setTimestamp();
    return i.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === "voiceinterval") {
    const v = i.options.getInteger("minutes", true);
    await db.update(settingsTable).set({ voiceCoinsInterval: v }).where(eq(settingsTable.guildId, i.guild.id));
    return i.reply({ content: `✅ Intervalle vocal : **${v} minutes**`, ephemeral: true });
  }

  if (sub === "voicecoins") {
    const v = i.options.getInteger("montant", true);
    await db.update(settingsTable).set({ voiceCoinsAmount: v }).where(eq(settingsTable.guildId, i.guild.id));
    return i.reply({ content: `✅ Coins vocal : **${v} 🪙** / intervalle`, ephemeral: true });
  }

  if (sub === "chatcoins") {
    const v = i.options.getInteger("montant", true);
    await db.update(settingsTable).set({ chatCoinsAmount: v }).where(eq(settingsTable.guildId, i.guild.id));
    return i.reply({ content: `✅ Coins message : **${v} 🪙** / message`, ephemeral: true });
  }
}
