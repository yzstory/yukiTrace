import { api } from "@/lib/api/handler";
import { resetChecks } from "@/lib/services/checklist";

/** 全部取消勾选 */
export const POST = api<{ tripId: string }>(async (ctx) => resetChecks(ctx, ctx.params.tripId));
