import { api } from "@/lib/api/handler";
import { addChecklistItem, listChecklist } from "@/lib/services/checklist";

export const GET = api<{ tripId: string }>(async (ctx) => ({ items: await listChecklist(ctx, ctx.params.tripId) }));
export const POST = api<{ tripId: string }>(async (ctx) => {
  const { group, text } = await ctx.body();
  return addChecklistItem(ctx, ctx.params.tripId, String(group ?? ""), String(text ?? ""));
});
