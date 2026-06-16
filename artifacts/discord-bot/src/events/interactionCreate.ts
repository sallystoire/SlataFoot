import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  type Interaction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db, betsTable, matchesTable, usersTable, settingsTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { updateLiveEmbed } from "../utils/liveEmbed.js";

const API_BASE = `https://${process.env.REPLIT_DOMAINS}`;

export async function handleInteractionCreate(interaction: Interaction) {
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }
  if (interaction.isModalSubmit()) {
    await handleModal(interaction);
    return;
  }
}

async function handleButton(interaction: ButtonInteraction) {
  const [, type, matchIdStr] = interaction.customId.split("_");
  const matchId = parseInt(matchIdStr, 10);

  if (!["home", "draw", "away"].includes(type) || isNaN(matchId)) return;

  const match = await db.query.matchesTable.findFirst({
    where: eq(matchesTable.id, matchId),
  });
  if (!match || match.status !== "upcoming") {
    await interaction.reply({ content: "❌ Ce match n'est plus disponible.", ephemeral: true });
    return;
  }

  const betLabel =
    type === "home" ? match.homeTeam :
    type === "away" ? match.awayTeam :
    "Match Nul";
  const odds =
    type === "home" ? match.homeOdds :
    type === "away" ? match.awayOdds :
    match.drawOdds;

  const user = await getOrCreateUser(interaction.user);

  const modal = new ModalBuilder()
    .setCustomId(`betmodal_${type}_${matchId}`)
    .setTitle(`Paris — ${betLabel} (x${odds.toFixed(2)})`);

  const amountInput = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel(`Solde : ${user.coins} 🪙 — Combien veux-tu miser ?`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 100")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput));
  await interaction.showModal(modal);
}

async function handleModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split("_");
  if (parts[0] !== "betmodal") return;

  const type = parts[1] as "home" | "draw" | "away";
  const matchId = parseInt(parts[2], 10);

  const amountStr = interaction.fields.getTextInputValue("amount");
  const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);

  if (isNaN(amount) || amount <= 0) {
    await interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
    return;
  }

  const match = await db.query.matchesTable.findFirst({
    where: eq(matchesTable.id, matchId),
  });
  if (!match || match.status !== "upcoming") {
    await interaction.reply({ content: "❌ Ce match n'est plus disponible.", ephemeral: true });
    return;
  }

  const user = await getOrCreateUser(interaction.user);

  if (user.coins < amount) {
    await interaction.reply({
      content: `❌ Tu n'as que **${user.coins} 🪙** mais tu essaies de miser **${amount} 🪙**.`,
      ephemeral: true,
    });
    return;
  }

  const betValue =
    type === "home" ? match.homeTeam :
    type === "away" ? match.awayTeam :
    "Match Nul";
  const odds =
    type === "home" ? match.homeOdds :
    type === "away" ? match.awayOdds :
    match.drawOdds;
  const potentialWin = Math.floor(amount * odds);

  await db.update(usersTable).set({
    coins: user.coins - amount,
    totalTickets: user.totalTickets + 1,
  }).where(eq(usersTable.id, user.id));

  await db.insert(betsTable).values({
    userId: user.id,
    matchId,
    betType: type,
    betValue,
    amount,
    odds,
    potentialWin,
    status: "pending",
  });

  const confirmEmbed = new EmbedBuilder()
    .setTitle("🎰 Pari enregistré !")
    .setColor(0x2ecc71)
    .addFields(
      { name: "⚽ Match", value: `${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam}`, inline: false },
      { name: "🎯 Pari sur", value: betValue, inline: true },
      { name: "💰 Mise", value: `${amount} 🪙`, inline: true },
      { name: "📈 Cote", value: `x${odds.toFixed(2)}`, inline: true },
      { name: "🏆 Gain potentiel", value: `**${potentialWin} 🪙**`, inline: true },
      { name: "💳 Solde restant", value: `${user.coins - amount} 🪙`, inline: true },
    )
    .setFooter({ text: "Bonne chance ! 🍀" })
    .setTimestamp();

  await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

  if (interaction.channel && interaction.channel.isTextBased()) {
    const tempMsg = await interaction.channel.send(
      `<@${interaction.user.id}> a misé **${amount} 🪙** sur **${betValue}** (x${odds.toFixed(2)}) — Gain potentiel : **${potentialWin} 🪙** 🎰`
    );
    setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
  }

  if (interaction.guildId) {
    updateLiveEmbed(interaction.client, interaction.guildId).catch(() => {});

    const settings = await db.query.settingsTable.findFirst({
      where: eq(settingsTable.guildId, interaction.guildId),
    });

    if (settings?.liveChannelId && settings.liveChannelId !== interaction.channelId) {
      try {
        const liveChannel = interaction.client.channels.cache.get(settings.liveChannelId);
        if (liveChannel && liveChannel.isTextBased()) {
          const liveTemp = await (liveChannel as import("discord.js").TextChannel).send(
            `<@${interaction.user.id}> a misé **${amount} 🪙** sur **${betValue}** — ${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam} 🎰`
          );
          setTimeout(() => liveTemp.delete().catch(() => {}), 5000);
        }
      } catch {}
    }

    const imageUrl = `${API_BASE}/api/match-image/${matchId}?t=${Date.now()}`;
    try {
      const origMsg = await interaction.message?.fetch();
      if (origMsg) {
        const updatedEmbed = EmbedBuilder.from(origMsg.embeds[0]).setImage(imageUrl);
        await origMsg.edit({ embeds: [updatedEmbed], components: origMsg.components });
      }
    } catch {}
  }
}
