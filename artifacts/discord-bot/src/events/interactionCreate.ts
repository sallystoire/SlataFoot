import {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder,
  type Interaction, type ButtonInteraction, type ModalSubmitInteraction,
  type ChatInputCommandInteraction, type TextChannel,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db, betsTable, matchesTable, usersTable, settingsTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { updateLiveEmbed } from "../utils/liveEmbed.js";
import { handleCouponButton, handleCouponModal, slashCoupon } from "../slash/coupon.js";
import { buildMatchEmbed } from "../slash/matchs.js";

import { slashHelp } from "../slash/help.js";
import { slashMatchs } from "../slash/matchs.js";
import { slashButeur } from "../slash/buteur.js";
import { slashTicket } from "../slash/ticket.js";
import { slashProfile, slashTop } from "../slash/profile.js";
import { slashParrainage, slashCode } from "../slash/parrainage.js";
import { slashLive } from "../slash/live.js";
import { slashSettings } from "../slash/settings.js";
import { slashAddmatch, slashAddbuteur, slashResultat, slashEditmatch } from "../slash/addmatch.js";
import { slashMatchslist, slashDeletematch, slashDeletebuteur, slashListbuteurs } from "../slash/managematch.js";

const couponState = new Map<string, Map<number, string>>();

export async function handleInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error("[Interaction Error]", err);
    const i = interaction as any;
    if (i.replied || i.deferred) {
      await i.followUp({ content: "❌ Une erreur est survenue.", ephemeral: true }).catch(() => {});
    } else {
      await i.reply({ content: "❌ Une erreur est survenue.", ephemeral: true }).catch(() => {});
    }
  }
}

async function handleSlashCommand(i: ChatInputCommandInteraction) {
  switch (i.commandName) {
    case "help":          return slashHelp(i);
    case "matchs":        return slashMatchs(i);
    case "matchslist":    return slashMatchslist(i);
    case "buteur":        return slashButeur(i);
    case "listbuteurs":   return slashListbuteurs(i);
    case "ticket":        return slashTicket(i);
    case "profile":       return slashProfile(i);
    case "top":           return slashTop(i);
    case "parrainage":    return slashParrainage(i);
    case "code":          return slashCode(i);
    case "live":          return slashLive(i);
    case "settings":      return slashSettings(i);
    case "addmatch":      return slashAddmatch(i);
    case "editmatch":     return slashEditmatch(i);
    case "deletematch":   return slashDeletematch(i);
    case "addbuteur":     return slashAddbuteur(i);
    case "deletebuteur":  return slashDeletebuteur(i);
    case "resultat":      return slashResultat(i);
    case "coupon":        return slashCoupon(i);
    default:
      await i.reply({ content: "❌ Commande inconnue.", ephemeral: true });
  }
}

async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId.startsWith("cp_")) {
    return handleCouponButton(interaction, couponState);
  }

  const parts = interaction.customId.split("_");
  if (parts[0] !== "bet") return;

  const type = parts[1] as "home" | "draw" | "away";
  const matchId = parseInt(parts[2], 10);

  if (!["home", "draw", "away"].includes(type) || isNaN(matchId)) return;

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match || match.status !== "upcoming") {
    return interaction.reply({ content: "❌ Ce match n'est plus disponible.", ephemeral: true });
  }

  const betLabel = type === "home" ? match.homeTeam : type === "away" ? match.awayTeam : "Match Nul";
  const odds = type === "home" ? match.homeOdds : type === "away" ? match.awayOdds : match.drawOdds;
  const user = await getOrCreateUser(interaction.user);

  const modal = new ModalBuilder()
    .setCustomId(`betmodal_${type}_${matchId}`)
    .setTitle(`🎰 ${betLabel} (x${odds.toFixed(2)})`);

  const input = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel(`Solde : ${user.coins} 🪙 — Mise ?`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 100")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId.startsWith("cp_modal_")) {
    return handleCouponModal(interaction, couponState);
  }

  const parts = interaction.customId.split("_");
  if (parts[0] !== "betmodal") return;

  const type = parts[1] as "home" | "draw" | "away";
  const matchId = parseInt(parts[2], 10);
  const amountStr = interaction.fields.getTextInputValue("amount");
  const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);

  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
  }

  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, matchId) });
  if (!match || match.status !== "upcoming") {
    return interaction.reply({ content: "❌ Ce match n'est plus disponible.", ephemeral: true });
  }

  const user = await getOrCreateUser(interaction.user);

  if (user.coins < amount) {
    return interaction.reply({
      content: `❌ Tu n'as que **${user.coins} 🪙** mais tu essaies de miser **${amount} 🪙**.`,
      ephemeral: true,
    });
  }

  const betValue = type === "home" ? match.homeTeam : type === "away" ? match.awayTeam : "Match Nul";
  const odds = type === "home" ? match.homeOdds : type === "away" ? match.awayOdds : match.drawOdds;
  const potentialWin = Math.floor(amount * odds);

  await db.update(usersTable).set({ coins: user.coins - amount, totalTickets: user.totalTickets + 1 }).where(eq(usersTable.id, user.id));
  await db.insert(betsTable).values({ userId: user.id, matchId, betType: type, betValue, amount, odds, potentialWin, status: "pending" });

  refreshMatchCard(interaction.client, match).catch(() => {});

  const confirmEmbed = new EmbedBuilder()
    .setTitle("🎰 Pari enregistré !")
    .setColor(0x2ecc71)
    .addFields(
      { name: "⚽ Match", value: `${match.homeTeamEmoji} ${match.homeTeam} vs ${match.awayTeamEmoji} ${match.awayTeam}`, inline: false },
      { name: "🎯 Pari", value: betValue, inline: true },
      { name: "💰 Mise", value: `${amount} 🪙`, inline: true },
      { name: "📈 Cote", value: `x${odds.toFixed(2)}`, inline: true },
      { name: "🏆 Gain potentiel", value: `**${potentialWin} 🪙**`, inline: true },
      { name: "💳 Nouveau solde", value: `${user.coins - amount} 🪙`, inline: true },
    )
    .setFooter({ text: "Bonne chance ! 🍀" })
    .setTimestamp();

  await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

  if (interaction.channel && interaction.channel.isTextBased()) {
    const tempMsg = await (interaction.channel as TextChannel).send(
      `<@${interaction.user.id}> a misé **${amount} 🪙** sur **${betValue}** (x${odds.toFixed(2)}) — Gain potentiel : **${potentialWin} 🪙** 🎰`
    );
    setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
  }

  if (interaction.guildId) {
    updateLiveEmbed(interaction.client, interaction.guildId).catch(() => {});

    const settings = await db.query.settingsTable.findFirst({ where: eq(settingsTable.guildId, interaction.guildId) });
    if (settings?.liveChannelId && settings.liveChannelId !== interaction.channelId) {
      try {
        const ch = interaction.client.channels.cache.get(settings.liveChannelId) as TextChannel | undefined;
        if (ch) {
          const lt = await ch.send(`<@${interaction.user.id}> a misé **${amount} 🪙** sur **${betValue}** — ${match.homeTeamEmoji}${match.homeTeam} vs ${match.awayTeamEmoji}${match.awayTeam} 🎰`);
          setTimeout(() => lt.delete().catch(() => {}), 5000);
        }
      } catch {}
    }
  }
}

async function refreshMatchCard(client: import("discord.js").Client, match: typeof matchesTable.$inferSelect) {
  if (!match.cardChannelId || !match.cardMessageId) return;

  const freshMatch = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, match.id) });
  if (!freshMatch) return;

  try {
    const channel = await client.channels.fetch(freshMatch.cardChannelId!);
    if (!channel || !channel.isTextBased()) return;
    const msg = await (channel as TextChannel).messages.fetch(freshMatch.cardMessageId!);
    const { embed, row } = buildMatchEmbed(freshMatch);
    await msg.edit({ embeds: [embed], components: [row] });
  } catch (e) {
    console.error("[refreshMatchCard]", e);
  }
}
