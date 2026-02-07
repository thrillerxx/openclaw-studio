import { NextResponse } from "next/server";

import { type StudioSettingsPatch } from "@/lib/studio/settings";
import { applyStudioSettingsPatch, loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

const isPatch = (value: unknown): value is StudioSettingsPatch =>
  Boolean(value && typeof value === "object");

const resolveGatewayUrlForRequest = (
  settings: ReturnType<typeof loadStudioSettings>,
  request: Request
) => {
  const configured = settings.gateway?.url?.trim() ?? "";
  if (!configured) return "";

  // If we're being accessed via Tailscale Serve over HTTPS (MagicDNS .ts.net),
  // the client must NOT try to connect to ws://127.0.0.1 (phone != gateway host).
  // Conversely, when accessed locally, we prefer loopback for safety.
  const host = request.headers.get("host") ?? "";
  const isTailscaleHost = host.includes(".ts.net");

  if (isTailscaleHost) {
    // Prefer a stable remote URL on the same host.
    // We expose the gateway websocket endpoint on a dedicated HTTPS port (8443)
    // so the path remains `/` (the gateway doesn't expect a prefix).
    const hostWithoutPort = host.split(":")[0];
    return `wss://${hostWithoutPort}:8443`;
  }

  // Local browsing: keep remote configs as-is, but pin loopback-ish configs to the
  // local gateway port to avoid accidentally pointing at the wrong host.
  if (/^ws:\/\/(127\.0\.0\.1|localhost)(:\d+)?\b/i.test(configured)) {
    return "ws://127.0.0.1:18790";
  }

  return configured;
};

export async function GET(request: Request = new Request("http://localhost")) {
  try {
    const settings = loadStudioSettings();
    if (!settings.gateway) {
      return NextResponse.json({ settings });
    }

    const gatewayUrl = resolveGatewayUrlForRequest(settings, request);
    const patched = {
      ...settings,
      gateway: {
        ...settings.gateway,
        url: gatewayUrl || settings.gateway.url,
      },
    };
    return NextResponse.json({ settings: patched });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load studio settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isPatch(body)) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    const settings = applyStudioSettingsPatch(body);
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save studio settings.";
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
