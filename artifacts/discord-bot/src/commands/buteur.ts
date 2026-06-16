import { EmbedBuilder, type Message } from "discord.js";
import { db, matchesTable, scorersTable } from "../db.js";
import { eq } from "drizzle-orm";

export async function buteurCommand(message: Message) {
  const matches = await db.query.matchesTable.findMany({
    where: eq(matchesTable.status, "upcoming"),
    orderBy: (m, { asc }) => [asc(m.matchDate)],
  });

  if (matches.length === 0) {
    return message.reply("❌ Aucun match disponible pour le moment.");
  }

  for (const match of matches.slice(0, 3)) {
    const scorers = await db.query.scorersTable.findMany({
      where: eq(scorersTable.matchId, match.id),
    });

    if (scorers.length === 0) continue;

    const homePlayers = scorers.filter((s) => s.team === match.homeTeam);
    const awayPlayers = scorers.filter((s) => s.team === match.awayTeam);

    const formatPlayers = (players: typeof scorers) =>
      players.length === 0
        ? "_Aucun buteur défini_"
        : players.map((p) => `• **${p.playerName}** — \`x${p.odds.toFixed(2)}\``).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`⚽ Buteurs — ${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam}`)
      .setColor(0xe74c3c)
      .addFields(
        {
          name: `${match.homeTeamEmoji} ${match.homeTeam}`,
          value: formatPlayers(homePlayers),
          inline: true,
        },
        {
          name: `${match.awayTeamEmoji} ${match.awayTeam}`,
          value: formatPlayers(awayPlayers),
          inline: true,
        }
      )
      .setDescription(`🆔 Match #${match.id} | Utilise \`-mise [Nom Buteur] [montant]\``)
      .setFooter({ text: "Paris buteur" })
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }
}
