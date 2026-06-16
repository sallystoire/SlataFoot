import { EmbedBuilder, type Message } from "discord.js";
import { db, usersTable } from "../db.js";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";

export async function parrainageCommand(message: Message) {
  const user = await getOrCreateUser(message.author);

  const embed = new EmbedBuilder()
    .setTitle("🤝 Ton Code de Parrainage")
    .setColor(0x9b59b6)
    .setThumbnail(message.author.displayAvatarURL({ size: 64 }))
    .addFields(
      {
        name: "🔑 Ton code",
        value: `\`\`\`${user.referralCode}\`\`\``,
        inline: false,
      },
      {
        name: "👥 Utilisations",
        value: `**${user.referralCount}** personne(s) ont utilisé ton code`,
        inline: true,
      },
      {
        name: "💰 Coins gagnés via parrainage",
        value: `**${user.referralCount * 150} 🪙**`,
        inline: true,
      }
    )
    .setDescription(
      [
        "Partage ton code à tes amis !",
        "",
        "📌 **Comment ça marche ?**",
        "• Quelqu'un utilise `-code " + user.referralCode + "`",
        "• Il reçoit **200 🪙** de bonus",
        "• Tu reçois **150 🪙** de récompense",
        "• Chaque personne ne peut utiliser qu'un seul code",
      ].join("\n")
    )
    .setFooter({ text: "Le parrainage est limité à une utilisation par utilisateur" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function codeCommand(message: Message, args: string[]) {
  if (!args[0]) {
    return message.reply("❌ Usage : `-code [CODE_PARRAINAGE]`");
  }

  const code = args[0].toUpperCase().trim();
  const user = await getOrCreateUser(message.author);

  if (user.usedReferralCode) {
    return message.reply("❌ Tu as déjà utilisé un code de parrainage. C'est limité à une seule fois !");
  }

  if (user.referralCode === code) {
    return message.reply("❌ Tu ne peux pas utiliser ton propre code de parrainage !");
  }

  const owner = await db.query.usersTable.findFirst({
    where: eq(usersTable.referralCode, code),
  });

  if (!owner) {
    return message.reply(`❌ Le code **${code}** n'existe pas. Vérifie l'orthographe !`);
  }

  await db.update(usersTable).set({
    coins: user.coins + 200,
    xp: user.xp + 50,
    usedReferralCode: true,
  }).where(eq(usersTable.id, user.id));

  await db.update(usersTable).set({
    coins: owner.coins + 150,
    referralCount: owner.referralCount + 1,
  }).where(eq(usersTable.id, owner.id));

  const embed = new EmbedBuilder()
    .setTitle("🎉 Code de parrainage activé !")
    .setColor(0x2ecc71)
    .setDescription(
      [
        `Tu as utilisé le code de **${owner.username}** !`,
        "",
        `✅ Tu reçois **+200 🪙** et **+50 XP**`,
        `🎁 **${owner.username}** reçoit **+150 🪙**`,
      ].join("\n")
    )
    .setFooter({ text: "Merci de soutenir la communauté !" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });

  try {
    const ownerUser = await message.client.users.fetch(owner.discordId);
    await ownerUser.send(
      `🎉 **${message.author.username}** a utilisé ton code de parrainage ! Tu as reçu **+150 🪙** !`
    );
  } catch {}
}
