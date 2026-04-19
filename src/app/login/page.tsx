"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";

export default function LoginPage() {
 const router = useRouter();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 // TODO: 실제 인증 구현 시 교체
 router.push("/dashboard");
 };

 return (
 <main className="min-h-screen flex flex-col bg-background">
 {/* Metadata Ribbon */}
 <div className="w-full bg-accent py-1 px-6 flex justify-between items-center text-accent-foreground text-[10px] tracking-widest uppercase z-50 relative">
 <span>JobScout v1.0</span>
 <span>AI 채용공고 분석기</span>
 </div>

 {/* Login Canvas */}
 <div className="flex-1 flex items-center justify-center relative p-4">
 {/* Left decorative image */}
 <div className="absolute left-12 top-1/2 -translate-y-1/2 hidden xl:block w-64 opacity-[0.15] pointer-events-none">
 <div className="aspect-[3/4] bg-muted border-2 border-dashed border-border p-2" />
 <p className="text-[10px] mt-4 tracking-wider uppercase text-muted-foreground">
 Ref: JobScout_Archive
 </p>
 </div>

 {/* Login card */}
 <div className="relative w-full max-w-[480px]">
 {/* Layered parchment effect */}
 <div className="absolute -inset-2 bg-muted/40 -rotate-1 pointer-events-none" />

 <div className="relative bg-background border-4 border-primary p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(3,22,50,0.1)]">
 {/* Branding */}
 <header className="mb-10 space-y-2">
 <div className="flex items-center gap-2 mb-4">
 <span className="text-primary text-xl">■</span>
 <div className="h-px flex-grow bg-muted" />
 </div>
 <h1 className=" font-black text-4xl tracking-tighter text-primary uppercase leading-none">
 JobScout
 </h1>
 <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">
 AI 채용공고 분석기
 </p>
 </header>

 {/* Login Form */}
 <form onSubmit={handleSubmit} className="space-y-8">
 {/* Email */}
 <div className="space-y-2">
 <label
 htmlFor="email"
 className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
 >
 <span>이메일</span>
 <span className="text-accent/60">필수</span>
 </label>
 <input
 id="email"
 type="email"
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="name@example.com"
 className="w-full bg-muted border-b-2 border-input focus:border-primary outline-none py-3 px-0 text-primary placeholder:text-muted-foreground transition-colors duration-100"
 />
 </div>

 {/* Password */}
 <div className="space-y-2">
 <label
 htmlFor="password"
 className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground tracking-wider"
 >
 <span>비밀번호</span>
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="text-muted-foreground hover:text-primary transition-colors text-xs"
 >
 {showPassword ?"숨기기" :"보기"}
 </button>
 </label>
 <input
 id="password"
 type={showPassword ?"text" :"password"}
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="••••••••••••"
 className="w-full bg-muted border-b-2 border-input focus:border-primary outline-none py-3 px-0 text-primary placeholder:text-muted-foreground transition-colors duration-100"
 />
 </div>

 {/* Actions */}
 <div className="pt-4 flex flex-col gap-6">
 <button
 type="submit"
 className="group relative w-full bg-primary text-primary-foreground py-5 font-bold text-sm overflow-hidden transition-all active:scale-[0.98]"
 >
 <span className="relative z-10">로그인</span>
 <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-100" />
 </button>

 <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
 <Link
 href="#"
 className="hover:text-accent border-b border-transparent hover:border-secondary transition-all"
 >
 회원가입
 </Link>
 <span className="opacity-30">/</span>
 <Link
 href="#"
 className="hover:text-accent border-b border-transparent hover:border-secondary transition-all"
 >
 비밀번호 찾기
 </Link>
 </div>
 </div>
 </form>

 {/* Footer metadata */}
 <footer className="mt-12 pt-8 border-t border-dashed border-border">
 <div className="flex justify-between items-end opacity-40">
 <div className="space-y-1">
 <p className="text-[8px]">
 보안 상태: 256-bit AES
 </p>
 <p className="text-[8px]">
 Protocol: JOBSCOUT_SEC_V1
 </p>
 </div>
 <span className="text-2xl">■</span>
 </div>
 </footer>
 </div>

 {/* Right decorative */}
 <div className="absolute -right-24 bottom-0 hidden xl:block w-48 opacity-[0.08] pointer-events-none translate-y-12">
 <div className="w-full aspect-square bg-muted" />
 </div>
 </div>
 </div>

 {/* Footer */}
 <footer className="w-full bg-muted border-t-2 border-primary py-8 px-12 flex flex-col md:flex-row justify-between items-center gap-4">
 <p className="text-[10px] text-primary/60">
 © 2026 JobScout. All rights reserved.
 </p>
 <div className="flex gap-6">
 <Link
 href="/"
 className="text-[10px] uppercase text-primary/60 hover:text-accent transition-colors"
 >
 홈으로
 </Link>
 <Link
 href="#"
 className="text-[10px] uppercase text-primary/60 hover:text-accent transition-colors"
 >
 이용약관
 </Link>
 <Link
 href="#"
 className="text-[10px] uppercase text-primary/60 hover:text-accent transition-colors"
 >
 개인정보처리방침
 </Link>
 </div>
 </footer>
 </main>
 );
}
