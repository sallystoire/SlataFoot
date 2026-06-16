import { EmbedBuilder, type Message } from "discord.js";
import { db, matchesTable } from "../db.js";
import { eq } from "drizzle-orm";

export async function matchsCommand(message: Message) {
  const matches = await db.query.matchesTable.findMany({
    where: eq(matchesTable.status, "upcoming"),
    orderBy: (m, { asc }) => [asc(m.matchDate)],
  });

  if (matches.length === 0) {
    return message.reply("❌ Aucun match disponible pour le moment. Un admin peut en ajouter avec `-addmatch`.");
  }

  const embed = new EmbedBuilder()
    .setTitle("⚽ Matchs Disponibles")
    .setColor(0x2ecc71)
    .setDescription("Utilise `-mise [équipe ou 'nul'] [montant]` pour parier !");

  for (const match of matches.slice(0, 10)) {
    const dateStr = new Date(match.matchDate).toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    embed.addFields({
      name: `🆔 #${match.id} | ${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam}`,
      value: [
        `📅 **${dateStr}** — ${match.competition}`,
        ``,
        `| 🏠 **${match.homeTeam}** | ⚖️ **Match Nul** | ✈️ **${match.awayTeam}** |`,
        `| :---: | :---: | :---: |`,
        `| \`x${match.homeOdds.toFixed(2)}\` | \`x${match.drawOdds.toFixed(2)}\` | \`x${match.awayOdds.toFixed(2)}\` |`,
      ].join("\n"),
      inline: false,
    });
  }

  embed.setFooter({ text: `${matches.length} match(s) disponible(s)` }).setTimestamp();

  await message.reply({ embeds: [embed] });
}
