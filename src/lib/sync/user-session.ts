"use client";

const USER_ID_KEY = "jobscout:userId";

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function setCurrentUserId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(USER_ID_KEY, id);
  else localStorage.removeItem(USER_ID_KEY);
}
