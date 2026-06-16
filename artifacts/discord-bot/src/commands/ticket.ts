import { EmbedBuilder, type Message } from "discord.js";
import { db, betsTable, matchesTable, usersTable } from "../db.js";
import { eq, and, desc } from "drizzle-orm";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";

const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳",
  won: "✅",
  lost: "❌",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  won: "Gagné",
  lost: "Perdu",
};

export async function ticketCommand(message: Message) {
  const user = await getOrCreateUser(message.author);

  const bets = await db
    .select({
      id: betsTable.id,
      amount: betsTable.amount,
      betValue: betsTable.betValue,
      odds: betsTable.odds,
      potentialWin: betsTable.potentialWin,
      status: betsTable.status,
      createdAt: betsTable.createdAt,
      homeTeam: matchesTable.homeTeam,
      awayTeam: matchesTable.awayTeam,
      homeTeamEmoji: matchesTable.homeTeamEmoji,
      awayTeamEmoji: matchesTable.awayTeamEmoji,
      matchDate: matchesTable.matchDate,
    })
    .from(betsTable)
    .innerJoin(matchesTable, eq(betsTable.matchId, matchesTable.id))
    .where(eq(betsTable.userId, user.id))
    .orderBy(desc(betsTable.createdAt))
    .limit(10);

  if (bets.length === 0) {
    return message.reply("📭 Tu n'as aucun pari. Utilise `-matchs` pour voir les matchs disponibles et `-mise` pour parier !");
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Tickets de ${message.author.username}`)
    .setColor(0x5865f2)
    .setThumbnail(message.author.displayAvatarURL({ size: 64 }))
    .setDescription(`Voici tes **${bets.length}** derniers paris :`);

  for (const bet of bets) {
    const emoji = STATUS_EMOJI[bet.status] ?? "❓";
    const label = STATUS_LABEL[bet.status] ?? bet.status;
    const dateStr = new Date(bet.createdAt).toLocaleDateString("fr-FR");

    embed.addFields({
      name: `${emoji} #${bet.id} — ${bet.homeTeamEmoji} ${bet.homeTeam} vs ${bet.awayTeamEmoji} ${bet.awayTeam}`,
      value: [
        `🎯 Pari : **${bet.betValue}** (x${bet.odds.toFixed(2)})`,
        `💰 Mise : **${bet.amount} 🪙** | Gain potentiel : **${Math.floor(bet.potentialWin)} 🪙**`,
        `📊 Statut : **${label}** | 📅 ${dateStr}`,
      ].join("\n"),
      inline: false,
    });
  }

  embed.setFooter({ text: `Solde actuel : ${user.coins} 🪙` }).setTimestamp();

  await message.reply({ embeds: [embed] });
}
