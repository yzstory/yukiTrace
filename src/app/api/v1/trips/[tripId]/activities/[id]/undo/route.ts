import { api } from "@/lib/api/handler";
import { undoRecord } from "@/lib/services/records";

/** 撤销一次 AI 写入（activity id 见记录的 history） */
export const POST = api<{ tripId: string; id: string }>(async (ctx) => undoRecord(ctx, ctx.params.tripId, ctx.params.id));
