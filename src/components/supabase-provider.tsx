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

interface SupabaseContextValue {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

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
