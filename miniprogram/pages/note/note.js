const api = require("../../utils/api");

Page({
  data: { tripId: "", date: "", content: "", original: "", aiDraft: "", busy: false, generating: false, aiConfigured: true },

  async onLoad(q) {
    this.setData({ tripId: q.tripId, date: q.date });
    wx.setNavigationBarTitle({ title: `${q.date} 日记` });
    try {
      const d = await api.tripDetail(q.tripId);
      const hit = d.dailyNotes.find((n) => String(n.date).slice(0, 10) === q.date);
      this.setData({ content: hit ? hit.content : "", original: hit ? hit.content : "", aiDraft: hit && hit.aiDraft ? hit.aiDraft : "" });
    } catch (e) { /* */ }
  },
  onInput(e) { this.setData({ content: e.detail.value }); },

  async save() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await api.saveNote(this.data.tripId, this.data.date, this.data.content);
      getApp().globalData.tripDirty = this.data.tripId;
      wx.navigateBack();
    } catch (e) { /* toast */ } finally { this.setData({ busy: false }); }
  },

  async draft(e) {
    const tone = e.currentTarget.dataset.tone || "default";
    if (this.data.generating) return;
    this.setData({ generating: true });
    wx.showLoading({ title: "AI 正在写…" });
    try {
      const r = await api.aiDailyDraft(this.data.tripId, this.data.date, tone);
      this.setData({ aiDraft: r.draft || "" });
    } catch (e) {
      if (e.status === 503) this.setData({ aiConfigured: false });
    } finally {
      wx.hideLoading();
      this.setData({ generating: false });
    }
  },
  adopt() {
    const { content, aiDraft } = this.data;
    this.setData({ content: content.trim() ? `${content.trim()}\n\n${aiDraft}` : aiDraft });
  },
});
