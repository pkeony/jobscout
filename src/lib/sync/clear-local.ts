"use client";

export function clearAllJobscoutLocal(): void {
  if (typeof window === "undefined") return;
  const lsKeys = Object.keys(localStorage).filter((k) =>
    k.startsWith("jobscout:"),
  );
  lsKeys.forEach((k) => localStorage.removeItem(k));
  const ssKeys = Object.keys(sessionStorage).filter((k) =>
    k.startsWith("jobscout:"),
  );
  ssKeys.forEach((k) => sessionStorage.removeItem(k));
}
