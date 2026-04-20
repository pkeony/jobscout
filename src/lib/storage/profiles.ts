import { ProfileSlotSchema, UserProfileSchema, type ProfileSlot, type UserProfile } from "@/types";
import { z } from "zod";
import {
  pushProfileUpsert,
  pushProfileDelete,
  pushActiveProfileId,
} from "@/lib/sync/push";

const PROFILES_KEY = "jobscout:profiles";
const ACTIVE_KEY = "jobscout:activeProfileId";
const LEGACY_KEY = "jobscout:profile";
const MIGRATION_FLAG = "jobscout:profileMigrated";

const ProfilesArraySchema = z.array(ProfileSlotSchema);

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadProfiles(): ProfileSlot[] {
  if (typeof window === "undefined") return [];
  migrateLegacyProfileIfNeeded();
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return [];
  try {
    return ProfilesArraySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveProfiles(profiles: ProfileSlot[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    localStorage.setItem(ACTIVE_KEY, id);
  }
  pushActiveProfileId(id);
}

export function getActiveProfile(): ProfileSlot | null {
  const id = getActiveProfileId();
  if (!id) return null;
  return loadProfiles().find((p) => p.id === id) ?? null;
}

export function addProfile(label: string, profile: UserProfile): ProfileSlot {
  const now = Date.now();
  const slot: ProfileSlot = {
    id: genId(),
    label: label.trim() || "이름 없는 프로필",
    profile,
    createdAt: now,
    updatedAt: now,
  };
  const profiles = loadProfiles();
  profiles.push(slot);
  saveProfiles(profiles);
  pushProfileUpsert(slot);
  // 첫 프로필이면 자동 활성화
  if (profiles.length === 1) setActiveProfileId(slot.id);
  return slot;
}

export function updateProfile(
  id: string,
  patch: { label?: string; profile?: UserProfile },
): ProfileSlot | null {
  const profiles = loadProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const existing = profiles[idx];
  const updated: ProfileSlot = {
    ...existing,
    label: patch.label?.trim() || existing.label,
    profile: patch.profile ?? existing.profile,
    updatedAt: Date.now(),
  };
  profiles[idx] = updated;
  saveProfiles(profiles);
  pushProfileUpsert(updated);
  return updated;
}

export function deleteProfile(id: string): void {
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  pushProfileDelete(id);
  if (getActiveProfileId() === id) {
    setActiveProfileId(profiles[0]?.id ?? null);
  }
}

/**
 * 기존 단일 키(jobscout:profile)가 있으면 슬롯으로 자동 이전.
 * 마이그레이션 플래그로 한 번만 실행.
 */
function migrateLegacyProfileIfNeeded(): void {
  if (localStorage.getItem(MIGRATION_FLAG) === "done") return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) {
    localStorage.setItem(MIGRATION_FLAG, "done");
    return;
  }
  try {
    const profile = UserProfileSchema.parse(JSON.parse(legacy));
    const now = Date.now();
    const slot: ProfileSlot = {
      id: genId(),
      label: "기본 프로필",
      profile,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(PROFILES_KEY, JSON.stringify([slot]));
    localStorage.setItem(ACTIVE_KEY, slot.id);
  } catch {
    // 파싱 실패해도 마이그레이션 완료로 간주 (legacy 데이터 폐기)
  } finally {
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(MIGRATION_FLAG, "done");
  }
}
