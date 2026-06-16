import { EmbedBuilder, type Message } from "discord.js";
import { eq } from "drizzle-orm";
import { db, matchesTable, scorersTable, betsTable, usersTable } from "../db.js";

const TEAM_EMOJIS: Record<string, string> = {
  france: "🇫🇷", portugal: "🇵🇹", espagne: "🇪🇸", allemagne: "🇩🇪",
  angleterre: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", italie: "🇮🇹", brésil: "🇧🇷", bresil: "🇧🇷",
  argentine: "🇦🇷", belgique: "🇧🇪", maroc: "🇲🇦",
  sénégal: "🇸🇳", senegal: "🇸🇳", psg: "🔵", marseille: "🔵",
  om: "🔵", lyon: "🔴", monaco: "⚽", ajax: "⚽",
};

function getEmoji(team: string): string {
  const key = team.toLowerCase().replace(/\s+/g, "_");
  for (const [k, v] of Object.entries(TEAM_EMOJIS)) {
    if (key.includes(k)) return v;
  }
  return "⚽";
}

export async function addmatchCommand(message: Message, args: string[]) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ Seuls les administrateurs peuvent ajouter des matchs.");
  }

  if (args.length < 6) {
    return message.reply([
      "❌ Usage : `-addmatch [équipe1] [équipe2] [côteEq1] [côteNul] [côteEq2] [date] [compétition]`",
      "Exemple : `-addmatch Portugal France 1.80 3.50 4.20 2026-06-20T20:00 \"Coupe du Monde\"`",
    ].join("\n"));
  }

  const homeTeam = args[0];
  const awayTeam = args[1];
  const homeOdds = parseFloat(args[2]);
  const drawOdds = parseFloat(args[3]);
  const awayOdds = parseFloat(args[4]);
  const dateStr = args[5];
  const competition = args.slice(6).join(" ") || "Ligue 1";

  if (isNaN(homeOdds) || isNaN(drawOdds) || isNaN(awayOdds)) {
    return message.reply("❌ Les côtes doivent être des nombres valides.");
  }

  const matchDate = new Date(dateStr);
  if (isNaN(matchDate.getTime())) {
    return message.reply("❌ Date invalide. Format attendu : `YYYY-MM-DDTHH:mm` (ex: `2026-06-20T20:00`)");
  }

  const [match] = await db.insert(matchesTable).values({
    homeTeam,
    awayTeam,
    homeTeamEmoji: getEmoji(homeTeam),
    awayTeamEmoji: getEmoji(awayTeam),
    competition,
    matchDate,
    homeOdds,
    drawOdds,
    awayOdds,
    status: "upcoming",
  }).returning();

  const embed = new EmbedBuilder()
    .setTitle("✅ Match ajouté !")
    .setColor(0x2ecc71)
    .addFields(
      { name: "🆔 ID", value: `#${match.id}`, inline: true },
      { name: "⚽ Match", value: `${match.homeTeamEmoji} ${homeTeam} vs ${match.awayTeamEmoji} ${awayTeam}`, inline: true },
      { name: "🏆 Compétition", value: competition, inline: true },
      { name: "📅 Date", value: matchDate.toLocaleString("fr-FR"), inline: true },
      { name: "📊 Côtes", value: `${homeTeam}: x${homeOdds} | Nul: x${drawOdds} | ${awayTeam}: x${awayOdds}`, inline: false },
    )
    .setDescription(`Utilise \`-addbuteur ${match.id} [nom] [équipe] [côte]\` pour ajouter des buteurs.`)
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function addbuteurCommand(message: Message, args: string[]) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ Seuls les administrateurs peuvent ajouter des buteurs.");
  }

  if (args.length < 4) {
    return message.reply("❌ Usage : `-addbuteur [matchId] [nom joueur] [équipe] [côte]`\nExemple : `-addbuteur 1 \"Cristiano Ronaldo\" Portugal 1.70`");
  }

  const matchId = parseInt(args[0], 10);
  const playerName = args[1];
  const team = args[2];
  const odds = parseFloat(args[3]);

  if (isNaN(matchId) || isNaN(odds)) {
    return message.reply("❌ matchId et côte doivent être des nombres valides.");
  }

  await db.insert(scorersTable).values({ matchId, playerName, team, odds });
  await message.reply(`✅ Buteur **${playerName}** (${team}) ajouté pour le match #${matchId} avec une côte de **x${odds}**.`);
}

export async function resultatCommand(message: Message, args: string[]) {
  if (!message.member?.permissions.has("Administrator")) {
    return message.reply("❌ Seuls les administrateurs peuvent définir les résultats.");
  }

  if (args.length < 2) {
    return message.reply("❌ Usage : `-resultat [matchId] [score]`\nExemple : `-resultat 1 2-1` ou `-resultat 1 nul`");
  }

  const matchId = parseInt(args[0], 10);
  const scoreStr = args[1].toLowerCase();

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) return message.reply(`❌ Match #${matchId} introuvable.`);

  let homeScore: number;
  let awayScore: number;
  let winner: string;

  if (scoreStr === "nul" || scoreStr === "draw") {
    homeScore = 0; awayScore = 0; winner = "draw";
  } else {
    const parts = scoreStr.split("-");
    if (parts.length !== 2) return message.reply("❌ Format de score invalide. Exemples : `2-1`, `0-0`, `nul`");
    homeScore = parseInt(parts[0], 10);
    awayScore = parseInt(parts[1], 10);
    if (isNaN(homeScore) || isNaN(awayScore)) return message.reply("❌ Scores invalides.");
    winner = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";
  }

  await db.update(matchesTable).set({ status: "finished", homeScore, awayScore }).where(eq(matchesTable.id, matchId));

  const pendingBets = await db.query.betsTable.findMany({
    where: (b, { and, eq: beq }) => and(beq(b.matchId, matchId), beq(b.status, "pending")),
  });

  let wonCount = 0;
  let lostCount = 0;

  for (const bet of pendingBets) {
    const isWin =
      (bet.betType === "home" && winner === "home") ||
      (bet.betType === "away" && winner === "away") ||
      (bet.betType === "draw" && winner === "draw");

    const betUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, bet.userId) });
    if (!betUser) continue;

    if (isWin) {
      const winAmount = Math.floor(bet.potentialWin);
      await db.update(usersTable).set({
        coins: betUser.coins + winAmount,
        wonBets: betUser.wonBets + 1,
        xp: betUser.xp + 20,
      }).where(eq(usersTable.id, bet.userId));
      await db.update(betsTable).set({ status: "won" }).where(eq(betsTable.id, bet.id));
      wonCount++;
      try {
        const dUser = await message.client.users.fetch(betUser.discordId);
        await dUser.send(
          `🏆 Tu as **GAGNÉ** ton pari sur **${match.homeTeam} vs ${match.awayTeam}** !\n` +
          `Mise : **${bet.amount} 🪙** → Gain : **+${winAmount} 🪙** 🎉`
        );
      } catch {}
    } else {
      await db.update(usersTable).set({ lostBets: betUser.lostBets + 1 }).where(eq(usersTable.id, bet.userId));
      await db.update(betsTable).set({ status: "lost" }).where(eq(betsTable.id, bet.id));
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
      { name: "✅ Paris gagnants", value: `${wonCount}`, inline: true },
      { name: "❌ Paris perdants", value: `${lostCount}`, inline: true },
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
