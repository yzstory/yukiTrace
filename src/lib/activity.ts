import "server-only";
import { db as base } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ENTITIES, snapshot, type Entity, type Snapshot } from "./activity-data";

export type AuditContext = { tripId: string; userId: string; source?: "manual" | "ai" | "organize" };
type Args = { where?: Record<string, unknown>; data?: unknown; create?: unknown; update?: unknown };
type Delegate = {
  findUnique(args: Args): Promise<Snapshot | null>;
  create(args: Args): Promise<Snapshot>;
  update(args: Args): Promise<Snapshot>;
  delete(args: Args): Promise<Snapshot>;
  upsert(args: Args): Promise<Snapshot>;
};
export function delegate(tx: Prisma.TransactionClient, entity: Entity): Delegate {
  return tx[entity] as unknown as Delegate;
}
export async function writeActivity(tx: Prisma.TransactionClient, context: AuditContext, entity: Entity, before: Snapshot | null, after: Snapshot | null, action?: string) {
  const record = after ?? before!;
  return tx.activity.create({ data: {
    tripId: context.tripId, actorId: context.userId, source: context.source ?? "manual", entity, refId: String(record.id),
    action: action ?? (!before ? "create" : !after ? "delete" : "update"),
    before: snapshot(before) as Prisma.InputJsonValue ?? Prisma.DbNull,
    after: snapshot(after) as Prisma.InputJsonValue ?? Prisma.DbNull,
  } });
}
export async function assertReferences(tx: Prisma.TransactionClient, tripId: string, data: Snapshot) {
  if (data.stopId && !await tx.stop.findFirst({ where: { id: String(data.stopId), tripId }, select: { id: true } })) throw new Error("地点不属于当前旅程");
  if (data.entryId && !await tx.entry.findFirst({ where: { id: String(data.entryId), tripId }, select: { id: true } })) throw new Error("条目不属于当前旅程");
}
export function auditedDb(context: AuditContext): typeof base {
  return new Proxy(base, {
    get(target, model, receiver) {
      if (!ENTITIES.includes(model as Entity)) return Reflect.get(target, model, receiver);
      const entity = model as Entity;
      return new Proxy(target[entity], {
        get(modelTarget, method) {
          if (!["create", "update", "delete", "upsert"].includes(String(method))) {
            const value = Reflect.get(modelTarget, method);
            return typeof value === "function" ? value.bind(modelTarget) : value;
          }
          return async (args: Args) => base.$transaction(async (tx) => {
            const access = await tx.trip.findFirst({ where: { id: context.tripId, OR: [{ ownerId: context.userId }, { members: { some: { userId: context.userId, role: { in: ["OWNER", "EDITOR"] } } } }] }, select: { id: true } });
            if (!access) throw new Error("没有编辑权限");
            const table = delegate(tx, entity);
            const before = method === "create" ? null : await table.findUnique({ where: args.where });
            if (before && before.tripId !== context.tripId) throw new Error("记录不属于当前旅程");
            const data = (args.data ?? (before ? args.update : args.create)) as Snapshot | undefined;
            if (data) {
              if (data.tripId && data.tripId !== context.tripId) throw new Error("记录不属于当前旅程");
              await assertReferences(tx, context.tripId, data);
            }
            const result = await table[method as "create" | "update" | "delete" | "upsert"](args);
            if (result.tripId !== context.tripId) throw new Error("记录不属于当前旅程");
            const after = method === "delete" ? null : result;
            const activity = await writeActivity(tx, context, entity, before, after);
            if (context.source !== "ai") await tx.activity.updateMany({ where: { tripId: context.tripId, entity, refId: String(result.id), source: "ai", reviewedAt: null }, data: { reviewedAt: new Date() } });
            return Object.assign(result, { activityId: activity.id });
          }, { isolationLevel: "Serializable" });
        },
      });
    },
  });
}
export function activityId(record: unknown): string {
  return String((record as { activityId: string }).activityId);
}
