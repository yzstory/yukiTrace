import { api } from "@/lib/api/handler";
import { growth } from "@/lib/services/review";

/** 成长对照：同一城市不同旅程的照片与当时月龄 */
export const GET = api(async (ctx) => growth(ctx));
