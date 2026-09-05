"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { headers } from "next/headers";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export type AuthState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
});

const signupSchema = loginSchema.extend({
  name: z.string().trim().min(1, "请填写昵称").max(30),
});

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/trips";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const gate = rateLimit(`login:${await clientKey()}:${parsed.data.email}`, LIMITS.login.limit, LIMITS.login.windowMs);
  if (!gate.ok) return { error: `尝试次数过多，请 ${Math.ceil(gate.retryAfterS / 60)} 分钟后再试` };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) {
    log.warn("login.failed", { email: parsed.data.email });
    return { error: "邮箱或密码不正确" };
  }

  log.info("login.ok", { userId: user.id });
  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "当前未开放注册" };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const gate = rateLimit(`signup:${await clientKey()}`, LIMITS.login.limit, LIMITS.login.windowMs);
  if (!gate.ok) return { error: `尝试次数过多，请 ${Math.ceil(gate.retryAfterS / 60)} 分钟后再试` };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "该邮箱已注册" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await db.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, passwordHash },
  });
  await createSession(user.id);
  redirect("/trips");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
