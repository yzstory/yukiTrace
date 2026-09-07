import { api } from "@/lib/api/handler";
import { createEntry } from "@/lib/services/entries";

export const POST = api<{ tripId: string }>(async (ctx) => createEntry(ctx, ctx.params.tripId, await ctx.body()));
