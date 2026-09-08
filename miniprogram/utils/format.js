/** 常量与格式化：与 src/lib/currency.ts、entry-types.ts、date.ts 保持一致 */

const CURRENCIES = [
  { code: "CNY", symbol: "¥", name: "人民币", minorUnit: 2 },
  { code: "JPY", symbol: "¥", name: "日元", minorUnit: 0 },
  { code: "USD", symbol: "$", name: "美元", minorUnit: 2 },
  { code: "EUR", symbol: "€", name: "欧元", minorUnit: 2 },
  { code: "HKD", symbol: "HK$", name: "港币", minorUnit: 2 },
  { code: "TWD", symbol: "NT$", name: "新台币", minorUnit: 0 },
  { code: "KRW", symbol: "₩", name: "韩元", minorUnit: 0 },
  { code: "THB", symbol: "฿", name: "泰铢", minorUnit: 2 },
  { code: "SGD", symbol: "S$", name: "新加坡元", minorUnit: 2 },
  { code: "MYR", symbol: "RM", name: "马来西亚林吉特", minorUnit: 2 },
  { code: "GBP", symbol: "£", name: "英镑", minorUnit: 2 },
  { code: "AUD", symbol: "A$", name: "澳元", minorUnit: 2 },
  { code: "NZD", symbol: "NZ$", name: "新西兰元", minorUnit: 2 },
  { code: "CAD", symbol: "C$", name: "加元", minorUnit: 2 },
  { code: "CHF", symbol: "CHF", name: "瑞士法郎", minorUnit: 2 },
  { code: "VND", symbol: "₫", name: "越南盾", minorUnit: 0 },
  { code: "IDR", symbol: "Rp", name: "印尼盾", minorUnit: 0 },
  { code: "MOP", symbol: "MOP$", name: "澳门元", minorUnit: 2 },
];
const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

const TIMEZONES = [
  { value: "Asia/Shanghai", label: "中国 · 北京时间 (UTC+8)" },
  { value: "Asia/Hong_Kong", label: "中国香港 (UTC+8)" },
  { value: "Asia/Taipei", label: "中国台湾 (UTC+8)" },
  { value: "Asia/Tokyo", label: "日本 · 东京 (UTC+9)" },
  { value: "Asia/Seoul", label: "韩国 · 首尔 (UTC+9)" },
  { value: "Asia/Singapore", label: "新加坡 (UTC+8)" },
  { value: "Asia/Bangkok", label: "泰国 · 曼谷 (UTC+7)" },
  { value: "Asia/Kuala_Lumpur", label: "马来西亚 (UTC+8)" },
  { value: "Asia/Jakarta", label: "印尼 · 雅加达 (UTC+7)" },
  { value: "Asia/Ho_Chi_Minh", label: "越南 (UTC+7)" },
  { value: "Asia/Dubai", label: "阿联酋 · 迪拜 (UTC+4)" },
  { value: "Australia/Sydney", label: "澳大利亚 · 悉尼" },
  { value: "Pacific/Auckland", label: "新西兰 · 奥克兰" },
  { value: "Europe/London", label: "英国 · 伦敦" },
  { value: "Europe/Paris", label: "法国 · 巴黎" },
  { value: "Europe/Berlin", label: "德国 · 柏林" },
  { value: "Europe/Rome", label: "意大利 · 罗马" },
  { value: "Europe/Zurich", label: "瑞士 · 苏黎世" },
  { value: "America/Los_Angeles", label: "美国 · 西海岸" },
  { value: "America/New_York", label: "美国 · 东海岸" },
  { value: "America/Toronto", label: "加拿大 · 多伦多" },
  { value: "UTC", label: "UTC" },
];

const ENTRY_TYPES = {
  MOMENT: { label: "此刻", emoji: "✨", color: "#8E8E93", defaultCategory: "OTHER", fields: [] },
  MEAL: { label: "餐食", emoji: "🍜", color: "#FF9500", defaultCategory: "FOOD", fields: [{ key: "dishes", label: "吃了什么", placeholder: "汤咖喱、成吉思汗烤肉" }] },
  ACTIVITY: { label: "游玩", emoji: "🎟️", color: "#34C759", defaultCategory: "ACTIVITY", fields: [{ key: "ticket", label: "门票信息" }] },
  HOTEL: { label: "住宿", emoji: "🛏️", color: "#AF52DE", defaultCategory: "ACCOMMODATION", fields: [{ key: "roomType", label: "房型", placeholder: "家庭房" }, { key: "bookingRef", label: "预订号" }, { key: "hasCrib", label: "婴儿床 (有/无)" }] },
  FLIGHT: { label: "航班", emoji: "✈️", color: "#0A84FF", defaultCategory: "TRANSPORT", fields: [{ key: "flightNo", label: "航班号", placeholder: "CA1234" }, { key: "airline", label: "航空公司", placeholder: "国航" }, { key: "from", label: "出发机场", placeholder: "PVG 浦东 T2" }, { key: "to", label: "到达机场", placeholder: "CTS 新千岁" }, { key: "seat", label: "座位", placeholder: "23A" }] },
  CAR_RENTAL: { label: "租车", emoji: "🚗", color: "#5856D6", defaultCategory: "TRANSPORT", fields: [{ key: "company", label: "租车公司" }, { key: "carModel", label: "车型" }, { key: "pickupPlace", label: "取车地点" }, { key: "returnPlace", label: "还车地点" }, { key: "plate", label: "车牌" }, { key: "startKm", label: "取车里程 (km)", type: "number" }, { key: "endKm", label: "还车里程 (km)", type: "number" }] },
  TRAIN: { label: "火车", emoji: "🚄", color: "#30B0C7", defaultCategory: "TRANSPORT", fields: [{ key: "trainNo", label: "车次", placeholder: "G1234" }, { key: "from", label: "出发站" }, { key: "to", label: "到达站" }, { key: "seat", label: "座位" }] },
  TAXI: { label: "打车", emoji: "🚕", color: "#FFCC00", defaultCategory: "TRANSPORT", fields: [{ key: "from", label: "起点" }, { key: "to", label: "终点" }] },
  SHOPPING: { label: "购物", emoji: "🛍️", color: "#FF2D55", defaultCategory: "SHOPPING", fields: [{ key: "items", label: "买了什么" }] },
};
const ENTRY_TYPE_ORDER = ["MOMENT", "MEAL", "ACTIVITY", "HOTEL", "FLIGHT", "CAR_RENTAL", "TRAIN", "TAXI", "SHOPPING"];

const STOP_TYPES = {
  CITY: { label: "城市", emoji: "🏙️" },
  AIRPORT: { label: "机场", emoji: "🛫" },
  STATION: { label: "车站", emoji: "🚉" },
  HOTEL: { label: "酒店", emoji: "🏨" },
  RESTAURANT: { label: "餐厅", emoji: "🍽️" },
  ATTRACTION: { label: "景点", emoji: "🏛️" },
  SHOP: { label: "商店", emoji: "🏬" },
  PARK: { label: "公园", emoji: "🌳" },
  OTHER: { label: "地点", emoji: "📍" },
};
const STOP_TYPE_ORDER = ["OTHER", "CITY", "ATTRACTION", "RESTAURANT", "HOTEL", "AIRPORT", "STATION", "SHOP", "PARK"];

const EXPENSE_CATEGORIES = {
  TRANSPORT: { label: "交通", emoji: "🚌", color: "#0A84FF" },
  ACCOMMODATION: { label: "住宿", emoji: "🛏️", color: "#AF52DE" },
  FOOD: { label: "餐饮", emoji: "🍜", color: "#FF9500" },
  ACTIVITY: { label: "游玩", emoji: "🎟️", color: "#34C759" },
  SHOPPING: { label: "购物", emoji: "🛍️", color: "#FF2D55" },
  BABY: { label: "宝宝", emoji: "🍼", color: "#30B0C7" },
  OTHER: { label: "其他", emoji: "💳", color: "#8E8E93" },
};
const EXPENSE_CATEGORY_ORDER = ["FOOD", "TRANSPORT", "ACCOMMODATION", "ACTIVITY", "SHOPPING", "BABY", "OTHER"];

const BABY_TAGS = { nursing_room: "母婴室", changing_table: "尿布台", high_chair: "儿童座椅", stroller_ok: "推车友好", kids_menu: "儿童餐", crib: "婴儿床", play_area: "游乐区" };
const BABY_LOG_TYPES = { FEED: { label: "喂奶", emoji: "🍼" }, DIAPER: { label: "换尿布", emoji: "🧷" }, SLEEP: { label: "睡了", emoji: "😴" }, WAKE: { label: "醒了", emoji: "🌞" }, MEDICINE: { label: "吃药", emoji: "💊" }, OTHER: { label: "其他", emoji: "📝" } };
const BABY_LOG_ORDER = ["FEED", "DIAPER", "SLEEP", "WAKE", "MEDICINE", "OTHER"];
const ENTITY_LABELS = { stop: "地点", entry: "条目", expense: "花费", photo: "照片", babyLog: "宝宝状态", dailyNote: "日记", checklistItem: "清单" };
const DAY_COLORS = ["#D9603A", "#3F7FB5", "#4E9A85", "#8A5CA8", "#D9536F", "#3B8F9A", "#D9A441", "#8E8A84"];

// ───────────────────────── 金额 ─────────────────────────

function currencyInfo(code) {
  return CURRENCIES.find((c) => c.code === code) || { code, symbol: code, name: code, minorUnit: 2 };
}
function fromMinor(minor, code) {
  return (minor || 0) / Math.pow(10, currencyInfo(code).minorUnit);
}
function groupThousands(s) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/** ¥1,280 / ¥128.50 / 1,800 JPY（showCode） */
function money(minor, code, opts = {}) {
  const info = currencyInfo(code);
  const value = fromMinor(minor, code);
  const digits = opts.compact ? 0 : info.minorUnit;
  const abs = Math.abs(value);
  let str;
  if (opts.compact && abs >= 100000) str = `${(abs / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  else {
    const [int, frac] = abs.toFixed(digits).split(".");
    str = groupThousands(int) + (frac ? `.${frac}` : "");
  }
  const sign = value < 0 ? "-" : "";
  return `${sign}${info.symbol}${str}${opts.showCode && code !== "CNY" ? ` ${code}` : ""}`;
}

// ───────────────────────── 时间（按时区） ─────────────────────────

const DEFAULT_TZ = "Asia/Shanghai";
/** 无 Intl 时的固定偏移兜底（分钟），不考虑夏令时 */
const FIXED_OFFSET = { "Asia/Shanghai": 480, "Asia/Hong_Kong": 480, "Asia/Taipei": 480, "Asia/Tokyo": 540, "Asia/Seoul": 540, "Asia/Singapore": 480, "Asia/Bangkok": 420, "Asia/Kuala_Lumpur": 480, "Asia/Jakarta": 420, "Asia/Ho_Chi_Minh": 420, "Asia/Dubai": 240, "Australia/Sydney": 600, "Pacific/Auckland": 720, "Europe/London": 0, "Europe/Paris": 60, "Europe/Berlin": 60, "Europe/Rome": 60, "Europe/Zurich": 60, "America/Los_Angeles": -480, "America/New_York": -300, "America/Toronto": -300, UTC: 0 };
const dtfCache = {};
function dtf(tz) {
  if (dtfCache[tz] !== undefined) return dtfCache[tz];
  try {
    dtfCache[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
  } catch (e) {
    dtfCache[tz] = null;
  }
  return dtfCache[tz];
}
/** 某时刻在时区里的墙上时间各字段 */
function parts(d, tz) {
  const date = d instanceof Date ? d : new Date(d);
  const zone = tz || DEFAULT_TZ;
  const f = dtf(zone);
  if (f) {
    const o = {};
    f.formatToParts(date).forEach((p) => (o[p.type] = p.value));
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday);
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour === 24 ? 0 : +o.hour, min: +o.minute, wd: wd < 0 ? date.getDay() : wd };
  }
  const off = FIXED_OFFSET[zone] !== undefined ? FIXED_OFFSET[zone] : -date.getTimezoneOffset();
  const t = new Date(date.getTime() + off * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), wd: t.getUTCDay() };
}
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const fmt = {
  date: (d, tz) => { const p = parts(d, tz); return `${p.m}月${p.d}日`; },
  dateFull: (d, tz) => { const p = parts(d, tz); return `${p.y}年${p.m}月${p.d}日`; },
  weekday: (d, tz) => WEEKDAYS[parts(d, tz).wd],
  time: (d, tz) => { const p = parts(d, tz); return `${pad(p.h)}:${pad(p.min)}`; },
  dateTime: (d, tz) => { const p = parts(d, tz); return `${p.m}月${p.d}日 ${pad(p.h)}:${pad(p.min)}`; },
  monthYear: (d, tz) => { const p = parts(d, tz); return `${p.y}年${p.m}月`; },
  inputDate: (d, tz) => { const p = parts(d, tz); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; },
  inputTime: (d, tz) => { const p = parts(d, tz); return `${pad(p.h)}:${pad(p.min)}`; },
  inputDateTime: (d, tz) => `${fmt.inputDate(d, tz)}T${fmt.inputTime(d, tz)}`,
};
/** 日期类字段（startDate / endDate / date）按 UTC 存，直接取 UTC 年月日 */
function dateOnly(d) {
  const t = d instanceof Date ? d : new Date(d);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), key: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` };
}
function dateRange(start, end) {
  const a = dateOnly(start), b = dateOnly(end);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `${a.y}年${a.m}月${a.d}日`;
  if (a.y === b.y) return `${a.y}年${a.m}月${a.d}日 – ${b.m}月${b.d}日`;
  return `${a.y}年${a.m}月${a.d}日 – ${b.y}年${b.m}月${b.d}日`;
}
function tripDays(start, end) {
  const a = dateOnly(start), b = dateOnly(end);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000) + 1;
}
/** 第几天（从 1 开始）：按时区墙上日期与旅程开始日比较 */
function dayIndex(tripStart, d, tz) {
  const p = parts(d, tz), s = dateOnly(tripStart);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(s.y, s.m - 1, s.d)) / 86400000) + 1;
}
/** 第 index 天的日期 key（YYYY-MM-DD） */
function dayKey(tripStart, index) {
  const s = dateOnly(tripStart);
  return dateOnly(new Date(Date.UTC(s.y, s.m - 1, s.d + index - 1))).key;
}
function babyAge(birth, at) {
  const b = new Date(birth), a = at ? new Date(at) : new Date();
  const days = Math.floor((a - b) / 86400000);
  if (days < 0) return null;
  if (days < 31) return `${days} 天`;
  let months = (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + (a.getUTCMonth() - b.getUTCMonth());
  if (a.getUTCDate() < b.getUTCDate()) months--;
  if (months < 24) return `${months} 个月`;
  const years = Math.floor(months / 12), rest = months % 12;
  return rest ? `${years} 岁 ${rest} 个月` : `${years} 岁`;
}
/** 当前时刻在时区里的 YYYY-MM-DDTHH:mm，用作表单默认值 */
function nowInput(tz) {
  return fmt.inputDateTime(new Date(), tz);
}
function distance(m) {
  if (!m) return "0 m";
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 100000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}
function duration(s) {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} 小时${m ? ` ${m} 分` : ""}` : `${m} 分钟`;
}

module.exports = {
  CURRENCIES, CURRENCY_CODES, TIMEZONES, ENTRY_TYPES, ENTRY_TYPE_ORDER, STOP_TYPES, STOP_TYPE_ORDER, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ORDER,
  BABY_TAGS, BABY_LOG_TYPES, BABY_LOG_ORDER, ENTITY_LABELS, DAY_COLORS, DEFAULT_TZ,
  currencyInfo, fromMinor, money, fmt, parts, dateOnly, dateRange, tripDays, dayIndex, dayKey, babyAge, nowInput, distance, duration, pad,
};
