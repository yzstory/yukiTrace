const api = require("../../utils/api");
const F = require("../../utils/format");
const offline = require("../../utils/offline");

Page({
  data: { id: "", tz: "Asia/Shanghai", busy: false, type: "FEED", types: F.BABY_LOG_ORDER.map((k) => ({ key: k, ...F.BABY_LOG_TYPES[k] })), date: "", time: "", note: "", babyName: "宝宝" },

  async onLoad(q) {
    this.setData({ id: q.id });
    try {
      const { trip } = await api.tripDetail(q.id);
      const now = F.nowInput(trip.timezone).split("T");
      this.setData({ tz: trip.timezone, date: now[0], time: now[1], babyName: trip.babyName || "宝宝" });
      wx.setNavigationBarTitle({ title: `${trip.babyName || "宝宝"}状态` });
    } catch (e) { /* */ }
  },
  setType(e) { this.setData({ type: e.currentTarget.dataset.key }); },
  onPick(e) { this.setData({ [e.currentTarget.dataset.key]: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const payload = { type: this.data.type, at: `${this.data.date}T${this.data.time}`, note: this.data.note };
      try {
        await api.createBabyLog(this.data.id, payload);
      } catch (e) {
        if (!offline.isOffline(e)) {
          wx.showToast({ title: e.message || "保存失败", icon: "none", duration: 2500 });
          return;
        }
        offline.enqueue("babyLog", this.data.id, payload, F.BABY_LOG_TYPES[this.data.type].label);
        wx.showToast({ title: "没有网络，已存到本机，联网后自动同步", icon: "none", duration: 2500 });
      }
      getApp().globalData.tripDirty = this.data.id;
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: e.message || "保存失败", icon: "none", duration: 2500 });
    } finally { this.setData({ busy: false }); }
  },
});
