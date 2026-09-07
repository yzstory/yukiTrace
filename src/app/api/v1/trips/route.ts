import { api } from "@/lib/api/handler";
import { createTrip, listTrips } from "@/lib/services/trips";

export const GET = api(async (ctx) => ({ trips: await listTrips(ctx) }));
export const POST = api(async (ctx) => createTrip(ctx, await ctx.body()));
