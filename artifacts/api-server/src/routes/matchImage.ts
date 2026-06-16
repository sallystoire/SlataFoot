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
    await sharp(buf).resize(860, 500, { fit: "cover", position: "center" }).jpeg({ quality: 85 }).toFile(filePath);
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
  return { line1: d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }), line2: time };
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateUISVG(opts: {
  homeTeam: string; awayTeam: string;
  homeOdds: number; drawOdds: number; awayOdds: number;
  homePct: number; drawPct: number; awayPct: number;
  competition: string; matchDate: Date; totalBets: number;
  mostBetted: "home" | "draw" | "away"; hasBg: boolean;
}): string {
  const W = 860; const H = 500;
  const { line1, line2 } = formatDate(opts.matchDate);
  const ht = escapeXml(opts.homeTeam); const at = escapeXml(opts.awayTeam);
  const comp = escapeXml(opts.competition);

  const boxY = 340; const boxH = 80;
  const homeBoxX = 30; const drawBoxX = 300; const awayBoxX = 570; const boxW = 255;
  const homePW = Math.round((opts.homePct / 100) * boxW);
  const drawPW = Math.round((opts.drawPct / 100) * boxW);
  const awayPW = Math.round((opts.awayPct / 100) * boxW);

  const homeStroke = opts.mostBetted === "home" ? 'stroke="#ffffff" stroke-width="3"' : 'stroke="#444" stroke-width="1.5"';
  const drawStroke = opts.mostBetted === "draw" ? 'stroke="#ffffff" stroke-width="3"' : 'stroke="#444" stroke-width="1.5"';
  const awayStroke = opts.mostBetted === "away" ? 'stroke="#ffffff" stroke-width="3"' : 'stroke="#444" stroke-width="1.5"';
  const badgeX = opts.mostBetted === "home" ? homeBoxX + boxW / 2 : opts.mostBetted === "draw" ? drawBoxX + boxW / 2 : awayBoxX + boxW / 2;

  const darkBgOverlay = opts.hasBg
    ? `<rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="18" fill="rgba(0,0,0,0.35)"/>`
    : `<rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="18" fill="url(#darkBg)"/>`;

  const baseBg = opts.hasBg
    ? ""
    : `<rect width="${W}" height="${H}" rx="22" fill="#0d0d1a"/>`;

  const borderRect = opts.hasBg
    ? `<rect width="${W}" height="${H}" rx="22" fill="none" stroke="url(#borderGrad)" stroke-width="6"/>`
    : `<rect width="${W}" height="${H}" rx="22" fill="url(#borderGrad)"/>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff0080"/><stop offset="25%" stop-color="#ff8000"/>
      <stop offset="50%" stop-color="#ffff00"/><stop offset="75%" stop-color="#00ff80"/>
      <stop offset="100%" stop-color="#0080ff"/>
    </linearGradient>
    <linearGradient id="darkBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e1e2e"/><stop offset="100%" stop-color="#0d0d1a"/>
    </linearGradient>
    <linearGradient id="hdrGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4f5fdb"/><stop offset="100%" stop-color="#2a3aaa"/>
    </linearGradient>
    <linearGradient id="fadeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${opts.hasBg ? 0.82 : 1}"/>
    </linearGradient>
    <clipPath id="cc"><rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="18"/></clipPath>
  </defs>

  ${baseBg}
  ${borderRect}

  <g clip-path="url(#cc)">
    ${darkBgOverlay}
    <rect x="5" y="180" width="${W - 10}" height="315" fill="url(#fadeGrad)"/>
    <rect x="5" y="5" width="${W - 10}" height="58" fill="url(#hdrGrad)" opacity="${opts.hasBg ? 0.92 : 1}"/>
    <text x="22" y="42" font-size="19" font-weight="700" fill="white" font-family="Arial,Helvetica,sans-serif">${comp}</text>
    <rect x="5" y="63" width="${W - 10}" height="4" fill="#2ecc71"/>
    <rect x="${W - 72}" y="12" width="56" height="38" rx="9" fill="#1a1f6e"/>
    <text x="${W - 44}" y="39" text-anchor="middle" font-size="18" fill="white" font-family="Arial,sans-serif">👕</text>

    <text x="120" y="308" text-anchor="middle" font-size="22" font-weight="800" fill="white" font-family="Arial,sans-serif">${ht}</text>
    <text x="${W - 120}" y="308" text-anchor="middle" font-size="22" font-weight="800" fill="white" font-family="Arial,sans-serif">${at}</text>

    <text x="${W / 2}" y="255" text-anchor="middle" font-size="17" fill="#aac" font-family="Arial,sans-serif">${escapeXml(line1)}</text>
    <text x="${W / 2}" y="295" text-anchor="middle" font-size="36" font-weight="700" fill="white" font-family="Arial,sans-serif">${escapeXml(line2)}</text>

    <rect x="${badgeX - 55}" y="${boxY - 24}" width="110" height="22" rx="11" fill="#e74c3c"/>
    <text x="${badgeX}" y="${boxY - 7}" text-anchor="middle" font-size="12" fill="white" font-weight="700" font-family="Arial,sans-serif">${opts.totalBets} 🪙 misés</text>

    <rect x="${homeBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="#12122a" opacity="0.9" ${homeStroke}/>
    <text x="${homeBoxX + boxW / 2}" y="${boxY + 25}" text-anchor="middle" font-size="14" fill="#ccd" font-family="Arial,sans-serif">${ht}</text>
    <text x="${homeBoxX + boxW / 2}" y="${boxY + 63}" text-anchor="middle" font-size="32" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.homeOdds.toFixed(2)}</text>
    <text x="${homeBoxX}" y="${boxY + boxH + 18}" font-size="12" fill="#99a" font-family="Arial,sans-serif">${opts.homePct}%</text>
    <rect x="${homeBoxX}" y="${boxY + boxH + 22}" width="${boxW}" height="5" rx="2.5" fill="#333"/>
    <rect x="${homeBoxX}" y="${boxY + boxH + 22}" width="${homePW}" height="5" rx="2.5" fill="${opts.homePct > 35 ? "#2ecc71" : "#e74c3c"}"/>

    <rect x="${drawBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="#12122a" opacity="0.9" ${drawStroke}/>
    <text x="${drawBoxX + boxW / 2}" y="${boxY + 25}" text-anchor="middle" font-size="14" fill="#ccd" font-family="Arial,sans-serif">Match nul</text>
    <text x="${drawBoxX + boxW / 2}" y="${boxY + 63}" text-anchor="middle" font-size="32" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.drawOdds.toFixed(2)}</text>
    <text x="${drawBoxX}" y="${boxY + boxH + 18}" font-size="12" fill="#99a" font-family="Arial,sans-serif">${opts.drawPct}%</text>
    <rect x="${drawBoxX}" y="${boxY + boxH + 22}" width="${boxW}" height="5" rx="2.5" fill="#333"/>
    <rect x="${drawBoxX}" y="${boxY + boxH + 22}" width="${drawPW}" height="5" rx="2.5" fill="${opts.drawPct > 35 ? "#2ecc71" : "#e74c3c"}"/>

    <rect x="${awayBoxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="14" fill="#12122a" opacity="0.9" ${awayStroke}/>
    <text x="${awayBoxX + boxW / 2}" y="${boxY + 25}" text-anchor="middle" font-size="14" fill="#ccd" font-family="Arial,sans-serif">${at}</text>
    <text x="${awayBoxX + boxW / 2}" y="${boxY + 63}" text-anchor="middle" font-size="32" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.awayOdds.toFixed(2)}</text>
    <text x="${awayBoxX}" y="${boxY + boxH + 18}" font-size="12" fill="#99a" font-family="Arial,sans-serif">${opts.awayPct}%</text>
    <rect x="${awayBoxX}" y="${boxY + boxH + 22}" width="${boxW}" height="5" rx="2.5" fill="#333"/>
    <rect x="${awayBoxX}" y="${boxY + boxH + 22}" width="${awayPW}" height="5" rx="2.5" fill="${opts.awayPct > 35 ? "#2ecc71" : "#e74c3c"}"/>
  </g>
</svg>`;
}

async function generateMatchPng(matchId: number): Promise<Buffer> {
  const W = 860; const H = 500;

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match) throw new Error("Match not found");

  const betRows = await db.select({
    betType: betsTable.betType,
    total: sql<number>`COALESCE(SUM(${betsTable.amount}),0)`,
  }).from(betsTable).where(eq(betsTable.matchId, matchId)).groupBy(betsTable.betType);

  const totals = { home: 0, draw: 0, away: 0, scorer: 0 };
  for (const r of betRows) totals[r.betType as keyof typeof totals] = Number(r.total);
  const grand = Math.max(totals.home + totals.draw + totals.away + totals.scorer, 1);
  const homePct = Math.round((totals.home / grand) * 100);
  const drawPct = Math.round((totals.draw / grand) * 100);
  const awayPct = 100 - homePct - drawPct;
  const totalBets = totals.home + totals.draw + totals.away + totals.scorer;
  const mostBetted: "home" | "draw" | "away" = totals.home >= totals.draw && totals.home >= totals.away ? "home" : totals.away >= totals.draw ? "away" : "draw";

  const hasBg = !!match.backgroundImageUrl;

  const svgStr = generateUISVG({
    homeTeam: match.homeTeam, awayTeam: match.awayTeam,
    homeOdds: match.homeOdds, drawOdds: match.drawOdds, awayOdds: match.awayOdds,
    homePct, drawPct, awayPct, competition: match.competition,
    matchDate: new Date(match.matchDate), totalBets, mostBetted, hasBg,
  });

  const homeCode = getCountryCode(match.homeTeam);
  const awayCode = getCountryCode(match.awayTeam);

  const [homeFlagBuf, awayFlagBuf] = await Promise.all([
    homeCode ? fetchFlagBuffer(homeCode) : Promise.resolve(null),
    awayCode ? fetchFlagBuffer(awayCode) : Promise.resolve(null),
  ]);

  const flagComposites: sharp.OverlayOptions[] = [];
  if (homeFlagBuf) {
    const rf = await sharp(homeFlagBuf).resize(90, 68).png().toBuffer();
    flagComposites.push({ input: rf, top: 195, left: 75 });
  }
  if (awayFlagBuf) {
    const rf = await sharp(awayFlagBuf).resize(90, 68).png().toBuffer();
    flagComposites.push({ input: rf, top: 195, left: W - 165 });
  }

  const uiBuf = await sharp(Buffer.from(svgStr)).resize(W, H).png().toBuffer();

  if (hasBg) {
    const bgPath = path.resolve(process.cwd(), "public", "match-bg", `${matchId}.jpg`);
    try {
      const bgBuf = await fs.readFile(bgPath);
      const darkenedBg = await sharp(bgBuf)
        .resize(W, H, { fit: "cover" })
        .modulate({ brightness: 0.55 })
        .blur(2.5)
        .jpeg({ quality: 90 })
        .toBuffer();

      const composites: sharp.OverlayOptions[] = [
        { input: uiBuf, top: 0, left: 0 },
        ...flagComposites,
      ];

      return await sharp(darkenedBg).composite(composites).png().toBuffer();
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
