import { AttachmentBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq, desc } from "drizzle-orm";
import { db, betsTable, matchesTable, couponsTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { getApiBase } from "../utils/apiBase.js";

const STATUS: Record<string, string> = { pending: "⏳ En attente", won: "✅ Gagné", lost: "❌ Perdu" };

export async function slashTicket(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const user = await getOrCreateUser(i.user);
  const avatarUrl = i.user.displayAvatarURL({ size: 128, extension: "png" });
  const imageUrl = `${getApiBase()}/api/ticket-image/${i.user.id}?avatar=${encodeURIComponent(avatarUrl)}&t=${Date.now()}`;

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const attachment = new AttachmentBuilder(buf, { name: "ticket.png" });

    const bets = await db.select({
      id: betsTable.id, status: betsTable.status,
    }).from(betsTable).where(eq(betsTable.userId, user.id)).orderBy(desc(betsTable.createdAt)).limit(8);

    const coupons = await db.query.couponsTable.findMany({
      where: eq(couponsTable.userId, user.id),
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
      limit: 3,
    });

    const pending = bets.filter((b) => b.status === "pending").length;
    const won = bets.filter((b) => b.status === "won").length;
    const lost = bets.filter((b) => b.status === "lost").length;

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Tickets de ${i.user.username}`)
      .setColor(0x5865f2)
      .setImage("attachment://ticket.png")
      .addFields(
        { name: "⏳ En attente", value: `**${pending}**`, inline: true },
        { name: "✅ Gagnés", value: `**${won}**`, inline: true },
        { name: "❌ Perdus", value: `**${lost}**`, inline: true },
        { name: "🪙 Solde", value: `**${user.coins.toLocaleString("fr-FR")} 🪙**`, inline: true },
        { name: "🎰 Coupons", value: `**${coupons.length}**`, inline: true },
      )
      .setFooter({ text: "SlataFoot ⚽ — Tes 8 derniers paris + 3 coupons" })
      .setTimestamp();

    await i.editReply({ embeds: [embed], files: [attachment] });
  } catch (e) {
    console.error("[slashTicket image]", e);
    const bets = await db.select({
      id: betsTable.id, amount: betsTable.amount, betValue: betsTable.betValue,
      odds: betsTable.odds, potentialWin: betsTable.potentialWin, status: betsTable.status,
      createdAt: betsTable.createdAt, homeTeam: matchesTable.homeTeam, awayTeam: matchesTable.awayTeam,
      homeEmoji: matchesTable.homeTeamEmoji, awayEmoji: matchesTable.awayTeamEmoji,
    }).from(betsTable)
      .innerJoin(matchesTable, eq(betsTable.matchId, matchesTable.id))
      .where(eq(betsTable.userId, user.id))
      .orderBy(desc(betsTable.createdAt))
      .limit(8);

    if (bets.length === 0) return i.editReply("📭 Aucun pari. Utilise `/matchs` pour voir les matchs !");

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Tickets de ${i.user.username}`)
      .setColor(0x5865f2)
      .setDescription(
        bets.map((b) => `${STATUS[b.status] ?? b.status} **${b.homeEmoji}${b.homeTeam} vs ${b.awayEmoji}${b.awayTeam}** · ${b.betValue} x${b.odds.toFixed(2)} · ${b.amount}→${Math.floor(b.potentialWin)} 🪙`).join("\n")
      )
      .setFooter({ text: `Solde : ${user.coins} 🪙` })
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  }
}
