import { changedFields, FIELD_LABELS, type Snapshot } from "@/lib/activity-data";
import { formatMoney } from "@/lib/currency";
import { fmt } from "@/lib/date";

export function HistoryDiff({ before, after, timezone }: { before: Snapshot | null; after: Snapshot | null; timezone: string }) {
  const display = (record: Snapshot | null, key: string) => {
    const value = record?.[key];
    if (value == null || value === "") return "未填写";
    if (key === "amountMinor" && record?.currency) return formatMoney(Number(value), String(record.currency), { showCode: true });
    if (["paidAt", "arriveAt", "leaveAt", "startAt", "endAt", "at", "date", "takenAt"].includes(key)) return `${fmt.dateFull(new Date(String(value)), timezone)} ${fmt.time(new Date(String(value)), timezone)}`;
    if (typeof value === "boolean") return value ? "是" : "否";
    return (typeof value === "object" ? JSON.stringify(value) : String(value)).slice(0, 500);
  };
  return <div className="space-y-1 text-footnote">{changedFields(before, after).map((key) => <p key={key} className="break-words">{key === "amountMinor" ? "金额" : FIELD_LABELS[key]}：{display(before, key)} → {display(after, key)}</p>)}</div>;
}
