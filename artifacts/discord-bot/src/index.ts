import { Client, GatewayIntentBits, Partials } from "discord.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { startVoiceCoinLoop } from "./voiceCoins.js";
import { db, usersTable, settingsTable, matchesTable, scorersTable } from "./db.js";
import { eq } from "drizzle-orm";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once("clientReady", async () => {
  console.log(`✅ Bot connecté : ${client.user?.tag}`);
  console.log(`📡 Serveurs : ${client.guilds.cache.size}`);
  startVoiceCoinLoop(client);
  await ensureDb();
});

client.on("messageCreate", handleMessageCreate);
client.on("voiceStateUpdate", handleVoiceStateUpdate);

client.on("error", (err) => {
  console.error("[Discord Error]", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[Unhandled Rejection]", err);
});

async function ensureDb() {
  try {
    await db.execute("SELECT 1");
    console.log("✅ Base de données connectée");
  } catch (err) {
    console.error("❌ Erreur de connexion à la base de données:", err);
  }
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN manquant !");
  process.exit(1);
}

client.login(token);
