import { fmt } from "./date";

export type DuplicateExpense = { id: string; title: string; currency: string; amountMinor: number; paidAt: Date; updatedAt: Date };
export function duplicateExpenses(expenses: DuplicateExpense[], timezone: string) {
  const groups = new Map<string, DuplicateExpense[]>();
  for (const expense of expenses) {
    const key = JSON.stringify([expense.title.trim().toLowerCase(), expense.currency, expense.amountMinor, fmt.inputDate(expense.paidAt, timezone)]);
    groups.set(key, [...(groups.get(key) ?? []), expense]);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1).map((items) => ({ items, fingerprint: items.map((item) => `${item.id}:${item.updatedAt.toISOString()}`).sort().join("|") }));
}
