"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { keepDuplicates, retryPhotoAnalysis } from "@/app/(app)/trips/[tripId]/organize/actions";

export function OrganizeButton({ tripId, value, kind }: { tripId: string; value: string; kind: "duplicate" | "photo" }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button disabled={pending} className="min-h-11 rounded-xl bg-fill-secondary px-3 text-footnote disabled:opacity-50" onClick={() => start(async () => {
    try {
      const result = kind === "duplicate" ? await keepDuplicates(tripId, value) : await retryPhotoAnalysis(tripId, value);
      if (result.error) toast.error(result.error); else { toast.success("已处理"); router.refresh(); }
    } catch { toast.error("处理失败，请稍后重试"); }
  })}>{pending ? "处理中…" : kind === "duplicate" ? "确认是不同消费，全部保留" : "重新识别"}</button>;
}
