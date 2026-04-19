"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hashJdText } from "@/lib/storage/job-index";

function AnalyzeRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      router.replace(`/?url=${encodeURIComponent(urlParam)}`);
      return;
    }
    const jdText =
      typeof window !== "undefined"
        ? sessionStorage.getItem("jobscout:jdText")
        : null;
    if (!jdText) {
      router.replace("/");
      return;
    }
    router.replace(`/jobs/${hashJdText(jdText)}?tab=analyze`);
  }, [router, searchParams]);

  return null;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AnalyzeRedirect />
    </Suspense>
  );
}
