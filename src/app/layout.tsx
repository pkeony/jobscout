import type { Metadata } from "next";
import { Newsreader, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

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
    <html
      lang="ko"
      className={`${newsreader.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-secondary selection:text-secondary-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
