import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requestUserId } from "@/lib/api/auth";
import { fromMinor } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import { fmt } from "@/lib/date";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/export/[tripId]">) {
  const userId = await requestUserId(req);
  if (!userId) return new NextResponse("unauthorized", { status: 401 });
  const { tripId } = await ctx.params;
  const trip = await db.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId: userId } } }] },
    include: { expenses: { orderBy: { paidAt: "asc" }, include: { stop: { select: { name: true } }, paidBy: { select: { name: true } } } } },
  });
  if (!trip) return new NextResponse("not found", { status: 404 });
  const kind = req.nextUrl.searchParams.get("kind") ?? "expenses";
  if (kind !== "expenses") return new NextResponse("unsupported", { status: 400 });

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["日期", "时间", "名称", "分类", "宝宝相关", "金额", "货币", `折算 ${trip.homeCurrency}`, "汇率", "站点", "付款人", "备注"],
    ...trip.expenses.map((e) => [
      fmt.inputDate(e.paidAt, trip.timezone),
      fmt.time(e.paidAt, trip.timezone),
      e.title,
      EXPENSE_CATEGORIES[e.category].label,
      e.isBaby ? "是" : "",
      fromMinor(e.amountMinor, e.currency),
      e.currency,
      fromMinor(e.amountHomeMinor, trip.homeCurrency),
      e.rate,
      e.stop?.name ?? "",
      e.paidBy?.name ?? "",
      e.note ?? "",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${trip.title}-花费.csv`)}`,
    },
  });
}
