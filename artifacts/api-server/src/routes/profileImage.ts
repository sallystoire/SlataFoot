import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import sharp from "sharp";

const router = Router();

function escapeXml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function makeBar(progress: number, total: number, maxWidth: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(progress, total) / total) * maxWidth);
}

function xpToNextLevel(xp: number): { level: number; progress: number; needed: number } {
  let level = 1;
  let needed = 100;
  let cumulative = 0;
  while (xp >= cumulative + needed) {
    cumulative += needed;
    level++;
    needed = Math.floor(needed * 1.25);
  }
  return { level, progress: xp - cumulative, needed };
}

function generateProfileSVG(opts: {
  username: string;
  level: number; progress: number; needed: number;
  coins: number; xp: number;
  wonBets: number; lostBets: number;
  totalTickets: number; referralCount: number;
  createdAt: string;
  winRate: number;
  avatarData: string | null;
}): string {
  const W = 800; const H = 320;
  const { level, progress, needed, winRate } = opts;
  const xpBarW = makeBar(progress, needed, 480);
  const xpPct = needed > 0 ? Math.round((progress / needed) * 100) : 0;
  const username = escapeXml(opts.username.slice(0, 20));
  const memberSince = new Date(opts.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long" });

  const statColor = (v: number, good: number) => v >= good ? "#2ecc71" : "#e74c3c";
  const rankLabel = level >= 30 ? "Légende" : level >= 20 ? "Expert" : level >= 10 ? "Pro" : level >= 5 ? "Confirmé" : "Débutant";
  const rankColor = level >= 30 ? "#f1c40f" : level >= 20 ? "#9b59b6" : level >= 10 ? "#3498db" : level >= 5 ? "#2ecc71" : "#95a5a6";

  const avatarSection = opts.avatarData
    ? `<image x="30" y="55" width="110" height="110" href="${opts.avatarData}" clip-path="url(#avatarClip)"/>`
    : `<circle cx="85" cy="110" r="55" fill="#2a2a4a"/>
       <text x="85" y="128" text-anchor="middle" font-size="40" font-weight="800" fill="${rankColor}" font-family="Arial,sans-serif">${username.charAt(0).toUpperCase()}</text>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0f1e"/>
      <stop offset="100%" stop-color="#1a1a3e"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f5fdb"/>
      <stop offset="100%" stop-color="#2a3aaa"/>
    </linearGradient>
    <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4f5fdb"/>
      <stop offset="100%" stop-color="#2ecc71"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1f4e" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#12122a" stop-opacity="0.95"/>
    </linearGradient>
    <clipPath id="avatarClip"><circle cx="85" cy="110" r="55"/></clipPath>
    <clipPath id="outer"><rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="18"/></clipPath>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="22" fill="url(#borderGrad)"/>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="18" fill="url(#bgGrad)"/>

  <g clip-path="url(#outer)">
    <!-- Header bar -->
    <rect x="4" y="4" width="${W - 8}" height="46" fill="url(#borderGrad)"/>
    <text x="24" y="34" font-size="17" font-weight="700" fill="white" font-family="Arial,Helvetica,sans-serif">⚽ SlataFoot — Profil</text>
    <rect x="4" y="50" width="${W - 8}" height="4" fill="#2ecc71"/>

    <!-- Avatar zone -->
    ${avatarSection}
    <!-- Avatar ring -->
    <circle cx="85" cy="110" r="57" fill="none" stroke="${rankColor}" stroke-width="4"/>

    <!-- Rank badge -->
    <rect x="30" y="175" width="110" height="26" rx="13" fill="${rankColor}" opacity="0.9"/>
    <text x="85" y="193" text-anchor="middle" font-size="13" font-weight="700" fill="white" font-family="Arial,sans-serif">${rankLabel}</text>

    <!-- Username & level -->
    <text x="165" y="90" font-size="26" font-weight="800" fill="white" font-family="Arial,Helvetica,sans-serif">${username}</text>
    <text x="165" y="115" font-size="14" fill="#aab" font-family="Arial,sans-serif">Membre depuis ${escapeXml(memberSince)}</text>

    <!-- Level circle -->
    <circle cx="660" cy="82" r="38" fill="#12122a" stroke="${rankColor}" stroke-width="3"/>
    <text x="660" y="77" text-anchor="middle" font-size="12" fill="#aab" font-family="Arial,sans-serif">NIVEAU</text>
    <text x="660" y="103" text-anchor="middle" font-size="30" font-weight="800" fill="${rankColor}" font-family="Arial,sans-serif">${level}</text>

    <!-- Coins display -->
    <text x="165" y="145" font-size="20" font-weight="700" fill="#f1c40f" font-family="Arial,sans-serif">🪙 ${opts.coins.toLocaleString("fr-FR")} coins</text>

    <!-- XP Bar -->
    <text x="165" y="175" font-size="12" fill="#aab" font-family="Arial,sans-serif">XP vers niveau ${level + 1} — ${progress}/${needed} (${xpPct}%)</text>
    <rect x="165" y="180" width="480" height="12" rx="6" fill="#1e1e3e"/>
    <rect x="165" y="180" width="${xpBarW}" height="12" rx="6" fill="url(#xpGrad)"/>

    <!-- Stats cards -->
    <!-- Tickets -->
    <rect x="165" y="210" width="108" height="72" rx="12" fill="url(#cardGrad)"/>
    <text x="219" y="235" text-anchor="middle" font-size="12" fill="#aab" font-family="Arial,sans-serif">🎫 Tickets</text>
    <text x="219" y="268" text-anchor="middle" font-size="26" font-weight="800" fill="white" font-family="Arial,sans-serif">${opts.totalTickets}</text>

    <!-- Won -->
    <rect x="283" y="210" width="108" height="72" rx="12" fill="url(#cardGrad)"/>
    <text x="337" y="235" text-anchor="middle" font-size="12" fill="#aab" font-family="Arial,sans-serif">✅ Gagnés</text>
    <text x="337" y="268" text-anchor="middle" font-size="26" font-weight="800" fill="#2ecc71" font-family="Arial,sans-serif">${opts.wonBets}</text>

    <!-- Lost -->
    <rect x="401" y="210" width="108" height="72" rx="12" fill="url(#cardGrad)"/>
    <text x="455" y="235" text-anchor="middle" font-size="12" fill="#aab" font-family="Arial,sans-serif">❌ Perdus</text>
    <text x="455" y="268" text-anchor="middle" font-size="26" font-weight="800" fill="#e74c3c" font-family="Arial,sans-serif">${opts.lostBets}</text>

    <!-- Win rate -->
    <rect x="519" y="210" width="120" height="72" rx="12" fill="url(#cardGrad)"/>
    <text x="579" y="235" text-anchor="middle" font-size="12" fill="#aab" font-family="Arial,sans-serif">📈 Win Rate</text>
    <text x="579" y="268" text-anchor="middle" font-size="26" font-weight="800" fill="${statColor(winRate, 50)}" font-family="Arial,sans-serif">${winRate}%</text>

    <!-- Referrals -->
    <rect x="649" y="210" width="120" height="72" rx="12" fill="url(#cardGrad)"/>
    <text x="709" y="235" text-anchor="middle" font-size="12" fill="#aab" font-family="Arial,sans-serif">🤝 Filleuls</text>
    <text x="709" y="268" text-anchor="middle" font-size="26" font-weight="800" fill="${rankColor}" font-family="Arial,sans-serif">${opts.referralCount}</text>

    <!-- Footer -->
    <text x="${W - 16}" y="${H - 10}" text-anchor="end" font-size="11" fill="#555" font-family="Arial,sans-serif">SlataFoot ⚽ • ${new Date().toLocaleDateString("fr-FR")}</text>
  </g>
</svg>`;
}

router.get("/profile-image/:discordId", async (req, res) => {
  try {
    const { discordId } = req.params;
    const avatarUrl = req.query.avatar as string | undefined;

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.discordId, discordId) });
    if (!user) return res.status(404).send("User not found");

    const { level, progress, needed } = xpToNextLevel(user.xp);
    const total = user.wonBets + user.lostBets;
    const winRate = total > 0 ? Math.round((user.wonBets / total) * 100) : 0;

    let avatarData: string | null = null;
    if (avatarUrl) {
      try {
        const avatarRes = await fetch(avatarUrl, { signal: AbortSignal.timeout(5000) });
        if (avatarRes.ok) {
          const buf = await sharp(Buffer.from(await avatarRes.arrayBuffer()))
            .resize(110, 110)
            .png()
            .toBuffer();
          avatarData = `data:image/png;base64,${buf.toString("base64")}`;
        }
      } catch {}
    }

    const svgStr = generateProfileSVG({
      username: user.username,
      level, progress, needed,
      coins: user.coins,
      xp: user.xp,
      wonBets: user.wonBets,
      lostBets: user.lostBets,
      totalTickets: user.totalTickets,
      referralCount: user.referralCount,
      createdAt: user.createdAt.toISOString(),
      winRate,
      avatarData,
    });

    const png = await sharp(Buffer.from(svgStr)).resize(800, 320).png().toBuffer();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(png);
  } catch (err) {
    console.error("[profile-image]", err);
    res.status(500).send("Error");
  }
});

export default router;
