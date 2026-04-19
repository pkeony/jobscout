"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getJobKey } from "@/lib/storage/job-index";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const jdText =
      typeof window !== "undefined"
        ? sessionStorage.getItem("jobscout:jdText")
        : null;
    if (!jdText) {
      router.replace("/");
      return;
    }
    const focus = sessionStorage.getItem("jobscout:focusPosition");
    router.replace(`/jobs/${getJobKey(jdText, focus)}?tab=interview`);
  }, [router]);

  return null;
}
