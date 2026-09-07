import { api } from "@/lib/api/handler";
import { autoTidy, tidy } from "@/lib/services/organize";

/** GET 整理报告（重复账单 / AI 待核对 / 缺关联 / 识别失败）；POST 一键整理 */
export const GET = api<{ tripId: string }>(async (ctx) => tidy(ctx, ctx.params.tripId));
export const POST = api<{ tripId: string }>(async (ctx) => autoTidy(ctx, ctx.params.tripId));
