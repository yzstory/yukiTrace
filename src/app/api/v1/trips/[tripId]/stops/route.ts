import { api } from "@/lib/api/handler";
import { createStop } from "@/lib/services/stops";

export const POST = api<{ tripId: string }>(async (ctx) => createStop(ctx, ctx.params.tripId, await ctx.body()));
