const api = require("../../utils/api");
const F = require("../../utils/format");
const { baseUrl } = require("../../utils/request");

Page({
  data: { id: "", role: "", members: [], invites: [], links: [], loading: true, me: "", tripTitle: "" },

  onLoad(q) { this.setData({ id: q.id, me: (getApp().globalData.user || {}).id }); this.load(); },

  async load() {
    try {
      const m = await api.members(this.data.id);
      const links = m.role === "VIEWER" ? [] : await api.shareLinks(this.data.id).catch(() => []);
      const detail = await api.tripDetail(this.data.id).catch(() => null);
      this.setData({
        role: m.role,
        members: m.members.map((x) => ({ ...x, initial: (x.name || '?').slice(0, 1), roleText: x.isOwner ? "所有者" : x.role === "EDITOR" ? "可记录" : "只读", joined: F.fmt.date(x.joinedAt) })),
        invites: m.invites.map((x) => ({ ...x, url: `${baseUrl()}/invite/${x.token}`, expires: x.expiresAt ? F.fmt.date(x.expiresAt) : "不过期" })),
        links: (links.links || links).map((x) => ({ ...x, url: `${baseUrl()}/share/${x.token}`, created: F.fmt.date(x.createdAt) })),
        tripTitle: detail ? detail.trip.title : "",
        loading: false,
      });
    } catch (e) { this.setData({ loading: false }); }
  },

  copy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.url }); },
  /** 转发邀请：分享出去的是小程序卡片，家人点开直接进 invite 页 */
  onShareAppMessage(e) {
    const token = e.from === "button" ? e.target.dataset.token : "";
    if (token) return { title: `邀请你一起记录「${this.data.tripTitle || "这段旅程"}」`, path: `/pages/invite/invite?token=${encodeURIComponent(token)}` };
    return { title: this.data.tripTitle || "Trace 旅程", path: `/pages/trip/trip?id=${this.data.id}` };
  },
  async invite() {
    const r = await api.createInvite(this.data.id);
    wx.setClipboardData({ data: r.url || `${baseUrl()}/invite/${r.token}`, success: () => wx.showToast({ title: "链接已复制，也可直接「转发」给微信家人", icon: "none", duration: 2500 }) });
    this.load();
  },
  revokeInvite(e) { wx.showModal({ title: "撤销邀请", content: "链接会立即失效。", success: async (r) => { if (r.confirm) { await api.revokeInvite(this.data.id, e.currentTarget.dataset.id); this.load(); } } }); },
  removeMember(e) {
    const { userid, name } = e.currentTarget.dataset;
    wx.showModal({ title: "移除家人", content: `${name} 将无法再看到这段旅程。`, confirmText: "移除", confirmColor: "#FF3B30", success: async (r) => { if (r.confirm) { await api.removeMember(this.data.id, userid); this.load(); } } });
  },
  leave() {
    wx.showModal({ title: "退出旅程", content: "退出后需要重新邀请才能看到。", confirmText: "退出", confirmColor: "#FF3B30", success: async (r) => { if (r.confirm) { await api.leaveTrip(this.data.id); getApp().markDirty(); wx.reLaunch({ url: "/pages/trips/trips" }); } } });
  },
  async share() {
    wx.showModal({
      title: "只读分享链接", content: "分享给别人看，默认隐藏花费。", confirmText: "隐藏花费", cancelText: "显示花费",
      success: async (r) => {
        const link = await api.createShareLink(this.data.id, r.confirm);
        wx.setClipboardData({ data: link.url || `${baseUrl()}/share/${link.token}`, success: () => wx.showToast({ title: "分享链接已复制", icon: "none" }) });
        this.load();
      },
    });
  },
  revokeLink(e) { wx.showModal({ title: "撤销分享", content: "链接会立即失效。", success: async (r) => { if (r.confirm) { await api.revokeShareLink(this.data.id, e.currentTarget.dataset.id); this.load(); } } }); },
});
