import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { resolveStateDir } from "@/lib/clawdbot/paths";

const UPLOADS_DIRNAME = "openclaw-studio/uploads";

export type StoredUpload = {
  id: string;
  filename: string;
  mimeType: string;
  filePath: string;
};

export const resolveUploadsDir = () => path.join(resolveStateDir(), UPLOADS_DIRNAME);

const ensureUploadsDir = () => {
  const dir = resolveUploadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const safeExtensionForMime = (mimeType: string) => {
  const m = mimeType.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "bin";
};

export const storeUpload = (bytes: Uint8Array, mimeType: string): StoredUpload => {
  const dir = ensureUploadsDir();
  const id = crypto.randomUUID();
  const ext = safeExtensionForMime(mimeType);
  const filename = `${id}.${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, bytes);
  return { id, filename, mimeType, filePath };
};

export const resolveUploadPath = (id: string): string | null => {
  const safe = id.replace(/[^a-zA-Z0-9-_.]/g, "");
  if (!safe) return null;
  const dir = resolveUploadsDir();
  const candidate = path.join(dir, safe);
  if (!candidate.startsWith(dir)) return null;
  if (!fs.existsSync(candidate)) return null;
  return candidate;
};
