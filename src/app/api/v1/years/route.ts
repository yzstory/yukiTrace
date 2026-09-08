import { api } from "@/lib/api/handler";
import { years } from "@/lib/services/review";

/** 可做年度回顾的年份 → { years: [2026, 2025] } */
export const GET = api(async (ctx) => years(ctx));
