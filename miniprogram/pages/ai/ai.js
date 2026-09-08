const { chat, userMessage, assistantMessage } = require("../../utils/stream");
const { toDataUrl } = require("../../utils/upload");
const { createVoice } = require("../../utils/voice");

const TOOL_LABELS = { listStops: "查看地点", listEntries: "查看条目", queryExpenses: "查账", searchPlace: "搜地点", getTripSummary: "旅程概览", createStop: "记地点", createEntry: "记条目", addExpense: "记一笔", logBaby: "记宝宝状态", saveDailyNote: "写日记", searchMemories: "翻回忆", compareTrips: "比较旅程", onThisDay: "那年今日" };
const TRIP_HINTS = ["刚在便利店花了 680 日元买了奶粉和水", "宝宝 14:30 睡着了", "今天一共花了多少？", "帮我写今天的日记"];
const GLOBAL_HINTS = ["我们在东京住过哪家酒店？", "去年这个时候我们在哪？", "哪次旅行花得最多？", "宝宝第一次坐飞机是什么时候？"];

Page({
  data: { tripId: "", messages: [], input: "", streaming: false, pending: [], hints: GLOBAL_HINTS, scrollTo: "", keyboard: 0, voice: "idle", voiceMode: false },

  onLoad(q) {
    this.setData({ tripId: q.tripId || "", hints: q.tripId ? TRIP_HINTS : GLOBAL_HINTS });
    wx.setNavigationBarTitle({ title: q.tripId ? "旅程助手" : "回忆问答" });
    this.history = []; // UIMessage[]，发给服务端
    this.voice = createVoice({
      onState: (v) => this.setData({ voice: v }),
      onText: (text) => { this.setData({ input: text }); this.send(text); },
      onError: (m) => wx.showToast({ title: m, icon: "none" }),
    });
  },
  toggleVoiceMode() { this.setData({ voiceMode: !this.data.voiceMode }); },
  voiceStart() { if (!this.data.streaming) this.voice.start(); },
  voiceEnd() { if (this.data.voice === "recording") this.voice.stop(); },
  voiceCancel() { if (this.data.voice === "recording") this.voice.cancel(); },
  onUnload() { if (this.task) this.task.abort(); },

  onInput(e) { this.setData({ input: e.detail.value }); },
  onFocus(e) { this.setData({ keyboard: e.detail.height || 0 }); },
  onBlur() { this.setData({ keyboard: 0 }); },
  useHint(e) { this.send(e.currentTarget.dataset.text); },

  addPhoto() {
    if (this.data.pending.length >= 6) return wx.showToast({ title: "一次最多 6 张", icon: "none" });
    wx.chooseMedia({
      count: 6 - this.data.pending.length, mediaType: ["image"], sizeType: ["compressed"],
      success: (r) => this.setData({ pending: [...this.data.pending, ...r.tempFiles.map((f) => f.tempFilePath)] }),
    });
  },
  removePending(e) { this.setData({ pending: this.data.pending.filter((_, i) => i !== e.currentTarget.dataset.index) }); },

  async send(preset) {
    const text = (typeof preset === "string" ? preset : this.data.input).trim();
    const { pending, streaming } = this.data;
    if (streaming || (!text && !pending.length)) return;
    this.setData({ input: "", pending: [], streaming: true });
    wx.showLoading({ title: pending.length ? "处理图片…" : "思考中…", mask: false });
    let images = [];
    try { images = await Promise.all(pending.map((p) => toDataUrl(p))); } catch (e) { /* 忽略失败的图片 */ }
    const msg = userMessage(text || "请看这张图片，按内容帮我记录", images);
    this.history.push(msg);
    const view = [...this.data.messages, { id: msg.id, role: "user", text: text || "（图片）", images: pending }, { id: `a-${msg.id}`, role: "assistant", text: "", tools: [] }];
    this.setData({ messages: view, scrollTo: `m-${msg.id}` });
    const aIdx = view.length - 1;
    this.task = chat({
      messages: this.history.slice(-20),
      tripId: this.data.tripId,
      onText: (full) => { wx.hideLoading(); this.setData({ [`messages[${aIdx}].text`]: full, scrollTo: "bottom" }); },
      onTool: (t) => {
        wx.hideLoading();
        const tools = this.data.messages[aIdx].tools.slice();
        const i = tools.findIndex((x) => x.id === t.id);
        const item = { id: t.id, label: TOOL_LABELS[t.name] || t.name || "工具", state: t.state, result: summarizeOutput(t.output) };
        if (i >= 0) tools[i] = item; else tools.push(item);
        this.setData({ [`messages[${aIdx}].tools`]: tools, scrollTo: "bottom" });
        if (t.state === "done" && /^(createStop|createEntry|addExpense|logBaby|saveDailyNote)$/.test(t.name || "")) { getApp().markDirty(); if (this.data.tripId) getApp().globalData.tripDirty = this.data.tripId; }
      },
      onError: (m) => { wx.hideLoading(); wx.showToast({ title: m, icon: "none", duration: 3000 }); this.setData({ [`messages[${aIdx}].error`]: m }); },
      onDone: () => {
        wx.hideLoading();
        const finalText = this.data.messages[aIdx].text;
        if (finalText) this.history.push(assistantMessage(finalText));
        this.setData({ streaming: false, scrollTo: "bottom" });
      },
    });
  },
  onSendTap() { if (this.data.streaming) this.stop(); else this.send(); },
  stop() { if (this.task) this.task.abort(); this.setData({ streaming: false }); wx.hideLoading(); },
  clear() { this.history = []; this.setData({ messages: [] }); },
  copy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.text }); },
});

function summarizeOutput(o) {
  if (o == null) return "";
  if (typeof o === "string") return o.slice(0, 60);
  if (o.error) return String(o.error).slice(0, 60);
  if (o.title || o.name) return String(o.title || o.name);
  if (Array.isArray(o)) return `${o.length} 条`;
  if (o.count != null) return `${o.count} 条`;
  return "完成";
}
