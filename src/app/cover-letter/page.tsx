"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hashJdText } from "@/lib/storage/job-index";

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
    router.replace(`/jobs/${hashJdText(jdText)}?tab=cover-letter`);
  }, [router]);

  return null;
}
