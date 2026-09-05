"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTripAccess } from "@/lib/dal";

const DEFAULT_TEMPLATE: Array<{ group: string; items: string[] }> = [
  { group: "证件与钱", items: ["护照 / 身份证", "宝宝出生证明或户口本复印件", "信用卡 + 少量现金", "行程与酒店确认单截图"] },
  { group: "宝宝用品", items: ["奶粉 / 辅食（按天数 +2 天）", "奶瓶 + 清洗刷", "尿布（每天 8 片）", "湿巾 + 隔尿垫", "安抚奶嘴 / 安抚玩具", "婴儿推车", "背带 / 腰凳", "睡袋 / 小毯子"] },
  { group: "衣物", items: ["宝宝换洗衣物（每天 2 套）", "薄外套 + 帽子", "袜子 / 软底鞋", "大人衣物"] },
  { group: "药品与护理", items: ["退烧药（对乙酰氨基酚 / 布洛芬）", "体温计", "生理盐水 / 吸鼻器", "护臀膏", "防晒霜（婴儿）", "驱蚊贴", "创可贴 + 消毒棉片"] },
  { group: "电子与杂物", items: ["充电器 + 充电宝", "转换插头", "白噪音机 / 手机 App", "保温杯", "垃圾袋 / 密封袋", "小夜灯"] },
];

export async function toggleChecklistItem(tripId: string, id: string, checked: boolean) {
  await requireTripAccess(tripId, "EDITOR");
  await db.checklistItem.update({ where: { id, tripId }, data: { checked } });
  revalidatePath(`/trips/${tripId}/checklist`);
}

export async function addChecklistItem(tripId: string, group: string, text: string) {
  await requireTripAccess(tripId, "EDITOR");
  const t = text.trim();
  if (!t) return;
  const count = await db.checklistItem.count({ where: { tripId } });
  await db.checklistItem.create({ data: { tripId, group: group.trim() || "通用", text: t, order: count } });
  revalidatePath(`/trips/${tripId}/checklist`);
}

export async function deleteChecklistItem(tripId: string, id: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.checklistItem.delete({ where: { id, tripId } });
  revalidatePath(`/trips/${tripId}/checklist`);
}

export async function applyDefaultTemplate(tripId: string) {
  await requireTripAccess(tripId, "EDITOR");
  const existing = await db.checklistItem.count({ where: { tripId } });
  let i = existing;
  await db.checklistItem.createMany({
    data: DEFAULT_TEMPLATE.flatMap((g) => g.items.map((text) => ({ tripId, group: g.group, text, order: i++ }))),
  });
  revalidatePath(`/trips/${tripId}/checklist`);
}

export async function resetChecks(tripId: string) {
  await requireTripAccess(tripId, "EDITOR");
  await db.checklistItem.updateMany({ where: { tripId }, data: { checked: false } });
  revalidatePath(`/trips/${tripId}/checklist`);
}
