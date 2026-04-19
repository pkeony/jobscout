"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileDropZone } from "@/components/file-drop-zone";
import type { UserProfile } from "@/types";

interface ProfileFormProps {
  initialProfile: UserProfile;
  onSubmit: (profile: UserProfile) => void;
  submitLabel?: string;
}

export function ProfileForm({
  initialProfile,
  onSubmit,
  submitLabel = "매칭 분석 시작",
}: ProfileFormProps) {
  const [skills, setSkills] = useState(initialProfile.skills.join(", "));
  const [experience, setExperience] = useState(initialProfile.experience);
  const [education, setEducation] = useState(initialProfile.education ?? "");
  const [introduction, setIntroduction] = useState(
    initialProfile.introduction ?? "",
  );
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeAutoFilled, setResumeAutoFilled] = useState(false);

  const handleResumeFile = useCallback(async (file: File) => {
    setResumeLoading(true);
    setResumeError(null);
    setResumeAutoFilled(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        setResumeError(body.error ?? "이력서 파싱에 실패했습니다");
        return;
      }

      const { profile } = (await res.json()) as { profile: UserProfile };
      setSkills(profile.skills.join(", "));
      setExperience(profile.experience);
      setEducation(profile.education ?? "");
      setIntroduction(profile.introduction ?? "");
      setResumeAutoFilled(true);
    } catch {
      setResumeError("이력서 파싱 중 오류가 발생했습니다");
    } finally {
      setResumeLoading(false);
    }
  }, []);

  const handleSubmit = () => {
    const profile: UserProfile = {
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      experience,
      education: education || undefined,
      introduction: introduction || undefined,
    };
    onSubmit(profile);
  };

  const isValid = skills.trim().length > 0 && experience.trim().length > 0;

  return (
    <>
      {resumeAutoFilled && !resumeError && (
        <div className="border-l-4 border-accent bg-accent/10 px-4 py-3 mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-accent font-mono text-xs font-bold shrink-0">
              ✓
            </span>
            <span className="text-sm leading-snug">
              이력서에서 프로필 추출 완료 — <strong>아래 항목을 검토</strong>한 뒤
              진행하세요.
            </span>
          </div>
          <button
            onClick={() => setResumeAutoFilled(false)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 shrink-0"
          >
            다시 업로드
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-foreground">
        <div className="p-8 bg-muted/30 border-r-0 md:border-r-2 border-border">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">이력서 업로드</h2>
            <span className="text-[10px] text-muted-foreground">
              자동 프로필 추출
            </span>
          </div>
          <FileDropZone
            accept=".pdf,.docx,.txt"
            label={resumeLoading ? "이력서 분석 중..." : "이력서를 드래그하세요"}
            description="PDF, DOCX, TXT (5MB 이하) — 자동으로 프로필을 채워드립니다"
            onFile={handleResumeFile}
            isLoading={resumeLoading}
          />
          {resumeError && (
            <p className="text-sm text-destructive mt-3">{resumeError}</p>
          )}
        </div>

        <div className="p-8 bg-muted">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">직접 입력</h2>
            <span className="text-[10px] text-muted-foreground">
              프로필 정보 기입
            </span>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-foreground">
                보유 스킬 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="React, TypeScript, Node.js"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">쉼표로 구분</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-foreground">
                경력 <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="프론트엔드 개발자 2년..."
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-foreground">학력</label>
              <Input
                placeholder="컴퓨터공학 학사 (선택)"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-foreground">
                자기소개
              </label>
              <Textarea
                placeholder="간단한 자기소개 (선택)"
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              className="w-full bg-accent text-accent-foreground px-8 py-5 text-sm font-bold hover:bg-foreground hover:text-background transition-colors duration-75 h-auto"
            >
              {submitLabel}
              <span className="ml-2">→</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
