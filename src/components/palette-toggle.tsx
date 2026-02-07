"use client";

import { useEffect, useState } from "react";
import { Paintbrush } from "lucide-react";

const PALETTE_STORAGE_KEY = "palette";

type Palette = "terminal" | "studio";

const getPreferredPalette = (): Palette => {
  if (typeof window === "undefined") return "terminal";
  const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  if (stored === "terminal" || stored === "studio") return stored;
  return "terminal";
};

const applyPalette = (palette: Palette) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", palette);
};

export const PaletteToggle = () => {
  const [palette, setPalette] = useState<Palette>("terminal");

  useEffect(() => {
    const preferred = getPreferredPalette();
    setPalette(preferred);
    applyPalette(preferred);
  }, []);

  const togglePalette = () => {
    setPalette((current) => {
      const next: Palette = current === "terminal" ? "studio" : "terminal";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
      }
      applyPalette(next);
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={togglePalette}
      aria-label={palette === "terminal" ? "Switch to Studio palette" : "Switch to Terminal palette"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input/90 bg-background/75 text-foreground shadow-sm transition hover:border-ring hover:bg-card"
      title={palette === "terminal" ? "Terminal palette" : "Studio palette"}
    >
      <Paintbrush className="h-[15px] w-[15px]" />
    </button>
  );
};
