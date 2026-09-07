import { api } from "@/lib/api/handler";
import { deleteExpense } from "@/lib/services/expenses";

/** 修改花费走 /records/expense/{id}（带版本号，防止家人或 AI 的并发改动被覆盖） */
export const DELETE = api<{ tripId: string; expenseId: string }>(async (ctx) => deleteExpense(ctx, ctx.params.tripId, ctx.params.expenseId));
