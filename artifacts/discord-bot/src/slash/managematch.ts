import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq, inArray } from "drizzle-orm";
import { db, matchesTable, scorersTable, betsTable } from "../db.js";

const STATUS_EMOJI: Record<string, string> = {
  upcoming: "🟢", live: "🔴", finished: "⚫",
};

export async function slashMatchslist(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const filter = i.options.getString("filtre") ?? "all";

  const allMatches = await db.query.matchesTable.findMany({
    orderBy: (m, { asc, desc }) => filter === "finished" ? [desc(m.matchDate)] : [asc(m.matchDate)],
  });

  const filtered = filter === "all"
    ? allMatches
    : allMatches.filter((m) => m.status === filter);

  if (filtered.length === 0) {
    return i.editReply("📭 Aucun match trouvé avec ce filtre.");
  }

  const chunks: (typeof allMatches)[] = [];
  for (let idx = 0; idx < filtered.length; idx += 8) chunks.push(filtered.slice(idx, idx + 8));

  for (const chunk of chunks.slice(0, 3)) {
    const embed = new EmbedBuilder()
      .setTitle(`📋 Liste des matchs ${filter !== "all" ? `(${filter})` : ""}`)
      .setColor(0x3498db)
      .setDescription(
        chunk.map((m) => {
          const date = new Date(m.matchDate).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          const score = m.status === "finished" && m.homeScore != null
            ? ` **${m.homeScore}-${m.awayScore}**`
            : ` x${m.homeOdds.toFixed(1)}|x${m.drawOdds.toFixed(1)}|x${m.awayOdds.toFixed(1)}`;
          return `${STATUS_EMOJI[m.status] ?? "⚪"} \`#${m.id}\` **${m.homeTeamEmoji}${m.homeTeam} vs ${m.awayTeamEmoji}${m.awayTeam}**${score} · ${date} · *${m.competition}*`;
        }).join("\n")
      )
      .setFooter({ text: `${filtered.length} match(s) au total — 🟢 À venir · 🔴 En direct · ⚫ Terminé` })
      .setTimestamp();

    await i.followUp({ embeds: [embed], ephemeral: true });
  }
}

export async function slashDeletematch(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const matchId = i.options.getInteger("match_id", true);

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return i.editReply(`❌ Match #${matchId} introuvable.`);

  const pendingBets = await db.query.betsTable.findMany({
    where: (b, { and, eq: beq }) => and(beq(b.matchId, matchId), beq(b.status, "pending")),
  });

  if (pendingBets.length > 0 && !i.options.getBoolean("forcer")) {
    return i.editReply(
      `⚠️ Ce match a **${pendingBets.length} pari(s) en attente**.\n` +
      `Utilise \`/deletematch match_id:${matchId} forcer:true\` pour confirmer la suppression et rembourser les joueurs.`
    );
  }

  await db.update(betsTable).set({ status: "refunded" }).where(eq(betsTable.matchId, matchId));

  const { usersTable } = await import("../db.js");
  for (const bet of pendingBets) {
    const betUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, bet.userId) });
    if (!betUser) continue;
    await db.update(usersTable).set({ coins: betUser.coins + bet.amount }).where(eq(usersTable.id, bet.userId));
    try {
      const du = await i.client.users.fetch(betUser.discordId);
      await du.send(`💰 Le match **${match.homeTeam} vs ${match.awayTeam}** a été supprimé. Ta mise de **${bet.amount} 🪙** t'a été remboursée.`);
    } catch {}
  }

  await db.delete(scorersTable).where(eq(scorersTable.matchId, matchId));
  await db.delete(matchesTable).where(eq(matchesTable.id, matchId));

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Match supprimé")
    .setColor(0xe74c3c)
    .addFields(
      { name: "⚽ Match supprimé", value: `${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam}`, inline: false },
      { name: "💰 Paris remboursés", value: `${pendingBets.length} pari(s)`, inline: true },
      { name: "🏆 Compétition", value: match.competition, inline: true },
    )
    .setTimestamp();

  await i.editReply({ embeds: [embed] });
}

export async function slashDeletebuteur(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const buteurId = i.options.getInteger("buteur_id");
  const matchId = i.options.getInteger("match_id");

  if (!buteurId && !matchId) {
    return i.editReply("❌ Fournis soit `buteur_id` (ID exact) soit `match_id` (supprime tous les buteurs du match).");
  }

  if (buteurId) {
    const scorer = await db.query.scorersTable.findFirst({ where: eq(scorersTable.id, buteurId) });
    if (!scorer) return i.editReply(`❌ Buteur #${buteurId} introuvable.`);

    await db.delete(scorersTable).where(eq(scorersTable.id, buteurId));
    await i.editReply(`✅ Buteur **${scorer.playerName}** (${scorer.team}) supprimé.`);
    return;
  }

  if (matchId) {
    const scorers = await db.query.scorersTable.findMany({ where: eq(scorersTable.matchId, matchId) });
    if (scorers.length === 0) return i.editReply(`❌ Aucun buteur pour le match #${matchId}.`);

    await db.delete(scorersTable).where(eq(scorersTable.matchId, matchId));
    await i.editReply(`✅ **${scorers.length} buteur(s)** supprimé(s) du match #${matchId}.`);
  }
}

export async function slashListbuteurs(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const matchId = i.options.getInteger("match_id", true);

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return i.editReply(`❌ Match #${matchId} introuvable.`);

  const scorers = await db.query.scorersTable.findMany({ where: eq(scorersTable.matchId, matchId) });

  if (scorers.length === 0) {
    return i.editReply(`📭 Aucun buteur pour le match #${matchId} (${match.homeTeam} vs ${match.awayTeam}).`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`⚽ Buteurs — ${match.homeTeamEmoji}${match.homeTeam} vs ${match.awayTeamEmoji}${match.awayTeam}`)
    .setColor(0x2ecc71)
    .setDescription(
      scorers.map((s) => `\`#${s.id}\` **${s.playerName}** (${s.team}) — x${s.odds.toFixed(2)}`).join("\n")
    )
    .setFooter({ text: `Match #${matchId} · Utilise /deletebuteur buteur_id:X pour supprimer` })
    .setTimestamp();

  await i.editReply({ embeds: [embed] });
}
