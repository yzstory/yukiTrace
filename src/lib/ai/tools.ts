import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { auditedDb, activityId } from "@/lib/activity";
import { searchPoi, amapConfigured } from "@/lib/amap";
import { CURRENCIES, toMinor, convertMinor, formatMoney } from "@/lib/currency";
import { getRate } from "@/app/(app)/trips/[tripId]/actions";
import { EntryType, ExpenseCategory, StopType } from "@/generated/prisma/enums";
import { fmt, parseInTz } from "@/lib/date";
import { revalidatePath } from "next/cache";
import { storeTripPhoto, storeImageOnly } from "@/lib/photos";
import { analyzePhotos } from "@/lib/ai/photo";
import { after } from "next/server";

/**
 * 给 AI 的工具集，全部限定在一个 tripId 内，由调用方鉴权后传入。
 * 工具返回值尽量是简短、可读的对象，方便模型复述。
 */
/**
 * 解析模型给出的时间。模型常见的两个错误：
 *  a) 没写时区偏移 → 按旅程时区解析，而不是让 JS 当成 UTC；
 *  b) 年份写错（照抄时刻却猜年份）→ 若落在旅程日期范围之外，把年份纠正到旅程所在年份；
 *     若仍越界且「现在」在旅程期间内，则直接用现在。
 */
export function parseAiTime(raw: string | undefined, ctx: { now: Date; tz: string; start: Date; end: Date }): Date {
  const { now, tz, start, end } = ctx;
  const inRange = (d: Date) => d.getTime() >= start.getTime() - 86400_000 && d.getTime() <= end.getTime() + 2 * 86400_000;
  if (!raw) return now;
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const d = hasOffset ? new Date(raw) : parseInTz(raw.replace(" ", "T").slice(0, 16), tz);
  if (Number.isNaN(d.getTime())) return now;
  if (inRange(d)) return d;
  // 年份纠正：保留月日时分，年份改成旅程开始年
  const local = fmt.inputDateTime(d, tz); // yyyy-MM-ddTHH:mm
  const fixed = parseInTz(`${fmt.inputDate(start, tz).slice(0, 4)}${local.slice(4)}`, tz);
  if (inRange(fixed)) return fixed;
  return inRange(now) ? now : d;
}

export type Attachment = { buffer: Buffer; mediaType: string };

export function tripTools(ctx: {
  tripId: string;
  userId: string;
  homeCurrency: string;
  now: Date;
  canEdit: boolean;
  timezone: string;
  startDate: Date;
  endDate: Date;
  /** 用户这条消息里附带的图片，按顺序编号从 0 开始 */
  attachments?: Attachment[];
}) {
  const { tripId, userId, homeCurrency, timezone: tz } = ctx;
  const db = auditedDb({ tripId, userId, source: "ai" });
  const timeCtx = { now: ctx.now, tz, start: ctx.startDate, end: ctx.endDate };
  const attachments = ctx.attachments ?? [];
  const pickAttachments = (indexes?: number[]) => (indexes && indexes.length ? indexes : attachments.map((_, i) => i)).map((i) => attachments[i]).filter(Boolean);

  /** 把附件存成旅程照片，并在后台跑视觉分析 */
  async function saveAttachmentsAsPhotos(indexes: number[] | undefined, opts: { stopId?: string | null; entryId?: string | null; caption?: string | null; firstMoment?: string | null }) {
    const ids: string[] = [];
    for (const a of pickAttachments(indexes)) {
      const p = await storeTripPhoto({ tripId, buffer: a.buffer, uploaderId: userId, source: "ai", ...opts });
      ids.push(p.id);
    }
    if (ids.length) {
      after(async () => {
        await analyzePhotos(ids).catch(() => {});
        revalidatePath(`/trips/${tripId}`);
      });
    }
    return ids;
  }

  const readTools = {
    listStops: tool({
      description: "列出这段旅程的所有站点（按时间顺序），含 id、名称、城市、到达时间。",
      inputSchema: z.object({}),
      execute: async () => {
        const stops = await db.stop.findMany({ where: { tripId }, orderBy: [{ arriveAt: "asc" }, { order: "asc" }], select: { id: true, name: true, city: true, type: true, arriveAt: true } });
        return stops.map((s) => ({ id: s.id, name: s.name, city: s.city, type: s.type, arriveAt: fmt.dateTime(s.arriveAt, tz) }));
      },
    }),
    listEntries: tool({
      description: "列出条目（航班/租车/住宿/餐食/游玩/购物等），可按类型或站点过滤。",
      inputSchema: z.object({ type: z.nativeEnum(EntryType).optional(), stopId: z.string().optional() }),
      execute: async ({ type, stopId }) => {
        const entries = await db.entry.findMany({ where: { tripId, type, stopId }, orderBy: { startAt: "asc" }, include: { stop: { select: { name: true } } }, take: 100 });
        return entries.map((e) => ({ id: e.id, type: e.type, title: e.title, at: fmt.dateTime(e.startAt, tz), stop: e.stop?.name ?? null, note: e.note, meta: e.meta }));
      },
    }),
    queryExpenses: tool({
      description: "查询花费。可按分类、是否宝宝相关、日期范围过滤；返回明细与合计（主币种）。",
      inputSchema: z.object({
        category: z.nativeEnum(ExpenseCategory).optional(),
        isBaby: z.boolean().optional(),
        from: z.string().optional().describe("ISO 日期，含"),
        to: z.string().optional().describe("ISO 日期，含"),
        keyword: z.string().optional().describe("标题关键字"),
      }),
      execute: async ({ category, isBaby, from, to, keyword }) => {
        const list = await db.expense.findMany({
          where: {
            tripId,
            category,
            isBaby,
            title: keyword ? { contains: keyword, mode: "insensitive" } : undefined,
            paidAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59`) : undefined },
          },
          orderBy: { paidAt: "asc" },
          include: { stop: { select: { name: true } } },
          take: 200,
        });
        const total = list.reduce((a, e) => a + e.amountHomeMinor, 0);
        return {
          count: list.length,
          total: formatMoney(total, homeCurrency),
          items: list.map((e) => ({ id: e.id, title: e.title, amount: formatMoney(e.amountMinor, e.currency, { showCode: true }), home: formatMoney(e.amountHomeMinor, homeCurrency), category: e.category, isBaby: e.isBaby, at: fmt.dateTime(e.paidAt, tz), stop: e.stop?.name ?? null })),
        };
      },
    }),
    searchPlace: tool({
      description: "用高德搜索地点，返回候选（含坐标）。用于把用户说的地名变成可创建的站点。",
      inputSchema: z.object({ keyword: z.string(), city: z.string().optional() }),
      execute: async ({ keyword, city }) => {
        if (!amapConfigured()) return { configured: false, results: [] as const, hint: "未配置高德 Key，无法搜索坐标；可以让用户手动添加站点。" };
        const results = await searchPoi(keyword, city);
        return { configured: true, results: results.slice(0, 5) };
      },
    }),
    getTripSummary: tool({
      description: "获取旅程概览：标题、日期、天数、宝宝信息、站点数、总花费。",
      inputSchema: z.object({}),
      execute: async () => {
        const t = await db.trip.findUniqueOrThrow({ where: { id: tripId }, include: { _count: { select: { stops: true, photos: true, entries: true } }, expenses: { select: { amountHomeMinor: true } } } });
        return {
          title: t.title,
          dates: `${fmt.dateFull(t.startDate, tz)} – ${fmt.dateFull(t.endDate, tz)}`,
          babyName: t.babyName,
          babyBirthDate: t.babyBirthDate ? fmt.inputDate(t.babyBirthDate, tz) : null,
          travelers: t.travelers,
          stops: t._count.stops,
          entries: t._count.entries,
          photos: t._count.photos,
          total: formatMoney(t.expenses.reduce((a, e) => a + e.amountHomeMinor, 0), t.homeCurrency),
        };
      },
    }),
  };

  if (!ctx.canEdit) return readTools;

  const writeTools = {
    createStop: tool({
      description: "创建一个站点。必须有坐标（先用 searchPlace 拿到 lat/lng）。arriveAt 用旅程时区的本地时间 YYYY-MM-DDTHH:mm（带完整年份，不加时区偏移）；不确定时间就用系统提示里的当前时间。",
      inputSchema: z.object({
        name: z.string(),
        lat: z.number(),
        lng: z.number(),
        type: z.nativeEnum(StopType).default("OTHER"),
        arriveAt: z.string().describe("ISO 8601"),
        address: z.string().optional(),
        city: z.string().optional(),
        note: z.string().optional(),
      }),
      execute: async (input) => {
        const count = await db.stop.count({ where: { tripId } });
        const s = await db.stop.create({ data: { tripId, ...input, arriveAt: parseAiTime(input.arriveAt, timeCtx), order: count } });
        revalidatePath(`/trips/${tripId}`);
        return { id: s.id, name: s.name, arriveAt: fmt.dateTime(s.arriveAt, tz), records: [{ entity: "stop", refId: s.id, activityId: activityId(s) }] };
      },
    }),
    createEntry: tool({
      description: "创建一条条目（餐食/游玩/住宿/航班/租车/火车/打车/购物/此刻）。可选同时记一笔花费（amount 为原币金额，如 2800 日元就是 2800 + JPY）。",
      inputSchema: z.object({
        type: z.nativeEnum(EntryType),
        title: z.string(),
        startAt: z.string().describe("ISO 8601"),
        endAt: z.string().optional(),
        stopId: z.string().optional().describe("关联站点 id，可用 listStops 查"),
        note: z.string().optional(),
        meta: z.record(z.string(), z.string()).optional().describe("类型特定字段，如 flightNo/seat/company/carModel/roomType/dishes"),
        expense: z
          .object({
            amount: z.number().positive(),
            currency: z.string().default(homeCurrency),
            isBaby: z.boolean().default(false),
            category: z.nativeEnum(ExpenseCategory).optional(),
          })
          .optional(),
        photoAttachmentIndexes: z.array(z.number().int().min(0)).optional().describe("把用户附带的哪几张图片存为这条条目的照片（下标从 0 起）；票据类图片不要存为照片"),
      }),
      execute: async (input) => {
        const startAt = parseAiTime(input.startAt, timeCtx);
        const entry = await db.entry.create({
          data: { tripId, type: input.type, title: input.title, startAt, endAt: input.endAt ? parseAiTime(input.endAt, timeCtx) : null, stopId: input.stopId ?? null, note: input.note ?? null, meta: input.meta ?? undefined },
        });
        let expenseText: string | null = null;
        const records = [{ entity: "entry", refId: entry.id, activityId: activityId(entry) }];
        if (input.expense) {
          const cur = CURRENCIES.some((c) => c.code === input.expense!.currency) ? input.expense.currency : homeCurrency;
          const amountMinor = toMinor(input.expense.amount, cur);
          const rate = await getRate(cur, homeCurrency, startAt);
          const defaultCat: Record<EntryType, ExpenseCategory> = { FLIGHT: "TRANSPORT", CAR_RENTAL: "TRANSPORT", TRAIN: "TRANSPORT", TAXI: "TRANSPORT", HOTEL: "ACCOMMODATION", MEAL: "FOOD", ACTIVITY: "ACTIVITY", SHOPPING: "SHOPPING", MOMENT: "OTHER" };
          const e = await db.expense.create({
            data: {
              tripId,
              entryId: entry.id,
              stopId: input.stopId ?? null,
              paidById: userId,
              amountMinor,
              currency: cur,
              amountHomeMinor: convertMinor(amountMinor, cur, homeCurrency, rate),
              amountCnyMinor: convertMinor(amountMinor, cur, "CNY", cur === "CNY" ? 1 : await getRate(cur, "CNY", startAt)),
              rate,
              category: input.expense.isBaby ? "BABY" : (input.expense.category ?? defaultCat[input.type]),
              isBaby: input.expense.isBaby,
              title: input.title,
              paidAt: startAt,
            },
          });
          expenseText = `${formatMoney(e.amountMinor, e.currency, { showCode: true })} ≈ ${formatMoney(e.amountHomeMinor, homeCurrency)}`;
          records.push({ entity: "expense", refId: e.id, activityId: activityId(e) });
        }
        const photoIds = input.photoAttachmentIndexes?.length ? await saveAttachmentsAsPhotos(input.photoAttachmentIndexes, { stopId: input.stopId ?? null, entryId: entry.id }) : [];
        revalidatePath(`/trips/${tripId}`);
        return { id: entry.id, title: entry.title, type: entry.type, at: fmt.dateTime(entry.startAt, tz), expense: expenseText, photosSaved: photoIds.length, records: [...records, ...photoIds.map((refId) => ({ entity: "photo", refId }))] };
      },
    }),
    addExpense: tool({
      description: "单独记一笔花费（不挂条目）。amount 为原币金额。",
      inputSchema: z.object({
        title: z.string(),
        amount: z.number().positive(),
        currency: z.string().default(homeCurrency),
        category: z.nativeEnum(ExpenseCategory).default("OTHER"),
        isBaby: z.boolean().default(false),
        paidAt: z.string().describe("ISO 8601"),
        stopId: z.string().optional(),
        note: z.string().optional(),
        receiptAttachmentIndex: z.number().int().min(0).optional().describe("若用户附带了这笔花费的票据/账单图片，填其下标以保存为凭证"),
      }),
      execute: async (input) => {
        const cur = CURRENCIES.some((c) => c.code === input.currency) ? input.currency : homeCurrency;
        const receipt = input.receiptAttachmentIndex != null ? attachments[input.receiptAttachmentIndex] : undefined;
        const receiptKey = receipt ? await storeImageOnly(tripId, receipt.buffer).catch(() => null) : null;
        const amountMinor = toMinor(input.amount, cur);
        const paidAt = parseAiTime(input.paidAt, timeCtx);
        const rate = await getRate(cur, homeCurrency, paidAt);
        const e = await db.expense.create({
          data: {
            tripId,
            stopId: input.stopId ?? null,
            paidById: userId,
            amountMinor,
            currency: cur,
            amountHomeMinor: convertMinor(amountMinor, cur, homeCurrency, rate),
            amountCnyMinor: convertMinor(amountMinor, cur, "CNY", cur === "CNY" ? 1 : await getRate(cur, "CNY", paidAt)),
            rate,
            category: input.isBaby ? "BABY" : input.category,
            isBaby: input.isBaby,
            title: input.title,
            note: input.note ?? null,
            paidAt,
            receiptKey,
          },
        });
        revalidatePath(`/trips/${tripId}`);
        return { id: e.id, title: e.title, amount: formatMoney(e.amountMinor, e.currency, { showCode: true }), home: formatMoney(e.amountHomeMinor, homeCurrency), receiptSaved: Boolean(receiptKey), records: [{ entity: "expense", refId: e.id, activityId: activityId(e) }] };
      },
    }),
    savePhotos: tool({
      description: "把用户这条消息附带的图片存为旅程照片（生活照、风景、宝宝的瞬间）。可关联站点、写一句说明、标注「第一次」。票据/订单截图不要用这个，那些走 addExpense 或 createEntry。",
      inputSchema: z.object({
        indexes: z.array(z.number().int().min(0)).optional().describe("要保存的图片下标，省略表示全部"),
        stopId: z.string().optional().describe("关联站点，可用 listStops 查；不确定就省略，会按 GPS 自动匹配"),
        caption: z.string().optional().describe("一句话说明，可以直接用用户的原话"),
        firstMoment: z.string().optional().describe("若用户提到这是某个「第一次」，写一句话，如「第一次看海」"),
      }),
      execute: async ({ indexes, stopId, caption, firstMoment }) => {
        if (attachments.length === 0) return { saved: 0, hint: "这条消息没有附带图片" };
        const ids = await saveAttachmentsAsPhotos(indexes, { stopId: stopId ?? null, caption: caption ?? null, firstMoment: firstMoment ?? null });
        return { saved: ids.length, ids, records: ids.map((refId) => ({ entity: "photo", refId })) };
      },
    }),
    logBaby: tool({
      description: "记录宝宝状态：喂奶 FEED / 换尿布 DIAPER / 入睡 SLEEP / 醒来 WAKE / 吃药 MEDICINE / 其他 OTHER。",
      inputSchema: z.object({ type: z.enum(["FEED", "DIAPER", "SLEEP", "WAKE", "MEDICINE", "OTHER"]), at: z.string().describe("ISO 8601"), note: z.string().optional() }),
      execute: async ({ type, at, note }) => {
        const l = await db.babyLog.create({ data: { tripId, type, at: parseAiTime(at, timeCtx), note: note ?? null } });
        revalidatePath(`/trips/${tripId}`);
        return { id: l.id, type: l.type, at: fmt.dateTime(l.at, tz), records: [{ entity: "babyLog", refId: l.id, activityId: activityId(l) }] };
      },
    }),
    saveDailyNote: tool({
      description: "保存某一天的日记（覆盖）。date 为 YYYY-MM-DD。",
      inputSchema: z.object({ date: z.string(), content: z.string() }),
      execute: async ({ date, content }) => {
        const day = new Date(date);
        const note = await db.dailyNote.upsert({ where: { tripId_date: { tripId, date: day } }, update: { content }, create: { tripId, date: day, content } });
        revalidatePath(`/trips/${tripId}`);
        return { ok: true, date, records: [{ entity: "dailyNote", refId: note.id, activityId: activityId(note) }] };
      },
    }),
  };

  return { ...readTools, ...writeTools };
}

export function systemPrompt(ctx: { tripTitle: string; homeCurrency: string; now: Date; babyName: string | null; babyAge: string | null; timezone: string }) {
  return `你是「Trace」的旅行记录助手，帮一家人在带宝宝旅行时以最低成本记录行程与花费。
当前旅程：${ctx.tripTitle}。主币种：${ctx.homeCurrency}。现在时间：${fmt.dateFull(ctx.now, ctx.timezone)} ${fmt.time(ctx.now, ctx.timezone)}（${ctx.timezone}）。**今年是 ${fmt.inputDate(ctx.now, ctx.timezone).slice(0, 4)} 年**，写入任何时间都必须带完整年份且使用这一年，格式如 ${fmt.inputDateTime(ctx.now, ctx.timezone)}（该时区本地时间，不要加 Z 或时区偏移）。
${ctx.babyName ? `宝宝：${ctx.babyName}${ctx.babyAge ? `，现在 ${ctx.babyAge}` : ""}。` : ""}

原则：
1. 用户随口一句话，就直接帮他记下来：拆成站点 / 条目 / 花费 / 宝宝状态，调用工具写入，不要反问太多。缺时间就用现在；缺地点就不关联站点；缺货币就用主币种。
2. 记完用一两句话确认写了什么，金额带货币；不要输出 JSON，不要复述工具细节。
3. 回答花费/行程问题时先用查询工具拿数据，再给结论，数字要来自工具结果。
4. 语气轻松、简洁、中文，像一个细心的朋友。不要用 emoji 堆砌。
5. 创建站点前必须有坐标：先 searchPlace；搜不到就告诉用户可以手动添加。
6. 用户可能附带图片（按顺序编号从 0 开始）。**用途以用户的文字为准**：
   - 说是账单/收据/订单/机票/酒店确认 → 直接读图里的金额、时间、商家，调用 addExpense（用 receiptAttachmentIndex 保存凭证）或 createEntry；
   - 说是照片/宝宝/风景/第一次… → 调用 savePhotos 存进旅程，caption 用用户原话；
   - 只是提问（「这是什么」「帮我看看菜单」「翻译一下」）→ 直接回答，不要保存；
   - 没有文字只有图片 → 一句话说出你看到了什么，问用户想记账还是存照片，不要自作主张。
7. 问到「以前 / 去年 / 别的旅程」时，用跨旅程工具（searchMemories、listTrips、compareSpending、findPlacesVisited、onThisDay）查，不要只看当前旅程。`;
}
