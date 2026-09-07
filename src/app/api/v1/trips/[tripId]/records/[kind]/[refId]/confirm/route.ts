import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { confirmRecord } from "@/lib/services/records";

/** 核对 AI 写入的记录无误 */
export const POST = api<{ tripId: string; kind: string; refId: string }>(async (ctx) => {
  const { version } = await ctx.body();
  if (typeof version !== "string") throw badRequest("需要 version");
  await confirmRecord(ctx, ctx.params.tripId, ctx.params.kind, ctx.params.refId, version);
});
