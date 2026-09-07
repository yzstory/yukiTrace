import { api } from "@/lib/api/handler";
import { deleteEntry, updateEntry } from "@/lib/services/entries";

type P = { tripId: string; entryId: string };
export const PUT = api<P>(async (ctx) => updateEntry(ctx, ctx.params.tripId, ctx.params.entryId, await ctx.body()));
export const DELETE = api<P>(async (ctx) => deleteEntry(ctx, ctx.params.tripId, ctx.params.entryId));
