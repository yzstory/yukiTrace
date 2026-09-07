import { api } from "@/lib/api/handler";
import { deleteTrip, tripDetail, updateTrip } from "@/lib/services/trips";

type P = { tripId: string };
export const GET = api<P>(async (ctx) => tripDetail(ctx, ctx.params.tripId));
/** 整体替换：需要传完整字段（与编辑表单一致） */
export const PUT = api<P>(async (ctx) => updateTrip(ctx, ctx.params.tripId, await ctx.body()));
export const DELETE = api<P>(async (ctx) => deleteTrip(ctx, ctx.params.tripId));
