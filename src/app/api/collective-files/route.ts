import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const COLLECTIVE_DIR = path.resolve(process.cwd(), "..", "collective");

const ALLOWED_FILES = ["COLLECTIVE.md", "MEMORY.md", "HACKERS.md"] as const;

type AllowedFileName = (typeof ALLOWED_FILES)[number];

const isAllowedFileName = (value: string): value is AllowedFileName =>
  (ALLOWED_FILES as readonly string[]).includes(value);

const templates: Record<AllowedFileName, string> = {
  "COLLECTIVE.md":
    "# Collective\n\nShared notes for the HackerBot OS collective.\n\n- What are we building?\n- What are the rules?\n- What do we want next?\n",
  "MEMORY.md":
    "# Memory\n\nShared memory for the collective (non-sensitive).\n\n- Decisions\n- Conventions\n- TODOs\n",
  "HACKERS.md":
    "# Hackers\n\nShared guidance for hackers (agents).\n\n- How should hackers behave?\n- Shared tools/constraints\n",
};

async function ensureCollectiveDir() {
  await fs.mkdir(COLLECTIVE_DIR, { recursive: true });
}

async function loadFile(name: AllowedFileName) {
  await ensureCollectiveDir();
  const filePath = path.join(COLLECTIVE_DIR, name);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return { exists: true, content };
  } catch {
    const content = templates[name] ?? "";
    await fs.writeFile(filePath, content, "utf8");
    return { exists: false, content };
  }
}

async function saveFile(name: AllowedFileName, content: string) {
  await ensureCollectiveDir();
  const filePath = path.join(COLLECTIVE_DIR, name);
  await fs.writeFile(filePath, content, "utf8");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name")?.trim() ?? "";
    if (!name || !isAllowedFileName(name)) {
      return NextResponse.json(
        { error: `Invalid file name. Allowed: ${ALLOWED_FILES.join(", ")}` },
        { status: 400 }
      );
    }

    const { exists, content } = await loadFile(name);
    return NextResponse.json({ file: { name, exists, content } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load collective file.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name")?.trim() ?? "";
    if (!name || !isAllowedFileName(name)) {
      return NextResponse.json(
        { error: `Invalid file name. Allowed: ${ALLOWED_FILES.join(", ")}` },
        { status: 400 }
      );
    }

    const body = (await request.json()) as unknown;
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const content = typeof record?.content === "string" ? record.content : null;
    if (content === null) {
      return NextResponse.json({ error: "Missing content." }, { status: 400 });
    }

    await saveFile(name, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save collective file.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
