const api = require("../../utils/api");
const { imageSrc } = require("../../utils/request");

const W = 1080, H = 1350; // 4:5 长图

Page({
  data: { id: "", d: null, loading: true, saving: false },

  onLoad(q) { this.setData({ id: q.id }); this.load(); },
  async load() {
    try {
      const d = await api.tripSummary(this.data.id);
      this.setData({ d: { ...d, cover: d.coverUrl ? imageSrc(d.coverUrl) : "", photos: (d.favoritePhotos || []).map(imageSrc), cityText: d.cityNames.slice(0, 6).join(" · "), travelerText: (d.travelers || []).join("、") } });
    } finally { this.setData({ loading: false }); }
  },
  onShareAppMessage() { return { title: `${this.data.d ? this.data.d.title : "旅程"} · 总结`, path: `/pages/trip/trip?id=${this.data.id}` }; },

  /** 用 Canvas 2D 画一张 1080×1350 的卡片并保存到相册 */
  async save() {
    if (this.data.saving || !this.data.d) return;
    this.setData({ saving: true });
    wx.showLoading({ title: "正在生成长图…" });
    try {
      const canvas = await new Promise((resolve, reject) => {
        wx.createSelectorQuery().in(this).select("#poster").fields({ node: true }).exec((res) => (res && res[0] && res[0].node ? resolve(res[0].node) : reject(new Error("画布不可用"))));
      });
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      await draw(ctx, canvas, this.data.d);
      const path = await new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: "png", success: (r) => resolve(r.tempFilePath), fail: reject }));
      await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({ filePath: path, success: resolve, fail: reject }));
      wx.hideLoading();
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (e) {
      wx.hideLoading();
      const msg = (e && e.errMsg) || (e && e.message) || "";
      if (/auth|deny/i.test(msg)) wx.showModal({ title: "需要相册权限", content: "请在设置里允许保存到相册。", confirmText: "去设置", success: (r) => r.confirm && wx.openSetting() });
      else wx.showToast({ title: "生成失败：" + msg.slice(0, 30), icon: "none" });
    } finally { this.setData({ saving: false }); }
  },
});

function loadImage(canvas, src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(ctx, s, x, y, { size = 32, weight = "normal", color = "#fff", align = "left", max = W - 160 } = {}) {
  ctx.font = `${weight} ${size}px -apple-system, PingFang SC, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  let str = String(s || "");
  while (str.length > 1 && ctx.measureText(str).width > max) str = str.slice(0, -2) + "…";
  ctx.fillText(str, x, y);
}
async function draw(ctx, canvas, d) {
  // 背景渐变
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1f3a5f"); g.addColorStop(1, "#2e6b8a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 封面
  const cover = await loadImage(canvas, d.cover);
  if (cover) {
    ctx.save(); roundRect(ctx, 60, 60, W - 120, 520, 40); ctx.clip();
    const s = Math.max((W - 120) / cover.width, 520 / cover.height);
    ctx.drawImage(cover, 60 + ((W - 120) - cover.width * s) / 2, 60 + (520 - cover.height * s) / 2, cover.width * s, cover.height * s);
    const shade = ctx.createLinearGradient(0, 300, 0, 580); shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = shade; ctx.fillRect(60, 300, W - 120, 280);
    ctx.restore();
  }
  let y = cover ? 500 : 180;
  text(ctx, d.title, 100, y, { size: 64, weight: "bold" });
  text(ctx, `${d.dateRange} · ${d.days} 天`, 100, y + 60, { size: 30, color: "rgba(255,255,255,0.85)" });
  y = cover ? 660 : 320;
  // 四格统计
  const cells = [[`${d.stopCount}`, "个地点"], [d.distanceText, "路程"], [d.totalText, "总花费"], [`${d.photoCount}`, "张照片"]];
  cells.forEach(([v, l], i) => {
    const cx = 60 + (i % 2) * ((W - 120) / 2 + 10) - (i % 2 ? 10 : 0), cy = y + Math.floor(i / 2) * 170;
    const cw = (W - 120 - 20) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.12)"; roundRect(ctx, cx, cy, cw, 150, 28); ctx.fill();
    text(ctx, v, cx + 32, cy + 78, { size: 48, weight: "bold", max: cw - 64 });
    text(ctx, l, cx + 32, cy + 122, { size: 26, color: "rgba(255,255,255,0.75)" });
  });
  y += 370;
  if (d.cityText) { text(ctx, `📍 ${d.cityText}`, 100, y, { size: 30, color: "rgba(255,255,255,0.9)" }); y += 56; }
  if (d.topCategory) { text(ctx, `💴 ${d.topCategory.label}花得最多 ${d.topCategory.text}（${d.topCategory.pct}%）· 日均 ${d.dailyAvgText}`, 100, y, { size: 30, color: "rgba(255,255,255,0.9)" }); y += 56; }
  if (d.flightCount) { text(ctx, `✈️ ${d.flightCount} 次飞行${d.flightHours ? ` · 约 ${d.flightHours} 小时` : ""}`, 100, y, { size: 30, color: "rgba(255,255,255,0.9)" }); y += 56; }
  if (d.babyName) { text(ctx, `👶 ${d.babyName}${d.babyAgeText ? ` · ${d.babyAgeText}` : ""}${d.babyTotalText ? ` · 宝宝相关 ${d.babyTotalText}` : ""}`, 100, y, { size: 30, color: "rgba(255,255,255,0.9)" }); y += 56; }
  (d.babyFirsts || []).slice(0, 3).forEach((f) => { text(ctx, `🌟 第一次：${f}`, 100, y, { size: 28, color: "rgba(255,255,255,0.85)" }); y += 48; });
  if (d.bestDay) { y += 16; text(ctx, `最丰富的一天 · Day ${d.bestDay.index} ${d.bestDay.date}`, 100, y, { size: 26, color: "rgba(255,255,255,0.7)" }); text(ctx, d.bestDay.text, 100, y + 46, { size: 30 }); y += 100; }
  // 精选照片条
  const photos = (await Promise.all((d.photos || []).slice(0, 4).map((p) => loadImage(canvas, p)))).filter(Boolean);
  if (photos.length && y < H - 300) {
    const pw = (W - 120 - (photos.length - 1) * 16) / photos.length, ph = Math.min(220, H - 140 - y);
    photos.forEach((img, i) => {
      const x = 60 + i * (pw + 16);
      ctx.save(); roundRect(ctx, x, y, pw, ph, 24); ctx.clip();
      const s = Math.max(pw / img.width, ph / img.height);
      ctx.drawImage(img, x + (pw - img.width * s) / 2, y + (ph - img.height * s) / 2, img.width * s, img.height * s);
      ctx.restore();
    });
  }
  text(ctx, `Trace · 带娃旅行记${d.travelerText ? ` · ${d.travelerText}` : ""}`, W / 2, H - 50, { size: 24, color: "rgba(255,255,255,0.6)", align: "center" });
}
