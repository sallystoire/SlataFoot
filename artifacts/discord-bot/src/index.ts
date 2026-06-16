import { Client, GatewayIntentBits, Partials, type ChatInputCommandInteraction } from "discord.js";
import { handleVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { startVoiceCoinLoop } from "./voiceCoins.js";
import { db } from "./db.js";

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
  try {
    await db.execute("SELECT 1" as any);
    console.log("✅ Base de données connectée");
  } catch (e) {
    console.error("❌ DB:", e);
  }
});

client.on("interactionCreate", handleInteractionCreate);
client.on("voiceStateUpdate", handleVoiceStateUpdate);
client.on("messageCreate", handleMessageCreate);

client.on("error", (err) => console.error("[Discord Error]", err));
process.on("unhandledRejection", (err) => console.error("[Unhandled]", err));

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error("❌ DISCORD_BOT_TOKEN manquant !"); process.exit(1); }

client.login(token);
