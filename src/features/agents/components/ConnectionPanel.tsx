import type { GatewayStatus } from "@/lib/gateway/GatewayClient";

type ConnectionPanelProps = {
  gatewayUrl: string;
  token: string;
  status: GatewayStatus;
  error: string | null;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

const statusStyles: Record<GatewayStatus, { label: string; className: string }> =
  {
    disconnected: {
      label: "Disconnected",
      className: "border border-border/70 bg-muted text-muted-foreground",
    },
    connecting: {
      label: "Connecting",
      className: "border border-border/70 bg-secondary text-secondary-foreground",
    },
    connected: {
      label: "Connected",
      className: "border border-primary/30 bg-primary/15 text-foreground",
    },
  };

export const ConnectionPanel = ({
  gatewayUrl,
  token,
  status,
  error,
  onGatewayUrlChange,
  onTokenChange,
  onConnect,
  onDisconnect,
}: ConnectionPanelProps) => {
  const statusConfig = statusStyles[status];
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div className="fade-up-delay flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-md px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>
        <button
          className="rounded-md border border-input/90 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting || !gatewayUrl.trim()}
        >
          {isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <label className="flex flex-col gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Gateway URL
          <input
            className="h-10 rounded-md border border-input bg-background/75 px-4 font-sans text-sm text-foreground outline-none transition focus:border-ring"
            type="text"
            value={gatewayUrl}
            onChange={(event) => onGatewayUrlChange(event.target.value)}
            placeholder="ws://127.0.0.1:18789"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Token
          <input
            className="h-10 rounded-md border border-input bg-background/75 px-4 font-sans text-sm text-foreground outline-none transition focus:border-ring"
            type="password"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="gateway token"
            spellCheck={false}
          />
        </label>
      </div>
      <div className="rounded-md border border-border/70 bg-card/60 px-4 py-3">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          App
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-border/70 bg-muted px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {/* iOS Safari sets navigator.standalone */}
            Installed:{" "}
            {(() => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const standalone = Boolean((navigator as any).standalone) ||
                  (typeof window !== "undefined" &&
                    typeof window.matchMedia === "function" &&
                    window.matchMedia("(display-mode: standalone)").matches);
                return standalone ? "Yes" : "No";
              } catch {
                return "Unknown";
              }
            })()}
          </span>
          <span className="inline-flex items-center rounded-md border border-border/70 bg-muted px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Display:{" "}
            {(() => {
              try {
                if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
                  return window.matchMedia("(display-mode: standalone)").matches
                    ? "Standalone"
                    : "Browser";
                }
                return "Browser";
              } catch {
                return "Browser";
              }
            })()}
          </span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Tip: on iPhone, Safari → Share → “Add to Home Screen” gives the best experience.
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive bg-destructive px-4 py-2 text-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
};
