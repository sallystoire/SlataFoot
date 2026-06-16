import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, betsTable } from "@workspace/db/schema";
import { eq, count, sql } from "drizzle-orm";
import sharp from "sharp";

const router = Router();

function formatDate(d: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  if (d.toDateString() === now.toDateString()) return `Aujourd'hui\n${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Demain\n${time}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + `\n${time}`;
}

function makeProgressBar(pct: number, color: string, x: number, y: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="6" rx="3" fill="#333"/>
    <rect x="${x}" y="${y}" width="${filled}" height="6" rx="3" fill="${color}"/>
  `;
}

function generateSVG(opts: {
  homeTeam: string;
  awayTeam: string;
  homeEmoji: string;
  awayEmoji: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homePct: number;
  drawPct: number;
  awayPct: number;
  competition: string;
  matchDate: Date;
  totalBets: number;
  mostBetted: "home" | "draw" | "away";
}): string {
  const W = 860;
  const H = 500;
  const dateLabel = formatDate(opts.matchDate);
  const [dateLine1, dateLine2] = dateLabel.split("\n");

  const homePctStr = `${opts.homePct}%`;
  const drawPctStr = `${opts.drawPct}%`;
  const awayPctStr = `${opts.awayPct}%`;

  const boxY = 340;
  const boxH = 80;
  const homeBoxX = 30;
  const drawBoxX = 300;
  const awayBoxX = 570;
  const boxW = 255;

  const homeStroke = opts.mostBetted === "home" ? `stroke="#fff" stroke-width="3"` : `stroke="#444" stroke-width="1.5"`;
  const drawStroke = opts.mostBetted === "draw" ? `stroke="#fff" stroke-width="3"` : `stroke="#444" stroke-width="1.5"`;
  const awayStroke = opts.mostBetted === "away" ? `stroke="#fff" stroke-width="3"` : `stroke="#444" stroke-width="1.5"`;

  const badgeX = opts.mostBetted === "home" ? homeBoxX + boxW / 2 : opts.mostBetted === "draw" ? drawBoxX + boxW / 2 : awayBoxX + boxW / 2;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff0080;stop-opacity:1"/>
      <stop offset="25%" style="stop-color:#ff8000;stop-opacity:1"/>
      <stop offset="50%" style="stop-color:#ffff00;stop-opacity:1"/>
      <stop offset="75%" style="stop-color:#00ff80;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0080ff;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#5b6af0;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#3a4ac7;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1e2e;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0d0d1a;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="imgFade" x1="0%" y1="60%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1e2e;stop-opacity:0"/>
      <stop offset="100%" style="stop-color:#0d0d1a;stop-opacity:1"/>
    </linearGradient>
    <clipPath id="cardClip">
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="18"/>
    </clipPath>
  </defs>

  <!-- Rainbow border -->
  <rect width="${W}" height="${H}" rx="22" fill="url(#borderGrad)"/>

  <!-- Dark card background -->
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="18" fill="url(#bgGrad)" clip-path="url(#cardClip)"/>

  <!-- Top header bar -->
  <rect x="6" y="6" width="${W - 12}" height="58" fill="url(#headerGrad)"/>

  <!-- Soccer + Trophy emojis (as text) -->
  <text x="26" y="44" font-size="26" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">⚽🏆</text>

  <!-- Competition name -->
  <text x="90" y="43" font-size="20" font-weight="700" fill="white" font-family="Arial,sans-serif">${opts.competition}</text>

  <!-- Jersey badge (top right) -->
  <rect x="${W - 72}" y="12" width="56" height="40" rx="10" fill="#1a1f5e"/>
  <text x="${W - 44}" y="40" text-anchor="middle" font-size="22" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">👕</text>

  <!-- Green stripe below header -->
  <rect x="6" y="64" width="${W - 12}" height="6" fill="#2ecc71"/>

  <!-- Mid image area (gradient bg simulating photo) -->
  <rect x="6" y="70" width="${W - 12}" height="260" fill="#141428" clip-path="url(#cardClip)"/>

  <!-- Subtle spotlight effect -->
  <ellipse cx="${W / 2}" cy="160" rx="280" ry="120" fill="#2a2a50" opacity="0.5"/>

  <!-- Fade overlay at bottom of image -->
  <rect x="6" y="200" width="${W - 12}" height="130" fill="url(#imgFade)"/>

  <!-- Home team emoji flag -->
  <text x="120" y="250" text-anchor="middle" font-size="70" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${opts.homeEmoji}</text>
  <!-- Home team name -->
  <text x="120" y="295" text-anchor="middle" font-size="22" font-weight="800" fill="white" font-family="Arial,sans-serif">${opts.homeTeam}</text>

  <!-- Away team emoji flag -->
  <text x="${W - 120}" y="250" text-anchor="middle" font-size="70" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${opts.awayEmoji}</text>
  <!-- Away team name -->
  <text x="${W - 120}" y="295" text-anchor="middle" font-size="22" font-weight="800" fill="white" font-family="Arial,sans-serif">${opts.awayTeam}</text>

  <!-- Date/time center -->
  <text x="${W / 2}" y="245" text-anchor="middle" font-size="18" fill="#aaaacc" font-family="Arial,sans-serif">${dateLine1}</text>
  <text x="${W / 2}" y="275" text-anchor="middle" font-size="32" font-weight="700" fill="white" font-family="Arial,sans-serif">${dateLine2}</text>

  <!-- Most-bet badge -->
  <rect x="${badgeX - 52}" y="${boxY - 22}" width="104" height="24" rx="12" fill="#e74c3c"/>
  <text x="${badgeX}" y="${boxY - 5}" text-anchor="middle" font-size="13" fill="white" font-weight="700" font-family="Arial,sans-serif">${opts.totalBets} 🪙 misés</text>

  <!-- HOME bet box -->
  <rect x="${homeBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="#1c1c2e" ${homeStroke}/>
  <text x="${homeBoxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" font-size="15" fill="#ccccdd" font-family="Arial,sans-serif">${opts.homeTeam}</text>
  <text x="${homeBoxX + boxW / 2}" y="${boxY + 62}" text-anchor="middle" font-size="30" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.homeOdds.toFixed(2)}</text>

  <!-- DRAW bet box -->
  <rect x="${drawBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="#1c1c2e" ${drawStroke}/>
  <text x="${drawBoxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" font-size="15" fill="#ccccdd" font-family="Arial,sans-serif">Match nul</text>
  <text x="${drawBoxX + boxW / 2}" y="${boxY + 62}" text-anchor="middle" font-size="30" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.drawOdds.toFixed(2)}</text>

  <!-- AWAY bet box -->
  <rect x="${awayBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="#1c1c2e" ${awayStroke}/>
  <text x="${awayBoxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" font-size="15" fill="#ccccdd" font-family="Arial,sans-serif">${opts.awayTeam}</text>
  <text x="${awayBoxX + boxW / 2}" y="${boxY + 62}" text-anchor="middle" font-size="30" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.awayOdds.toFixed(2)}</text>

  <!-- Progress bars + pct labels -->
  <text x="${homeBoxX}" y="${boxY + boxH + 20}" font-size="13" fill="#aaaacc" font-family="Arial,sans-serif">${homePctStr}</text>
  ${makeProgressBar(opts.homePct, opts.homePct > 30 ? "#2ecc71" : "#e74c3c", homeBoxX, boxY + boxH + 26, boxW)}

  <text x="${drawBoxX}" y="${boxY + boxH + 20}" font-size="13" fill="#aaaacc" font-family="Arial,sans-serif">${drawPctStr}</text>
  ${makeProgressBar(opts.drawPct, opts.drawPct > 30 ? "#2ecc71" : "#e74c3c", drawBoxX, boxY + boxH + 26, boxW)}

  <text x="${awayBoxX}" y="${boxY + boxH + 20}" font-size="13" fill="#aaaacc" font-family="Arial,sans-serif">${awayPctStr}</text>
  ${makeProgressBar(opts.awayPct, opts.awayPct > 30 ? "#2ecc71" : "#e74c3c", awayBoxX, boxY + boxH + 26, boxW)}
</svg>`;
}

router.get("/match-image/:matchId", async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId, 10);
    if (isNaN(matchId)) return res.status(400).send("Invalid match ID");

    const match = await db.query.matchesTable.findFirst({
      where: eq(matchesTable.id, matchId),
    });
    if (!match) return res.status(404).send("Match not found");

    const betCounts = await db
      .select({
        betType: betsTable.betType,
        total: sql<number>`SUM(${betsTable.amount})`,
      })
      .from(betsTable)
      .where(eq(betsTable.matchId, matchId))
      .groupBy(betsTable.betType);

    const totals = { home: 0, draw: 0, away: 0, scorer: 0 };
    for (const row of betCounts) {
      if (row.betType in totals) totals[row.betType as keyof typeof totals] = Number(row.total);
    }
    const grand = totals.home + totals.draw + totals.away + totals.scorer || 1;
    const homePct = Math.round((totals.home / grand) * 100);
    const drawPct = Math.round((totals.draw / grand) * 100);
    const awayPct = Math.round(((totals.away + totals.scorer) / grand) * 100);
    const totalBets = totals.home + totals.draw + totals.away + totals.scorer;

    const mostBetted: "home" | "draw" | "away" =
      totals.home >= totals.draw && totals.home >= totals.away ? "home" :
      totals.away >= totals.draw ? "away" : "draw";

    const svg = generateSVG({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeEmoji: match.homeTeamEmoji,
      awayEmoji: match.awayTeamEmoji,
      homeOdds: match.homeOdds,
      drawOdds: match.drawOdds,
      awayOdds: match.awayOdds,
      homePct,
      drawPct,
      awayPct,
      competition: match.competition,
      matchDate: new Date(match.matchDate),
      totalBets,
      mostBetted,
    });

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(pngBuffer);
  } catch (err) {
    console.error("[match-image]", err);
    res.status(500).send("Image generation error");
  }
});

export default router;
