/**
 * 服务器地址。小程序 request 合法域名必须是 HTTPS 并已在微信公众平台登记；
 * 开发时可在微信开发者工具「详情 → 本地设置」勾选「不校验合法域名」。
 * 也可以在「我 → 服务器地址」里临时改，存在本机 storage。
 */
const DEFAULT_BASE_URL = "https://trace.aiyuki.cc";

function baseUrl() {
  return (wx.getStorageSync("baseUrl") || DEFAULT_BASE_URL).replace(/\/$/, "");
}

module.exports = { DEFAULT_BASE_URL, baseUrl };
