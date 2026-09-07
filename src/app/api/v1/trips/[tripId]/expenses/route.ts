import { api } from "@/lib/api/handler";
import { createExpense } from "@/lib/services/expenses";

export const POST = api<{ tripId: string }>(async (ctx) => createExpense(ctx, ctx.params.tripId, await ctx.body()));
