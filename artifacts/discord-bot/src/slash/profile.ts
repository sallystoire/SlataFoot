import { AttachmentBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { xpToNextLevel } from "../utils/coins.js";
import { db, usersTable } from "../db.js";

const API_BASE = `https://${process.env.REPLIT_DOMAINS}`;

export async function slashProfile(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: false });

  const target = i.options.getUser("user") ?? i.user;
  const user = await getOrCreateUser(target);

  const avatarUrl = target.displayAvatarURL({ size: 256, extension: "png" });
  const imageUrl = `${API_BASE}/api/profile-image/${target.id}?avatar=${encodeURIComponent(avatarUrl)}&t=${Date.now()}`;

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const attachment = new AttachmentBuilder(buf, { name: "profile.png" });

    const { level } = xpToNextLevel(user.xp);
    const embed = new EmbedBuilder()
      .setTitle(`👤 ${target.username}`)
      .setColor(0x4f5fdb)
      .setImage("attachment://profile.png")
      .setFooter({ text: `SlataFoot ⚽ — Niveau ${level}` })
      .setTimestamp();

    await i.editReply({ embeds: [embed], files: [attachment] });
  } catch (e) {
    console.error("[slashProfile image]", e);
    const { level, progress, needed } = xpToNextLevel(user.xp);
    const total = user.wonBets + user.lostBets;
    const winRate = total > 0 ? Math.round((user.wonBets / total) * 100) : 0;
    const bar = "▓".repeat(Math.round((progress / needed) * 18)) + "░".repeat(18 - Math.round((progress / needed) * 18));

    const embed = new EmbedBuilder()
      .setTitle(`👤 Profil de ${target.username}`)
      .setColor(0xf39c12)
      .setThumbnail(avatarUrl)
      .addFields(
        { name: "🪙 Coins", value: `**${user.coins.toLocaleString("fr-FR")} 🪙**`, inline: true },
        { name: "⭐ Niveau", value: `**${level}**`, inline: true },
        { name: `📊 XP → Niv. ${level + 1}`, value: `\`${bar}\` ${progress}/${needed}`, inline: false },
        { name: "🎫 Tickets", value: `**${user.totalTickets}**`, inline: true },
        { name: "✅ Gagnés", value: `**${user.wonBets}**`, inline: true },
        { name: "❌ Perdus", value: `**${user.lostBets}**`, inline: true },
        { name: "📈 Win rate", value: `**${winRate}%**`, inline: true },
        { name: "🤝 Filleuls", value: `**${user.referralCount}**`, inline: true },
      )
      .setFooter({ text: `Membre depuis ${new Date(user.createdAt).toLocaleDateString("fr-FR")}` })
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  }
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
