import { EmbedBuilder, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { eq, sum, desc } from "drizzle-orm";
import { db, settingsTable, betsTable, usersTable, matchesTable } from "../db.js";
import { getOrCreateSettings } from "../utils/settings.js";

export async function slashLive(i: ChatInputCommandInteraction) {
  if (!i.guild) return i.reply({ content: "❌ Serveur requis.", ephemeral: true });

  await i.deferReply({ ephemeral: true });
  await getOrCreateSettings(i.guild.id);

  const totalResult = await db.select({ total: sum(betsTable.amount) }).from(betsTable);
  const total = Number(totalResult[0]?.total ?? 0);

  const recentBets = await db.select({
    amount: betsTable.amount, betValue: betsTable.betValue, odds: betsTable.odds,
    discordId: usersTable.discordId, username: usersTable.username,
    homeTeam: matchesTable.homeTeam, awayTeam: matchesTable.awayTeam,
    homeEmoji: matchesTable.homeTeamEmoji, awayEmoji: matchesTable.awayTeamEmoji,
  }).from(betsTable)
    .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
    .innerJoin(matchesTable, eq(betsTable.matchId, matchesTable.id))
    .orderBy(desc(betsTable.createdAt))
    .limit(10);

  const embed = new EmbedBuilder()
    .setTitle("🎰 Live des Paris")
    .setColor(0x2ecc71)
    .setDescription(
      `## 💰 Total misé : **${total.toLocaleString("fr-FR")} 🪙**\n\n` +
      (recentBets.length === 0
        ? "_Aucun pari pour l'instant..._"
        : recentBets.map((b) =>
            `<@${b.discordId}> a misé **${b.amount} 🪙** sur **${b.betValue}** (${b.homeEmoji}${b.homeTeam} vs ${b.awayEmoji}${b.awayTeam}) — x${b.odds}`
          ).join("\n"))
    )
    .setFooter({ text: "Mis à jour en temps réel • Les nouvelles mises apparaissent ci-dessous" })
    .setTimestamp();

  const liveMsg = await (i.channel as TextChannel).send({ embeds: [embed] });

  await db.update(settingsTable).set({ liveChannelId: i.channel!.id, liveMessageId: liveMsg.id }).where(eq(settingsTable.guildId, i.guild.id));

  await i.editReply("✅ Embed live activé dans ce salon !");
}
