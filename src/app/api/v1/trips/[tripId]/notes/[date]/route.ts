import { api } from "@/lib/api/handler";
import { upsertDailyNote } from "@/lib/services/daily";

/** date 形如 2026-09-07；body.content 为当天日记全文 */
export const PUT = api<{ tripId: string; date: string }>(async (ctx) => {
  const { content } = await ctx.body();
  await upsertDailyNote(ctx, ctx.params.tripId, ctx.params.date, String(content ?? ""));
});
