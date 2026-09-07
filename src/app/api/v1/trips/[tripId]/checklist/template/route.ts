import { api } from "@/lib/api/handler";
import { applyDefaultTemplate } from "@/lib/services/checklist";

/** 追加带娃默认清单 */
export const POST = api<{ tripId: string }>(async (ctx) => applyDefaultTemplate(ctx, ctx.params.tripId));
