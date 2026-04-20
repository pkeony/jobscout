const JOBS_CHANGED = "jobscout:jobs-changed";
const CREDITS_CHANGED = "jobscout:credits-changed";
const INSUFFICIENT_CREDITS = "jobscout:insufficient-credits";

export function emitJobsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JOBS_CHANGED));
}

export function onJobsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(JOBS_CHANGED, handler);
  return () => window.removeEventListener(JOBS_CHANGED, handler);
}

export function emitCreditsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_CHANGED));
}

export function onCreditsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CREDITS_CHANGED, handler);
  return () => window.removeEventListener(CREDITS_CHANGED, handler);
}

export function emitInsufficientCredits(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INSUFFICIENT_CREDITS));
}

export function onInsufficientCredits(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(INSUFFICIENT_CREDITS, handler);
  return () => window.removeEventListener(INSUFFICIENT_CREDITS, handler);
}
