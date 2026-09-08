import { api } from "@/lib/api/handler";
import { tripSummary } from "@/lib/services/review";

/** 旅程总结：Wrapped 风格卡片所需的全部统计与精选照片 */
export const GET = api<{ tripId: string }>(async (ctx) => tripSummary(ctx, ctx.params.tripId));
