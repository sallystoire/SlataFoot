import { Router } from "express";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

const router = Router();
const BG_DIR = path.resolve(process.cwd(), "public", "match-bg");

router.post("/match-bg/upload", async (req, res) => {
  try {
    const { matchId, imageData, contentType, imageUrl } = req.body as {
      matchId: number;
      imageData?: string;
      contentType?: string;
      imageUrl?: string;
    };

    if (!matchId) return res.status(400).json({ error: "matchId required" });

    await fs.mkdir(BG_DIR, { recursive: true });

    let buf: Buffer;

    if (imageData) {
      // Preferred: raw bytes sent as base64 by the bot
      buf = Buffer.from(imageData, "base64");
    } else if (imageUrl) {
      // Fallback: fetch by URL
      const fetchRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      if (!fetchRes.ok) return res.status(400).json({ error: "Failed to fetch image" });
      buf = Buffer.from(await fetchRes.arrayBuffer());
    } else {
      return res.status(400).json({ error: "imageData or imageUrl required" });
    }

    const filePath = path.join(BG_DIR, `${matchId}.jpg`);
    await sharp(buf)
      .resize(860, 500, { fit: "cover", position: "center" })
      .jpeg({ quality: 90 })
      .toFile(filePath);

    const publicUrl = `/api/match-bg/${matchId}.jpg`;
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error("[upload-bg]", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
