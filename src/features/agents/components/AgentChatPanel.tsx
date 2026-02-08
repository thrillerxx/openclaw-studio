import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Cog, Shuffle, Paperclip } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { isToolMarkdown, isTraceMarkdown } from "@/lib/text/message-extract";
import { isNearBottom } from "@/lib/dom/scroll";
import { AgentAvatar } from "./AgentAvatar";
import {
  buildFinalAgentChatItems,
  normalizeAssistantDisplayText,
  summarizeToolLabel,
  type AgentChatItem,
} from "./chatItems";
import { EmptyStatePanel } from "./EmptyStatePanel";

type AgentChatPanelProps = {
  agent: AgentRecord;
  isSelected: boolean;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  /**
   * auto = switches based on viewport (xl+ => full, else mobile)
   * full = current Studio panel
   * mobile = compact, chat-first layout
   */
  variant?: "auto" | "full" | "mobile";
  onOpenSettings: () => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onStopRun: () => void;
  onAvatarShuffle: () => void;
};

const AgentChatFinalItems = memo(function AgentChatFinalItems({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  chatItems,
  chatItemTimes,
  autoExpandThinking,
  lastThinkingItemIndex,
  onCopy,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  chatItems: AgentChatItem[];
  chatItemTimes: number[];
  autoExpandThinking: boolean;
  lastThinkingItemIndex: number;
  onCopy: (text: string) => void;
}) {
  const formatRelative = useCallback((ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 5) return "now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }, []);

  const formatTime = useCallback((ms: number, opts?: { includeDate?: boolean }) => {
    try {
      const d = new Date(ms);
      if (opts?.includeDate) {
        return d.toLocaleString([], {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, []);

  const renderTimestamp = useCallback(
    (timestamp: number, align: "left" | "right") => {
      const now = Date.now();
      const ageMs = Math.max(0, now - timestamp);
      const base = formatTime(timestamp, { includeDate: ageMs >= 24 * 60 * 60 * 1000 });
      const hover = formatRelative(ageMs);
      const full = formatTime(timestamp, { includeDate: true });
      return (
        <div
          className={`group text-[10px] text-muted-foreground/80 ${
            align === "left" ? "pl-1" : "pr-1"
          }`}
          title={full}
        >
          <span className="group-hover:hidden">{base}</span>
          <span className="hidden group-hover:inline">{hover}</span>
        </div>
      );
    },
    [formatRelative, formatTime]
  );

  return (
    <>
      {chatItems.map((item, index) => {
        const timestamp = chatItemTimes[index] ?? Date.now();

        if (item.kind === "thinking") {
          return (
            <details
              key={`chat-${agentId}-thinking-${index}`}
              className="rounded-md border border-border/70 bg-muted/55 text-[11px] text-muted-foreground"
              open={autoExpandThinking && index === lastThinkingItemIndex}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] [&::-webkit-details-marker]:hidden">
                <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
                <span>Thinking</span>
              </summary>
              <div className="agent-markdown px-2 pb-2 text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
              </div>
            </details>
          );
        }
        if (item.kind === "user") {
          const nextKind = chatItems[index + 1]?.kind;
          const grouped = nextKind === "user";
          return (
            <div key={`chat-${agentId}-user-${index}`} className="flex flex-col items-end gap-1">
              <div
                className={`max-w-[88%] border border-border/70 bg-muted/70 px-3 py-2 text-foreground ${
                  grouped ? "rounded-md rounded-br-sm" : "rounded-md"
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{`> ${item.text}`}</ReactMarkdown>
              </div>
              {!grouped ? renderTimestamp(timestamp, "right") : null}
            </div>
          );
        }
        if (item.kind === "tool") {
          const { summaryText, body } = summarizeToolLabel(item.text);
          return (
            <details
              key={`chat-${agentId}-tool-${index}`}
              className="rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <summary className="cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.11em]">
                {summaryText}
              </summary>
              {body ? (
                <div className="agent-markdown mt-1 text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : null}
            </details>
          );
        }
        const nextKind = chatItems[index + 1]?.kind;
        const grouped = nextKind === "assistant";
        return (
          <div key={`chat-${agentId}-assistant-${index}`} className="flex flex-col items-start gap-1">
            <div
              className={`agent-markdown group relative max-w-[92%] border border-primary/20 bg-primary/5 px-3 py-2 text-foreground ${
                grouped ? "rounded-md rounded-bl-sm" : "rounded-md"
              }`}
            >
              <button
                type="button"
                className="absolute right-2 top-2 rounded-md border border-border/40 bg-card/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground opacity-0 transition hover:bg-muted/70 group-hover:opacity-100"
                onClick={() => onCopy(item.text)}
                aria-label="Copy message"
                title="Copy"
              >
                Copy
              </button>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ children, className, ...props }) => {
                    const text = String(children ?? "");
                    const isBlock = Boolean(className) || text.includes("\n");
                    if (!isBlock) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <span className="relative block">
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-md border border-border/40 bg-card/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground opacity-0 transition hover:bg-muted/70 group-hover:opacity-100"
                          onClick={() => onCopy(text)}
                          aria-label="Copy code"
                          title="Copy code"
                        >
                          Copy
                        </button>
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </span>
                    );
                  },
                }}
              >
                {item.text}
              </ReactMarkdown>
            </div>
            {!grouped ? renderTimestamp(timestamp, "left") : null}
          </div>
        );
      })}
    </>
  );
});

const AgentChatTranscript = memo(function AgentChatTranscript({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  status,
  chatItems,
  autoExpandThinking,
  lastThinkingItemIndex,
  liveThinkingText,
  liveAssistantText,
  showTypingIndicator,
  outputLineCount,
  liveAssistantCharCount,
  liveThinkingCharCount,
  scrollToBottomNextOutputRef,
  flash,
  onCopy,
  fullBleed,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  status: AgentRecord["status"];
  chatItems: AgentChatItem[];
  autoExpandThinking: boolean;
  lastThinkingItemIndex: number;
  liveThinkingText: string;
  liveAssistantText: string;
  showTypingIndicator: boolean;
  outputLineCount: number;
  liveAssistantCharCount: number;
  liveThinkingCharCount: number;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
  flash: boolean;
  onCopy: (text: string) => void;
  fullBleed: boolean;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const [isPinned, setIsPinned] = useState(true);

  // Stable-ish timestamps: preserve times for the shared prefix of messages.
  const chatItemTimesRef = useRef<number[]>([]);
  const prevChatItemsRef = useRef<AgentChatItem[]>([]);
  const chatItemTimes = useMemo(() => {
    const prevItems = prevChatItemsRef.current;
    const prevTimes = chatItemTimesRef.current;

    let prefix = 0;
    while (prefix < prevItems.length && prefix < chatItems.length) {
      const a = prevItems[prefix];
      const b = chatItems[prefix];
      if (!a || !b) break;
      if (a.kind !== b.kind) break;
      if (a.text !== b.text) break;
      prefix += 1;
    }

    const nextTimes: number[] = prevTimes.slice(0, prefix);
    const now = Date.now();
    for (let i = prefix; i < chatItems.length; i += 1) {
      nextTimes[i] = now;
    }

    prevChatItemsRef.current = chatItems;
    chatItemTimesRef.current = nextTimes;
    return nextTimes;
  }, [chatItems]);

  const scrollChatToBottom = useCallback(() => {
    if (!chatRef.current) return;
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ block: "end" });
      return;
    }
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, []);

  const setPinned = useCallback((nextPinned: boolean) => {
    if (pinnedRef.current === nextPinned) return;
    pinnedRef.current = nextPinned;
    setIsPinned(nextPinned);
  }, []);

  const updatePinnedFromScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    setPinned(
      isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        48
      )
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollChatToBottom();
    });
  }, [scrollChatToBottom]);

  useEffect(() => {
    updatePinnedFromScroll();
  }, [updatePinnedFromScroll]);

  const showJumpToLatest =
    !isPinned && (outputLineCount > 0 || liveAssistantCharCount > 0 || liveThinkingCharCount > 0);

  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      scheduleScrollToBottom();
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
      return;
    }
  }, [
    liveAssistantCharCount,
    liveThinkingCharCount,
    outputLineCount,
    scheduleScrollToBottom,
    scrollToBottomNextOutputRef,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`relative flex-1 overflow-hidden transition ${
        fullBleed
          ? "rounded-none border-0 bg-transparent"
          : "rounded-md border border-border/80 bg-card/75"
      } ${flash ? "ring-1 ring-primary/25" : ""}`}
    >
      <div
        ref={chatRef}
        data-testid="agent-chat-scroll"
        className={
          fullBleed
            ? "h-full overflow-auto px-3 pb-6 pt-3 sm:px-4"
            : "h-full overflow-auto p-3 sm:p-4"
        }
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex flex-col gap-2 text-xs text-foreground">
          {chatItems.length === 0 ? (
            <EmptyStatePanel title="No messages yet." compact className="p-3 text-xs" />
          ) : (
            <>
              <AgentChatFinalItems
                agentId={agentId}
                name={name}
                avatarSeed={avatarSeed}
                avatarUrl={avatarUrl}
                chatItems={chatItems}
                chatItemTimes={chatItemTimes}
                autoExpandThinking={autoExpandThinking}
                lastThinkingItemIndex={lastThinkingItemIndex}
                onCopy={(text) => onCopy(text)}
              />
              {liveThinkingText ? (
                <details
                  className="rounded-md border border-border/70 bg-muted/55 text-[11px] text-muted-foreground"
                  open={status === "running" && autoExpandThinking}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] [&::-webkit-details-marker]:hidden">
                    <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
                    <span>Thinking</span>
                    {status === "running" ? (
                      <span className="typing-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : null}
                  </summary>
                  <div className="px-2 pb-2 text-foreground">
                    <div className="whitespace-pre-wrap break-words">{liveThinkingText}</div>
                  </div>
                </details>
              ) : null}
              {liveAssistantText ? (
                <div className="agent-markdown max-w-[92%] rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-foreground opacity-85">
                  {liveAssistantText}
                </div>
              ) : null}
              {showTypingIndicator ? (
                <div
                  className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/55 px-2 py-1.5 text-[11px] text-muted-foreground"
                  role="status"
                  aria-live="polite"
                  data-testid="agent-typing-indicator"
                >
                  <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em]">
                    {name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/80">Thinking</span>
                  <span className="typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ) : null}
              <div ref={chatBottomRef} />
            </>
          )}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border/80 bg-card/95 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground shadow-sm transition hover:bg-muted/70"
          onClick={() => {
            setPinned(true);
            scrollChatToBottom();
          }}
          aria-label="Jump to latest"
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
});

const AgentChatComposer = memo(function AgentChatComposer({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  canSend,
  stopBusy,
  running,
  sendDisabled,
  inputRef,
  onAttach,
  attaching,
  mobile,
  onRerun,
  onNudge,
  onSummarize,
  rerunDisabled,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  stopBusy: boolean;
  running: boolean;
  sendDisabled: boolean;
  inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  onAttach: (file: File) => void;
  attaching: boolean;
  mobile: boolean;
  onRerun: () => void;
  onNudge: () => void;
  onSummarize: () => void;
  rerunDisabled: boolean;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      localRef.current = el;
      inputRef(el);
    },
    [inputRef]
  );

  return (
    <div className="flex flex-col gap-1">
      {mobile ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="h-8 rounded-md border border-border/80 bg-card/60 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onRerun}
            disabled={rerunDisabled}
            title="Rerun"
          >
            Rerun
          </button>
          <button
            type="button"
            className="h-8 rounded-md border border-border/80 bg-card/60 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onNudge}
            disabled={!canSend || running}
            title="Nudge"
          >
            Nudge
          </button>
          <button
            type="button"
            className="h-8 rounded-md border border-border/80 bg-card/60 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onSummarize}
            disabled={!canSend || stopBusy}
            title="Summarize"
          >
            Summarize
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onAttach(file);
            // allow selecting the same file again
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border/80 bg-card/60 text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Attach image"
          title={attaching ? "Uploading…" : "Attach image"}
          disabled={attaching}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </button>

        <textarea
        ref={handleRef}
        rows={1}
        value={value}
        inputMode="text"
        enterKeyHint="send"
        className="flex-1 min-h-10 resize-none rounded-md border border-border/80 bg-card/75 px-3 py-2 text-[16px] leading-5 text-foreground outline-none transition focus:border-ring sm:min-h-0 sm:text-[11px] sm:leading-normal"
        style={{ touchAction: "manipulation" }}
        onFocus={(event) => {
          // iOS: keep the keyboard open by avoiding extra programmatic focus/scroll churn.
          // We *only* do a gentle scroll-into-view on focus.
          try {
            // Some browsers support this to avoid jumping.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (event.currentTarget as any).focus?.({ preventScroll: true });
          } catch {
            // ignore
          }
          requestAnimationFrame(() => {
            event.currentTarget.scrollIntoView({ block: "nearest" });
          });
        }}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Chat (type…)"
      />
        {/* Stop lives in the quick-actions row now (avoid duplicate Stop buttons). */}
        <button
          className="rounded-md border border-transparent bg-primary px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
        >
          Send
        </button>
      </div>
      {!mobile ? (
        <div className="px-1 text-[10px] text-muted-foreground/80">
          {attaching ? "Uploading image…" : "Enter to send • Shift+Enter for newline"}
        </div>
      ) : null}
    </div>
  );
});

export const AgentChatPanel = ({
  agent,
  isSelected,
  canSend,
  models,
  stopBusy,
  variant = "auto",
  onOpenSettings,
  onModelChange,
  onThinkingChange,
  onDraftChange,
  onSend,
  onStopRun,
  onAvatarShuffle,
}: AgentChatPanelProps) => {
  const [draftValue, setDraftValue] = useState(agent.draft);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  const [autoVariant, setAutoVariant] = useState<"full" | "mobile">("full");
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setAutoVariant(mq.matches ? "full" : "mobile");
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const effectiveVariant = variant === "auto" ? autoVariant : variant;
  const resolvedVariant = effectiveVariant ?? autoVariant;

  const scrollToBottomNextOutputRef = useRef(false);

  const [chatFlash, setChatFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    };
  }, []);

  const resolveHapticsLevel = useCallback((): "off" | "subtle" | "strong" => {
    try {
      const v = localStorage.getItem("hbos.haptics")?.trim();
      if (v === "off" || v === "subtle" || v === "strong") return v;
    } catch {
      // ignore
    }
    return "subtle";
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1100);
  }, []);

  const copyToClipboard = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(trimmed);
          showToast("Copied");
          return;
        }
      } catch {
        // ignore and fall back
      }
      try {
        const el = document.createElement("textarea");
        el.value = trimmed;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        showToast("Copied");
      } catch {
        showToast("Copy failed");
      }
    },
    [showToast]
  );

  const hapticTap = useCallback(
    (kind: "send" | "received" | "action") => {
      const level = resolveHapticsLevel();
      if (level === "off") return;

      // Visual fallback (always): brief ring flash.
      setChatFlash(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setChatFlash(false), 220);

      // Best-effort vibration (iOS often blocks this; Android usually works).
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          const base = level === "strong" ? 18 : 8;
          const pattern = kind === "received" ? [base] : [base, 8, base];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (navigator as any).vibrate?.(pattern);
        }
      } catch {
        // ignore
      }
    },
    [resolveHapticsLevel]
  );

  useEffect(() => {
    const onChange = () => {
      // no-op; reading localStorage on tap is enough.
    };
    window.addEventListener("storage", onChange);
    window.addEventListener("hbos-haptics-change", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("hbos-haptics-change", onChange);
    };
  }, []);
  const composerWrapRef = useRef<HTMLDivElement | null>(null);
  const lastOutputLineCountRef = useRef<number>(agent.outputLines.length);

  // Mobile UX: after the hacker replies, keep the composer visible (scroll to bottom).
  useEffect(() => {
    if (resolvedVariant !== "mobile") {
      lastOutputLineCountRef.current = agent.outputLines.length;
      return;
    }

    const nextCount = agent.outputLines.length;
    const prevCount = lastOutputLineCountRef.current;
    lastOutputLineCountRef.current = nextCount;
    if (nextCount <= prevCount) return;

    requestAnimationFrame(() => {
      composerWrapRef.current?.scrollIntoView({ block: "end" });
    });
  }, [agent.outputLines.length, resolvedVariant]);

  const plainDraftRef = useRef(agent.draft);
  const pendingResizeFrameRef = useRef<number | null>(null);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  const handleDraftRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    draftRef.current = el instanceof HTMLTextAreaElement ? el : null;
  }, []);

  useEffect(() => {
    if (agent.draft === plainDraftRef.current) return;
    plainDraftRef.current = agent.draft;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftValue(agent.draft);
  }, [agent.draft]);

  useEffect(() => {
    if (pendingResizeFrameRef.current !== null) {
      cancelAnimationFrame(pendingResizeFrameRef.current);
    }
    pendingResizeFrameRef.current = requestAnimationFrame(() => {
      pendingResizeFrameRef.current = null;
      resizeDraft();
    });
    return () => {
      if (pendingResizeFrameRef.current !== null) {
        cancelAnimationFrame(pendingResizeFrameRef.current);
        pendingResizeFrameRef.current = null;
      }
    };
  }, [resizeDraft, agent.draft]);

  const handleSend = useCallback(
    (message: string) => {
      if (!canSend || agent.status === "running") return;
      const trimmed = message.trim();
      if (!trimmed) return;

      // HackerBot OS command aliases (v1)
      // `/kida2 <msg>` acts as a shorthand for sending `<msg>` to the currently focused agent.
      // (Future: route to named agents, /status, /newhacker, etc.)
      const normalized = trimmed.toLowerCase().startsWith("/kida2")
        ? trimmed.replace(/^\/kida2\b\s*/i, "")
        : trimmed;

      if (!normalized.trim()) return;
      scrollToBottomNextOutputRef.current = true;

      // Clear draft immediately (and shrink textarea) for a snappy messenger feel.
      plainDraftRef.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-callback
      setDraftValue("");
      onDraftChange("");
      requestAnimationFrame(() => resizeDraft());

      hapticTap("send");
      onSend(normalized.trim());
    },
    [agent.status, canSend, onSend, onDraftChange, resizeDraft, hapticTap]
  );

  const statusColor =
    agent.status === "running"
      ? "border border-primary/30 bg-primary/15 text-foreground"
      : agent.status === "error"
        ? "border border-destructive/35 bg-destructive/12 text-destructive"
        : "border border-border/70 bg-muted text-muted-foreground";
  const statusLabel =
    agent.status === "running"
      ? "Active"
      : agent.status === "error"
        ? "Error"
        : "Idle";

  const statusDotClassName =
    agent.status === "running"
      ? "bg-primary"
      : agent.status === "error"
        ? "bg-destructive"
        : "bg-muted-foreground/70";

  const onlineDotClassName = agent.sessionCreated ? "bg-emerald-400" : "bg-muted-foreground/35";
  const onlineLabel = agent.sessionCreated ? "Online" : "Offline";

  const chatItems = useMemo(
    () =>
      buildFinalAgentChatItems({
        outputLines: agent.outputLines,
        showThinkingTraces: agent.showThinkingTraces,
        toolCallingEnabled: agent.toolCallingEnabled,
      }),
    [agent.outputLines, agent.showThinkingTraces, agent.toolCallingEnabled]
  );

  const lastUserMessage = useMemo(() => {
    for (let i = chatItems.length - 1; i >= 0; i -= 1) {
      const item = chatItems[i];
      if (item.kind === "user") return item.text;
    }
    return null;
  }, [chatItems]);
  const liveAssistantText = agent.streamText ? normalizeAssistantDisplayText(agent.streamText) : "";
  const liveThinkingText =
    agent.showThinkingTraces && agent.thinkingTrace ? agent.thinkingTrace.trim() : "";
  const hasLiveAssistantText = Boolean(liveAssistantText.trim());
  const hasVisibleLiveThinking = Boolean(liveThinkingText.trim());
  const latestUserOutputIndex = useMemo(() => {
    let latestUserIndex = -1;
    for (let index = agent.outputLines.length - 1; index >= 0; index -= 1) {
      const line = agent.outputLines[index]?.trim();
      if (!line) continue;
      if (line.startsWith(">")) {
        latestUserIndex = index;
        break;
      }
    }
    return latestUserIndex;
  }, [agent.outputLines]);
  const hasSavedThinkingSinceLatestUser = useMemo(() => {
    if (!agent.showThinkingTraces || latestUserOutputIndex < 0) return false;
    for (
      let index = latestUserOutputIndex + 1;
      index < agent.outputLines.length;
      index += 1
    ) {
      if (isTraceMarkdown(agent.outputLines[index] ?? "")) {
        return true;
      }
    }
    return false;
  }, [agent.outputLines, agent.showThinkingTraces, latestUserOutputIndex]);
  const hasSavedAssistantSinceLatestUser = useMemo(() => {
    if (latestUserOutputIndex < 0) return false;
    for (
      let index = latestUserOutputIndex + 1;
      index < agent.outputLines.length;
      index += 1
    ) {
      const line = agent.outputLines[index]?.trim() ?? "";
      if (!line) continue;
      if (line.startsWith(">")) continue;
      if (isTraceMarkdown(line)) continue;
      if (isToolMarkdown(line)) continue;
      return true;
    }
    return false;
  }, [agent.outputLines, latestUserOutputIndex]);
  const lastThinkingItemIndex = useMemo(() => {
    for (let index = chatItems.length - 1; index >= 0; index -= 1) {
      if (chatItems[index]?.kind === "thinking") {
        return index;
      }
    }
    return -1;
  }, [chatItems]);
  const autoExpandThinking =
    agent.status === "running" &&
    !hasSavedAssistantSinceLatestUser &&
    (lastThinkingItemIndex >= 0 || hasVisibleLiveThinking);
  const showTypingIndicator =
    agent.status === "running" &&
    !hasLiveAssistantText &&
    !hasVisibleLiveThinking &&
    !hasSavedThinkingSinceLatestUser;

  const modelOptions = useMemo(
    () =>
      models.map((entry) => ({
        value: `${entry.provider}/${entry.id}`,
        label:
          entry.name === `${entry.provider}/${entry.id}`
            ? entry.name
            : `${entry.name} (${entry.provider}/${entry.id})`,
        reasoning: entry.reasoning,
      })),
    [models]
  );
  const modelValue = agent.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find((option) => option.value === modelValue);
  const allowThinking = selectedModel?.reasoning !== false;

  const avatarSeed = agent.avatarSeed ?? agent.agentId;
  const running = agent.status === "running";
  const [attaching, setAttaching] = useState(false);
  const sendDisabled = !canSend || running || attaching || !draftValue.trim();

  const handleComposerChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      plainDraftRef.current = value;
      setDraftValue(value);
      onDraftChange(value);
      if (pendingResizeFrameRef.current !== null) {
        cancelAnimationFrame(pendingResizeFrameRef.current);
      }
      pendingResizeFrameRef.current = requestAnimationFrame(() => {
        pendingResizeFrameRef.current = null;
        resizeDraft();
      });
    },
    [onDraftChange, resizeDraft]
  );

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.defaultPrevented) return;

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend(draftValue);
        return;
      }

      if ((event.key === "r" || event.key === "R") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (lastUserMessage) handleSend(lastUserMessage);
        return;
      }

      if ((event.key === "n" || event.key === "N") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSend("Continue.");
        return;
      }
    },
    [draftValue, handleSend, lastUserMessage, hapticTap]
  );

  const handleComposerSend = useCallback(() => {
    handleSend(draftValue);
  }, [draftValue, handleSend]);

  const handleAttach = useCallback(
    async (file: File) => {
      if (!canSend) return;
      if (attaching) return;
      setAttaching(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) {
          throw new Error(json.error || "Upload failed");
        }
        const absoluteUrl = (() => {
          try {
            return new URL(json.url, window.location.origin).toString();
          } catch {
            return json.url;
          }
        })();

        const insertion = `\n\n![screenshot](${absoluteUrl})\n`;
        setDraftValue((v) => {
          const next = `${v}${insertion}`;
          plainDraftRef.current = next;
          onDraftChange(next);
          return next;
        });
        requestAnimationFrame(() => resizeDraft());
        hapticTap("action");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setToast(message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 1400);
      } finally {
        setAttaching(false);
      }
    },
    [attaching, canSend, hapticTap, onDraftChange, resizeDraft]
  );

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full flex-col">
      <div className="px-3 pt-3 sm:px-4 sm:pt-4">
        {resolvedVariant === "mobile" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <AgentAvatar
                seed={avatarSeed}
                name={agent.name}
                avatarUrl={agent.avatarUrl ?? null}
                size={28}
                isSelected={isSelected}
              />
              <div className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                {agent.name}
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${statusColor}`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${statusDotClassName}`} />
                {statusLabel}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/65 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${onlineDotClassName}`} />
                {onlineLabel}
              </span>
            </div>
            <button
              className="nodrag flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/65"
              type="button"
              data-testid="agent-settings-toggle"
              aria-label="Open hacker settings"
              title="Hacker settings"
              onClick={onOpenSettings}
            >
              <Cog className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="group/avatar relative">
              <AgentAvatar
                seed={avatarSeed}
                name={agent.name}
                avatarUrl={agent.avatarUrl ?? null}
                size={96}
                isSelected={isSelected}
              />
              <button
                className="nodrag pointer-events-none absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card/90 text-muted-foreground opacity-0 shadow-sm transition group-focus-within/avatar:pointer-events-auto group-focus-within/avatar:opacity-100 group-hover/avatar:pointer-events-auto group-hover/avatar:opacity-100 hover:border-border hover:bg-muted/65"
                type="button"
                aria-label="Shuffle avatar"
                data-testid="agent-avatar-shuffle"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAvatarShuffle();
                }}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.16em] text-foreground sm:text-sm">
                  {agent.name}
                </div>
                <span aria-hidden className="shrink-0 text-[11px] text-muted-foreground/80">
                  •
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${statusColor}`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${statusDotClassName}`} />
                  {statusLabel}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/65 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${onlineDotClassName}`} />
                  {onlineLabel}
                </span>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                <label className="flex min-w-0 flex-col gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span>Model</span>
                  <select
                    className="h-8 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-card/75 px-2 text-[11px] font-semibold text-foreground"
                    aria-label="Model"
                    value={modelValue}
                    onChange={(event) => {
                      const value = event.target.value.trim();
                      onModelChange(value ? value : null);
                    }}
                  >
                    {modelOptionsWithFallback.length === 0 ? (
                      <option value="">No models found</option>
                    ) : null}
                    {modelOptionsWithFallback.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {allowThinking ? (
                  <label className="flex flex-col gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Thinking</span>
                    <select
                      className="h-8 rounded-md border border-border bg-card/75 px-2 text-[11px] font-semibold text-foreground"
                      aria-label="Thinking"
                      value={agent.thinkingLevel ?? ""}
                      onChange={(event) => {
                        const value = event.target.value.trim();
                        onThinkingChange(value ? value : null);
                      }}
                    >
                      <option value="">Default</option>
                      <option value="off">Off</option>
                      <option value="minimal">Minimal</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="xhigh">XHigh</option>
                    </select>
                  </label>
                ) : (
                  <div />
                )}
              </div>
            </div>
          </div>

          <button
            className="nodrag mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/65"
            type="button"
            data-testid="agent-settings-toggle"
            aria-label="Open hacker settings"
            title="Hacker settings"
            onClick={onOpenSettings}
          >
            <Cog className="h-4 w-4" />
          </button>
        </div>
        )}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
        <AgentChatTranscript
          agentId={agent.agentId}
          name={agent.name}
          avatarSeed={avatarSeed}
          avatarUrl={agent.avatarUrl ?? null}
          status={agent.status}
          chatItems={chatItems}
          autoExpandThinking={autoExpandThinking}
          lastThinkingItemIndex={lastThinkingItemIndex}
          liveThinkingText={liveThinkingText}
          liveAssistantText={liveAssistantText}
          showTypingIndicator={showTypingIndicator}
          outputLineCount={agent.outputLines.length}
          liveAssistantCharCount={agent.streamText?.length ?? 0}
          liveThinkingCharCount={agent.thinkingTrace?.length ?? 0}
          scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
          flash={chatFlash}
          fullBleed={resolvedVariant === "mobile"}
          onCopy={(text) => {
            hapticTap("action");
            void copyToClipboard(text);
          }}
        />

        <div
          ref={composerWrapRef}
          className={
            resolvedVariant === "mobile"
              ? "sticky bottom-0 z-20 -mx-3 border-t border-border/60 bg-card/70 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 sm:-mx-4 sm:px-4"
              : ""
          }
        >
          {toast ? (
            <div className="pointer-events-none mb-2 flex justify-center">
              <div className="rounded-md border border-border/70 bg-card/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground shadow-sm">
                {toast}
              </div>
            </div>
          ) : null}

          {resolvedVariant !== "mobile" ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (!lastUserMessage) return;
                hapticTap("action");
                handleSend(lastUserMessage);
              }}
              disabled={!canSend || running || !lastUserMessage}
              title="Re-run your last message (R)"
            >
              Rerun
            </button>

            {agent.status === "error" ? (
              <button
                type="button"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  if (!lastUserMessage) return;
                  hapticTap("action");
                  handleSend(lastUserMessage);
                }}
                disabled={!canSend || running || !lastUserMessage}
                title="Retry last (error)"
              >
                Retry
              </button>
            ) : null}

            <button
              type="button"
              className="rounded-md border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                hapticTap("action");
                handleSend("Continue.");
              }}
              disabled={!canSend || running}
              title="Nudge the hacker (N)"
            >
              Nudge
            </button>

            <button
              type="button"
              className="rounded-md border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                hapticTap("action");
                // Cancel the current run (if any), then request a tight summary.
                if (running) onStopRun();
                handleSend("Give a 5-bullet summary + next steps.");
              }}
              disabled={!canSend || stopBusy}
              title={running ? "Stop and summarize" : "Summarize"}
            >
              {running ? (stopBusy ? "Stopping" : "Stop+Sum") : "Summarize"}
            </button>
          </div>
          ) : null}

          <AgentChatComposer
            value={draftValue}
            inputRef={handleDraftRef}
            onChange={handleComposerChange}
            onKeyDown={handleComposerKeyDown}
            onSend={handleComposerSend}
            onStop={onStopRun}
            canSend={canSend}
            stopBusy={stopBusy}
            running={running}
            sendDisabled={sendDisabled}
            onAttach={(file) => void handleAttach(file)}
            attaching={attaching}
            mobile={resolvedVariant === "mobile"}
            rerunDisabled={!canSend || running || !lastUserMessage}
            onRerun={() => {
              if (!lastUserMessage) return;
              hapticTap("action");
              handleSend(lastUserMessage);
            }}
            onNudge={() => {
              hapticTap("action");
              handleSend("Continue.");
            }}
            onSummarize={() => {
              hapticTap("action");
              if (running) onStopRun();
              handleSend("Give a 5-bullet summary + next steps.");
            }}
          />
        </div>
      </div>
    </div>
  );
};
