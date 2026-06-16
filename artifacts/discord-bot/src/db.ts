import { db as sharedDb } from "@workspace/db";

export const db = sharedDb;
export * from "@workspace/db/schema";
