import { api } from "@/lib/api/handler";
import { deleteChecklistItem, toggleChecklistItem } from "@/lib/services/checklist";

type P = { tripId: string; id: string };
export const PATCH = api<P>(async (ctx) => {
  const { checked } = await ctx.body();
  await toggleChecklistItem(ctx, ctx.params.tripId, ctx.params.id, Boolean(checked));
});
export const DELETE = api<P>(async (ctx) => deleteChecklistItem(ctx, ctx.params.tripId, ctx.params.id));
