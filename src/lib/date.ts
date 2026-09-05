import { differenceInCalendarDays, differenceInMonths, differenceInYears, addDays, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/** 默认时区：绝大多数记录发生在国内 */
export const DEFAULT_TZ = "Asia/Shanghai";

export type Tz = string | null | undefined;

function tzOf(tz: Tz) {
  return tz || DEFAULT_TZ;
}

function f(d: Date | string, pattern: string, tz: Tz) {
  return formatInTimeZone(new Date(d), tzOf(tz), pattern, { locale: zhCN });
}

/**
 * 所有格式化都在指定时区进行，避免容器时区（UTC）与旅行地时区造成的偏移。
 * 第二个参数省略时按 Asia/Shanghai 处理。
 */
export const fmt = {
  date: (d: Date | string, tz?: Tz) => f(d, "M月d日", tz),
  dateFull: (d: Date | string, tz?: Tz) => f(d, "yyyy年M月d日", tz),
  weekday: (d: Date | string, tz?: Tz) => f(d, "EEEE", tz),
  time: (d: Date | string, tz?: Tz) => f(d, "HH:mm", tz),
  dateTime: (d: Date | string, tz?: Tz) => f(d, "M月d日 HH:mm", tz),
  monthYear: (d: Date | string, tz?: Tz) => f(d, "yyyy年M月", tz),
  inputDate: (d: Date | string, tz?: Tz) => f(d, "yyyy-MM-dd", tz),
  inputDateTime: (d: Date | string, tz?: Tz) => f(d, "yyyy-MM-dd'T'HH:mm", tz),
  /** 带时区缩写，例如 14:10 JST */
  timeWithZone: (d: Date | string, tz?: Tz) => f(d, "HH:mm zzz", tz),
};

/** 表单里的本地时间字符串（yyyy-MM-dd'T'HH:mm 或 yyyy-MM-dd）→ UTC Date */
export function parseInTz(value: string, tz?: Tz): Date {
  return fromZonedTime(value, tzOf(tz));
}

/** 取该时刻在指定时区的「墙上时间」，用于跨时区做按天分组 */
export function wallClock(d: Date | string, tz?: Tz): Date {
  return toZonedTime(new Date(d), tzOf(tz));
}

export function tripDays(start: Date | string, end: Date | string) {
  return differenceInCalendarDays(new Date(end), new Date(start)) + 1;
}

/** 第几天（从 1 开始）。日期类字段按 UTC 存储，比较时统一取旅程时区的墙上时间 */
export function dayIndex(tripStart: Date | string, d: Date | string, tz?: Tz) {
  return differenceInCalendarDays(wallClock(d, tz), new Date(tripStart)) + 1;
}

export function dayDate(tripStart: Date | string, index: number) {
  return addDays(new Date(tripStart), index - 1);
}

/** 宝宝月龄描述，例如「1 岁 3 个月」「8 个月」「15 天」 */
export function babyAge(birth: Date | string, at: Date | string = new Date()) {
  const b = new Date(birth);
  const a = new Date(at);
  const years = differenceInYears(a, b);
  const months = differenceInMonths(a, b) - years * 12;
  if (years === 0 && months === 0) return `${differenceInCalendarDays(a, b)} 天`;
  if (years === 0) return `${months} 个月`;
  return months === 0 ? `${years} 岁` : `${years} 岁 ${months} 个月`;
}

/** 常用旅行时区 */
export const TIMEZONES: Array<{ value: string; label: string }> = [
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

export function timezoneLabel(tz: Tz) {
  const t = tzOf(tz);
  return TIMEZONES.find((x) => x.value === t)?.label ?? t;
}

export { isSameDay };
