import type { Entity } from "./activity-data";
export type RecordField = { key: string; label: string; type?: "datetime-local" | "number" | "stop" | "currency" | "textarea"; required?: boolean };
const note: RecordField = { key: "note", label: "备注", type: "textarea" };
const stop: RecordField = { key: "stopId", label: "关联地点", type: "stop" };
export const RECORD_FIELDS: Record<Entity, RecordField[]> = {
  expense: [{ key: "title", label: "名称", required: true }, { key: "amount", label: "金额", type: "number", required: true }, { key: "currency", label: "币种", type: "currency", required: true }, { key: "paidAt", label: "付款时间", type: "datetime-local", required: true }, stop, note],
  entry: [{ key: "title", label: "名称", required: true }, { key: "startAt", label: "开始时间", type: "datetime-local", required: true }, { key: "endAt", label: "结束时间", type: "datetime-local" }, stop, note],
  stop: [{ key: "name", label: "地点名称", required: true }, { key: "arriveAt", label: "到达时间", type: "datetime-local", required: true }, { key: "leaveAt", label: "离开时间", type: "datetime-local" }, { key: "lat", label: "纬度", type: "number", required: true }, { key: "lng", label: "经度", type: "number", required: true }, { key: "address", label: "地址" }, note],
  photo: [{ key: "caption", label: "照片说明", type: "textarea" }, { key: "takenAt", label: "拍摄时间", type: "datetime-local" }, stop, { key: "firstMoment", label: "第一次（请按实际经历确认）" }],
  babyLog: [{ key: "at", label: "记录时间", type: "datetime-local", required: true }, note],
  dailyNote: [{ key: "content", label: "日记", type: "textarea", required: true }],
  checklistItem: [{ key: "text", label: "清单内容", required: true }],
};
