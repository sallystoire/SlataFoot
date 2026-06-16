import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import { db, matchesTable, scorersTable } from "../db.js";

export async function slashButeur(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: false });

  const matchId = i.options.getInteger("match_id");

  let matches;
  if (matchId) {
    const m = await db.query.matchesTable.findFirst({ where: (t, { and, eq: deq }) => and(deq(t.id, matchId), deq(t.status, "upcoming")) });
    matches = m ? [m] : [];
  } else {
    matches = await db.query.matchesTable.findMany({ where: eq(matchesTable.status, "upcoming"), orderBy: (m, { asc }) => [asc(m.matchDate)] });
  }

  if (matches.length === 0) return i.editReply("❌ Aucun match disponible.");

  for (const match of matches.slice(0, 3)) {
    const scorers = await db.query.scorersTable.findMany({ where: eq(scorersTable.matchId, match.id) });
    if (scorers.length === 0) continue;

    const home = scorers.filter((s) => s.team === match.homeTeam);
    const away = scorers.filter((s) => s.team === match.awayTeam);
    const fmt = (p: typeof scorers) => p.length === 0 ? "_Aucun buteur_" : p.map((s) => `• **${s.playerName}** — \`x${s.odds.toFixed(2)}\``).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`⚽ Buteurs — ${match.homeTeamEmoji}${match.homeTeam} vs ${match.awayTeamEmoji}${match.awayTeam}`)
      .setColor(0xe74c3c)
      .setDescription(`Match #${match.id} | Clique sur **🏠 Équipe** ou **✈️ Équipe** dans la card du match pour parier.`)
      .addFields(
        { name: `${match.homeTeamEmoji} ${match.homeTeam}`, value: fmt(home), inline: true },
        { name: `${match.awayTeamEmoji} ${match.awayTeam}`, value: fmt(away), inline: true },
      )
      .setTimestamp();

    await i.channel?.send({ embeds: [embed] }).catch(() => {});
  }

  await i.editReply("✅ Buteurs affichés !");
}
