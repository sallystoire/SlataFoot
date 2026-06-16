import { EmbedBuilder, type Message } from "discord.js";

export async function helpCommand(message: Message) {
  const embed = new EmbedBuilder()
    .setTitle("📖 Aide — BetBot")
    .setColor(0x5865f2)
    .setDescription("Bienvenue sur **BetBot** ! Voici toutes les commandes disponibles.")
    .addFields(
      {
        name: "⚽ Paris Sportifs",
        value: [
          "`-matchs` — Affiche les matchs disponibles avec les côtes",
          "`-buteur` — Affiche les côtes des buteurs pour chaque match",
          "`-mise [équipe/buteur] [montant]` — Placer un pari",
          "`-ticket` — Voir tes paris en cours",
        ].join("\n"),
      },
      {
        name: "🪙 Économie",
        value: [
          "`-profile` — Voir ton profil (coins, XP, stats)",
          "`-parrainage` — Voir ton code de parrainage",
          "`-code [CODE]` — Utiliser un code de parrainage (+200 🪙)",
        ].join("\n"),
      },
      {
        name: "📡 Live",
        value: ["`-live` — Afficher le suivi en direct des paris dans ce salon"].join("\n"),
      },
      {
        name: "⚙️ Administration",
        value: [
          "`-settings` — Configurer le bot (intervalle vocal, coins...)",
          "`-addmatch` — Ajouter un match manuellement",
          "`-resultat [matchId] [score]` — Définir le résultat d'un match",
        ].join("\n"),
      },
      {
        name: "💡 Gagner des coins",
        value: [
          "🎙️ **Vocal** — Gagnes des coins toutes les X minutes en vocal",
          "📹 **Stream** — x1.5 coins si tu stream",
          "📸 **Stream + cam** — x2 coins si tu stream avec la caméra",
          "💬 **Chat** — +1 🪙 par message envoyé",
        ].join("\n"),
      }
    )
    .setFooter({ text: "Préfixe : -" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
