import { api } from "@/lib/api/handler";
import { revokeShareLink, toggleShareExpense } from "@/lib/services/share";

type P = { tripId: string; id: string };
export const PATCH = api<P>(async (ctx) => {
  const { hideExpense } = await ctx.body();
  await toggleShareExpense(ctx, ctx.params.tripId, ctx.params.id, Boolean(hideExpense));
});
export const DELETE = api<P>(async (ctx) => revokeShareLink(ctx, ctx.params.tripId, ctx.params.id));
