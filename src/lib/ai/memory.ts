import "server-only";
import { embed, embedMany } from "ai";
import { db } from "@/lib/db";
import { embeddingModel, embeddingsConfigured } from "@/lib/ai/model";
import { fmt } from "@/lib/date";
import { formatMoney } from "@/lib/currency";
import { ENTRY_TYPES, STOP_TYPES } from "@/lib/entry-types";
import { log } from "@/lib/logger";

export type MemoryHit = {
  kind: string;
  refId: string;
  tripId: string;
  tripTitle: string;
  text: string;
  occurredAt: Date | null;
  score: number;
};

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** 把一段旅程的所有记录转成可检索的文本片段 */
async function collectDocs(tripId: string) {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: { include: { entries: true } },
      expenses: { include: { stop: { select: { name: true } } } },
      dailyNotes: true,
      photos: { where: { aiCaption: { not: null } }, select: { id: true, aiCaption: true, takenAt: true, firstMoment: true } },
    },
  });
  if (!trip) return [];

  const tz = trip.timezone;
  const docs: Array<{ kind: string; refId: string; text: string; occurredAt: Date | null }> = [];

  docs.push({
    kind: "trip",
    refId: trip.id,
    text: [`旅程「${trip.title}」`, trip.description, `${fmt.dateFull(trip.startDate, tz)} 至 ${fmt.dateFull(trip.endDate, tz)}`, trip.travelers.length ? `同行：${trip.travelers.join("、")}` : "", trip.babyName ? `宝宝：${trip.babyName}` : ""].filter(Boolean).join("。"),
    occurredAt: trip.startDate,
  });

  for (const s of trip.stops) {
    const tags = s.babyTags.length ? `婴儿友好：${s.babyTags.join("、")}` : "";
    docs.push({
      kind: "stop",
      refId: s.id,
      text: [`在${trip.title}，${fmt.dateFull(s.arriveAt, s.timezone ?? tz)}到达${STOP_TYPES[s.type].label}「${s.name}」`, s.city, s.address, s.note, tags].filter(Boolean).join("。"),
      occurredAt: s.arriveAt,
    });
    for (const e of s.entries) {
      docs.push({
        kind: "entry",
        refId: e.id,
        text: [`${ENTRY_TYPES[e.type].label}：${e.title}`, `地点：${s.name}`, e.note, e.meta ? JSON.stringify(e.meta) : ""].filter(Boolean).join("。"),
        occurredAt: e.startAt,
      });
    }
  }

  for (const e of trip.expenses) {
    docs.push({
      kind: "expense",
      refId: e.id,
      text: `${fmt.dateFull(e.paidAt, tz)}在${trip.title}${e.stop ? `的${e.stop.name}` : ""}花了${formatMoney(e.amountMinor, e.currency, { showCode: true })}：${e.title}${e.isBaby ? "（宝宝相关）" : ""}`,
      occurredAt: e.paidAt,
    });
  }

  for (const n of trip.dailyNotes.filter((n) => n.content)) {
    docs.push({ kind: "note", refId: n.id, text: `${fmt.dateFull(n.date, tz)}的日记：${n.content}`, occurredAt: n.date });
  }

  for (const p of trip.photos) {
    docs.push({ kind: "photo", refId: p.id, text: [`照片：${p.aiCaption}`, p.firstMoment].filter(Boolean).join("。"), occurredAt: p.takenAt });
  }

  return docs;
}

/** 重建某段旅程的向量索引 */
export async function reindexTrip(tripId: string) {
  if (!embeddingsConfigured()) return { indexed: 0 };
  const trip = await db.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  if (!trip) return { indexed: 0 };

  const docs = await collectDocs(tripId);
  if (docs.length === 0) return { indexed: 0 };

  // 只对新增或文本变化的片段重新算向量，省调用
  const existing = await db.embedding.findMany({ where: { tripId }, select: { kind: true, refId: true, text: true } });
  const seen = new Map(existing.map((e) => [`${e.kind}:${e.refId}`, e.text]));
  const changed = docs.filter((d) => seen.get(`${d.kind}:${d.refId}`) !== d.text);
  const staleKeys = existing.filter((e) => !docs.some((d) => d.kind === e.kind && d.refId === e.refId));

  if (staleKeys.length > 0) {
    await db.embedding.deleteMany({ where: { OR: staleKeys.map((k) => ({ kind: k.kind, refId: k.refId })) } });
  }
  if (changed.length === 0) return { indexed: 0 };

  try {
    const { embeddings } = await embedMany({ model: embeddingModel(), values: changed.map((d) => d.text) });
    for (const [i, d] of changed.entries()) {
      await db.embedding.upsert({
        where: { kind_refId: { kind: d.kind, refId: d.refId } },
        update: { text: d.text, vector: embeddings[i], occurredAt: d.occurredAt, tripId, userId: trip.ownerId },
        create: { kind: d.kind, refId: d.refId, text: d.text, vector: embeddings[i], occurredAt: d.occurredAt, tripId, userId: trip.ownerId },
      });
    }
    log.info("memory.reindex", { tripId, indexed: changed.length, removed: staleKeys.length });
    return { indexed: changed.length };
  } catch (e) {
    log.warn("memory.reindex failed", { tripId, err: e });
    return { indexed: 0 };
  }
}

/** 跨旅程语义搜索；未配置向量模型时回退到关键词匹配 */
export async function searchMemories(userId: string, query: string, limit = 8): Promise<MemoryHit[]> {
  const tripIds = (
    await db.trip.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { id: true, title: true },
    })
  );
  const titles = new Map(tripIds.map((t) => [t.id, t.title]));
  if (tripIds.length === 0) return [];

  if (!embeddingsConfigured()) {
    const rows = await db.embedding.findMany({
      where: { tripId: { in: tripIds.map((t) => t.id) }, text: { contains: query, mode: "insensitive" } },
      take: limit,
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((r) => ({ kind: r.kind, refId: r.refId, tripId: r.tripId, tripTitle: titles.get(r.tripId) ?? "", text: r.text, occurredAt: r.occurredAt, score: 0.5 }));
  }

  const { embedding } = await embed({ model: embeddingModel(), value: query });
  const rows = await db.embedding.findMany({ where: { tripId: { in: tripIds.map((t) => t.id) } } });

  return rows
    .map((r) => ({
      kind: r.kind,
      refId: r.refId,
      tripId: r.tripId,
      tripTitle: titles.get(r.tripId) ?? "",
      text: r.text,
      occurredAt: r.occurredAt,
      score: cosine(embedding, r.vector),
    }))
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
