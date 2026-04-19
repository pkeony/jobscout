"use client";

import { cn } from "@/lib/utils";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";
import { QuestionCard } from "./QuestionCard";
import type { InterviewResult } from "@/types";

export function InterviewResultView({ result }: { result: InterviewResult }) {
  const technical = result.questions.filter((q) => q.category === "technical");
  const behavioral = result.questions.filter((q) => q.category === "behavioral");
  const situational = result.questions.filter((q) => q.category === "situational");

  const sections = [
    { label: "기술 질문", questions: technical, color: "border-foreground" },
    { label: "인성 질문", questions: behavioral, color: "border-secondary" },
    { label: "상황 질문", questions: situational, color: "border-accent" },
  ].filter((s) => s.questions.length > 0);

  let questionIndex = 0;

  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <FadeIn key={section.label}>
          <div className="space-y-4">
            <div className={cn("border-l-4 pl-4 py-1", section.color)}>
              <h2 className="text-xl font-bold">{section.label}</h2>
              <span className="text-[10px] text-muted-foreground">
                {section.questions.length}개 질문
              </span>
            </div>
            <StaggerList className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.questions.map((q) => {
                const idx = questionIndex++;
                return (
                  <StaggerItem key={idx}>
                    <QuestionCard question={q} index={idx} />
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>
        </FadeIn>
      ))}

      {result.tips.length > 0 && (
        <FadeIn>
          <div className="bg-foreground p-1">
            <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
              <span className="text-[10px] flex items-center gap-2 text-background/80">
                <span className="w-2 h-2 bg-accent" />
                면접 준비 팁
              </span>
            </div>
            <div className="bg-card p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg font-black text-accent shrink-0">
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    <p className="text-sm leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
