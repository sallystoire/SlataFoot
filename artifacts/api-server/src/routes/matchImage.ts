import { Router } from "express";
import path from "path";
import fs from "fs/promises";
import { db } from "@workspace/db";
import { matchesTable, betsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { getCountryCode, fetchFlagBuffer } from "./flagsHelper.js";

const router = Router();

const BG_DIR = path.resolve(process.cwd(), "public", "match-bg");
fs.mkdir(BG_DIR, { recursive: true }).catch(() => {});

export async function saveMatchBackground(matchId: number, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const filePath = path.join(BG_DIR, `${matchId}.jpg`);
    await sharp(buf).resize(860, 500, { fit: "cover", position: "center" }).jpeg({ quality: 90 }).toFile(filePath);
    return `/api/match-bg/${matchId}.jpg`;
  } catch (e) {
    console.error("[saveMatchBackground]", e);
    return null;
  }
}

function formatDate(d: Date): { line1: string; line2: string } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return { line1: "Aujourd'hui", line2: time };
  if (d.toDateString() === tomorrow.toDateString()) return { line1: "Demain", line2: time };
  return {
    line1: d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }),
    line2: time,
  };
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateUISVG(opts: {
  homeTeam: string;
  awayTeam: string;
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
  hasBg: boolean;
}): string {
  const W = 860;
  const H = 500;
  const { line1, line2 } = formatDate(opts.matchDate);
  const ht = escapeXml(opts.homeTeam);
  const at = escapeXml(opts.awayTeam);
  const comp = escapeXml(opts.competition);

  // Betting boxes layout
  const boxY = 332;
  const boxH = 82;
  const boxW = 258;
  const homeBoxX = 28;
  const drawBoxX = 301;
  const awayBoxX = 574;

  const homePW = Math.max(4, Math.round((opts.homePct / 100) * boxW));
  const drawPW = Math.max(4, Math.round((opts.drawPct / 100) * boxW));
  const awayPW = Math.max(4, Math.round((opts.awayPct / 100) * boxW));

  const homeSelected = opts.mostBetted === "home";
  const drawSelected = opts.mostBetted === "draw";
  const awaySelected = opts.mostBetted === "away";

  const badgeCX =
    opts.mostBetted === "home"
      ? homeBoxX + boxW / 2
      : opts.mostBetted === "draw"
        ? drawBoxX + boxW / 2
        : awayBoxX + boxW / 2;

  // Flag placeholder circles (actual flag images composited separately in sharp)
  const flagSize = 90;
  const homeFlagCX = 120;
  const awayFlagCX = W - 120;
  const flagCY = 205;

  // Bottom fade gradient height
  const fadeStart = opts.hasBg ? 160 : 110;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff0080"/>
      <stop offset="25%" stop-color="#ff8000"/>
      <stop offset="50%" stop-color="#ffff00"/>
      <stop offset="75%" stop-color="#00ff80"/>
      <stop offset="100%" stop-color="#0080ff"/>
    </linearGradient>
    <linearGradient id="darkBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </linearGradient>
    <linearGradient id="hdrGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4a5cc8"/>
      <stop offset="100%" stop-color="#283499"/>
    </linearGradient>
    <linearGradient id="fadeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${opts.hasBg ? 0.88 : 1}"/>
    </linearGradient>
    <linearGradient id="barHome" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#27ae60"/>
      <stop offset="100%" stop-color="#2ecc71"/>
    </linearGradient>
    <linearGradient id="barDraw" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e67e22"/>
      <stop offset="100%" stop-color="#f39c12"/>
    </linearGradient>
    <linearGradient id="barAway" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c0392b"/>
      <stop offset="100%" stop-color="#e74c3c"/>
    </linearGradient>
    <clipPath id="cardClip">
      <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="18"/>
    </clipPath>
  </defs>

  <!-- Rainbow border -->
  <rect width="${W}" height="${H}" rx="22" fill="url(#borderGrad)"/>

  <g clip-path="url(#cardClip)">

    <!-- Background (dark if no image) -->
    ${!opts.hasBg ? `<rect x="5" y="5" width="${W - 10}" height="${H - 10}" fill="url(#darkBg)"/>` : ""}

    <!-- Bottom fade gradient over image -->
    <rect x="5" y="${fadeStart}" width="${W - 10}" height="${H - fadeStart}" fill="url(#fadeGrad)"/>

    <!-- Header bar -->
    <rect x="5" y="5" width="${W - 10}" height="58" rx="4" fill="url(#hdrGrad)" opacity="0.95"/>

    <!-- Header icons -->
    <text x="22" y="43" font-size="26" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">⚽</text>
    <text x="52" y="43" font-size="26" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">🏆</text>

    <!-- Competition name -->
    <text x="90" y="42" font-size="19" font-weight="700" fill="white" font-family="Arial,Helvetica,sans-serif" letter-spacing="0.3">${comp}</text>

    <!-- Jersey badge (top right) -->
    <rect x="${W - 68}" y="12" width="52" height="36" rx="8" fill="#1a2280"/>
    <text x="${W - 42}" y="39" text-anchor="middle" font-size="20" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif">👕</text>

    <!-- Green accent line -->
    <rect x="5" y="63" width="${W - 10}" height="3" fill="#2ecc71"/>

    <!-- Flag shadow rings (flags composited on top by sharp) -->
    <circle cx="${homeFlagCX}" cy="${flagCY}" r="${flagSize / 2 + 5}" fill="rgba(0,0,0,0.35)"/>
    <circle cx="${homeFlagCX}" cy="${flagCY}" r="${flagSize / 2 + 5}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <circle cx="${awayFlagCX}" cy="${flagCY}" r="${flagSize / 2 + 5}" fill="rgba(0,0,0,0.35)"/>
    <circle cx="${awayFlagCX}" cy="${flagCY}" r="${flagSize / 2 + 5}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>

    <!-- Team names -->
    <text x="${homeFlagCX}" y="320" text-anchor="middle" font-size="22" font-weight="800" fill="white" font-family="Arial,Helvetica,sans-serif">${ht}</text>
    <text x="${awayFlagCX}" y="320" text-anchor="middle" font-size="22" font-weight="800" fill="white" font-family="Arial,Helvetica,sans-serif">${at}</text>

    <!-- Date / time center -->
    <text x="${W / 2}" y="262" text-anchor="middle" font-size="16" fill="#c8d8ff" font-family="Arial,Helvetica,sans-serif" font-weight="500">${escapeXml(line1)}</text>
    <text x="${W / 2}" y="302" text-anchor="middle" font-size="38" font-weight="700" fill="white" font-family="Arial,Helvetica,sans-serif">${escapeXml(line2)}</text>

    <!-- === BETTING BOXES === -->

    <!-- Home box -->
    <rect x="${homeBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${homeSelected ? "rgba(255,255,255,0.12)" : "rgba(18,18,36,0.88)"}"/>
    <rect x="${homeBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="none" stroke="${homeSelected ? "#ffffff" : "#2a2a4a"}" stroke-width="${homeSelected ? "3" : "1.5"}"/>
    <text x="${homeBoxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" font-size="13" fill="#9999bb" font-family="Arial,Helvetica,sans-serif">${ht}</text>
    <text x="${homeBoxX + boxW / 2}" y="${boxY + 66}" text-anchor="middle" font-size="34" font-weight="800" fill="#e74c3c" font-family="Arial,Helvetica,sans-serif">${opts.homeOdds.toFixed(2)}</text>

    <!-- Draw box -->
    <rect x="${drawBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${drawSelected ? "rgba(255,255,255,0.12)" : "rgba(18,18,36,0.88)"}"/>
    <rect x="${drawBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="none" stroke="${drawSelected ? "#ffffff" : "#2a2a4a"}" stroke-width="${drawSelected ? "3" : "1.5"}"/>
    <text x="${drawBoxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" font-size="13" fill="#9999bb" font-family="Arial,Helvetica,sans-serif">Match nul</text>
    <text x="${drawBoxX + boxW / 2}" y="${boxY + 66}" text-anchor="middle" font-size="34" font-weight="800" fill="#e74c3c" font-family="Arial,Helvetica,sans-serif">${opts.drawOdds.toFixed(2)}</text>

    <!-- Away box -->
    <rect x="${awayBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="${awaySelected ? "rgba(255,255,255,0.12)" : "rgba(18,18,36,0.88)"}"/>
    <rect x="${awayBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="none" stroke="${awaySelected ? "#ffffff" : "#2a2a4a"}" stroke-width="${awaySelected ? "3" : "1.5"}"/>
    <text x="${awayBoxX + boxW / 2}" y="${boxY + 26}" text-anchor="middle" font-size="13" fill="#9999bb" font-family="Arial,Helvetica,sans-serif">${at}</text>
    <text x="${awayBoxX + boxW / 2}" y="${boxY + 66}" text-anchor="middle" font-size="34" font-weight="800" fill="#e74c3c" font-family="Arial,Helvetica,sans-serif">${opts.awayOdds.toFixed(2)}</text>

    <!-- Most-betted badge -->
    <rect x="${badgeCX - 58}" y="${boxY - 22}" width="116" height="20" rx="10" fill="#e74c3c"/>
    <text x="${badgeCX}" y="${boxY - 7}" text-anchor="middle" font-size="11" fill="white" font-weight="700" font-family="Arial,Helvetica,sans-serif">${opts.totalBets} 🪙 misés</text>

    <!-- Progress bars -->
    <!-- Home -->
    <text x="${homeBoxX + 4}" y="${boxY + boxH + 17}" font-size="12" fill="#8888aa" font-family="Arial,Helvetica,sans-serif">${opts.homePct}%</text>
    <rect x="${homeBoxX}" y="${boxY + boxH + 22}" width="${boxW}" height="5" rx="2.5" fill="#222240"/>
    <rect x="${homeBoxX}" y="${boxY + boxH + 22}" width="${homePW}" height="5" rx="2.5" fill="url(#barHome)"/>

    <!-- Draw -->
    <text x="${drawBoxX + 4}" y="${boxY + boxH + 17}" font-size="12" fill="#8888aa" font-family="Arial,Helvetica,sans-serif">${opts.drawPct}%</text>
    <rect x="${drawBoxX}" y="${boxY + boxH + 22}" width="${boxW}" height="5" rx="2.5" fill="#222240"/>
    <rect x="${drawBoxX}" y="${boxY + boxH + 22}" width="${drawPW}" height="5" rx="2.5" fill="url(#barDraw)"/>

    <!-- Away -->
    <text x="${awayBoxX + 4}" y="${boxY + boxH + 17}" font-size="12" fill="#8888aa" font-family="Arial,Helvetica,sans-serif">${opts.awayPct}%</text>
    <rect x="${awayBoxX}" y="${boxY + boxH + 22}" width="${boxW}" height="5" rx="2.5" fill="#222240"/>
    <rect x="${awayBoxX}" y="${boxY + boxH + 22}" width="${awayPW}" height="5" rx="2.5" fill="url(#barAway)"/>

  </g>
</svg>`;
}

async function makeCircularFlag(buf: Buffer, size: number): Promise<Buffer> {
  const half = size / 2;
  const circleMask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="${half}" cy="${half}" r="${half}" fill="white"/>` +
      `</svg>`,
  );
  return sharp(buf)
    .resize(size, size, { fit: "cover", position: "center" })
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function generateMatchPng(matchId: number): Promise<Buffer> {
  const W = 860;
  const H = 500;

  const match = await db.query.matchesTable.findFirst({
    where: eq(matchesTable.id, matchId),
  });
  if (!match) throw new Error("Match not found");

  const betRows = await db
    .select({
      betType: betsTable.betType,
      total: sql<number>`COALESCE(SUM(${betsTable.amount}),0)`,
    })
    .from(betsTable)
    .where(eq(betsTable.matchId, matchId))
    .groupBy(betsTable.betType);

  const totals = { home: 0, draw: 0, away: 0, scorer: 0 };
  for (const r of betRows)
    totals[r.betType as keyof typeof totals] = Number(r.total);
  const grand = Math.max(totals.home + totals.draw + totals.away + totals.scorer, 1);
  const homePct = Math.round((totals.home / grand) * 100);
  const drawPct = Math.round((totals.draw / grand) * 100);
  const awayPct = 100 - homePct - drawPct;
  const totalBets = totals.home + totals.draw + totals.away + totals.scorer;
  const mostBetted: "home" | "draw" | "away" =
    totals.home >= totals.draw && totals.home >= totals.away
      ? "home"
      : totals.away >= totals.draw
        ? "away"
        : "draw";

  const hasBg = !!match.backgroundImageUrl;

  const svgStr = generateUISVG({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
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
    hasBg,
  });

  const homeCode = getCountryCode(match.homeTeam);
  const awayCode = getCountryCode(match.awayTeam);

  const [homeFlagRaw, awayFlagRaw] = await Promise.all([
    homeCode ? fetchFlagBuffer(homeCode) : Promise.resolve(null),
    awayCode ? fetchFlagBuffer(awayCode) : Promise.resolve(null),
  ]);

  // Circular flags, 90×90
  const FLAG_SIZE = 90;
  const homeFlagCX = 120;
  const awayFlagCX = W - 120;
  const flagTop = 205 - FLAG_SIZE / 2; // center Y = 205

  const flagComposites: sharp.OverlayOptions[] = [];
  if (homeFlagRaw) {
    const cf = await makeCircularFlag(homeFlagRaw, FLAG_SIZE);
    flagComposites.push({ input: cf, top: flagTop, left: homeFlagCX - FLAG_SIZE / 2 });
  }
  if (awayFlagRaw) {
    const cf = await makeCircularFlag(awayFlagRaw, FLAG_SIZE);
    flagComposites.push({ input: cf, top: flagTop, left: awayFlagCX - FLAG_SIZE / 2 });
  }

  const uiBuf = await sharp(Buffer.from(svgStr)).resize(W, H).png().toBuffer();

  if (hasBg) {
    const bgPath = path.resolve(process.cwd(), "public", "match-bg", `${matchId}.jpg`);
    try {
      const bgBuf = await fs.readFile(bgPath);
      // Show image clearly — only slightly darken, no blur
      const processedBg = await sharp(bgBuf)
        .resize(W, H, { fit: "cover", position: "center" })
        .modulate({ brightness: 0.78 })
        .jpeg({ quality: 92 })
        .toBuffer();

      return await sharp(processedBg)
        .composite([{ input: uiBuf, top: 0, left: 0 }, ...flagComposites])
        .png()
        .toBuffer();
    } catch (e) {
      console.error("[bg load failed, fallback]", e);
    }
  }

  return await sharp(uiBuf).composite(flagComposites).png().toBuffer();
}

router.get("/match-image/:matchId", async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId, 10);
    if (isNaN(matchId)) return res.status(400).send("Invalid ID");
    const png = await generateMatchPng(matchId);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(png);
  } catch (err: any) {
    if (err.message === "Match not found") return res.status(404).send("Match not found");
    console.error("[match-image]", err);
    res.status(500).send("Error");
  }
});

export default router;
