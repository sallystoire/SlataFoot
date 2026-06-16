import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, betsTable, matchesTable, couponsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import sharp from "sharp";

const router = Router();

function escapeXml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STATUS_COLOR: Record<string, string> = { pending: "#f1c40f", won: "#2ecc71", lost: "#e74c3c" };
const STATUS_LABEL: Record<string, string> = { pending: "⏳ EN ATTENTE", won: "✅ GAGNÉ", lost: "❌ PERDU" };

router.get("/ticket-image/:discordId", async (req, res) => {
  try {
    const { discordId } = req.params;
    const avatarUrl = req.query.avatar as string | undefined;

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.discordId, discordId) });
    if (!user) return res.status(404).send("User not found");

    const bets = await db.select({
      id: betsTable.id,
      amount: betsTable.amount,
      betValue: betsTable.betValue,
      odds: betsTable.odds,
      potentialWin: betsTable.potentialWin,
      status: betsTable.status,
      homeTeam: matchesTable.homeTeam,
      awayTeam: matchesTable.awayTeam,
      homeEmoji: matchesTable.homeTeamEmoji,
      awayEmoji: matchesTable.awayTeamEmoji,
      competition: matchesTable.competition,
    }).from(betsTable)
      .innerJoin(matchesTable, eq(betsTable.matchId, matchesTable.id))
      .where(eq(betsTable.userId, user.id))
      .orderBy(desc(betsTable.createdAt))
      .limit(8);

    const coupons = await db.query.couponsTable.findMany({
      where: eq(couponsTable.userId, user.id),
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
      limit: 3,
    });

    const W = 800;
    const HEADER_H = 80;
    const ROW_H = 68;
    const COUPON_H = 56;
    const PADDING = 14;
    const totalRows = bets.length + coupons.length;
    const H = Math.max(280, HEADER_H + (totalRows > 0 ? totalRows * ROW_H + 40 : 80) + 60);

    let avatarData: string | null = null;
    if (avatarUrl) {
      try {
        const r = await fetch(avatarUrl, { signal: AbortSignal.timeout(5000) });
        if (r.ok) {
          const buf = await sharp(Buffer.from(await r.arrayBuffer())).resize(52, 52).png().toBuffer();
          avatarData = `data:image/png;base64,${buf.toString("base64")}`;
        }
      } catch {}
    }

    const pendingBets = bets.filter((b) => b.status === "pending");
    const totalMised = bets.reduce((s, b) => s + b.amount, 0);
    const totalGain = bets.filter((b) => b.status === "won").reduce((s, b) => s + Math.floor(b.potentialWin), 0);

    const avatarEl = avatarData
      ? `<image x="20" y="14" width="52" height="52" href="${avatarData}" clip-path="url(#avatarClip)"/>`
      : `<circle cx="46" cy="40" r="26" fill="#2a3aaa"/><text x="46" y="49" text-anchor="middle" font-size="22" fill="white" font-family="Arial,sans-serif">${escapeXml(user.username.charAt(0).toUpperCase())}</text>`;

    const betsRows = bets.map((b, idx) => {
      const y = HEADER_H + PADDING + idx * ROW_H;
      const col = STATUS_COLOR[b.status] ?? "#888";
      const lbl = STATUS_LABEL[b.status] ?? b.status;
      const odd = b.odds.toFixed(2);
      const pot = Math.floor(b.potentialWin);
      return `
      <rect x="12" y="${y}" width="${W - 24}" height="${ROW_H - 6}" rx="10" fill="#0f1229" stroke="${col}" stroke-width="1.5"/>
      <rect x="12" y="${y}" width="6" height="${ROW_H - 6}" rx="3" fill="${col}"/>
      <text x="28" y="${y + 22}" font-size="13" fill="#ccd" font-family="Arial,sans-serif">${escapeXml(b.homeEmoji + b.homeTeam)} vs ${escapeXml(b.awayEmoji + b.awayTeam)}</text>
      <text x="28" y="${y + 42}" font-size="12" fill="white" font-weight="700" font-family="Arial,sans-serif">🎯 ${escapeXml(b.betValue)} · x${odd}</text>
      <text x="${W - 30}" y="${y + 22}" text-anchor="end" font-size="12" fill="#aab" font-family="Arial,sans-serif">${b.amount} 🪙 → ${pot} 🪙</text>
      <text x="${W - 30}" y="${y + 43}" text-anchor="end" font-size="11" font-weight="700" fill="${col}" font-family="Arial,sans-serif">${lbl}</text>`;
    }).join("");

    const couponRows = coupons.map((c, idx) => {
      const y = HEADER_H + PADDING + bets.length * ROW_H + idx * COUPON_H + 8;
      const col = STATUS_COLOR[c.status] ?? "#888";
      const lbl = STATUS_LABEL[c.status] ?? c.status;
      const labels = (c.matchLabels as string[]).join(" · ");
      return `
      <rect x="12" y="${y}" width="${W - 24}" height="${COUPON_H - 6}" rx="10" fill="#1a0a2e" stroke="${col}" stroke-width="1.5"/>
      <rect x="12" y="${y}" width="6" height="${COUPON_H - 6}" rx="3" fill="#9b59b6"/>
      <text x="28" y="${y + 20}" font-size="12" fill="#c8a0ff" font-weight="700" font-family="Arial,sans-serif">🎰 COUPON x${(c.combinedOdds as number).toFixed(2)}</text>
      <text x="28" y="${y + 38}" font-size="11" fill="#aab" font-family="Arial,sans-serif">${escapeXml(labels.slice(0, 60))}</text>
      <text x="${W - 30}" y="${y + 20}" text-anchor="end" font-size="12" fill="#aab" font-family="Arial,sans-serif">${c.amount} 🪙 → ${Math.floor(c.potentialWin as number)} 🪙</text>
      <text x="${W - 30}" y="${y + 39}" text-anchor="end" font-size="11" font-weight="700" fill="${col}" font-family="Arial,sans-serif">${lbl}</text>`;
    }).join("");

    const emptyMsg = totalRows === 0
      ? `<text x="${W / 2}" y="${HEADER_H + 60}" text-anchor="middle" font-size="16" fill="#556" font-family="Arial,sans-serif">Aucun pari pour le moment 📭</text>`
      : "";

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a1a"/>
      <stop offset="100%" stop-color="#111130"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4f5fdb"/>
      <stop offset="100%" stop-color="#2a3aaa"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f5fdb"/>
      <stop offset="100%" stop-color="#9b59b6"/>
    </linearGradient>
    <clipPath id="avatarClip"><circle cx="46" cy="40" r="26"/></clipPath>
    <clipPath id="outer"><rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="16"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" rx="20" fill="url(#borderGrad)"/>
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="16" fill="url(#bgGrad)"/>

  <g clip-path="url(#outer)">
    <rect x="3" y="3" width="${W - 6}" height="${HEADER_H - 3}" fill="url(#headerGrad)"/>
    ${avatarEl}
    <text x="86" y="33" font-size="18" font-weight="700" fill="white" font-family="Arial,Helvetica,sans-serif">🎫 ${escapeXml(user.username)}</text>
    <text x="86" y="54" font-size="13" fill="#ccd" font-family="Arial,sans-serif">${pendingBets.length} en attente · ${totalGain} 🪙 gagnés · Solde: ${user.coins} 🪙</text>

    <rect x="3" y="${HEADER_H - 3}" width="${W - 6}" height="4" fill="#2ecc71"/>

    ${betsRows}
    ${couponRows}
    ${emptyMsg}

    <text x="${W - 14}" y="${H - 12}" text-anchor="end" font-size="10" fill="#334" font-family="Arial,sans-serif">SlataFoot ⚽ · ${new Date().toLocaleDateString("fr-FR")}</text>
  </g>
</svg>`;

    const png = await sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(png);
  } catch (err) {
    console.error("[ticket-image]", err);
    res.status(500).send("Error");
  }
});

export default router;
