import { db, matchesTable, scorersTable } from "./db.js";

async function seed() {
  const [m1] = await db.insert(matchesTable).values({
    homeTeam: "Portugal", awayTeam: "France",
    homeTeamEmoji: "🇵🇹", awayTeamEmoji: "🇫🇷",
    competition: "Coupe du Monde 2026 • J1",
    matchDate: new Date("2026-06-20T20:00:00"),
    homeOdds: 1.80, drawOdds: 3.50, awayOdds: 4.20,
    status: "upcoming",
  }).returning();

  await db.insert(scorersTable).values([
    { matchId: m1.id, playerName: "Cristiano Ronaldo", team: "Portugal", odds: 1.70 },
    { matchId: m1.id, playerName: "Bruno Fernandes", team: "Portugal", odds: 2.80 },
    { matchId: m1.id, playerName: "Kylian Mbappé", team: "France", odds: 1.90 },
    { matchId: m1.id, playerName: "Antoine Griezmann", team: "France", odds: 3.20 },
  ]);

  const [m2] = await db.insert(matchesTable).values({
    homeTeam: "Argentine", awayTeam: "Algérie",
    homeTeamEmoji: "🇦🇷", awayTeamEmoji: "🇩🇿",
    competition: "Coupe du Monde 2026 • J1",
    matchDate: new Date("2026-06-21T03:00:00"),
    homeOdds: 1.42, drawOdds: 4.50, awayOdds: 7.75,
    status: "upcoming",
  }).returning();

  await db.insert(scorersTable).values([
    { matchId: m2.id, playerName: "Lionel Messi", team: "Argentine", odds: 1.60 },
    { matchId: m2.id, playerName: "Lautaro Martínez", team: "Argentine", odds: 2.20 },
    { matchId: m2.id, playerName: "Islam Slimani", team: "Algérie", odds: 4.00 },
  ]);

  console.log(`✅ Matchs créés : #${m1.id} et #${m2.id}`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
