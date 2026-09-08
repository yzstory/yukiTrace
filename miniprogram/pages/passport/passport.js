const api = require("../../utils/api");
const F = require("../../utils/format");
const { imageSrc } = require("../../utils/request");

Page({
  data: { book: null, stamps: [], busy: "", loading: true },

  onLoad() { this.load(); },
  async onPullDownRefresh() { await this.load(true); wx.stopPullDownRefresh(); },

  async load(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const p = await api.passport();
      const stamps = p.stamps.map((s) => ({ ...s, photo: s.photoUrl ? imageSrc(s.photoUrl) : "", inked: !!s.inkedAt, rotate: s.tilt || 0, hue: s.hue || 0, names: (s.stopNames || []).slice(0, 3).join(" · ") }));
      this.setData({ book: { babyName: p.babyName, ...p.stats, distance: F.distance(p.stats.distanceM), pending: p.stats.cities - p.stats.inked }, stamps });
    } finally { this.setData({ loading: false }); }
  },

  async ink(e) {
    const { city, inked, tripid } = e.currentTarget.dataset;
    if (inked) return wx.navigateTo({ url: `/pages/trip/trip?id=${tripid}` });
    if (this.data.busy) return;
    this.setData({ busy: city });
    try {
      const r = await api.inkStamp(city);
      if (r.inked) wx.showToast({ title: r.line || "盖好了", icon: "none", duration: 2500 });
      await this.load(true);
    } catch (e) { /* toast */ } finally { this.setData({ busy: "" }); }
  },
  async inkAll() {
    if (this.data.busy) return;
    this.setData({ busy: "all" });
    wx.showLoading({ title: "AI 正在写章上的话…" });
    try {
      const r = await api.inkAll();
      wx.hideLoading();
      wx.showToast({ title: `盖了 ${r.inked} 枚章`, icon: "success" });
      await this.load(true);
    } catch (e) { wx.hideLoading(); } finally { this.setData({ busy: "" }); }
  },
  onShareAppMessage() { return { title: `${this.data.book && this.data.book.babyName ? this.data.book.babyName + "的" : ""}旅行护照：${this.data.book ? this.data.book.cities : 0} 座城市`, path: "/pages/passport/passport" }; },
});
