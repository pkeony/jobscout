"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { InterviewQuestion } from "@/types";

export function QuestionCard({
  question,
  index,
}: {
  question: InterviewQuestion;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  const categoryLabel =
    question.category === "technical"
      ? "기술"
      : question.category === "behavioral"
        ? "인성"
        : "상황";

  const categoryColor =
    question.category === "technical" ? "bg-foreground" : "bg-accent";

  return (
    <div className="bg-card border-2 border-border overflow-hidden hover:-translate-y-0.5 transition-transform duration-75">
      <div
        className={cn(
          "px-4 py-2 flex items-center justify-between gap-3",
          categoryColor,
        )}
      >
        <span className="text-[10px] font-bold text-white shrink-0">
          Q{String(index + 1).padStart(2, "0")} — {categoryLabel}
        </span>
        <span className="text-[10px] text-white/85 truncate text-right">
          {question.intent}
        </span>
      </div>

      <div className="p-5 cursor-pointer" onClick={() => setOpen(!open)}>
        <p className="text-sm font-medium leading-relaxed">{question.question}</p>
        <button className="mt-3 text-[10px] text-accent font-bold flex items-center gap-1">
          {open ? "답변 숨기기 ▲" : "모범 답변 보기 ▼"}
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5">
          <div className="bg-muted p-4 border-l-4 border-secondary">
            <p className="text-[10px] font-bold text-accent mb-2">모범 답변</p>
            <p className="text-sm leading-relaxed">{question.sampleAnswer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
