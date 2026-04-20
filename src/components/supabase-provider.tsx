"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setCurrentUserId } from "@/lib/sync/user-session";
import {
  countLocalData,
  hasAnyLocalData,
  getMigrationStatus,
  migrateLocalToSupabase,
  markMigrationSkipped,
  type MigrationCounts,
} from "@/lib/sync/migrate";
import { pullAllFromSupabase } from "@/lib/sync/pull";
import { clearAllJobscoutLocal } from "@/lib/sync/clear-local";
import { MigrationPrompt } from "@/components/migration-prompt";

interface SupabaseContextValue {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

const EMPTY_COUNTS: MigrationCounts = {
  profiles: 0,
  analyze: 0,
  match: 0,
  coverLetter: 0,
  interview: 0,
  jobMeta: 0,
};

interface SupabaseProviderProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export function SupabaseProvider({
  children,
  initialSession = null,
}: SupabaseProviderProps) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(initialSession);
  const [loading, setLoading] = useState(initialSession === null);

  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationCounts, setMigrationCounts] =
    useState<MigrationCounts>(EMPTY_COUNTS);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    let lastUserId: string | null = null;

    async function bootSyncForUser(userId: string) {
      setCurrentUserId(userId);
      try {
        const { alreadyMigrated } = await getMigrationStatus(userId);
        if (!alreadyMigrated) {
          if (hasAnyLocalData()) {
            setMigrationCounts(countLocalData());
            setMigrationError(null);
            setMigrationOpen(true);
            return;
          }
          await markMigrationSkipped(userId);
        } else {
          clearAllJobscoutLocal();
          setCurrentUserId(userId);
        }
        await pullAllFromSupabase(userId);
      } catch (err) {
        console.error("[sync] boot failed", err);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      const nextUserId = nextSession?.user.id ?? null;
      if (
        (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
        nextUserId &&
        nextUserId !== lastUserId
      ) {
        lastUserId = nextUserId;
        void bootSyncForUser(nextUserId);
      } else if (event === "SIGNED_OUT") {
        lastUserId = null;
        clearAllJobscoutLocal();
        setCurrentUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleMigrate() {
    const userId = session?.user.id;
    if (!userId) return;
    setMigrationBusy(true);
    setMigrationError(null);
    try {
      await migrateLocalToSupabase(userId);
      await pullAllFromSupabase(userId);
      setMigrationOpen(false);
    } catch (err) {
      console.error("[sync] migrate failed", err);
      setMigrationError("이관 중 문제가 발생했어요. 다시 시도해주세요.");
    } finally {
      setMigrationBusy(false);
    }
  }

  async function handleSkip() {
    const userId = session?.user.id;
    if (!userId) return;
    setMigrationBusy(true);
    setMigrationError(null);
    try {
      await markMigrationSkipped(userId);
      // 로컬 데이터는 그대로 유지 (실수 클릭 시 유실 방지).
      // 이후 쓰기는 dual-write 로 DB 에도 누적됨.
      setMigrationOpen(false);
    } catch (err) {
      console.error("[sync] skip failed", err);
      setMigrationError("건너뛰기에 실패했어요. 다시 시도해주세요.");
    } finally {
      setMigrationBusy(false);
    }
  }

  const value = useMemo<SupabaseContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      loading,
    }),
    [supabase, session, loading],
  );

  return (
    <SupabaseContext.Provider value={value}>
      {children}
      <MigrationPrompt
        open={migrationOpen}
        counts={migrationCounts}
        busy={migrationBusy}
        error={migrationError}
        onMigrate={handleMigrate}
        onSkip={handleSkip}
      />
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return ctx;
}

export function useUser() {
  return useSupabase().user;
}

export function useSession() {
  return useSupabase().session;
}
