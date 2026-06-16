import { EmbedBuilder, type TextChannel, type Client } from "discord.js";
import { db, betsTable, usersTable, matchesTable, settingsTable } from "../db.js";
import { eq, sum, desc } from "drizzle-orm";

export async function updateLiveEmbed(client: Client, guildId: string) {
  const settings = await db.query.settingsTable.findFirst({
    where: eq(settingsTable.guildId, guildId),
  });
  if (!settings?.liveChannelId || !settings?.liveMessageId) return;

  const channel = client.channels.cache.get(settings.liveChannelId) as TextChannel | undefined;
  if (!channel) return;

  const totalResult = await db
    .select({ total: sum(betsTable.amount) })
    .from(betsTable);
  const total = Number(totalResult[0]?.total ?? 0);

  const recentBets = await db
    .select({
      amount: betsTable.amount,
      betType: betsTable.betType,
      betValue: betsTable.betValue,
      odds: betsTable.odds,
      discordId: usersTable.discordId,
      username: usersTable.username,
      homeTeam: matchesTable.homeTeam,
      awayTeam: matchesTable.awayTeam,
    })
    .from(betsTable)
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
        : recentBets
            .map(
              (b) =>
                `<@${b.discordId}> a misé **${b.amount} 🪙** sur **${b.betValue}** (${b.homeTeam} vs ${b.awayTeam}) — cote **x${b.odds}**`
            )
            .join("\n"))
    )
    .setFooter({ text: "Mis à jour en temps réel" })
    .setTimestamp();

  try {
    const msg = await channel.messages.fetch(settings.liveMessageId);
    await msg.edit({ embeds: [embed] });
  } catch {
    const msg = await channel.send({ embeds: [embed] });
    await db
      .update(settingsTable)
      .set({ liveMessageId: msg.id })
      .where(eq(settingsTable.guildId, guildId));
  }
}
