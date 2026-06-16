import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import { db, usersTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";

export async function slashParrainage(i: ChatInputCommandInteraction) {
  const user = await getOrCreateUser(i.user);

  const embed = new EmbedBuilder()
    .setTitle("🤝 Ton Code de Parrainage")
    .setColor(0x9b59b6)
    .setThumbnail(i.user.displayAvatarURL({ size: 64 }))
    .setDescription([
      `Partage ton code à tes amis !`,
      "", "📌 **Comment ça marche ?**",
      `• Ils font \`/code ${user.referralCode}\``,
      "• Ils reçoivent **+200 🪙**",
      "• Tu reçois **+150 🪙**",
      "• Chacun ne peut utiliser qu'un seul code",
    ].join("\n"))
    .addFields(
      { name: "🔑 Ton code", value: `\`\`\`${user.referralCode}\`\`\``, inline: false },
      { name: "👥 Utilisations", value: `**${user.referralCount}**`, inline: true },
      { name: "💰 Gains cumulés", value: `**${user.referralCount * 150} 🪙**`, inline: true },
    )
    .setTimestamp();

  await i.reply({ embeds: [embed], ephemeral: true });
}

export async function slashCode(i: ChatInputCommandInteraction) {
  const code = i.options.getString("code", true).toUpperCase().trim();
  const user = await getOrCreateUser(i.user);

  if (user.usedReferralCode) return i.reply({ content: "❌ Tu as déjà utilisé un code de parrainage !", ephemeral: true });
  if (user.referralCode === code) return i.reply({ content: "❌ Tu ne peux pas utiliser ton propre code !", ephemeral: true });

  const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.referralCode, code) });
  if (!owner) return i.reply({ content: `❌ Code **${code}** introuvable.`, ephemeral: true });

  await db.update(usersTable).set({ coins: user.coins + 200, xp: user.xp + 50, usedReferralCode: true }).where(eq(usersTable.id, user.id));
  await db.update(usersTable).set({ coins: owner.coins + 150, referralCount: owner.referralCount + 1 }).where(eq(usersTable.id, owner.id));

  const embed = new EmbedBuilder()
    .setTitle("🎉 Code activé !")
    .setColor(0x2ecc71)
    .setDescription([`Code de **${owner.username}** utilisé !`, "", "✅ Tu reçois **+200 🪙** et **+50 XP**", `🎁 **${owner.username}** reçoit **+150 🪙**`].join("\n"))
    .setTimestamp();

  await i.reply({ embeds: [embed], ephemeral: true });

  try {
    const ou = await i.client.users.fetch(owner.discordId);
    await ou.send(`🎉 **${i.user.username}** a utilisé ton code ! Tu as reçu **+150 🪙** !`);
  } catch {}
}
