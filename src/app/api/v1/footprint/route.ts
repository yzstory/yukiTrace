import { api } from "@/lib/api/handler";
import { footprint } from "@/lib/services/footprint";

/** 足迹：所有旅程的站点坐标与统计（旅程数 / 城市数 / 直线里程） */
export const GET = api(async (ctx) => footprint(ctx));
