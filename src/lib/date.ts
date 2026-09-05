import { format, differenceInCalendarDays, differenceInMonths, differenceInYears, addDays, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";

export const fmt = {
  date: (d: Date | string) => format(new Date(d), "M月d日", { locale: zhCN }),
  dateFull: (d: Date | string) => format(new Date(d), "yyyy年M月d日", { locale: zhCN }),
  weekday: (d: Date | string) => format(new Date(d), "EEEE", { locale: zhCN }),
  time: (d: Date | string) => format(new Date(d), "HH:mm"),
  dateTime: (d: Date | string) => format(new Date(d), "M月d日 HH:mm", { locale: zhCN }),
  monthYear: (d: Date | string) => format(new Date(d), "yyyy年M月", { locale: zhCN }),
  inputDate: (d: Date | string) => format(new Date(d), "yyyy-MM-dd"),
  inputDateTime: (d: Date | string) => format(new Date(d), "yyyy-MM-dd'T'HH:mm"),
};

export function tripDays(start: Date | string, end: Date | string) {
  return differenceInCalendarDays(new Date(end), new Date(start)) + 1;
}

/** 第几天（从 1 开始） */
export function dayIndex(tripStart: Date | string, d: Date | string) {
  return differenceInCalendarDays(new Date(d), new Date(tripStart)) + 1;
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

export { isSameDay };
