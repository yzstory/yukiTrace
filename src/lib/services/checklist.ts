import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertTripAccess } from "@/lib/access";
import { badRequest } from "@/lib/api/errors";
import type { Actor } from "./shared";

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}/checklist`);

export const DEFAULT_TEMPLATE: Array<{ group: string; items: string[] }> = [
  { group: "证件与钱", items: ["护照 / 身份证", "宝宝出生证明或户口本复印件", "信用卡 + 少量现金", "行程与酒店确认单截图"] },
  { group: "宝宝用品", items: ["奶粉 / 辅食（按天数 +2 天）", "奶瓶 + 清洗刷", "尿布（每天 8 片）", "湿巾 + 隔尿垫", "安抚奶嘴 / 安抚玩具", "婴儿推车", "背带 / 腰凳", "睡袋 / 小毯子"] },
  { group: "衣物", items: ["宝宝换洗衣物（每天 2 套）", "薄外套 + 帽子", "袜子 / 软底鞋", "大人衣物"] },
  { group: "药品与护理", items: ["退烧药（对乙酰氨基酚 / 布洛芬）", "体温计", "生理盐水 / 吸鼻器", "护臀膏", "防晒霜（婴儿）", "驱蚊贴", "创可贴 + 消毒棉片"] },
  { group: "电子与杂物", items: ["充电器 + 充电宝", "转换插头", "白噪音机 / 手机 App", "保温杯", "垃圾袋 / 密封袋", "小夜灯"] },
];

export async function listChecklist(actor: Actor, tripId: string) {
  await assertTripAccess(actor.userId, tripId);
  return db.checklistItem.findMany({ where: { tripId }, orderBy: { order: "asc" }, select: { id: true, group: true, text: true, checked: true, order: true } });
}

export async function toggleChecklistItem(actor: Actor, tripId: string, id: string, checked: boolean) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await db.checklistItem.updateMany({ where: { id, tripId }, data: { checked } });
  refresh(tripId);
}

export async function addChecklistItem(actor: Actor, tripId: string, group: string, text: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const t = text.trim();
  if (!t) throw badRequest("请填写物品");
  if (t.length > 120) throw badRequest("物品名称过长");
  const count = await db.checklistItem.count({ where: { tripId } });
  const item = await db.checklistItem.create({ data: { tripId, group: group.trim() || "通用", text: t, order: count } });
  refresh(tripId);
  return { id: item.id };
}

export async function deleteChecklistItem(actor: Actor, tripId: string, id: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await db.checklistItem.deleteMany({ where: { id, tripId } });
  refresh(tripId);
}

export async function applyDefaultTemplate(actor: Actor, tripId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  const existing = await db.checklistItem.count({ where: { tripId } });
  let i = existing;
  const { count } = await db.checklistItem.createMany({
    data: DEFAULT_TEMPLATE.flatMap((g) => g.items.map((text) => ({ tripId, group: g.group, text, order: i++ }))),
  });
  refresh(tripId);
  return { added: count };
}

export async function resetChecks(actor: Actor, tripId: string) {
  await assertTripAccess(actor.userId, tripId, "EDITOR");
  await db.checklistItem.updateMany({ where: { tripId }, data: { checked: false } });
  refresh(tripId);
}
