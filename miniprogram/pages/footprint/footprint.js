const api = require("../../utils/api");
const F = require("../../utils/format");

Page({
  data: { stats: null, trips: [], markers: [], polyline: [], lat: 35, lng: 110, loading: true, loaded: false },

  onLoad() { this.mapCtx = wx.createMapContext("map", this); this.load(); },
  onShow() { if (this.data.loaded && getApp().globalData.tripsDirty) this.load(true); },
  async onPullDownRefresh() { await this.load(true); wx.stopPullDownRefresh(); },

  async load(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const fp = await api.footprint();
      const markers = [], polyline = [], points = [];
      let mid = 0;
      fp.trips.forEach((t) => {
        t.stops.forEach((s) => { markers.push({ id: ++mid, latitude: s.lat, longitude: s.lng, width: 18, height: 18, iconPath: "/assets/pin.png", callout: { content: `${t.title} · ${s.name}`, display: "BYCLICK", fontSize: 12, borderRadius: 8, padding: 6, bgColor: "#fff", color: "#1C1C1E" }, tripId: t.id }); points.push({ latitude: s.lat, longitude: s.lng }); });
        if (t.stops.length > 1) polyline.push({ points: t.stops.map((s) => ({ latitude: s.lat, longitude: s.lng })), color: `${t.color}B3`, width: 3 });
      });
      this.markerTrips = markers.map((m) => m.tripId);
      this.setData({
        stats: { trips: fp.stats.trips, cities: fp.stats.cities, distance: fp.stats.stops ? F.distance(fp.stats.distanceM) : "—" },
        trips: fp.trips.map((t) => ({ id: t.id, title: t.title, color: t.color, month: F.fmt.monthYear(t.startDate, "UTC"), count: t.stops.length })),
        markers, polyline, loaded: true,
      });
      if (points.length > 1) this.mapCtx.includePoints({ points, padding: [40, 40, 40, 40] });
      else if (points.length === 1) this.setData({ lat: points[0].latitude, lng: points[0].longitude });
    } catch (e) { /* */ } finally { this.setData({ loading: false }); }
  },
  onMarker(e) {
    const tripId = this.markerTrips && this.markerTrips[e.detail.markerId - 1];
    if (tripId) wx.navigateTo({ url: `/pages/trip-map/trip-map?id=${tripId}` });
  },
  open(e) { wx.navigateTo({ url: `/pages/trip-map/trip-map?id=${e.currentTarget.dataset.id}` }); },
});
