"use client";

import { useCallback, useEffect, useState } from"react";
import { AppShell } from"@/components/app-shell";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { Textarea } from"@/components/ui/textarea";
import { FadeIn } from"@/components/motion";
import { FileDropZone } from"@/components/file-drop-zone";
import {
 addProfile,
 deleteProfile,
 getActiveProfileId,
 loadProfiles,
 setActiveProfileId,
 updateProfile,
} from"@/lib/storage/profiles";
import type { ProfileSlot, UserProfile } from"@/types";

interface FormState {
 label: string;
 skills: string;
 experience: string;
 education: string;
 introduction: string;
}

const EMPTY_FORM: FormState = {
 label:"",
 skills:"",
 experience:"",
 education:"",
 introduction:"",
};

function formToProfile(form: FormState): UserProfile {
 return {
 skills: form.skills
 .split(",")
 .map((s) => s.trim())
 .filter(Boolean),
 experience: form.experience.trim(),
 education: form.education.trim() || undefined,
 introduction: form.introduction.trim() || undefined,
 };
}

function slotToForm(slot: ProfileSlot): FormState {
 return {
 label: slot.label,
 skills: slot.profile.skills.join(","),
 experience: slot.profile.experience,
 education: slot.profile.education ??"",
 introduction: slot.profile.introduction ??"",
 };
}

export default function ProfilesPage() {
 const [profiles, setProfiles] = useState<ProfileSlot[]>([]);
 const [activeId, setActiveIdState] = useState<string | null>(null);
 const [editingId, setEditingId] = useState<string |"new" | null>(null);
 const [form, setForm] = useState<FormState>(EMPTY_FORM);
 const [resumeLoading, setResumeLoading] = useState(false);
 const [resumeError, setResumeError] = useState<string | null>(null);

 const refresh = useCallback(() => {
 setProfiles(loadProfiles());
 setActiveIdState(getActiveProfileId());
 }, []);

 useEffect(() => {
 refresh();
 }, [refresh]);

 const startNew = () => {
 setEditingId("new");
 setForm(EMPTY_FORM);
 setResumeError(null);
 };

 const startEdit = (slot: ProfileSlot) => {
 setEditingId(slot.id);
 setForm(slotToForm(slot));
 setResumeError(null);
 };

 const cancelEdit = () => {
 setEditingId(null);
 setForm(EMPTY_FORM);
 setResumeError(null);
 };

 const isFormValid =
 form.label.trim().length > 0 &&
 form.skills.trim().length > 0 &&
 form.experience.trim().length > 0;

 const submit = () => {
 if (!isFormValid) return;
 const profile = formToProfile(form);
 if (editingId ==="new") {
 addProfile(form.label, profile);
 } else if (editingId) {
 updateProfile(editingId, { label: form.label, profile });
 }
 cancelEdit();
 refresh();
 };

 const handleActivate = (id: string) => {
 setActiveProfileId(id);
 refresh();
 };

 const handleDelete = (id: string, label: string) => {
 if (!confirm(`"${label}" 프로필을 삭제할까요?`)) return;
 deleteProfile(id);
 refresh();
 if (editingId === id) cancelEdit();
 };

 const handleResumeFile = useCallback(async (file: File) => {
 setResumeLoading(true);
 setResumeError(null);
 try {
 const formData = new FormData();
 formData.append("file", file);
 const res = await fetch("/api/parse-resume", {
 method:"POST",
 body: formData,
 });
 if (!res.ok) {
 const body = await res.json();
 setResumeError(body.error ??"이력서 파싱에 실패했습니다");
 return;
 }
 const { profile } = (await res.json()) as { profile: UserProfile };
 setForm((prev) => ({
 ...prev,
 skills: profile.skills.join(","),
 experience: profile.experience,
 education: profile.education ??"",
 introduction: profile.introduction ??"",
 }));
 } catch {
 setResumeError("이력서 파싱 중 오류가 발생했습니다");
 } finally {
 setResumeLoading(false);
 }
 }, []);

 return (
 <AppShell ribbonLeft={<>프로필 관리</>} ribbonRight={<>{profiles.length}개 슬롯</>}>
 <div className="max-w-5xl mx-auto space-y-8">
 <FadeIn>
 <div className=" p-8 border-2 border-border">
 <span className="text-xs text-accent font-bold mb-2 inline-block">
 MULTI-SLOT
 </span>
 <h1 className=" text-5xl md:text-6xl text-primary font-black tracking-tighter leading-none mb-3">
 프로필 관리
 </h1>
 <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
 지원 직무별로 다른 프로필을 만들어두세요. 활성화한 프로필이 매칭·자소서·면접 질문 생성에 사용됩니다.
 </p>
 </div>
 </FadeIn>

 {/* ── 프로필 목록 ── */}
 <FadeIn delay={0.05}>
 <div className="border-t-4 border-foreground">
 <div className="flex items-center justify-between p-4 border-b-2 border-border bg-muted/30">
 <span className="text-xs font-bold">
 저장된 프로필 ({profiles.length})
 </span>
 {editingId !=="new" && (
 <Button
 onClick={startNew}
 size="sm"
 className="bg-accent text-accent-foreground hover:bg-foreground hover:text-background"
 >
 + 새 프로필
 </Button>
 )}
 </div>

 {profiles.length === 0 && editingId !=="new" && (
 <div className="p-12 text-center text-sm text-muted-foreground">
 저장된 프로필이 없습니다. 위 &ldquo;새 프로필&rdquo; 버튼으로 시작하세요.
 </div>
 )}

 <ul>
 {profiles.map((slot) => {
 const isActive = slot.id === activeId;
 const isEditingThis = editingId === slot.id;
 return (
 <li
 key={slot.id}
 className={`border-b border-border p-5 ${isActive ?"bg-accent/5 border-l-4 border-l-secondary" :"border-l-4 border-l-transparent"}`}
 >
 {!isEditingThis && (
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1.5">
 {isActive && (
 <span className="text-[10px] font-bold bg-accent text-accent-foreground px-1.5 py-0.5">
 활성
 </span>
 )}
 <h3 className=" text-lg font-bold truncate">{slot.label}</h3>
 </div>
 <p className="text-sm text-muted-foreground line-clamp-1">
 {slot.profile.skills.slice(0, 6).join(",")}
 {slot.profile.skills.length > 6 &&` 외 ${slot.profile.skills.length - 6}개`}
 </p>
 <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
 경력: {slot.profile.experience.slice(0, 80)}
 {slot.profile.experience.length > 80 &&"..."}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {!isActive && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleActivate(slot.id)}
 >
 활성화
 </Button>
 )}
 <Button
 size="sm"
 variant="ghost"
 onClick={() => startEdit(slot)}
 >
 수정
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => handleDelete(slot.id, slot.label)}
 className="text-destructive hover:text-destructive"
 >
 삭제
 </Button>
 </div>
 </div>
 )}

 {isEditingThis && (
 <ProfileEditor
 form={form}
 setForm={setForm}
 onSubmit={submit}
 onCancel={cancelEdit}
 isFormValid={isFormValid}
 submitLabel="저장"
 resumeLoading={resumeLoading}
 resumeError={resumeError}
 onResumeFile={handleResumeFile}
 />
 )}
 </li>
 );
 })}
 </ul>

 {/* 새 프로필 작성 폼 */}
 {editingId ==="new" && (
 <div className="border-b border-border p-5 bg-muted/20">
 <ProfileEditor
 form={form}
 setForm={setForm}
 onSubmit={submit}
 onCancel={cancelEdit}
 isFormValid={isFormValid}
 submitLabel="추가"
 resumeLoading={resumeLoading}
 resumeError={resumeError}
 onResumeFile={handleResumeFile}
 />
 </div>
 )}
 </div>
 </FadeIn>
 </div>
 </AppShell>
 );
}

interface ProfileEditorProps {
 form: FormState;
 setForm: (updater: (prev: FormState) => FormState) => void;
 onSubmit: () => void;
 onCancel: () => void;
 isFormValid: boolean;
 submitLabel: string;
 resumeLoading: boolean;
 resumeError: string | null;
 onResumeFile: (file: File) => void;
}

function ProfileEditor({
 form,
 setForm,
 onSubmit,
 onCancel,
 isFormValid,
 submitLabel,
 resumeLoading,
 resumeError,
 onResumeFile,
}: ProfileEditorProps) {
 return (
 <div className="space-y-5">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-[10px] font-bold">
 라벨 <span className="text-destructive">*</span>
 </label>
 <Input
 value={form.label}
 onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
 placeholder="예: 백엔드용 / 풀스택용"
 maxLength={40}
 />
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-bold">
 이력서 자동 채우기
 </label>
 <FileDropZone
 accept=".pdf,.docx,.txt"
 label={resumeLoading ?"분석 중..." :"이력서 드래그 (PDF/DOCX/TXT)"}
 description=""
 onFile={onResumeFile}
 isLoading={resumeLoading}
 />
 {resumeError && <p className="text-xs text-destructive">{resumeError}</p>}
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-bold">
 보유 스킬 <span className="text-destructive">*</span>
 </label>
 <Input
 value={form.skills}
 onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))}
 placeholder="React, TypeScript, Node.js"
 />
 <p className="text-xs text-muted-foreground">쉼표로 구분</p>
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-bold">
 경력 <span className="text-destructive">*</span>
 </label>
 <Textarea
 value={form.experience}
 onChange={(e) => setForm((p) => ({ ...p, experience: e.target.value }))}
 placeholder="프론트엔드 개발자 2년..."
 rows={3}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-[10px] font-bold">학력</label>
 <Input
 value={form.education}
 onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))}
 placeholder="컴퓨터공학 학사 (선택)"
 />
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-bold">자기소개</label>
 <Input
 value={form.introduction}
 onChange={(e) => setForm((p) => ({ ...p, introduction: e.target.value }))}
 placeholder="간단한 자기소개 (선택)"
 />
 </div>
 </div>

 <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
 <Button variant="ghost" size="sm" onClick={onCancel}>
 취소
 </Button>
 <Button
 onClick={onSubmit}
 disabled={!isFormValid}
 className="bg-accent text-accent-foreground hover:bg-foreground hover:text-background"
 >
 {submitLabel}
 </Button>
 </div>
 </div>
 );
}
