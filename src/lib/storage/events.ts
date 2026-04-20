const JOBS_CHANGED = "jobscout:jobs-changed";

export function emitJobsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JOBS_CHANGED));
}

export function onJobsChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(JOBS_CHANGED, handler);
  return () => window.removeEventListener(JOBS_CHANGED, handler);
}
