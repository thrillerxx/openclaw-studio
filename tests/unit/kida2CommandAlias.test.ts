import { describe, expect, it } from "vitest";

const normalize = (input: string) => {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase().startsWith("/kida2")
    ? trimmed.replace(/^\/kida2\b\s*/i, "")
    : trimmed;
  return normalized.trim();
};

describe("/kida2 command alias", () => {
  it("strips /kida2 prefix", () => {
    expect(normalize("/kida2 hello")).toBe("hello");
  });

  it("is case-insensitive", () => {
    expect(normalize("/KiDa2   hello  ")).toBe("hello");
  });

  it("does not change normal messages", () => {
    expect(normalize("hello")).toBe("hello");
  });

  it("returns empty when only /kida2 is provided", () => {
    expect(normalize("/kida2")).toBe("");
  });
});
