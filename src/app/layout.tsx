import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobScout — AI 채용공고 분석기",
  description:
    "채용공고 URL을 넣으면 AI가 스킬 분석, 프로필 매칭, 자소서 초안, 면접 예상질문까지 한번에 제공합니다.",
  openGraph: {
    title: "JobScout — AI 채용공고 분석기",
    description:
      "채용공고 URL을 넣으면 AI가 스킬 분석, 프로필 매칭, 자소서 초안, 면접 예상질문까지 한번에 제공합니다.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-accent selection:text-accent-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
