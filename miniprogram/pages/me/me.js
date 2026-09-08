const api = require("../../utils/api");
const F = require("../../utils/format");
const { setToken, baseUrl, imageSrc } = require("../../utils/request");
const { DEFAULT_BASE_URL } = require("../../config");

Page({
  data: { user: null, initial: "", passport: null, server: "", version: "", years: [], growth: [], wechat: null },

  onShow() {
    const app = getApp();
    const u = app.globalData.user;
    this.setData({ user: u, initial: u ? u.name.slice(0, 1) : "", server: baseUrl(), version: (wx.getAccountInfoSync ? wx.getAccountInfoSync().miniProgram.version : "") || "dev" });
    if (!u) app.loadUser().then((x) => this.setData({ user: x, initial: x ? x.name.slice(0, 1) : "" }));
    this.loadPassport();
    this.loadReview();
    this.loadWechat();
  },
  async loadPassport() {
    try {
      const p = await api.passport();
      this.setData({ passport: { babyName: p.babyName, cities: p.stats.cities, pending: p.stats.cities - p.stats.inked, earth: p.stats.earthPercent, flights: p.stats.flights } });
    } catch (e) { /* */ }
  },
  async loadReview() {
    try {
      const [y, g] = await Promise.all([api.years(), api.growth()]);
      this.setData({
        years: y.years || [],
        growth: (g.pairs || []).map((p) => ({ city: p.city, visits: p.visits.map((v) => ({ ...v, photo: v.photoUrl ? imageSrc(v.photoUrl) : "", month: F.fmt.monthYear(v.date, "UTC") })) })),
      });
    } catch (e) { /* */ }
  },
  async loadWechat() {
    try { this.setData({ wechat: await api.wechatStatus() }); } catch (e) { this.setData({ wechat: null }); }
  },

  openPassport() { wx.navigateTo({ url: "/pages/passport/passport" }); },
  openAi() { wx.navigateTo({ url: "/pages/ai/ai" }); },
  openYear(e) { wx.navigateTo({ url: `/pages/year/year?year=${e.currentTarget.dataset.year}` }); },
  openTripPhotos(e) { wx.navigateTo({ url: `/pages/trip-photos/trip-photos?id=${e.currentTarget.dataset.id}` }); },
  openTokens() {
    api.tokens().then((list) => {
      const lines = list.map((t) => `${t.scope === "api" ? "🔑" : "🤖"} ${t.name}（${t.prefix}…）`).join("\n") || "暂无令牌";
      wx.showModal({ title: "我的令牌", content: lines, showCancel: false });
    });
  },

  async toggleWechat() {
    const w = this.data.wechat;
    if (!w || !w.configured) return wx.showToast({ title: "服务器未配置微信登录", icon: "none" });
    if (w.bound) {
      wx.showModal({ title: "解绑微信", content: "解绑后需要用邮箱密码登录。", confirmText: "解绑", confirmColor: "#FF3B30", success: async (r) => { if (r.confirm) { await api.wechatUnbind(); this.loadWechat(); } } });
      return;
    }
    // 未绑定：用当前登录态 + 新 code 绑定（复用登录接口需要密码，这里让用户重新登录一次）
    wx.showModal({ title: "绑定微信", content: "需要用邮箱密码再登录一次，登录时会自动绑定当前微信。", confirmText: "去登录", success: (r) => { if (r.confirm) wx.reLaunch({ url: "/pages/login/login" }); } });
  },

  changeServer() {
    wx.showModal({
      title: "服务器地址", editable: true, placeholderText: DEFAULT_BASE_URL, content: this.data.server,
      success: (r) => {
        if (!r.confirm) return;
        const v = (r.content || "").trim().replace(/\/$/, "");
        if (v && !/^https?:\/\//.test(v)) return wx.showToast({ title: "请以 http(s):// 开头", icon: "none" });
        if (v) wx.setStorageSync("baseUrl", v); else wx.removeStorageSync("baseUrl");
        this.setData({ server: baseUrl() });
        wx.showToast({ title: "已更新，需要重新登录", icon: "none" });
      },
    });
  },
  logout() {
    wx.showModal({
      title: "退出登录", content: "会撤销本设备的访问令牌。", confirmText: "退出", confirmColor: "#FF3B30",
      success: async (r) => {
        if (!r.confirm) return;
        try { await api.logout(); } catch (e) { /* 令牌可能已失效 */ }
        setToken("");
        getApp().globalData.user = null;
        wx.reLaunch({ url: "/pages/login/login" });
      },
    });
  },
});
