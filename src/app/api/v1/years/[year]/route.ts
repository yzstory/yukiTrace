import { api } from "@/lib/api/handler";
import { yearReviewFor } from "@/lib/services/review";

/** 年度回顾：统计本地算，「给宝宝的信」由模型生成（未配置 AI 时为 null） */
export const GET = api<{ year: string }>(async (ctx) => yearReviewFor(ctx, ctx.params.year));
