"use client";

import { useCallback, useState, useRef } from"react";
import { Upload, Loader2, AlertCircle } from"lucide-react";
import { cn } from"@/lib/utils";

interface FileDropZoneProps {
 accept: string;
 maxSizeMB?: number;
 label: string;
 description?: string;
 onFile: (file: File) => void;
 disabled?: boolean;
 isLoading?: boolean;
 multiple?: boolean;
}

const ACCEPT_MAP: Record<string, string> = {
".pdf":"application/pdf",
".docx":
"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
".txt":"text/plain",
".png":"image/png",
".jpg":"image/jpeg",
".jpeg":"image/jpeg",
".webp":"image/webp",
};

function isAcceptedType(file: File, accept: string): boolean {
 const tokens = accept.split(",").map((t) => t.trim());
 if (tokens.includes("image/*") && file.type.startsWith("image/")) return true;
 const allowed = tokens.map((t) => ACCEPT_MAP[t]).filter(Boolean);
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
 multiple = false,
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

 const files = Array.from(e.dataTransfer.files);
 if (files.length === 0) return;
 if (multiple) {
 files.forEach((f) => validateAndEmit(f));
 } else {
 validateAndEmit(files[0]);
 }
 },
 [disabled, isLoading, multiple, validateAndEmit],
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
 const files = Array.from(e.target.files ?? []);
 if (multiple) {
 files.forEach((f) => validateAndEmit(f));
 } else if (files[0]) {
 validateAndEmit(files[0]);
 }
 e.target.value ="";
 },
 [multiple, validateAndEmit],
 );

 return (
 <div className="space-y-2">
 <div
 role="button"
 tabIndex={0}
 onClick={handleClick}
 onKeyDown={(e) => {
 if (e.key ==="Enter" || e.key ==="") handleClick();
 }}
 onDrop={handleDrop}
 onDragOver={handleDragOver}
 onDragLeave={handleDragLeave}
 className={cn(
"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed p-6 transition-colors duration-75",
 isDragOver
 ?"border-secondary bg-accent/5"
 :"border-muted-foreground/25 hover:border-secondary/50",
 (disabled || isLoading) &&"cursor-not-allowed opacity-50",
 )}
 >
 {isLoading ? (
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 ) : (
 <Upload className="h-8 w-8 text-muted-foreground" />
 )}
 <p className="text-sm font-medium text-muted-foreground">{label}</p>
 {description && (
 <p className="text-xs text-muted-foreground/70">{description}</p>
 )}
 <input
 ref={inputRef}
 type="file"
 accept={accept}
 multiple={multiple}
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
