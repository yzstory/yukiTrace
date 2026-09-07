import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { editRecord, loadRecord, removeRecord } from "@/lib/services/records";

type P = { tripId: string; kind: string; refId: string };

/** kind: stop | entry | expense | photo | babyLog | dailyNote | checklistItem */
export const GET = api<P>(async (ctx) => loadRecord(ctx, ctx.params.tripId, ctx.params.kind, ctx.params.refId));

/** body: { version, values } —— version 来自 GET，值的键见 GET 返回的 values */
export const PATCH = api<P>(async (ctx) => {
  const { version, values } = await ctx.body();
  if (typeof version !== "string" || !values || typeof values !== "object") throw badRequest("需要 version 与 values");
  const strings = Object.fromEntries(Object.entries(values as Record<string, unknown>).map(([k, v]) => [k, v == null ? "" : String(v)]));
  await editRecord(ctx, ctx.params.tripId, ctx.params.kind, ctx.params.refId, version, strings);
});

/** version 放 body 或 ?version= */
export const DELETE = api<P>(async (ctx) => {
  const version = String((await ctx.body()).version ?? ctx.query.get("version") ?? "");
  if (!version) throw badRequest("需要 version");
  await removeRecord(ctx, ctx.params.tripId, ctx.params.kind, ctx.params.refId, version);
});
