"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getJobKey } from "@/lib/storage/job-index";

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
    const focus = sessionStorage.getItem("jobscout:focusPosition");
    router.replace(`/jobs/${getJobKey(jdText, focus)}?tab=analyze`);
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
