const { baseUrl } = require("../config");

const TOKEN_KEY = "apiToken";

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || "";
}
function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
  else wx.removeStorageSync(TOKEN_KEY);
}

/** 把 /api/files/... 这类相对图片地址补成小程序能加载的绝对地址（带令牌） */
function imageSrc(url) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;
  const token = getToken();
  const sep = url.includes("?") ? "&" : "?";
  return `${baseUrl()}${url}${token ? `${sep}token=${encodeURIComponent(token)}` : ""}`;
}

let redirecting = false;
function toLogin() {
  if (redirecting) return;
  redirecting = true;
  setToken("");
  wx.reLaunch({ url: "/pages/login/login", complete: () => setTimeout(() => (redirecting = false), 1000) });
}

class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * 统一请求：自动带 Bearer 令牌；非 2xx 抛 ApiError（message 为服务端给人看的中文）；401 清令牌并回登录页。
 * opts: { method, data, query, silent(不自动 toast), auth(默认 true), timeout }
 */
function request(path, opts = {}) {
  const { method = "GET", data, query, silent = false, auth = true, timeout = 30000 } = opts;
  let url = `${baseUrl()}${path}`;
  if (query) {
    const qs = Object.keys(query)
      .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== "")
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
      .join("&");
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const header = { "content-type": "application/json" };
  const token = getToken();
  if (auth && token) header.authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: data === undefined ? undefined : data,
      header,
      timeout,
      success: (res) => {
        const body = res.data;
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body);
        const message = (body && typeof body === "object" && body.error) || (typeof body === "string" && body) || `请求失败（${res.statusCode}）`;
        if (res.statusCode === 401 && auth) {
          toLogin();
        } else if (!silent) {
          wx.showToast({ title: String(message).slice(0, 40), icon: "none", duration: 2500 });
        }
        reject(new ApiError(res.statusCode, String(message), body));
      },
      fail: (err) => {
        const msg = err && err.errMsg ? err.errMsg : "";
        const message = /timeout/i.test(msg) ? "网络超时，请稍后重试" : /url not in domain list/i.test(msg) ? "域名未加入小程序合法域名（开发时可关闭校验）" : "网络不可用，请检查连接";
        if (!silent) wx.showToast({ title: message, icon: "none", duration: 2500 });
        reject(new ApiError(0, message, err));
      },
    });
  });
}

const get = (path, query, opts) => request(path, { ...opts, method: "GET", query });
const post = (path, data, opts) => request(path, { ...opts, method: "POST", data });
const put = (path, data, opts) => request(path, { ...opts, method: "PUT", data });
const patch = (path, data, opts) => request(path, { ...opts, method: "PATCH", data });
const del = (path, data, opts) => request(path, { ...opts, method: "DELETE", data });

module.exports = { request, get, post, put, patch, del, getToken, setToken, imageSrc, toLogin, ApiError, baseUrl };
