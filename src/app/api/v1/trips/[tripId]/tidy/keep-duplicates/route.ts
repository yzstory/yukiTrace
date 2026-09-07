import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { keepDuplicates } from "@/lib/services/organize";

export const POST = api<{ tripId: string }>(async (ctx) => {
  const { fingerprint } = await ctx.body();
  if (typeof fingerprint !== "string") throw badRequest("需要 fingerprint");
  await keepDuplicates(ctx, ctx.params.tripId, fingerprint);
});
