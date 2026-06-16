import { EmbedBuilder, type Message } from "discord.js";
import { db, settingsTable } from "../db.js";
import { eq } from "drizzle-orm";
import { getOrCreateSettings } from "../utils/settings.js";

export async function settingsCommand(message: Message, args: string[]) {
  if (!message.guild) return message.reply("❌ Cette commande doit être utilisée dans un serveur.");

  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ Seuls les administrateurs peuvent modifier les paramètres.");
  }

  const settings = await getOrCreateSettings(message.guild.id);

  if (args.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle("⚙️ Paramètres du serveur")
      .setColor(0x95a5a6)
      .addFields(
        {
          name: "🎙️ Intervalle vocal",
          value: `**${settings.voiceCoinsInterval} minutes** pour gagner des coins`,
          inline: true,
        },
        {
          name: "🪙 Coins vocal",
          value: `**${settings.voiceCoinsAmount} 🪙** par intervalle`,
          inline: true,
        },
        {
          name: "💬 Coins chat",
          value: `**${settings.chatCoinsAmount} 🪙** par message`,
          inline: true,
        }
      )
      .setDescription(
        [
          "**Usage :**",
          "`-settings voiceinterval [minutes]` — Changer l'intervalle vocal",
          "`-settings voicecoins [montant]` — Changer les coins vocaux",
          "`-settings chatcoins [montant]` — Changer les coins par message",
          "",
          "**Multiplicateurs automatiques :**",
          "🎙️ Vocal normal → **x1**",
          "📹 Stream → **x1.5**",
          "📸 Stream + Caméra → **x2**",
        ].join("\n")
      )
      .setFooter({ text: "BetBot Settings" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  const subCmd = args[0].toLowerCase();
  const value = parseInt(args[1], 10);

  if (isNaN(value) || value <= 0) {
    return message.reply("❌ La valeur doit être un nombre positif.");
  }

  if (subCmd === "voiceinterval") {
    await db.update(settingsTable).set({ voiceCoinsInterval: value }).where(eq(settingsTable.guildId, message.guild.id));
    return message.reply(`✅ Intervalle vocal mis à jour : **${value} minutes** par distribution de coins.`);
  }

  if (subCmd === "voicecoins") {
    await db.update(settingsTable).set({ voiceCoinsAmount: value }).where(eq(settingsTable.guildId, message.guild.id));
    return message.reply(`✅ Coins vocaux mis à jour : **${value} 🪙** par intervalle.`);
  }

  if (subCmd === "chatcoins") {
    await db.update(settingsTable).set({ chatCoinsAmount: value }).where(eq(settingsTable.guildId, message.guild.id));
    return message.reply(`✅ Coins par message mis à jour : **${value} 🪙** par message.`);
  }

  return message.reply("❌ Sous-commande inconnue. Utilise `-settings` pour voir les options.");
}
