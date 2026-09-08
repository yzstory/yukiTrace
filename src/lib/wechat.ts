import "server-only";
import { unavailable, badRequest } from "@/lib/api/errors";
import { log } from "@/lib/logger";

export function wechatConfigured() {
  return Boolean(process.env.WECHAT_APPID && process.env.WECHAT_SECRET);
}

/** 小程序 wx.login() 的 code 换 openid（jscode2session） */
export async function codeToOpenId(code: string): Promise<string> {
  if (!wechatConfigured()) throw unavailable("服务器未配置微信登录（WECHAT_APPID / WECHAT_SECRET）");
  if (!code) throw badRequest("缺少微信登录凭证");
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", process.env.WECHAT_APPID!);
  url.searchParams.set("secret", process.env.WECHAT_SECRET!);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res) throw unavailable("微信接口暂时不可用");
  const json = (await res.json().catch(() => ({}))) as { openid?: string; errcode?: number; errmsg?: string };
  if (!json.openid) {
    log.warn("wechat.code2session failed", { errcode: json.errcode, errmsg: json.errmsg });
    // 40029 invalid code / 40163 code been used：都是客户端该重新 wx.login()
    throw badRequest(json.errcode === 40029 || json.errcode === 40163 ? "微信登录凭证已失效，请重试" : "微信登录失败");
  }
  return json.openid;
}
