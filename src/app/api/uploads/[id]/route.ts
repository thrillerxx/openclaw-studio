import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { resolveUploadsDir, resolveUploadPath } from "@/lib/studio/uploads-store";

export const runtime = "nodejs";

const contentTypeForExt = (ext: string) => {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "application/octet-stream";
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const filePath = resolveUploadPath(id);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // extra defense: stay inside uploads dir
  const dir = resolveUploadsDir();
  if (!filePath.startsWith(dir)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).replace(/^\./, "");
  const bytes = fs.readFileSync(filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentTypeForExt(ext),
      // immutable-ish; filenames are UUIDs.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
