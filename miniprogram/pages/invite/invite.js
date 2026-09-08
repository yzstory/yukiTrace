const api = require("../../utils/api");
const F = require("../../utils/format");
const { getToken } = require("../../utils/request");

/** 从整段文字里挑出邀请 token：既支持小程序卡片传参，也支持粘贴 /invite/xxx 链接 */
function tokenFrom(text) {
  const m = /\/invite\/([A-Za-z0-9_-]{8,})/.exec(text || "");
  return m ? m[1] : (text || "").trim();
}

Page({
  data: { token: "", info: null, loading: true, error: "", busy: false, needLogin: false },

  onLoad(q) {
    const token = q.token ? decodeURIComponent(q.token) : "";
    if (token) return this.check(token);
    this.setData({ loading: false, error: "" });
  },
  onShow() {
    // 从登录页回来时自动继续
    if (this.data.token && this.data.needLogin && getToken()) this.setData({ needLogin: false });
  },

  paste() {
    wx.getClipboardData({
      success: (r) => {
        const token = tokenFrom(r.data);
        if (!token) return wx.showToast({ title: "剪贴板里没有邀请链接", icon: "none" });
        this.check(token);
      },
    });
  },

  async check(token) {
    this.setData({ token, loading: true, error: "", info: null });
    try {
      const info = await api.inviteInfo(token);
      this.setData({
        info: { ...info, range: F.dateRange(info.trip.startDate, info.trip.endDate), expires: info.expiresAt ? F.fmt.date(info.expiresAt) : "不过期" },
        needLogin: !getToken(),
      });
    } catch (e) {
      this.setData({ error: e.message || "邀请无效" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async accept() {
    if (this.data.busy) return;
    if (!getToken()) {
      this.setData({ needLogin: true });
      return wx.navigateTo({ url: "/pages/login/login" });
    }
    this.setData({ busy: true });
    try {
      const r = await api.acceptInvite(this.data.token);
      getApp().markDirty();
      wx.showToast({ title: "已加入", icon: "success" });
      setTimeout(() => wx.redirectTo({ url: `/pages/trip/trip?id=${r.tripId}` }), 600);
    } catch (e) {
      /* toast 已显示 */
    } finally {
      this.setData({ busy: false });
    }
  },
});
