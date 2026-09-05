import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { searchMemories } from "@/lib/ai/memory";
import { formatMoney } from "@/lib/currency";
import { fmt, babyAge } from "@/lib/date";
import { ExpenseCategory } from "@/generated/prisma/enums";

/** 跨旅程问答的工具集：只读 */
export function globalTools(userId: string) {
  const scope = async () =>
    (await db.trip.findMany({ where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, select: { id: true } })).map((t) => t.id);

  return {
    searchMemories: tool({
      description: "在所有旅程的记录里做语义搜索（站点、条目、花费、日记、照片说明）。回答「我们在哪住过带婴儿床的酒店」这类问题时先用它。",
      inputSchema: z.object({ query: z.string().describe("自然语言查询"), limit: z.number().min(1).max(20).default(8) }),
      execute: async ({ query, limit }) => {
        const hits = await searchMemories(userId, query, limit);
        return hits.map((h) => ({ trip: h.tripTitle, kind: h.kind, when: h.occurredAt ? fmt.dateFull(h.occurredAt) : null, text: h.text }));
      },
    }),

    listTrips: tool({
      description: "列出所有旅程：标题、日期、天数、站点数、总花费、宝宝当时月龄。",
      inputSchema: z.object({}),
      execute: async () => {
        const trips = await db.trip.findMany({
          where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
          orderBy: { startDate: "desc" },
          include: { _count: { select: { stops: true, photos: true } }, expenses: { select: { amountCnyMinor: true } } },
        });
        return trips.map((t) => ({
          id: t.id,
          title: t.title,
          dates: `${fmt.dateFull(t.startDate, t.timezone)} – ${fmt.dateFull(t.endDate, t.timezone)}`,
          stops: t._count.stops,
          photos: t._count.photos,
          totalCny: formatMoney(t.expenses.reduce((a, e) => a + e.amountCnyMinor, 0), "CNY"),
          babyAgeAtStart: t.babyBirthDate ? babyAge(t.babyBirthDate, t.startDate) : null,
        }));
      },
    }),

    compareSpending: tool({
      description: "跨旅程比较花费：总额、日均、按分类，全部折算人民币。",
      inputSchema: z.object({ category: z.nativeEnum(ExpenseCategory).optional(), babyOnly: z.boolean().optional() }),
      execute: async ({ category, babyOnly }) => {
        const ids = await scope();
        const trips = await db.trip.findMany({
          where: { id: { in: ids } },
          orderBy: { startDate: "desc" },
          include: { expenses: { where: { category, isBaby: babyOnly ? true : undefined }, select: { amountCnyMinor: true, category: true } } },
        });
        return trips.map((t) => {
          const total = t.expenses.reduce((a, e) => a + e.amountCnyMinor, 0);
          const days = Math.max(1, Math.round((t.endDate.getTime() - t.startDate.getTime()) / 86400_000) + 1);
          const byCat = new Map<string, number>();
          t.expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCnyMinor));
          return {
            trip: t.title,
            month: fmt.monthYear(t.startDate, t.timezone),
            total: formatMoney(total, "CNY"),
            perDay: formatMoney(Math.round(total / days), "CNY"),
            byCategory: Object.fromEntries(Array.from(byCat).map(([k, v]) => [k, formatMoney(v, "CNY")])),
          };
        });
      },
    }),

    findPlacesVisited: tool({
      description: "查去过的地点，可按城市或婴儿友好标签过滤（母婴室 nursing_room、婴儿床 crib、儿童座椅 high_chair 等）。",
      inputSchema: z.object({ city: z.string().optional(), babyTag: z.string().optional(), keyword: z.string().optional() }),
      execute: async ({ city, babyTag, keyword }) => {
        const ids = await scope();
        const stops = await db.stop.findMany({
          where: {
            tripId: { in: ids },
            city: city ? { contains: city, mode: "insensitive" } : undefined,
            babyTags: babyTag ? { has: babyTag } : undefined,
            name: keyword ? { contains: keyword, mode: "insensitive" } : undefined,
          },
          orderBy: { arriveAt: "desc" },
          take: 50,
          include: { trip: { select: { title: true, timezone: true, babyName: true, babyBirthDate: true } } },
        });
        return stops.map((s) => ({
          name: s.name,
          city: s.city,
          trip: s.trip.title,
          when: fmt.dateFull(s.arriveAt, s.timezone ?? s.trip.timezone),
          babyTags: s.babyTags,
          note: s.note,
          babyAge: s.trip.babyBirthDate ? babyAge(s.trip.babyBirthDate, s.arriveAt) : null,
        }));
      },
    }),

    onThisDay: tool({
      description: "查往年的今天（或指定月日）发生了什么。",
      inputSchema: z.object({ month: z.number().min(1).max(12).optional(), day: z.number().min(1).max(31).optional() }),
      execute: async ({ month, day }) => {
        const now = new Date();
        const m = month ?? now.getMonth() + 1;
        const d = day ?? now.getDate();
        const ids = await scope();
        const stops = await db.stop.findMany({ where: { tripId: { in: ids } }, include: { trip: { select: { title: true, timezone: true, babyName: true, babyBirthDate: true } } } });
        return stops
          .filter((s) => {
            const w = new Date(s.arriveAt);
            return w.getMonth() + 1 === m && w.getDate() === d;
          })
          .map((s) => ({
            name: s.name,
            city: s.city,
            trip: s.trip.title,
            year: new Date(s.arriveAt).getFullYear(),
            babyAge: s.trip.babyBirthDate ? babyAge(s.trip.babyBirthDate, s.arriveAt) : null,
          }));
      },
    }),
  };
}

export function globalSystemPrompt(now: Date, userName: string) {
  return `你是「Trace」的家庭旅行记忆助手，帮 ${userName} 回顾所有旅程的记录。
现在时间：${fmt.dateFull(now)} ${fmt.time(now)}（Asia/Shanghai），今年是 ${now.getFullYear()} 年。

原则：
1. 回答前先用工具查数据，数字与地名必须来自工具结果，绝不臆造。
2. 语义类问题（「住过哪些带婴儿床的酒店」）先用 searchMemories；结构化统计用 compareSpending / findPlacesVisited。
3. 回答简洁自然，中文，带上时间与旅程名让人能对上号；金额统一人民币。
4. 查不到就直说没有记录，并提示可以怎么记。`;
}
