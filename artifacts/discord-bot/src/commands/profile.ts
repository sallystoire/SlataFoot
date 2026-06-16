import { EmbedBuilder, type Message } from "discord.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { xpToNextLevel } from "../utils/coins.js";

function makeProgressBar(progress: number, total: number, length = 20): string {
  const filled = Math.round((progress / total) * length);
  const empty = length - filled;
  return "▓".repeat(filled) + "░".repeat(empty);
}

export async function profileCommand(message: Message) {
  const target = message.mentions.users.first() ?? message.author;
  const user = await getOrCreateUser(target);

  const { level, progress, needed } = xpToNextLevel(user.xp);
  const progressBar = makeProgressBar(progress, needed);
  const totalBets = user.wonBets + user.lostBets;
  const winRate = totalBets > 0 ? Math.round((user.wonBets / totalBets) * 100) : 0;

  const embed = new EmbedBuilder()
    .setTitle(`👤 Profil de ${target.username}`)
    .setColor(0xf39c12)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: "🪙 Coins",
        value: `**${user.coins.toLocaleString("fr-FR")} 🪙**`,
        inline: true,
      },
      {
        name: "⭐ Niveau",
        value: `**${level}**`,
        inline: true,
      },
      {
        name: "✨ XP",
        value: `**${user.xp} XP**`,
        inline: true,
      },
      {
        name: `📊 XP vers niveau ${level + 1}`,
        value: `\`${progressBar}\` ${progress}/${needed} XP`,
        inline: false,
      },
      {
        name: "🎫 Total tickets",
        value: `**${user.totalTickets}**`,
        inline: true,
      },
      {
        name: "✅ Paris gagnés",
        value: `**${user.wonBets}**`,
        inline: true,
      },
      {
        name: "❌ Paris perdus",
        value: `**${user.lostBets}**`,
        inline: true,
      },
      {
        name: "📈 Taux de victoire",
        value: `**${winRate}%**`,
        inline: true,
      },
      {
        name: "🤝 Parrainages",
        value: `**${user.referralCount}** personne(s) parrainée(s)`,
        inline: true,
      }
    )
    .setFooter({ text: `Membre depuis le ${new Date(user.createdAt).toLocaleDateString("fr-FR")}` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
