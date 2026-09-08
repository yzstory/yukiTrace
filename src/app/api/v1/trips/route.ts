import { api } from "@/lib/api/handler";
import { createTrip, listTrips } from "@/lib/services/trips";

/** `?limit=&cursor=` 可选分页；不传就返回全部，`nextCursor` 为 null */
export const GET = api(async (ctx) => listTrips(ctx, { limit: ctx.query.get("limit"), cursor: ctx.query.get("cursor") }));
export const POST = api(async (ctx) => createTrip(ctx, await ctx.body()));
