import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { xpToNextLevel } from "../utils/coins.js";
import { db, betsTable, usersTable } from "../db.js";
import { eq, desc, sum } from "drizzle-orm";

function makeBar(progress: number, total: number, length = 18): string {
  const filled = Math.round((progress / total) * length);
  return "▓".repeat(filled) + "░".repeat(length - filled);
}

export async function slashProfile(i: ChatInputCommandInteraction) {
  const target = i.options.getUser("user") ?? i.user;
  const user = await getOrCreateUser(target);

  const { level, progress, needed } = xpToNextLevel(user.xp);
  const bar = makeBar(progress, needed);
  const total = user.wonBets + user.lostBets;
  const winRate = total > 0 ? Math.round((user.wonBets / total) * 100) : 0;

  const embed = new EmbedBuilder()
    .setTitle(`👤 Profil de ${target.username}`)
    .setColor(0xf39c12)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "🪙 Coins", value: `**${user.coins.toLocaleString("fr-FR")} 🪙**`, inline: true },
      { name: "⭐ Niveau", value: `**${level}**`, inline: true },
      { name: "✨ XP", value: `**${user.xp}**`, inline: true },
      { name: `📊 Progression → Niv. ${level + 1}`, value: `\`${bar}\` ${progress}/${needed} XP`, inline: false },
      { name: "🎫 Tickets", value: `**${user.totalTickets}**`, inline: true },
      { name: "✅ Gagnés", value: `**${user.wonBets}**`, inline: true },
      { name: "❌ Perdus", value: `**${user.lostBets}**`, inline: true },
      { name: "📈 Win rate", value: `**${winRate}%**`, inline: true },
      { name: "🤝 Filleuls", value: `**${user.referralCount}**`, inline: true },
    )
    .setFooter({ text: `Membre depuis ${new Date(user.createdAt).toLocaleDateString("fr-FR")}` })
    .setTimestamp();

  await i.reply({ embeds: [embed], ephemeral: true });
}

export async function slashTop(i: ChatInputCommandInteraction) {
  const topUsers = await db.query.usersTable.findMany({
    orderBy: (u, { desc }) => [desc(u.coins)],
    limit: 10,
  });

  const embed = new EmbedBuilder()
    .setTitle("🏆 Classement des meilleurs parieurs")
    .setColor(0xffd700)
    .setDescription(
      topUsers.length === 0
        ? "_Aucun joueur pour l'instant._"
        : topUsers.map((u, idx) => {
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
            const total = u.wonBets + u.lostBets;
            const wr = total > 0 ? Math.round((u.wonBets / total) * 100) : 0;
            return `${medal} **${u.username}** — **${u.coins.toLocaleString("fr-FR")} 🪙** | ${u.wonBets}W/${u.lostBets}L (${wr}%)`;
          }).join("\n")
    )
    .setTimestamp();

  await i.reply({ embeds: [embed] });
}
