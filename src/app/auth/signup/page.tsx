"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/onboarding";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createSupabaseBrowserClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("비밀번호는 8 자 이상이어야 해요.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // 이메일 확인 필요 없이 즉시 세션이 생긴 경우 (confirm email off 설정)
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    setSuccess(true);
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      setLoading(false);
      setError("소셜 로그인 시작에 실패했어요.");
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center elevation-sm">
          <h1 className="text-lg font-semibold text-foreground">
            확인 이메일을 보냈어요
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{email}</span> 로
            전송된 링크를 눌러 가입을 완료해주세요.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
          >
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              JobScout
            </h1>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            무료로 시작하기 · 월 5 크레딧
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 elevation-sm">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <span>Google 로 가입</span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              또는 이메일
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-muted-foreground"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-muted-foreground"
              >
                비밀번호 <span className="text-muted-foreground/70">(8 자 이상)</span>
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? "가입 중..." : "가입하기"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link
              href={`/auth/login${next !== "/home" ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="font-medium text-accent hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
