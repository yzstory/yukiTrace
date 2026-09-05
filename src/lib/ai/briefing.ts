import "server-only";
import { generateText } from "ai";
import { db } from "@/lib/db";
import { aiConfigured, chatModel } from "@/lib/ai/model";
import { liveWeather, amapConfigured } from "@/lib/amap";
import { formatMoney } from "@/lib/currency";
import { formatDistance, haversine } from "@/lib/geo";
import { fmt, babyAge, dayIndex, wallClock } from "@/lib/date";
import { log } from "@/lib/logger";

export type Briefing = { title: string; body: string; url: string };

/** 找出「此刻正在进行」的旅程 */
export async function activeTripsFor(userId: string, now = new Date()) {
  return db.trip.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      startDate: { lte: new Date(now.getTime() + 86400_000) },
      endDate: { gte: new Date(now.getTime() - 86400_000) },
    },
  });
}

/** 早间简报：今天几站、走多远、天气、宝宝作息建议 */
export async function morningBriefing(tripId: string, now = new Date()): Promise<Briefing | null> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: { stops: { orderBy: { arriveAt: "asc" } } },
  });
  if (!trip) return null;

  const today = wallClock(now, trip.timezone);
  const dayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const todays = trip.stops.filter((s) => {
    const w = wallClock(s.arriveAt, s.timezone ?? trip.timezone);
    return w.getFullYear() === today.getFullYear() && w.getMonth() === today.getMonth() && w.getDate() === today.getDate();
  });

  let distance = 0;
  for (let i = 1; i < todays.length; i++) distance += haversine(todays[i - 1], todays[i]);

  // 天气用第一站的行政区
  let weather = "";
  if (amapConfigured() && todays[0]?.adcode) {
    const w = await liveWeather(todays[0].adcode);
    if (w) weather = `${w.weather} ${w.temperature}℃`;
  }

  const di = dayIndex(trip.startDate, dayStart, trip.timezone);
  const facts = [
    `旅程：${trip.title}，今天是 Day ${di}`,
    todays.length ? `计划站点：${todays.map((s) => `${fmt.time(s.arriveAt, s.timezone ?? trip.timezone)} ${s.name}`).join("；")}` : "今天还没有安排站点",
    distance ? `站点间直线距离合计 ${formatDistance(distance)}` : "",
    weather ? `天气：${weather}` : "",
    trip.babyBirthDate ? `${trip.babyName ?? "宝宝"}现在 ${babyAge(trip.babyBirthDate, now)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const fallback = {
    title: `Day ${di} · ${trip.title}`,
    body: todays.length ? `今天 ${todays.length} 站：${todays.map((s) => s.name).join(" → ")}${weather ? `，${weather}` : ""}` : `今天还没有安排，随手记一笔也好${weather ? `。${weather}` : ""}`,
    url: `/trips/${tripId}`,
  };
  if (!aiConfigured()) return fallback;

  try {
    const { text } = await generateText({
      model: chatModel(),
      system: "你给一家带娃出行的人写早间提醒。50 字以内，中文，一句话说清今天去哪、天气如何，并给一条贴合宝宝月龄的实用建议（比如午睡时间、补水、防晒）。不要标题、不要 emoji、不要客套。",
      prompt: facts,
    });
    return { ...fallback, body: text.trim() || fallback.body };
  } catch (e) {
    log.warn("briefing.morning failed", { tripId, err: e });
    return fallback;
  }
}

/** 晚间小结：今天记了什么、花了多少，并提醒写日记 */
export async function eveningBriefing(tripId: string, now = new Date()): Promise<Briefing | null> {
  const trip = await db.trip.findUnique({ where: { id: tripId } });
  if (!trip) return null;

  const today = wallClock(now, trip.timezone);
  const start = new Date(now.getTime() - 20 * 3600_000);
  const [stops, expenses, photos, note] = await Promise.all([
    db.stop.count({ where: { tripId, arriveAt: { gte: start } } }),
    db.expense.findMany({ where: { tripId, paidAt: { gte: start } }, select: { amountHomeMinor: true } }),
    db.photo.count({ where: { tripId, createdAt: { gte: start } } }),
    db.dailyNote.findFirst({ where: { tripId, date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) } }),
  ]);

  if (stops === 0 && expenses.length === 0 && photos === 0) return null;

  const total = expenses.reduce((a, e) => a + e.amountHomeMinor, 0);
  const bits = [stops && `${stops} 站`, expenses.length && `${expenses.length} 笔花费 ${formatMoney(total, trip.homeCurrency, { compact: true })}`, photos && `${photos} 张照片`].filter(Boolean).join(" · ");

  return {
    title: `今天的记录 · ${trip.title}`,
    body: note?.content ? `${bits}。日记已写好，明天见。` : `${bits}。写两句今天的日记吧，AI 可以帮你起个草稿。`,
    url: `/trips/${tripId}`,
  };
}

/** 宝宝作息提醒：距上次喂奶超过学习到的间隔时提示 */
export async function babyReminder(tripId: string, now = new Date()): Promise<Briefing | null> {
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { title: true, babyName: true, timezone: true } });
  if (!trip) return null;

  const logs = await db.babyLog.findMany({ where: { tripId, type: "FEED" }, orderBy: { at: "desc" }, take: 8 });
  if (logs.length < 3) return null;

  // 用最近几次的中位间隔作为基线，比平均值更抗异常值
  const gaps: number[] = [];
  for (let i = 1; i < logs.length; i++) gaps.push(logs[i - 1].at.getTime() - logs[i].at.getTime());
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (!median || median < 30 * 60_000) return null;

  const since = now.getTime() - logs[0].at.getTime();
  if (since < median) return null;

  const name = trip.babyName ?? "宝宝";
  const hours = (since / 3600_000).toFixed(1);
  return {
    title: `${name}该吃了？`,
    body: `上次喂奶是 ${fmt.time(logs[0].at, trip.timezone)}，已经过去 ${hours} 小时（平时约 ${(median / 3600_000).toFixed(1)} 小时一次）。`,
    url: `/trips/${tripId}`,
  };
}
