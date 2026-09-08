import { api } from "@/lib/api/handler";
import { deleteExpense, updateExpense } from "@/lib/services/expenses";

type P = { tripId: string; expenseId: string };

/** 整体替换。家人或 AI 可能同时在改的场景用 /records/expense/{id}，那条路径带版本号做冲突检测 */
export const PUT = api<P>(async (ctx) => updateExpense(ctx, ctx.params.tripId, ctx.params.expenseId, await ctx.body()));
export const DELETE = api<P>(async (ctx) => deleteExpense(ctx, ctx.params.tripId, ctx.params.expenseId));
