import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq, desc } from "drizzle-orm";
import { db, betsTable, matchesTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";

const STATUS: Record<string, string> = { pending: "⏳ En attente", won: "✅ Gagné", lost: "❌ Perdu" };

export async function slashTicket(i: ChatInputCommandInteraction) {
  const user = await getOrCreateUser(i.user);

  const bets = await db.select({
    id: betsTable.id, amount: betsTable.amount, betValue: betsTable.betValue,
    odds: betsTable.odds, potentialWin: betsTable.potentialWin, status: betsTable.status,
    createdAt: betsTable.createdAt, homeTeam: matchesTable.homeTeam, awayTeam: matchesTable.awayTeam,
    homeEmoji: matchesTable.homeTeamEmoji, awayEmoji: matchesTable.awayTeamEmoji,
  }).from(betsTable)
    .innerJoin(matchesTable, eq(betsTable.matchId, matchesTable.id))
    .where(eq(betsTable.userId, user.id))
    .orderBy(desc(betsTable.createdAt))
    .limit(10);

  if (bets.length === 0) return i.reply({ content: "📭 Aucun pari. Utilise `/matchs` pour voir les matchs !", ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Tickets de ${i.user.username}`)
    .setColor(0x5865f2)
    .setThumbnail(i.user.displayAvatarURL({ size: 64 }))
    .setDescription(`Tes **${bets.length}** derniers paris :`);

  for (const bet of bets) {
    const st = STATUS[bet.status] ?? bet.status;
    embed.addFields({
      name: `${st} #${bet.id} — ${bet.homeEmoji}${bet.homeTeam} vs ${bet.awayEmoji}${bet.awayTeam}`,
      value: `🎯 **${bet.betValue}** (x${bet.odds.toFixed(2)}) | 💰 ${bet.amount} 🪙 → **${Math.floor(bet.potentialWin)} 🪙**`,
    });
  }

  embed.setFooter({ text: `Solde : ${user.coins} 🪙` }).setTimestamp();
  await i.reply({ embeds: [embed], ephemeral: true });
}
