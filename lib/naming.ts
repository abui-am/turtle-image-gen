export type TurtleSide = "left" | "right";
export type FlipVariant = "normal" | "flipped";

export function buildFilename(
  id: string,
  side: TurtleSide,
  variant: FlipVariant,
  extension = "png",
): string {
  const safeId = id.trim().replace(/\s+/g, "_");
  return `${safeId}_${side}_${variant}.${extension}`;
}

export function parseStoredId(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatId(prefix: string, counter: number, pad = 3): string {
  const safePrefix = prefix.trim().replace(/\s+/g, "_") || "turtle";
  return `${safePrefix}_${String(counter).padStart(pad, "0")}`;
}

const ID_COUNTER_KEY = "turtle-dataset-id-counter";
const ID_PREFIX_KEY = "turtle-dataset-id-prefix";

export function loadIdCounter(): number {
  if (typeof window === "undefined") return 0;
  return parseStoredId(localStorage.getItem(ID_COUNTER_KEY));
}

export function saveIdCounter(counter: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ID_COUNTER_KEY, String(counter));
}

export function loadIdPrefix(): string {
  if (typeof window === "undefined") return "turtle";
  return localStorage.getItem(ID_PREFIX_KEY) ?? "turtle";
}

export function saveIdPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ID_PREFIX_KEY, prefix);
}
