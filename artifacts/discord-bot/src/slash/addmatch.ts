import {
  EmbedBuilder, AttachmentBuilder, type ChatInputCommandInteraction, type TextChannel,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db, matchesTable, scorersTable } from "../db.js";
import { sendMatchCard, buildMatchEmbed, fetchMatchImageBuffer } from "./matchs.js";

const TEAM_COUNTRY: Record<string, string> = {
  france: "fr", portugal: "pt", espagne: "es", allemagne: "de",
  angleterre: "gb-eng", italie: "it", brésil: "br", bresil: "br",
  argentine: "ar", maroc: "ma", belgique: "be", algérie: "dz", algerie: "dz",
  sénégal: "sn", senegal: "sn", "pays-bas": "nl", croatie: "hr",
  japon: "jp", mexique: "mx", usa: "us", canada: "ca",
  australie: "au", suisse: "ch", danemark: "dk", pologne: "pl",
  ukraine: "ua", turquie: "tr", nigeria: "ng", tunisie: "tn",
  egypt: "eg", corée: "kr", qatar: "qa", suède: "se",
};

const FLAGS: Record<string, string> = {
  fr: "🇫🇷", pt: "🇵🇹", es: "🇪🇸", de: "🇩🇪", "gb-eng": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  it: "🇮🇹", br: "🇧🇷", ar: "🇦🇷", ma: "🇲🇦", be: "🇧🇪",
  dz: "🇩🇿", sn: "🇸🇳", nl: "🇳🇱", hr: "🇭🇷", jp: "🇯🇵",
  mx: "🇲🇽", us: "🇺🇸", ca: "🇨🇦", au: "🇦🇺", ch: "🇨🇭",
  dk: "🇩🇰", pl: "🇵🇱", ua: "🇺🇦", tr: "🇹🇷", ng: "🇳🇬",
  tn: "🇹🇳", eg: "🇪🇬", kr: "🇰🇷", qa: "🇶🇦", se: "🇸🇪",
};

function getEmoji(team: string): string {
  const lower = team.toLowerCase().trim();
  for (const [key, code] of Object.entries(TEAM_COUNTRY)) {
    if (lower.includes(key) || key.includes(lower)) return FLAGS[code] ?? "⚽";
  }
  return "⚽";
}

async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log("[image] Téléchargement depuis Discord:", imageUrl.substring(0, 80));
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!imgRes.ok) {
      console.error("[image] Échec fetch Discord:", imgRes.status);
      return null;
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    console.log(`[image] Téléchargé: ${(imgBuf.length / 1024).toFixed(0)} KB`);
    return imgBuf.toString("base64");
  } catch (e) {
    console.error("[image] Erreur téléchargement:", e);
    return null;
  }
}

export async function slashAddmatch(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const homeTeam = i.options.getString("equipe1", true);
  const awayTeam = i.options.getString("equipe2", true);
  const homeOdds = i.options.getNumber("cote1", true);
  const drawOdds = i.options.getNumber("cotenul", true);
  const awayOdds = i.options.getNumber("cote2", true);
  const dateStr = i.options.getString("date", true);
  const competition = i.options.getString("competition") ?? "Ligue 1";
  const image = i.options.getAttachment("image");

  const matchDate = new Date(dateStr);
  if (isNaN(matchDate.getTime())) {
    return i.editReply("❌ Date invalide. Format : `2026-06-20T20:00`");
  }

  const [match] = await db.insert(matchesTable).values({
    homeTeam, awayTeam,
    homeTeamEmoji: getEmoji(homeTeam),
    awayTeamEmoji: getEmoji(awayTeam),
    competition, matchDate, homeOdds, drawOdds, awayOdds,
    status: "upcoming",
  }).returning();

  let hasImage = false;

  if (image && image.contentType?.startsWith("image/")) {
    const imageData = await downloadImageAsBase64(image.url);
    if (imageData) {
      await db.update(matchesTable)
        .set({ backgroundImageData: imageData, backgroundImageUrl: "db" })
        .where(eq(matchesTable.id, match.id));
      hasImage = true;
      console.log(`[addmatch] Image sauvegardée en DB pour match #${match.id}`);
    } else {
      console.error(`[addmatch] Échec sauvegarde image pour match #${match.id}`);
    }
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle("✅ Match ajouté !")
    .setColor(0x2ecc71)
    .addFields(
      { name: "🆔 ID", value: `#${match.id}`, inline: true },
      { name: "⚽ Match", value: `${getEmoji(homeTeam)} ${homeTeam} vs ${getEmoji(awayTeam)} ${awayTeam}`, inline: true },
      { name: "🏆 Compétition", value: competition, inline: true },
      { name: "📅 Date", value: matchDate.toLocaleString("fr-FR"), inline: true },
      { name: "📊 Côtes", value: `${homeTeam}: x${homeOdds} | Nul: x${drawOdds} | ${awayTeam}: x${awayOdds}` },
      { name: "🖼️ Image de fond", value: hasImage ? "✅ Sauvegardée" : "❌ Aucune (fond sombre par défaut)" },
    )
    .setDescription(`💡 Utilise \`/addbuteur match_id:${match.id}\` pour ajouter des buteurs.\n\n⬇️ Génération de la card dans le salon...`)
    .setTimestamp();

  await i.editReply({ embeds: [confirmEmbed] });

  const updatedMatch = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, match.id) });
  if (updatedMatch && i.channel) await sendMatchCard(i.channel, updatedMatch);
}

export async function slashEditmatch(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const matchId = i.options.getInteger("match_id", true);
  const newCote1 = i.options.getNumber("cote1");
  const newCoteNul = i.options.getNumber("cotenul");
  const newCote2 = i.options.getNumber("cote2");
  const newDate = i.options.getString("date");
  const newCompetition = i.options.getString("competition");
  const image = i.options.getAttachment("image");

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return i.editReply(`❌ Match #${matchId} introuvable.`);

  const updates: Partial<typeof match> = {};
  if (newCote1 !== null) updates.homeOdds = newCote1;
  if (newCoteNul !== null) updates.drawOdds = newCoteNul;
  if (newCote2 !== null) updates.awayOdds = newCote2;
  if (newDate) {
    const d = new Date(newDate);
    if (isNaN(d.getTime())) return i.editReply("❌ Date invalide.");
    updates.matchDate = d;
  }
  if (newCompetition) updates.competition = newCompetition;

  if (image && image.contentType?.startsWith("image/")) {
    const imageData = await downloadImageAsBase64(image.url);
    if (imageData) {
      (updates as any).backgroundImageData = imageData;
      updates.backgroundImageUrl = "db";
      console.log(`[editmatch] Image sauvegardée en DB pour match #${matchId}`);
    } else {
      console.error(`[editmatch] Échec sauvegarde image pour match #${matchId}`);
    }
  }

  if (Object.keys(updates).length === 0) {
    return i.editReply("❌ Aucun changement fourni.");
  }

  await db.update(matchesTable).set(updates as any).where(eq(matchesTable.id, matchId));

  const updated = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });

  const confirmEmbed = new EmbedBuilder()
    .setTitle(`✏️ Match #${matchId} mis à jour`)
    .setColor(0x3498db)
    .addFields(
      { name: "⚽ Match", value: `${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam}`, inline: false },
      { name: "📊 Nouvelles côtes", value: `Dom: x${updated!.homeOdds.toFixed(2)} | Nul: x${updated!.drawOdds.toFixed(2)} | Ext: x${updated!.awayOdds.toFixed(2)}`, inline: false },
      ...(newDate ? [{ name: "📅 Nouvelle date", value: new Date(newDate).toLocaleString("fr-FR"), inline: true }] : []),
      ...(updates.backgroundImageUrl ? [{ name: "🖼️ Image", value: "✅ Mise à jour", inline: true }] : []),
    )
    .setTimestamp();

  await i.editReply({ embeds: [confirmEmbed] });

  if (updated?.cardMessageId && updated?.cardChannelId) {
    try {
      const channel = await i.client.channels.fetch(updated.cardChannelId);
      if (channel && channel.isTextBased()) {
        const msg = await (channel as TextChannel).messages.fetch(updated.cardMessageId);
        const imgBuf = await fetchMatchImageBuffer(updated.id);
        const { embed: cardEmbed, row } = buildMatchEmbed(updated, !!imgBuf);
        const editOptions: Parameters<typeof msg.edit>[0] = {
          embeds: [cardEmbed],
          components: [row],
          attachments: [],
        };
        if (imgBuf) {
          editOptions.files = [new AttachmentBuilder(imgBuf, { name: "match.png" })];
        }
        await msg.edit(editOptions);
      }
    } catch (e) {
      console.error("[editmatch card refresh]", e);
    }
  }
}

export async function slashAddbuteur(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const matchId = i.options.getInteger("match_id", true);
  const playerName = i.options.getString("joueur", true);
  const team = i.options.getString("equipe", true);
  const odds = i.options.getNumber("cote", true);

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return i.editReply(`❌ Match #${matchId} introuvable.`);

  await db.insert(scorersTable).values({ matchId, playerName, team, odds });
  await i.editReply(`✅ **${playerName}** (${team}) ajouté pour le match #${matchId} — cote **x${odds.toFixed(2)}**`);
}

export async function slashResultat(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const matchId = i.options.getInteger("match_id", true);
  const scoreStr = i.options.getString("score", true).toLowerCase().trim();

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return i.editReply(`❌ Match #${matchId} introuvable.`);

  let homeScore: number, awayScore: number, winner: string;

  if (scoreStr === "nul" || scoreStr === "draw" || scoreStr === "0-0") {
    homeScore = 0; awayScore = 0; winner = "draw";
  } else {
    const parts = scoreStr.split("-");
    if (parts.length !== 2) return i.editReply("❌ Format invalide. Ex: `2-1` ou `nul`");
    homeScore = parseInt(parts[0], 10);
    awayScore = parseInt(parts[1], 10);
    if (isNaN(homeScore) || isNaN(awayScore)) return i.editReply("❌ Scores invalides.");
    winner = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";
  }

  await db.update(matchesTable).set({ status: "finished", homeScore, awayScore }).where(eq(matchesTable.id, matchId));

  const { betsTable, usersTable, couponsTable } = await import("../db.js");
  const pendingBets = await db.query.betsTable.findMany({
    where: (b, { and, eq: beq }) => and(beq(b.matchId, matchId), beq(b.status, "pending")),
  });

  let wonCount = 0, lostCount = 0;

  for (const bet of pendingBets) {
    const isWin =
      (bet.betType === "home" && winner === "home") ||
      (bet.betType === "away" && winner === "away") ||
      (bet.betType === "draw" && winner === "draw");

    const betUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, bet.userId) });
    if (!betUser) continue;

    if (isWin) {
      const win = Math.floor(bet.potentialWin);
      await db.update(usersTable).set({ coins: betUser.coins + win, wonBets: betUser.wonBets + 1, xp: betUser.xp + 20 }).where(eq(usersTable.id, bet.userId));
      await db.update(betsTable).set({ status: "won" }).where(eq(betsTable.id, bet.id));
      wonCount++;
      try {
        const du = await i.client.users.fetch(betUser.discordId);
        await du.send(`🏆 Tu as **GAGNÉ** ton pari sur **${match.homeTeam} vs ${match.awayTeam}** !\nGain : **+${win} 🪙** 🎉`);
      } catch {}
    } else {
      await db.update(usersTable).set({ lostBets: betUser.lostBets + 1 }).where(eq(usersTable.id, bet.userId));
      await db.update(betsTable).set({ status: "lost" }).where(eq(betsTable.id, bet.id));
      lostCount++;
    }
  }

  const pendingCoupons = await db.query.couponsTable.findMany({
    where: (c, { eq: ceq }) => ceq(c.status, "pending"),
  });

  for (const coupon of pendingCoupons) {
    const matchIds = coupon.matchIds as number[];
    if (!matchIds.includes(matchId)) continue;

    const allMatches = await db.query.matchesTable.findMany({
      where: (m, { inArray }) => inArray(m.id, matchIds),
    });

    const allFinished = allMatches.every((m) => m.status === "finished");
    if (!allFinished) continue;

    const choices = coupon.betChoices as string[];
    let allWon = true;
    for (let idx = 0; idx < allMatches.length; idx++) {
      const m = allMatches[idx];
      const choice = choices[idx];
      const mWinner = (m.homeScore ?? 0) > (m.awayScore ?? 0) ? "home" : (m.awayScore ?? 0) > (m.homeScore ?? 0) ? "away" : "draw";
      if (choice !== mWinner) { allWon = false; break; }
    }

    const couponUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, coupon.userId) });
    if (!couponUser) continue;

    if (allWon) {
      const win = Math.floor(coupon.potentialWin);
      await db.update(usersTable).set({ coins: couponUser.coins + win, wonBets: couponUser.wonBets + 1, xp: couponUser.xp + 50 }).where(eq(usersTable.id, coupon.userId));
      await db.update(couponsTable).set({ status: "won" }).where(eq(couponsTable.id, coupon.id));
      wonCount++;
      try {
        const du = await i.client.users.fetch(couponUser.discordId);
        await du.send(`🏆 Ton **COUPON** est gagnant ! Gain : **+${win} 🪙** 🎉`);
      } catch {}
    } else {
      await db.update(usersTable).set({ lostBets: couponUser.lostBets + 1 }).where(eq(usersTable.id, coupon.userId));
      await db.update(couponsTable).set({ status: "lost" }).where(eq(couponsTable.id, coupon.id));
      lostCount++;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("🏁 Résultat enregistré !")
    .setColor(0xe74c3c)
    .addFields(
      { name: "⚽ Match", value: `${match.homeTeam} vs ${match.awayTeam}`, inline: true },
      { name: "📊 Score", value: `**${homeScore} - ${awayScore}**`, inline: true },
      { name: "🏆 Vainqueur", value: winner === "draw" ? "Match Nul" : winner === "home" ? match.homeTeam : match.awayTeam, inline: true },
      { name: "✅ Gagnants", value: `${wonCount} paris`, inline: true },
      { name: "❌ Perdants", value: `${lostCount} paris`, inline: true },
    )
    .setTimestamp();

  await i.editReply({ embeds: [embed] });
}
