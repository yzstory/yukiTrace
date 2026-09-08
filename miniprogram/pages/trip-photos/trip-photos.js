const api = require("../../utils/api");
const F = require("../../utils/format");
const { imageSrc } = require("../../utils/request");
const { pickAndUpload } = require("../../utils/upload");

Page({
  data: { id: "", groups: [], all: [], canEdit: false, loading: true, uploading: "", count: 0 },

  onLoad(q) { this.setData({ id: q.id }); this.load(); },
  onShow() { if (this.data.all.length && getApp().globalData.tripDirty === this.data.id) this.load(true); },

  async load(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const d = await api.tripDetail(this.data.id);
      const t = d.trip, tz = t.timezone;
      const n = F.tripDays(t.startDate, t.endDate);
      const all = [];
      const push = (p, stopName) => all.push({ id: p.id, thumb: imageSrc(p.thumbUrl), full: imageSrc(p.url), caption: p.caption || "", takenAt: p.takenAt, stopName, day: p.takenAt ? F.dayIndex(t.startDate, p.takenAt, tz) : 0 });
      d.stops.forEach((s) => { s.photos.forEach((p) => push(p, s.name)); s.entries.forEach((en) => en.photos.forEach((p) => push(p, s.name))); });
      d.looseEntries.forEach((en) => en.photos.forEach((p) => push(p, "")));
      d.loosePhotos.forEach((p) => push(p, ""));
      all.sort((a, b) => new Date(a.takenAt || 0) - new Date(b.takenAt || 0));
      const byDay = {};
      all.forEach((p) => { const k = p.day >= 1 && p.day <= n ? p.day : 0; (byDay[k] = byDay[k] || []).push(p); });
      const groups = Object.keys(byDay).map(Number).sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b)).map((day) => ({ day, label: day ? `Day ${day} · ${F.dayKey(t.startDate, day).slice(5).replace("-", "月")}日` : "未标日期", items: byDay[day] }));
      wx.setNavigationBarTitle({ title: `${t.title} · 照片` });
      this.setData({ all, groups, canEdit: t.role !== "VIEWER", count: all.length });
    } finally { this.setData({ loading: false }); }
  },

  preview(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({ current: url, urls: this.data.all.map((p) => p.full) });
  },
  manage(e) {
    const id = e.currentTarget.dataset.id;
    if (!this.data.canEdit) return;
    wx.showActionSheet({
      itemList: ["查看 / 编辑说明", "设为封面", "删除"],
      itemColor: "#1C1C1E",
      success: async (r) => {
        if (r.tapIndex === 0) return wx.navigateTo({ url: `/pages/record/record?tripId=${this.data.id}&kind=photo&refId=${id}` });
        if (r.tapIndex === 1) {
          const rec = await api.record(this.data.id, "photo", id);
          if (rec.record && rec.record.ossKey) { await api.setCover(this.data.id, rec.record.ossKey); getApp().markDirty(); wx.showToast({ title: "已设为封面", icon: "success" }); }
          return;
        }
        if (r.tapIndex === 2) {
          wx.showModal({ title: "删除照片", content: "删除后无法恢复。", confirmText: "删除", confirmColor: "#FF3B30", success: async (m) => { if (!m.confirm) return; await api.deletePhoto(this.data.id, id); getApp().markDirty(); this.load(true); } });
        }
      },
    });
  },
  async upload() {
    try {
      const r = await pickAndUpload({ tripId: this.data.id }, { onProgress: (done, total) => this.setData({ uploading: `上传中 ${done}/${total}` }) });
      this.setData({ uploading: "" });
      if (r.results.length) { wx.showToast({ title: `已上传 ${r.results.length} 张`, icon: "success" }); getApp().markDirty(); getApp().globalData.tripDirty = this.data.id; this.load(true); }
      if (r.failures.length) wx.showToast({ title: r.failures[0], icon: "none" });
    } catch (e) { this.setData({ uploading: "" }); wx.showToast({ title: e.message || "上传失败", icon: "none" }); }
  },
});
