import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { generateDailyDraft, generateFamilyDigest, generatePackingList, generateTripSummary } from "@/lib/services/ai";

/**
 * AI 生成：task = daily-draft（body.date, body.tone?）| family-digest（body.date）| summary | packing-list
 * 对话与语音仍走 /api/ai/chat、/api/ai/transcribe（同样接受 Bearer）
 */
export const POST = api<{ tripId: string; task: string }>(async (ctx) => {
  const { tripId, task } = ctx.params;
  const input = await ctx.body();
  switch (task) {
    case "daily-draft":
      return generateDailyDraft(ctx, tripId, String(input.date ?? ""), input.tone === "to_baby" ? "to_baby" : "default");
    case "family-digest":
      return generateFamilyDigest(ctx, tripId, String(input.date ?? ""));
    case "summary":
      return generateTripSummary(ctx, tripId);
    case "packing-list":
      return generatePackingList(ctx, tripId);
    default:
      throw badRequest(`不支持的任务 ${task}`);
  }
});
