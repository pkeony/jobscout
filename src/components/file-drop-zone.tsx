"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  accept: string;
  maxSizeMB?: number;
  label: string;
  description?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const ACCEPT_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

function isAcceptedType(file: File, accept: string): boolean {
  const allowed = accept
    .split(",")
    .map((ext) => ACCEPT_MAP[ext.trim()])
    .filter(Boolean);
  return allowed.includes(file.type);
}

export function FileDropZone({
  accept,
  maxSizeMB = 5,
  label,
  description,
  onFile,
  disabled = false,
  isLoading = false,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndEmit = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`파일 크기는 ${maxSizeMB}MB 이하여야 합니다`);
        return;
      }
      if (!isAcceptedType(file, accept)) {
        setError(`${accept} 파일만 지원합니다`);
        return;
      }

      onFile(file);
    },
    [accept, maxSizeMB, onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled || isLoading) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndEmit(file);
    },
    [disabled, isLoading, validateAndEmit],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isLoading) setIsDragOver(true);
    },
    [disabled, isLoading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled && !isLoading) inputRef.current?.click();
  }, [disabled, isLoading]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndEmit(file);
      e.target.value = "";
    },
    [validateAndEmit],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed p-6 transition-colors duration-75 dot-matrix-texture",
          isDragOver
            ? "border-secondary bg-secondary/5"
            : "border-muted-foreground/25 hover:border-secondary/50",
          (disabled || isLoading) && "cursor-not-allowed opacity-50",
        )}
      >
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground/70">{description}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || isLoading}
        />
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
