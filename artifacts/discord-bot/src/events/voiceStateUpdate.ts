import { type VoiceState } from "discord.js";
import { db, usersTable, settingsTable } from "../db.js";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { getOrCreateSettings } from "../utils/settings.js";

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;
  if (!newState.guild) return;

  const user = await getOrCreateUser(member.user);

  const joinedChannel = !oldState.channelId && newState.channelId;
  const leftChannel = oldState.channelId && !newState.channelId;
  const startedStreaming = !oldState.streaming && newState.streaming;
  const stoppedStreaming = oldState.streaming && !newState.streaming;
  const turnedOnCamera = !oldState.selfVideo && newState.selfVideo;
  const turnedOffCamera = oldState.selfVideo && !newState.selfVideo;

  if (joinedChannel) {
    await db.update(usersTable).set({ voiceJoinedAt: new Date() }).where(eq(usersTable.discordId, member.user.id));
  }

  if (leftChannel) {
    await db.update(usersTable).set({ voiceJoinedAt: null, isStreaming: false, hasCamera: false }).where(eq(usersTable.discordId, member.user.id));
  }

  if (startedStreaming) {
    await db.update(usersTable).set({ isStreaming: true }).where(eq(usersTable.discordId, member.user.id));
  }

  if (stoppedStreaming) {
    await db.update(usersTable).set({ isStreaming: false }).where(eq(usersTable.discordId, member.user.id));
  }

  if (turnedOnCamera) {
    await db.update(usersTable).set({ hasCamera: true }).where(eq(usersTable.discordId, member.user.id));
  }

  if (turnedOffCamera) {
    await db.update(usersTable).set({ hasCamera: false }).where(eq(usersTable.discordId, member.user.id));
  }
}
