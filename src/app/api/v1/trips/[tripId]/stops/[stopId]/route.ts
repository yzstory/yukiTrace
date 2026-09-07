import { api } from "@/lib/api/handler";
import { deleteStop, updateStop } from "@/lib/services/stops";

type P = { tripId: string; stopId: string };
export const PUT = api<P>(async (ctx) => updateStop(ctx, ctx.params.tripId, ctx.params.stopId, await ctx.body()));
export const DELETE = api<P>(async (ctx) => deleteStop(ctx, ctx.params.tripId, ctx.params.stopId));
