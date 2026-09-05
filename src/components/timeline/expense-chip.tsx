import { Baby } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/entry-types";
import type { TExpense } from "./types";

export function ExpenseChip({ expense, homeCurrency }: { expense: TExpense; homeCurrency: string }) {
  const cat = EXPENSE_CATEGORIES[expense.category];
  const Icon = expense.isBaby ? Baby : cat.icon;
  const foreign = expense.currency !== homeCurrency;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-caption font-medium" title={expense.title}>
      <Icon className="size-3" style={{ color: cat.color }} />
      <span className="max-w-24 truncate text-muted-foreground">{expense.title}</span>
      <span className="tabular-nums">
        {formatMoney(expense.amountMinor, expense.currency, { showCode: foreign })}
        {foreign && <span className="text-label-tertiary"> ≈{formatMoney(expense.amountHomeMinor, homeCurrency, { compact: true })}</span>}
      </span>
    </span>
  );
}
