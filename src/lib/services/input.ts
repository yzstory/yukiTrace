import { z } from "zod";

/**
 * 服务层输入：既来自表单（全是字符串），也来自 JSON（可能是数字 / 布尔 / 数组 / 对象）。
 * 这里的 schema 片段把两种形态收成同一种。
 */
export type Input = Record<string, unknown>;

export const optStr = z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim());
/** 必填字符串：缺字段和空串都给同一句中文提示 */
export const reqStr = (message: string, max = 200) => optStr.pipe(z.string().min(1, message).max(max, "内容过长"));
export const num = z.coerce.number();

/** 复选框 "on" / "true" / true 都算真 */
export const flag = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

/** "a, b" 或 ["a","b"] → ["a","b"] */
export const strList = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? "").split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
}, z.array(z.string()));

/** JSON 字符串或对象 → 对象；空 → null；坏 JSON 抛给调用方翻译 */
export function jsonObject(v: unknown, message: string): Record<string, unknown> | null {
  if (v == null || v === "") return null;
  if (typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(v));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    throw new Error(message);
  }
}

/** 表单 → 输入对象 */
export function fromForm(formData: FormData): Input {
  return Object.fromEntries(formData) as Input;
}

/** zod 第一条错误转成用户可读的信息 */
export function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "请求格式不正确";
  const path = issue.path.join(".") || "字段";
  // JSON 客户端漏传或传错类型时，zod 的英文提示对用户没意义，统一成中文
  if (issue.code === "invalid_type") return `缺少或格式不对：${path}`;
  if (issue.code === "invalid_value") return `${path} 不是有效选项`;
  return issue.message;
}
