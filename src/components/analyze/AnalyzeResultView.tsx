"use client";

import { Badge } from "@/components/ui/badge";
import { FadeIn, StaggerList, StaggerItem } from "@/components/motion";
import { SkillBadge } from "./SkillBadge";
import type { AnalysisResult } from "@/types";

export function AnalyzeResultView({ result }: { result: AnalysisResult }) {
  const required = result.skills.filter((s) => s.category === "required");
  const preferred = result.skills.filter((s) => s.category === "preferred");
  const etc = result.skills.filter((s) => s.category === "etc");

  return (
    <div className="space-y-0">
      {result.summary && (
        <FadeIn>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mb-8">
            {result.summary}
          </p>
        </FadeIn>
      )}

      {/* 좌우 대비: 주요 업무 / 회사 정보 */}
      <FadeIn delay={0.03}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-12 border-t-4 border-foreground">
          <div className="p-8 border-r-0 md:border-r-2 border-border bg-muted/30">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">주요 업무</h2>
              <span className="text-[10px] text-muted-foreground">핵심 직무 요구사항</span>
            </div>
            <div className="space-y-4">
              {result.keyResponsibilities.map((r, i) => (
                <div key={i} className="p-4 bg-card border-l-4 border-secondary/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-accent">
                      업무 {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-8 bg-muted">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">회사 프로필</h2>
              <span className="text-[10px] text-muted-foreground">기업 정보 요약</span>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-card/60 border-l-4 border-foreground">
                <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                  회사명
                </div>
                <p className="text-lg font-bold">{result.companyInfo.name}</p>
              </div>
              {result.companyInfo.industry && (
                <div className="p-4 bg-card/60 border-l-4 border-foreground">
                  <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                    업종
                  </div>
                  <p className="text-sm">{result.companyInfo.industry}</p>
                </div>
              )}
              {result.companyInfo.size && (
                <div className="p-4 bg-card/60 border-l-4 border-foreground">
                  <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                    규모
                  </div>
                  <p className="text-sm">{result.companyInfo.size}</p>
                </div>
              )}
              {result.experienceLevel && (
                <div className="p-4 bg-card/60 border-l-4 border-foreground">
                  <div className="text-[10px] font-bold uppercase text-foreground mb-1.5">
                    경력 요구
                  </div>
                  <p className="text-sm">{result.experienceLevel}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {(result.requirements.length > 0 || result.preferredRequirements.length > 0) && (
        <FadeIn delay={0.04}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mb-12 border-t-2 border-foreground">
            {result.requirements.length > 0 && (
              <div className="p-8 border-r-0 md:border-r-2 border-border bg-muted/20">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">자격요건</h2>
                  <span className="text-[10px] text-muted-foreground">필수 지원 조건</span>
                </div>
                <ul className="space-y-3">
                  {result.requirements.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm leading-relaxed"
                    >
                      <span className="text-[10px] font-bold text-accent mt-1 shrink-0 tracking-widest">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.preferredRequirements.length > 0 && (
              <div className="p-8 bg-card">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">우대사항</h2>
                  <span className="text-[10px] text-muted-foreground">있으면 좋은 조건</span>
                </div>
                <ul className="space-y-3">
                  {result.preferredRequirements.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm leading-relaxed"
                    >
                      <span className="text-[10px] font-bold text-accent mt-1 shrink-0 tracking-widest">
                        +{String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.06}>
        <div className="bg-foreground p-1 mb-4">
          <div className="bg-foreground px-4 py-2 border-b border-background/20 flex justify-between items-center">
            <span className="text-[10px] flex items-center gap-2 text-background/80">
              <span className="w-2 h-2 bg-accent" />
              기술 스택 분석
            </span>
          </div>
          <div className="bg-card p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {required.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-lg border-b-2 border-secondary pb-1 inline-block">
                    필수 스킬
                  </h4>
                  <StaggerList className="flex flex-wrap gap-2">
                    {required.map((s) => (
                      <StaggerItem key={s.name}>
                        <SkillBadge skill={s} />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </div>
              )}
              {preferred.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-lg border-b-2 border-secondary pb-1 inline-block">
                    우대 스킬
                  </h4>
                  <StaggerList className="flex flex-wrap gap-2">
                    {preferred.map((s) => (
                      <StaggerItem key={s.name}>
                        <SkillBadge skill={s} />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </div>
              )}
              {etc.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-lg border-b-2 border-secondary pb-1 inline-block">
                    기타
                  </h4>
                  <StaggerList className="flex flex-wrap gap-2">
                    {etc.map((s) => (
                      <StaggerItem key={s.name}>
                        <SkillBadge skill={s} />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                </div>
              )}
            </div>

            {result.benefits.length > 0 && (
              <div className="mt-8 pt-8 border-t border-border/30">
                <h4 className="font-bold text-lg border-b-2 border-secondary pb-1 inline-block mb-4">
                  복리후생
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
                  {result.benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-accent mt-0.5 shrink-0">●</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.companyInfo.culture.length > 0 && (
              <div className="mt-8 pt-8 border-t border-border/30">
                <h4 className="font-bold text-lg border-b-2 border-secondary pb-1 inline-block mb-4">
                  기업 문화
                </h4>
                <div className="flex flex-wrap gap-2">
                  {result.companyInfo.culture.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
