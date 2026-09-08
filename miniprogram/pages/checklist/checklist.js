const api = require("../../utils/api");

Page({
  data: { id: "", groups: [], total: 0, done: 0, loading: true, text: "", group: "通用", groupNames: [] },

  onLoad(q) { this.setData({ id: q.id }); this.load(); },

  async load() {
    try {
      const r = await api.checklist(this.data.id);
      const items = r.items || r;
      const map = {};
      items.forEach((it) => (map[it.group] = map[it.group] || []).push(it));
      const groups = Object.keys(map).map((g) => ({ name: g, items: map[g], done: map[g].filter((i) => i.checked).length }));
      this.setData({ groups, total: items.length, done: items.filter((i) => i.checked).length, groupNames: groups.map((g) => g.name), loading: false });
    } catch (e) { this.setData({ loading: false }); }
  },

  async toggle(e) {
    const { id, checked } = e.currentTarget.dataset;
    // 乐观更新
    const groups = this.data.groups.map((g) => ({ ...g, items: g.items.map((i) => (i.id === id ? { ...i, checked: !checked } : i)) }));
    groups.forEach((g) => (g.done = g.items.filter((i) => i.checked).length));
    this.setData({ groups, done: groups.reduce((a, g) => a + g.done, 0) });
    try { await api.toggleChecklistItem(this.data.id, id, !checked); } catch (err) { this.load(); }
  },
  remove(e) {
    const { id, text } = e.currentTarget.dataset;
    wx.showActionSheet({ itemList: [`删除「${text}」`], itemColor: "#FF3B30", success: async () => { await api.deleteChecklistItem(this.data.id, id); this.load(); } });
  },
  onText(e) { this.setData({ text: e.detail.value }); },
  onGroup(e) { this.setData({ group: this.data.groupNames[+e.detail.value] }); },
  async add() {
    const t = this.data.text.trim();
    if (!t) return;
    await api.addChecklistItem(this.data.id, this.data.group, t);
    this.setData({ text: "" });
    this.load();
  },
  async template() {
    const r = await api.applyChecklistTemplate(this.data.id);
    wx.showToast({ title: `加入了 ${r.added} 项`, icon: "success" });
    this.load();
  },
  async ai() {
    wx.showLoading({ title: "AI 正在按目的地和月龄生成…" });
    try { const r = await api.aiPackingList(this.data.id); wx.hideLoading(); wx.showToast({ title: `生成了 ${r.count} 项`, icon: "success" }); this.load(); } catch (e) { wx.hideLoading(); }
  },
  reset() {
    wx.showModal({ title: "重置", content: "取消所有勾选，下次出发再用。", success: async (r) => { if (r.confirm) { await api.resetChecklist(this.data.id); this.load(); } } });
  },
});
