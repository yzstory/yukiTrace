import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "yt_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天
/** 仅在 https 下发 Secure cookie；通过 IP/http 访问时（如未配域名）需要关掉，否则登录后 cookie 不会被保存 */
const SECURE = process.env.AUTH_COOKIE_SECURE ? process.env.AUTH_COOKIE_SECURE === "true" : (process.env.APP_URL ?? "").startsWith("https://");

export type SessionPayload = { userId: string; exp?: number };

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
}

export async function decrypt(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const token = await encrypt({ userId });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decrypt(store.get(COOKIE)?.value);
}

export { COOKIE as SESSION_COOKIE };
