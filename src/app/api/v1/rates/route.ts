import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { CURRENCIES } from "@/lib/currency";
import { getRate } from "@/lib/services/expenses";

/** ?from=JPY&to=CNY&at=2026-09-07 */
export const GET = api(async ({ query }) => {
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  if (!CURRENCIES.some((c) => c.code === from) || !CURRENCIES.some((c) => c.code === to)) throw badRequest("币种不支持");
  const at = query.get("at") ? new Date(query.get("at")!) : new Date();
  if (!Number.isFinite(at.getTime())) throw badRequest("日期格式不正确");
  return { from, to, at, rate: await getRate(from, to, at) };
});
