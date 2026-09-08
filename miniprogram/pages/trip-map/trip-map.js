const api = require("../../utils/api");
const F = require("../../utils/format");

Page({
  data: { id: "", stops: [], markers: [], polyline: [], includePoints: [], lat: 39.9, lng: 116.4, dayFilter: 0, days: [], selected: null, tz: "" },

  async onLoad(q) {
    this.setData({ id: q.id });
    this.mapCtx = wx.createMapContext("map", this);
    try {
      const d = await api.tripDetail(q.id);
      const tz = d.trip.timezone;
      const n = F.tripDays(d.trip.startDate, d.trip.endDate);
      const stops = d.stops.map((s, i) => {
        const day = F.dayIndex(d.trip.startDate, s.arriveAt, s.timezone || tz);
        return { id: s.id, idx: i + 1, name: s.name, lat: s.lat, lng: s.lng, address: s.address || "", city: s.city || "", day, color: F.DAY_COLORS[Math.max(0, Math.min(day - 1, F.DAY_COLORS.length - 1))], time: F.fmt.dateTime(s.arriveAt, s.timezone || tz), emoji: (F.STOP_TYPES[s.type] || F.STOP_TYPES.OTHER).emoji, photos: s.photos.length, entries: s.entries.length, leg: s.legFromPrev ? F.distance(s.legFromPrev.distanceM) : "" };
      });
      const daySet = Array.from(new Set(stops.map((s) => s.day))).filter((x) => x >= 1 && x <= n).sort((a, b) => a - b);
      wx.setNavigationBarTitle({ title: `${d.trip.title} · 地图` });
      this.setData({ stops, tz, days: daySet, lat: stops[0] ? stops[0].lat : 39.9, lng: stops[0] ? stops[0].lng : 116.4 });
      this.render();
    } catch (e) { /* */ }
  },

  render() {
    const { stops, dayFilter } = this.data;
    const shown = dayFilter ? stops.filter((s) => s.day === dayFilter) : stops;
    const markers = shown.map((s) => ({ id: s.idx, latitude: s.lat, longitude: s.lng, width: 30, height: 30, iconPath: "/assets/pin.png", label: { content: String(s.idx), color: "#fff", fontSize: 12, anchorX: -4, anchorY: -26, bgColor: s.color, borderRadius: 10, padding: 3, textAlign: "center" }, callout: { content: s.name, fontSize: 13, borderRadius: 8, padding: 6, display: "BYCLICK", bgColor: "#fff", color: "#1C1C1E" } }));
    // 按天分段着色的路线
    const polyline = [];
    for (let i = 1; i < shown.length; i++) {
      const a = shown[i - 1], b = shown[i];
      polyline.push({ points: [{ latitude: a.lat, longitude: a.lng }, { latitude: b.lat, longitude: b.lng }], color: `${b.color}CC`, width: 4, dottedLine: false });
    }
    const includePoints = shown.map((s) => ({ latitude: s.lat, longitude: s.lng }));
    this.setData({ markers, polyline, includePoints, shown });
    if (includePoints.length > 1) this.mapCtx.includePoints({ points: includePoints, padding: [80, 60, 220, 60] });
    else if (includePoints.length === 1) this.mapCtx.moveToLocation({ latitude: includePoints[0].latitude, longitude: includePoints[0].longitude });
  },

  setDay(e) {
    this.setData({ dayFilter: +e.currentTarget.dataset.day, selected: null });
    this.render();
  },
  onMarker(e) {
    const s = this.data.stops.find((x) => x.idx === e.detail.markerId);
    if (s) this.select(s);
  },
  onCard(e) {
    const s = this.data.stops.find((x) => x.id === e.currentTarget.dataset.id);
    if (s) this.select(s);
  },
  select(s) {
    this.setData({ selected: s });
    this.mapCtx.moveToLocation({ latitude: s.lat, longitude: s.lng });
  },
  openStop(e) {
    wx.navigateTo({ url: `/pages/record/record?tripId=${this.data.id}&kind=stop&refId=${e.currentTarget.dataset.id}` });
  },
  navigate(e) {
    const s = this.data.selected;
    if (!s) return;
    wx.openLocation({ latitude: s.lat, longitude: s.lng, name: s.name, address: s.address });
  },
  fit() { this.render(); },
});
