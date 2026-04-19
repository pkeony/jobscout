"use client";

import type { CoverLetterResult } from "@/types";

export function CoverLetterView({ result }: { result: CoverLetterResult }) {
  return (
    <div className="space-y-8">
      <div className="border-b-2 border-border pb-5 space-y-1">
        <p className="text-[10px] text-accent font-bold">지원 대상</p>
        <h3 className="text-2xl md:text-3xl font-black leading-tight">
          {result.companyName}
        </h3>
        <p className="text-sm text-muted-foreground font-medium">
          {result.jobTitle}
        </p>
      </div>
      {result.sections.map((section, i) => (
        <section key={i} className="space-y-3">
          <h2 className="text-2xl font-bold">
            <span className="text-accent mr-3">
              {String(i + 1).padStart(2, "0")}.
            </span>
            {section.heading}
          </h2>
          {section.paragraphs.map((p, j) => (
            <p key={j} className="text-sm leading-relaxed whitespace-pre-line">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
