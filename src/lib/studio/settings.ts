export type StudioGatewaySettings = {
  url: string;
  token: string;
};

export type FocusFilter = "all" | "needs-attention" | "running" | "idle";
export type StudioViewMode = "focused";

export type StudioFocusedPreference = {
  mode: StudioViewMode;
  selectedAgentId: string | null;
  filter: FocusFilter;
};

export type HapticsLevel = "off" | "subtle" | "strong";

export type StudioSettings = {
  version: 1;
  gateway: StudioGatewaySettings | null;
  focused: Record<string, StudioFocusedPreference>;
  /** avatar seed overrides (multiavatar) */
  avatars: Record<string, Record<string, string>>;
  /** avatar URL overrides (http(s):// or data:image/*) */
  avatarUrls: Record<string, Record<string, string>>;
  /** Haptics feedback level (best-effort; iOS may fall back to visual only). */
  haptics: HapticsLevel;
};

export type StudioSettingsPatch = {
  gateway?: StudioGatewaySettings | null;
  focused?: Record<string, Partial<StudioFocusedPreference> | null>;
  avatars?: Record<string, Record<string, string | null> | null>;
  avatarUrls?: Record<string, Record<string, string | null> | null>;
  haptics?: HapticsLevel;
};

const SETTINGS_VERSION = 1 as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const coerceString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeGatewayKey = (value: unknown) => {
  const key = coerceString(value);
  return key ? key : null;
};

const normalizeFocusFilter = (
  value: unknown,
  fallback: FocusFilter = "all"
): FocusFilter => {
  const filter = coerceString(value);
  if (
    filter === "all" ||
    filter === "needs-attention" ||
    filter === "running" ||
    filter === "idle"
  ) {
    return filter;
  }
  return fallback;
};

const normalizeViewMode = (
  value: unknown,
  fallback: StudioViewMode = "focused"
): StudioViewMode => {
  const mode = coerceString(value);
  if (mode === "focused") {
    return mode;
  }
  return fallback;
};

const normalizeSelectedAgentId = (value: unknown, fallback: string | null = null) => {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const defaultFocusedPreference = (): StudioFocusedPreference => ({
  mode: "focused",
  selectedAgentId: null,
  filter: "all",
});

const normalizeFocusedPreference = (
  value: unknown,
  fallback: StudioFocusedPreference = defaultFocusedPreference()
): StudioFocusedPreference => {
  if (!isRecord(value)) return fallback;
  return {
    mode: normalizeViewMode(value.mode, fallback.mode),
    selectedAgentId: normalizeSelectedAgentId(
      value.selectedAgentId,
      fallback.selectedAgentId
    ),
    filter: normalizeFocusFilter(value.filter, fallback.filter),
  };
};

const normalizeGatewaySettings = (value: unknown): StudioGatewaySettings | null => {
  if (!isRecord(value)) return null;
  const url = coerceString(value.url);
  if (!url) return null;
  const token = coerceString(value.token);
  return { url, token };
};

const normalizeFocused = (value: unknown): Record<string, StudioFocusedPreference> => {
  if (!isRecord(value)) return {};
  const focused: Record<string, StudioFocusedPreference> = {};
  for (const [gatewayKeyRaw, focusedRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    focused[gatewayKey] = normalizeFocusedPreference(focusedRaw);
  }
  return focused;
};

const normalizeAvatars = (value: unknown): Record<string, Record<string, string>> => {
  if (!isRecord(value)) return {};
  const avatars: Record<string, Record<string, string>> = {};
  for (const [gatewayKeyRaw, gatewayRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    if (!isRecord(gatewayRaw)) continue;
    const entries: Record<string, string> = {};
    for (const [agentIdRaw, seedRaw] of Object.entries(gatewayRaw)) {
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      const seed = coerceString(seedRaw);
      if (!seed) continue;
      entries[agentId] = seed;
    }
    avatars[gatewayKey] = entries;
  }
  return avatars;
};

const normalizeAvatarUrls = (value: unknown): Record<string, Record<string, string>> => {
  if (!isRecord(value)) return {};
  const avatarUrls: Record<string, Record<string, string>> = {};
  for (const [gatewayKeyRaw, gatewayRaw] of Object.entries(value)) {
    const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
    if (!gatewayKey) continue;
    if (!isRecord(gatewayRaw)) continue;
    const entries: Record<string, string> = {};
    for (const [agentIdRaw, urlRaw] of Object.entries(gatewayRaw)) {
      const agentId = coerceString(agentIdRaw);
      if (!agentId) continue;
      const url = coerceString(urlRaw);
      if (!url) continue;
      // only allow safe image URLs / data URIs
      if (
        url.startsWith("https://") ||
        url.startsWith("http://") ||
        url.startsWith("data:image/")
      ) {
        entries[agentId] = url;
      }
    }
    avatarUrls[gatewayKey] = entries;
  }
  return avatarUrls;
};

export const defaultStudioSettings = (): StudioSettings => ({
  version: SETTINGS_VERSION,
  gateway: null,
  focused: {},
  avatars: {},
  avatarUrls: {},
  haptics: "subtle",
});

const normalizeHapticsLevel = (
  value: unknown,
  fallback: HapticsLevel = "subtle"
): HapticsLevel => {
  const v = coerceString(value);
  if (v === "off" || v === "subtle" || v === "strong") return v;
  return fallback;
};

export const normalizeStudioSettings = (raw: unknown): StudioSettings => {
  if (!isRecord(raw)) return defaultStudioSettings();
  const gateway = normalizeGatewaySettings(raw.gateway);
  const focused = normalizeFocused(raw.focused);
  const avatars = normalizeAvatars(raw.avatars);
  const avatarUrls = normalizeAvatarUrls(raw.avatarUrls);
  const haptics = normalizeHapticsLevel(raw.haptics);
  return {
    version: SETTINGS_VERSION,
    gateway,
    focused,
    avatars,
    avatarUrls,
    haptics,
  };
};

export const mergeStudioSettings = (
  current: StudioSettings,
  patch: StudioSettingsPatch
): StudioSettings => {
  const nextGateway =
    patch.gateway === undefined ? current.gateway : normalizeGatewaySettings(patch.gateway);
  const nextFocused = { ...current.focused };
  const nextAvatars = { ...current.avatars };
  const nextAvatarUrls = { ...current.avatarUrls };
  const nextHaptics =
    patch.haptics === undefined
      ? current.haptics
      : normalizeHapticsLevel(patch.haptics, current.haptics);
  if (patch.focused) {
    for (const [keyRaw, value] of Object.entries(patch.focused)) {
      const key = normalizeGatewayKey(keyRaw);
      if (!key) continue;
      if (value === null) {
        delete nextFocused[key];
        continue;
      }
      const fallback = nextFocused[key] ?? defaultFocusedPreference();
      nextFocused[key] = normalizeFocusedPreference(value, fallback);
    }
  }
  if (patch.avatars) {
    for (const [gatewayKeyRaw, gatewayPatch] of Object.entries(patch.avatars)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (gatewayPatch === null) {
        delete nextAvatars[gatewayKey];
        continue;
      }
      if (!isRecord(gatewayPatch)) continue;
      const existing = nextAvatars[gatewayKey] ? { ...nextAvatars[gatewayKey] } : {};
      for (const [agentIdRaw, seedPatchRaw] of Object.entries(gatewayPatch)) {
        const agentId = coerceString(agentIdRaw);
        if (!agentId) continue;
        if (seedPatchRaw === null) {
          delete existing[agentId];
          continue;
        }
        const seed = coerceString(seedPatchRaw);
        if (!seed) {
          delete existing[agentId];
          continue;
        }
        existing[agentId] = seed;
      }
      nextAvatars[gatewayKey] = existing;
    }
  }

  if (patch.avatarUrls) {
    for (const [gatewayKeyRaw, gatewayPatch] of Object.entries(patch.avatarUrls)) {
      const gatewayKey = normalizeGatewayKey(gatewayKeyRaw);
      if (!gatewayKey) continue;
      if (gatewayPatch === null) {
        delete nextAvatarUrls[gatewayKey];
        continue;
      }
      if (!isRecord(gatewayPatch)) continue;
      const existing = nextAvatarUrls[gatewayKey]
        ? { ...nextAvatarUrls[gatewayKey] }
        : {};
      for (const [agentIdRaw, urlPatchRaw] of Object.entries(gatewayPatch)) {
        const agentId = coerceString(agentIdRaw);
        if (!agentId) continue;
        if (urlPatchRaw === null) {
          delete existing[agentId];
          continue;
        }
        const url = coerceString(urlPatchRaw);
        if (!url) {
          delete existing[agentId];
          continue;
        }
        if (
          url.startsWith("https://") ||
          url.startsWith("http://") ||
          url.startsWith("data:image/")
        ) {
          existing[agentId] = url;
        } else {
          delete existing[agentId];
        }
      }
      nextAvatarUrls[gatewayKey] = existing;
    }
  }

  return {
    version: SETTINGS_VERSION,
    gateway: nextGateway ?? null,
    focused: nextFocused,
    avatars: nextAvatars,
    avatarUrls: nextAvatarUrls,
    haptics: nextHaptics,
  };
};

export const resolveFocusedPreference = (
  settings: StudioSettings,
  gatewayUrl: string
): StudioFocusedPreference | null => {
  const key = normalizeGatewayKey(gatewayUrl);
  if (!key) return null;
  return settings.focused[key] ?? null;
};

export const resolveAgentAvatarSeed = (
  settings: StudioSettings,
  gatewayUrl: string,
  agentId: string
): string | null => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return null;
  const agentKey = coerceString(agentId);
  if (!agentKey) return null;
  return settings.avatars[gatewayKey]?.[agentKey] ?? null;
};

export const resolveAgentAvatarUrlOverride = (
  settings: StudioSettings,
  gatewayUrl: string,
  agentId: string
): string | null => {
  const gatewayKey = normalizeGatewayKey(gatewayUrl);
  if (!gatewayKey) return null;
  const agentKey = coerceString(agentId);
  if (!agentKey) return null;
  return settings.avatarUrls[gatewayKey]?.[agentKey] ?? null;
};
