export type CurrencyInfo = { code: string; symbol: string; name: string; minorUnit: number };

export const CURRENCIES: CurrencyInfo[] = [
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

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code, name: code, minorUnit: 2 };
}

/** 用户输入的金额（如 "128.5"）→ 最小单位整数 */
export function toMinor(amount: number | string, code: string): number {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** currencyInfo(code).minorUnit);
}

/** 最小单位整数 → 数字金额 */
export function fromMinor(minor: number, code: string): number {
  return minor / 10 ** currencyInfo(code).minorUnit;
}

/** 格式化金额，例如 ¥1,280 / ¥128.50 */
export function formatMoney(minor: number, code: string, opts: { compact?: boolean; showCode?: boolean } = {}): string {
  const info = currencyInfo(code);
  const value = fromMinor(minor, code);
  const str = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: opts.compact ? 0 : info.minorUnit,
    maximumFractionDigits: info.minorUnit,
    notation: opts.compact && Math.abs(value) >= 100000 ? "compact" : "standard",
  }).format(value);
  const codeSuffix = opts.showCode && code !== "CNY" ? ` ${code}` : "";
  return `${info.symbol}${str}${codeSuffix}`;
}

/** 折算：原币最小单位 → 主币最小单位 */
export function convertMinor(amountMinor: number, from: string, to: string, rate: number): number {
  const amount = fromMinor(amountMinor, from) * rate;
  return toMinor(amount, to);
}

/** 离线兜底汇率（1 单位外币 = ? CNY），仅在无网络/无缓存时使用 */
export const FALLBACK_RATES_TO_CNY: Record<string, number> = {
  CNY: 1,
  JPY: 0.048,
  USD: 7.1,
  EUR: 7.8,
  HKD: 0.91,
  TWD: 0.22,
  KRW: 0.0052,
  THB: 0.2,
  SGD: 5.3,
  MYR: 1.55,
  GBP: 9.1,
  AUD: 4.7,
  NZD: 4.3,
  CAD: 5.2,
  CHF: 8.1,
  VND: 0.00028,
  IDR: 0.00044,
  MOP: 0.88,
};
