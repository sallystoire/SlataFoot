import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  type ChatInputCommandInteraction, type ButtonInteraction, type ModalSubmitInteraction,
} from "discord.js";
import { eq, inArray } from "drizzle-orm";
import { db, matchesTable, usersTable, couponsTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";

const CHOICE_LABELS: Record<string, string> = { home: "Domicile", draw: "Match Nul", away: "Extérieur" };

export async function slashCoupon(i: ChatInputCommandInteraction) {
  await i.deferReply({ ephemeral: true });

  const matchIdsRaw = i.options.getString("matchs", true);
  const matchIds = matchIdsRaw
    .split(/[,\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
    .slice(0, 6);

  if (matchIds.length < 2) {
    return i.editReply("❌ Tu dois sélectionner au moins **2 matchs** pour un coupon. Ex: `/coupon matchs:1,2,3`");
  }

  const matches = await db.query.matchesTable.findMany({
    where: inArray(matchesTable.id, matchIds),
  });

  const upcomingMatches = matches.filter((m) => m.status === "upcoming");
  if (upcomingMatches.length < 2) {
    return i.editReply("❌ Pas assez de matchs disponibles. Vérifie que les matchs existent et sont à venir.");
  }

  const user = await getOrCreateUser(i.user);

  const embed = new EmbedBuilder()
    .setTitle("🎰 Création de ton Coupon")
    .setColor(0x9b59b6)
    .setDescription(
      upcomingMatches.map((m, idx) =>
        `**Match ${idx + 1}** — \`#${m.id}\` ${m.homeTeamEmoji} ${m.homeTeam} vs ${m.awayTeamEmoji} ${m.awayTeam}\n` +
        `↳ Dom x${m.homeOdds.toFixed(2)} · Nul x${m.drawOdds.toFixed(2)} · Ext x${m.awayOdds.toFixed(2)}`
      ).join("\n\n")
    )
    .addFields({ name: "💳 Ton solde", value: `**${user.coins} 🪙**`, inline: true })
    .setFooter({ text: "Sélectionne ton équipe pour chaque match puis valide" });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (const m of upcomingMatches.slice(0, 3)) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`cp_pick_${m.id}_home`)
        .setLabel(`${m.homeTeam}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🏠"),
      new ButtonBuilder()
        .setCustomId(`cp_pick_${m.id}_draw`)
        .setLabel("Nul")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🤝"),
      new ButtonBuilder()
        .setCustomId(`cp_pick_${m.id}_away`)
        .setLabel(`${m.awayTeam}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✈️"),
    );
    rows.push(row);
  }

  const matchIdsStr = upcomingMatches.map((m) => m.id).join(",");
  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cp_confirm_${matchIdsStr}`)
      .setLabel("Confirmer le coupon")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅")
      .setDisabled(true),
  );
  rows.push(confirmRow);

  await i.editReply({ embeds: [embed], components: rows });
}

export async function handleCouponButton(interaction: ButtonInteraction, state: Map<string, Map<number, string>>) {
  const parts = interaction.customId.split("_");

  if (parts[1] === "pick") {
    const matchId = parseInt(parts[2], 10);
    const choice = parts[3] as "home" | "draw" | "away";
    const userId = interaction.user.id;

    if (!state.has(userId)) state.set(userId, new Map());
    state.get(userId)!.set(matchId, choice);

    const picks = state.get(userId)!;
    const matchIdsInMsg = interaction.message.components
      .filter((r, i) => i < r.components.length - 1)
      .flatMap((r) => r.components)
      .filter((c) => c.customId?.startsWith("cp_pick_") && c.customId.endsWith("_home"))
      .map((c) => parseInt(c.customId!.split("_")[2], 10));

    const confirmDisabled = matchIdsInMsg.some((id) => !picks.has(id));

    const newRows = interaction.message.components.map((row, rowIdx) => {
      const newRow = new ActionRowBuilder<ButtonBuilder>();
      const btns = row.components.map((comp) => {
        const btn = ButtonBuilder.from(comp as any);
        const cid = comp.customId ?? "";
        if (cid.startsWith("cp_confirm_")) {
          btn.setDisabled(confirmDisabled);
        } else if (cid.startsWith("cp_pick_")) {
          const [, , mid, side] = cid.split("_");
          const isSelected = parseInt(mid, 10) === matchId && side === choice;
          btn.setStyle(isSelected ? ButtonStyle.Success : side === choice ? ButtonStyle.Primary : ButtonStyle.Secondary);
        }
        return btn;
      });
      newRow.addComponents(btns);
      return newRow;
    });

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const picksList = [...picks.entries()].map(([mid, c]) => `Match #${mid}: **${CHOICE_LABELS[c] ?? c}**`).join(", ");
    embed.setFooter({ text: `Sélections: ${picksList}` });

    await interaction.update({ embeds: [embed], components: newRows });
    return;
  }

  if (parts[1] === "confirm") {
    const matchIdsStr = parts.slice(2).join("_");
    const matchIds = matchIdsStr.split(",").map(Number);
    const userId = interaction.user.id;
    const picks = state.get(userId);

    if (!picks || matchIds.some((id) => !picks.has(id))) {
      return interaction.reply({ content: "❌ Sélectionne un pronostic pour chaque match d'abord.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`cp_modal_${matchIdsStr}`)
      .setTitle("💰 Montant de ta mise");

    const user = await getOrCreateUser(interaction.user);
    const input = new TextInputBuilder()
      .setCustomId("amount")
      .setLabel(`Solde: ${user.coins} 🪙 — Combien miser ?`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ex: 200")
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
  }
}

export async function handleCouponModal(interaction: ModalSubmitInteraction, state: Map<string, Map<number, string>>) {
  const parts = interaction.customId.split("_");
  const matchIdsStr = parts.slice(2).join("_");
  const matchIds = matchIdsStr.split(",").map(Number);
  const userId = interaction.user.id;
  const picks = state.get(userId);

  if (!picks) return interaction.reply({ content: "❌ Session expirée. Refais `/coupon`.", ephemeral: true });

  const amountStr = interaction.fields.getTextInputValue("amount");
  const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);
  if (isNaN(amount) || amount <= 0) return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });

  const matches = await db.query.matchesTable.findMany({ where: inArray(matchesTable.id, matchIds) });
  const user = await getOrCreateUser(interaction.user);

  if (user.coins < amount) {
    return interaction.reply({ content: `❌ Solde insuffisant (**${user.coins} 🪙**).`, ephemeral: true });
  }

  let combinedOdds = 1;
  const choices: string[] = [];
  const labels: string[] = [];

  for (const m of matches) {
    const choice = picks.get(m.id);
    if (!choice) return interaction.reply({ content: `❌ Pronostic manquant pour match #${m.id}.`, ephemeral: true });
    const odds = choice === "home" ? m.homeOdds : choice === "away" ? m.awayOdds : m.drawOdds;
    combinedOdds *= odds;
    choices.push(choice);
    labels.push(choice === "home" ? m.homeTeam : choice === "away" ? m.awayTeam : "Nul");
  }

  combinedOdds = Math.round(combinedOdds * 100) / 100;
  const potentialWin = Math.floor(amount * combinedOdds);

  await db.update(usersTable)
    .set({ coins: user.coins - amount, totalTickets: user.totalTickets + 1 })
    .where(eq(usersTable.id, user.id));

  await db.insert(couponsTable).values({
    userId: user.id,
    matchIds,
    betChoices: choices,
    matchLabels: labels,
    combinedOdds,
    amount,
    potentialWin,
    status: "pending",
  });

  state.delete(userId);

  const resultEmbed = new EmbedBuilder()
    .setTitle("🎰 Coupon enregistré !")
    .setColor(0x9b59b6)
    .addFields(
      { name: "📋 Pronostics", value: matches.map((m, i) => `${m.homeTeamEmoji} ${m.homeTeam} vs ${m.awayTeamEmoji} ${m.awayTeam} → **${labels[i]}**`).join("\n"), inline: false },
      { name: "📊 Côte combinée", value: `**x${combinedOdds.toFixed(2)}**`, inline: true },
      { name: "💰 Mise", value: `**${amount} 🪙**`, inline: true },
      { name: "🏆 Gain potentiel", value: `**${potentialWin} 🪙**`, inline: true },
      { name: "💳 Nouveau solde", value: `${user.coins - amount} 🪙`, inline: true },
    )
    .setFooter({ text: "Tous tes pronostics doivent être corrects ! 🍀" })
    .setTimestamp();

  await interaction.reply({ embeds: [resultEmbed], ephemeral: true });
}
