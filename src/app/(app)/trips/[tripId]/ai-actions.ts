"use server";

import { generateText } from "ai";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { formatMoney } from "@/lib/currency";
import { fmt, babyAge, dayIndex } from "@/lib/date";
import { revalidatePath } from "next/cache";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

/** 生成某一天的日记草稿（不直接覆盖已有日记，写入 aiDraft） */
export async function generateDailyDraft(tripId: string, date: string, tone: "default" | "to_baby" = "default"): Promise<{ draft?: string; error?: string }> {
  await requireTripAccess(tripId, "EDITOR");
  if (!aiConfigured()) return { error: "AI 未配置" };
  const gate_packing = rateLimit(`ai:packing:${tripId}`, LIMITS.aiGenerate.limit, LIMITS.aiGenerate.windowMs);
  if (!gate_packing.ok) return { error: `生成太频繁，请 ${gate_packing.retryAfterS} 秒后再试` };
  const gate_summary = rateLimit(`ai:summary:${tripId}`, LIMITS.aiGenerate.limit, LIMITS.aiGenerate.windowMs);
  if (!gate_summary.ok) return { error: `生成太频繁，请 ${gate_summary.retryAfterS} 秒后再试` };
  const gate_draft = rateLimit(`ai:draft:${tripId}`, LIMITS.aiGenerate.limit, LIMITS.aiGenerate.windowMs);
  if (!gate_draft.ok) return { error: `生成太频繁，请 ${gate_draft.retryAfterS} 秒后再试` };
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId } });
  const day = new Date(date);
  const next = new Date(day.getTime() + 86400000);
  const [stops, entries, expenses, babyLogs, photos] = await Promise.all([
    db.stop.findMany({ where: { tripId, arriveAt: { gte: day, lt: next } }, orderBy: { arriveAt: "asc" } }),
    db.entry.findMany({ where: { tripId, startAt: { gte: day, lt: next } }, orderBy: { startAt: "asc" }, include: { stop: { select: { name: true } } } }),
    db.expense.findMany({ where: { tripId, paidAt: { gte: day, lt: next } } }),
    db.babyLog.findMany({ where: { tripId, at: { gte: day, lt: next } }, orderBy: { at: "asc" } }),
    db.photo.findMany({ where: { tripId, takenAt: { gte: day, lt: next } }, select: { caption: true } }),
  ]);
  const facts = [
    `日期：${fmt.dateFull(day, trip.timezone)}（Day ${dayIndex(trip.startDate, day, trip.timezone)}）`,
    stops.length ? `站点：${stops.map((s) => `${fmt.time(s.arriveAt, trip.timezone)} ${s.name}${s.note ? `（${s.note}）` : ""}`).join("；")}` : "",
    entries.length ? `条目：${entries.map((e) => `${fmt.time(e.startAt, trip.timezone)} [${e.type}] ${e.title}${e.stop ? `@${e.stop.name}` : ""}${e.note ? `（${e.note}）` : ""}`).join("；")}` : "",
    expenses.length ? `花费：共 ${expenses.length} 笔，合计 ${formatMoney(expenses.reduce((a, e) => a + e.amountHomeMinor, 0), trip.homeCurrency)}；最大一笔 ${(() => { const m = expenses.reduce((a, b) => (a.amountHomeMinor > b.amountHomeMinor ? a : b)); return `${m.title} ${formatMoney(m.amountMinor, m.currency, { showCode: true })}`; })()}` : "",
    babyLogs.length ? `宝宝：${babyLogs.map((b) => `${fmt.time(b.at, trip.timezone)} ${b.type}${b.note ? ` ${b.note}` : ""}`).join("；")}` : "",
    photos.length ? `照片 ${photos.length} 张${photos.filter((p) => p.caption).length ? `，说明：${photos.map((p) => p.caption).filter(Boolean).join("；")}` : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (!facts.includes("站点") && !facts.includes("条目") && !facts.includes("花费")) return { error: "这一天还没有记录，先记点什么吧" };

  const baby = trip.babyName ?? "宝宝";
  const toneText = tone === "to_baby" ? `以「写给${baby}长大后看」的口吻，第二人称称呼${baby}，温柔但不肉麻。` : `以父母日记的口吻，第一人称，平实、有画面感。`;
  const { text } = await generateText({
    model: chatModel(),
    system: `你帮一家人写带娃旅行日记。${toneText}只根据给出的事实写，不要编造没发生的事；120 字左右，一段，不用标题，不用 emoji，不要罗列金额明细（可以提一句今天花得多或少）。${trip.babyBirthDate ? `${baby}此时 ${babyAge(trip.babyBirthDate, day)}。` : ""}`,
    prompt: facts,
  });
  const draft = text.trim();
  log.info("ai.dailyDraft", { tripId, date, tone, chars: draft.length });
  await db.dailyNote.upsert({ where: { tripId_date: { tripId, date: day } }, update: { aiDraft: draft }, create: { tripId, date: day, content: "", aiDraft: draft } });
  revalidatePath(`/trips/${tripId}`);
  return { draft };
}

/**
 * 家庭日记：把当天所有成员各自记录的内容合成一段共同的日记。
 * 与 generateDailyDraft 的区别是会标注「谁记的」，适合多人同行。
 */
export async function generateFamilyDigest(tripId: string, date: string): Promise<{ draft?: string; error?: string }> {
  await requireTripAccess(tripId, "EDITOR");
  if (!aiConfigured()) return { error: "AI 未配置" };
  const gate = rateLimit(`ai:digest:${tripId}`, LIMITS.aiGenerate.limit, LIMITS.aiGenerate.windowMs);
  if (!gate.ok) return { error: `生成太频繁，请 ${gate.retryAfterS} 秒后再试` };

  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId } });
  const day = new Date(date);
  const next = new Date(day.getTime() + 86400_000);

  const [expenses, photos, babyLogs, stops] = await Promise.all([
    db.expense.findMany({ where: { tripId, paidAt: { gte: day, lt: next } }, include: { paidBy: { select: { name: true } } } }),
    db.photo.findMany({ where: { tripId, createdAt: { gte: day, lt: next } }, include: { uploader: { select: { name: true } } } }),
    db.babyLog.findMany({ where: { tripId, at: { gte: day, lt: next } }, orderBy: { at: "asc" } }),
    db.stop.findMany({ where: { tripId, arriveAt: { gte: day, lt: next } }, orderBy: { arriveAt: "asc" } }),
  ]);

  if (stops.length === 0 && expenses.length === 0 && photos.length === 0) return { error: "这一天还没有记录" };

  // 按成员归集，让模型知道谁记了什么
  const byPerson = new Map<string, string[]>();
  const add = (who: string, what: string) => byPerson.set(who, [...(byPerson.get(who) ?? []), what]);
  expenses.forEach((e) => add(e.paidBy?.name ?? "有人", `记了一笔${e.title} ${formatMoney(e.amountMinor, e.currency, { showCode: true })}`));
  photos.forEach((p) => add(p.uploader?.name ?? "有人", `拍了照片${p.aiCaption ? `：${p.aiCaption}` : ""}`));

  const facts = [
    `日期：${fmt.dateFull(day, trip.timezone)}`,
    stops.length ? `去了：${stops.map((s) => `${fmt.time(s.arriveAt, s.timezone ?? trip.timezone)} ${s.name}${s.note ? `（${s.note}）` : ""}`).join("；")}` : "",
    Array.from(byPerson).map(([who, items]) => `${who}：${items.join("；")}`).join("\n"),
    babyLogs.length ? `${trip.babyName ?? "宝宝"}：${babyLogs.map((b) => `${fmt.time(b.at, trip.timezone)} ${b.type}${b.note ? ` ${b.note}` : ""}`).join("；")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateText({
    model: chatModel(),
    system: `你把一家人各自零散的旅行记录合成一段共同的日记，150 字左右，中文，一段。自然地提到是谁记的（例如「爸爸拍到…」），不要罗列流水账，不要列金额明细，不用标题与 emoji。`,
    prompt: facts,
  });

  const draft = text.trim();
  await db.dailyNote.upsert({
    where: { tripId_date: { tripId, date: day } },
    update: { aiDraft: draft },
    create: { tripId, date: day, content: "", aiDraft: draft },
  });
  log.info("ai.familyDigest", { tripId, date, chars: draft.length });
  revalidatePath(`/trips/${tripId}`);
  return { draft };
}

/** 生成整段旅程的游记与总结要点 */
export async function generateTripSummary(tripId: string): Promise<{ text?: string; error?: string }> {
  await requireTripAccess(tripId);
  if (!aiConfigured()) return { error: "AI 未配置" };
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { stops: { orderBy: { arriveAt: "asc" } }, entries: { orderBy: { startAt: "asc" } }, expenses: true, dailyNotes: { orderBy: { date: "asc" } }, _count: { select: { photos: true } } },
  });
  const total = trip.expenses.reduce((a, e) => a + e.amountHomeMinor, 0);
  const byCat = new Map<string, number>();
  trip.expenses.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountHomeMinor));
  const facts = [
    `旅程：${trip.title}，${fmt.dateFull(trip.startDate, trip.timezone)} – ${fmt.dateFull(trip.endDate, trip.timezone)}`,
    trip.babyName ? `宝宝 ${trip.babyName}${trip.babyBirthDate ? `，出发时 ${babyAge(trip.babyBirthDate, trip.startDate)}` : ""}` : "",
    `同行：${trip.travelers.join("、") || "未填写"}`,
    `站点（${trip.stops.length}）：${trip.stops.map((s) => `${fmt.date(s.arriveAt, trip.timezone)} ${s.name}${s.city ? `·${s.city}` : ""}`).join("；")}`,
    `条目：${trip.entries.map((e) => `[${e.type}] ${e.title}`).join("；")}`,
    `花费合计 ${formatMoney(total, trip.homeCurrency)}；分类：${Array.from(byCat.entries()).map(([k, v]) => `${k} ${formatMoney(v, trip.homeCurrency)}`).join("，")}`,
    `照片 ${trip._count.photos} 张`,
    trip.dailyNotes.filter((d) => d.content).length ? `日记：\n${trip.dailyNotes.filter((d) => d.content).map((d) => `${fmt.date(d.date, trip.timezone)}：${d.content}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const { text } = await generateText({
    model: chatModel(),
    system: "你帮一家人把带娃旅行的记录整理成一篇 300 字左右的游记，中文，分 2–3 段，有具体地点与细节，结尾一句给宝宝的话。只用给出的事实。不用标题，不用 emoji。",
    prompt: facts,
  });
  log.info("ai.tripSummary", { tripId, chars: text.trim().length });
  return { text: text.trim() };
}

/** 出行前装备清单建议：写入 ChecklistItem */
export async function generatePackingList(tripId: string): Promise<{ count?: number; error?: string }> {
  await requireTripAccess(tripId, "EDITOR");
  if (!aiConfigured()) return { error: "AI 未配置" };
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, include: { stops: { select: { city: true }, distinct: ["city"] } } });
  const { text } = await generateText({
    model: chatModel(),
    system: `你是带娃出行的老手。根据目的地、日期和宝宝月龄，给出装备清单。只输出 JSON 数组，每项 {"group":"分组","text":"物品"}，分组限定：证件与钱、宝宝用品、衣物、药品与护理、电子与杂物。20–30 项，具体到数量或型号建议时写在 text 里。不要输出其他文字。`,
    prompt: `目的地：${trip.stops.map((s) => s.city).filter(Boolean).join("、") || trip.title}\n日期：${fmt.dateFull(trip.startDate, trip.timezone)} – ${fmt.dateFull(trip.endDate, trip.timezone)}\n宝宝：${trip.babyName ?? "宝宝"}${trip.babyBirthDate ? `，出发时 ${babyAge(trip.babyBirthDate, trip.startDate)}` : "，月龄未知"}\n同行：${trip.travelers.join("、") || "未填写"}`,
  });
  let items: Array<{ group: string; text: string }> = [];
  try {
    const m = text.match(/\[[\s\S]*\]/);
    items = m ? (JSON.parse(m[0]) as typeof items) : [];
  } catch {
    return { error: "清单解析失败，请重试" };
  }
  if (items.length === 0) {
    log.warn("ai.packingList empty", { tripId });
    return { error: "没有生成内容" };
  }
  log.info("ai.packingList", { tripId, items: items.length });
  const existing = await db.checklistItem.count({ where: { tripId } });
  await db.checklistItem.createMany({ data: items.slice(0, 40).map((it, i) => ({ tripId, group: it.group || "通用", text: it.text, order: existing + i })) });
  revalidatePath(`/trips/${tripId}/checklist`);
  return { count: Math.min(items.length, 40) };
}
