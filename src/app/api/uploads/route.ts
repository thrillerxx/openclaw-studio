import { NextResponse } from "next/server";

import { storeUpload } from "@/lib/studio/uploads-store";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const mimeType = (file.type || "").trim();
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads supported" }, { status: 415 });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image too large (max ${MAX_BYTES} bytes)` },
        { status: 413 }
      );
    }

    const stored = storeUpload(buf, mimeType);
    // Serve via our GET route below.
    return NextResponse.json({ url: `/api/uploads/${stored.filename}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
