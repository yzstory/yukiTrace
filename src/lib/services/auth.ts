import "server-only";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { badRequest, forbidden, tooMany, unauthorized } from "@/lib/api/errors";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { parse } from "./shared";
import { codeToOpenId, wechatConfigured } from "@/lib/wechat";
import { optStr, reqStr, type Input } from "./input";

const loginSchema = z.object({
  email: optStr.pipe(z.string().toLowerCase().email("邮箱格式不正确")),
  password: z.preprocess((v) => (v == null ? "" : String(v)), z.string().min(6, "密码至少 6 位").max(200)),
});
const signupSchema = loginSchema.extend({ name: reqStr("请填写昵称", 30) });

function gate(key: string) {
  const g = rateLimit(key, LIMITS.login.limit, LIMITS.login.windowMs);
  if (!g.ok) throw tooMany(`尝试次数过多，请 ${Math.ceil(g.retryAfterS / 60)} 分钟后再试`);
}

export const PUBLIC_USER = { id: true, email: true, name: true, avatarKey: true } as const;

/** 校验邮箱密码；clientKey 用于按来源限流 */
export async function verifyCredentials(input: Input, clientKey: string) {
  const d = parse(loginSchema, input);
  gate(`login:${clientKey}:${d.email}`);
  const user = await db.user.findUnique({ where: { email: d.email } });
  const ok = user && (await bcrypt.compare(d.password, user.passwordHash));
  if (!ok) {
    log.warn("login.failed", { email: d.email });
    throw unauthorized("邮箱或密码不正确");
  }
  log.info("login.ok", { userId: user.id });
  return { id: user.id, email: user.email, name: user.name, avatarKey: user.avatarKey };
}

export async function registerUser(input: Input, clientKey: string) {
  if (process.env.ALLOW_SIGNUP === "false") throw forbidden("当前未开放注册");
  const d = parse(signupSchema, input);
  gate(`signup:${clientKey}`);
  if (await db.user.findUnique({ where: { email: d.email } })) throw badRequest("该邮箱已注册");
  const passwordHash = await bcrypt.hash(d.password, 10);
  const user = await db.user.create({ data: { email: d.email, name: d.name, passwordHash }, select: PUBLIC_USER });
  log.info("signup.ok", { userId: user.id });
  return user;
}

export async function currentUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: PUBLIC_USER });
  if (!user) throw unauthorized("账号不存在");
  return user;
}

/** 微信一键登录：code → openid → 已绑定的账号；未绑定返回 null（客户端转邮箱登录并带 code 绑定） */
export async function loginWithWechat(code: string) {
  const openId = await codeToOpenId(code);
  const user = await db.user.findUnique({ where: { wechatOpenId: openId }, select: PUBLIC_USER });
  if (user) log.info("login.wechat", { userId: user.id });
  return user;
}

/** 把当前账号与微信 openid 绑定；同一 openid 只能绑一个账号，换绑时解除旧账号 */
export async function bindWechat(userId: string, code: string) {
  const openId = await codeToOpenId(code);
  await db.$transaction([
    db.user.updateMany({ where: { wechatOpenId: openId, NOT: { id: userId } }, data: { wechatOpenId: null } }),
    db.user.update({ where: { id: userId }, data: { wechatOpenId: openId } }),
  ]);
  log.info("wechat.bound", { userId });
}

export async function unbindWechat(userId: string) {
  await db.user.update({ where: { id: userId }, data: { wechatOpenId: null } });
}

export async function wechatStatus(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { wechatOpenId: true } });
  return { configured: wechatConfigured(), bound: Boolean(user?.wechatOpenId) };
}
