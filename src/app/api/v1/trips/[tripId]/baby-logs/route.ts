import { api } from "@/lib/api/handler";
import { createBabyLog } from "@/lib/services/daily";

export const POST = api<{ tripId: string }>(async (ctx) => createBabyLog(ctx, ctx.params.tripId, await ctx.body()));
