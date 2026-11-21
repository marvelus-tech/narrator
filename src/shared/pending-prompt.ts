export const PENDING_PROMPT = "nr8r_pending_prompt";
export const PENDING_ASPECT = "nr8r_pending_aspect";
export const PENDING_COUNT = "nr8r_pending_shots";

export type PendingPrompt = { prompt: string; aspect: "2.39:1" | "16:9" | "9:16"; count: number };

export function savePending(input: PendingPrompt): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PENDING_PROMPT, input.prompt);
  localStorage.setItem(PENDING_ASPECT, input.aspect);
  localStorage.setItem(PENDING_COUNT, String(input.count));
}

export function readPending(): PendingPrompt | null {
  if (typeof localStorage === "undefined") return null;
  const prompt = localStorage.getItem(PENDING_PROMPT)?.trim() ?? "";
  if (prompt.length < 12) return null;
  const aspect = localStorage.getItem(PENDING_ASPECT);
  const count = Number(localStorage.getItem(PENDING_COUNT) || "5");
  return {
    prompt,
    aspect: aspect === "16:9" || aspect === "9:16" || aspect === "2.39:1" ? aspect : "2.39:1",
    count: count >= 4 && count <= 6 ? count : 5,
  };
}

export function clearPending(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PENDING_PROMPT);
  localStorage.removeItem(PENDING_ASPECT);
  localStorage.removeItem(PENDING_COUNT);
}
