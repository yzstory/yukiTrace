-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "amountCnyMinor" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Stop" ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai';

-- 回填 amountCnyMinor：
-- 1) 主币种即人民币的旅程，直接沿用 amountHomeMinor
UPDATE "Expense" e
SET "amountCnyMinor" = e."amountHomeMinor"
FROM "Trip" t
WHERE e."tripId" = t.id AND t."homeCurrency" = 'CNY';

-- 2) 其他主币种：按离线兜底汇率换算（minorUnit 差异一并处理），后续可由应用刷新
UPDATE "Expense" e
SET "amountCnyMinor" = ROUND(e."amountHomeMinor" / POWER(10, r.minor_unit) * r.rate * 100)
FROM "Trip" t
JOIN (VALUES
  ('JPY', 0.048, 0), ('USD', 7.1, 2), ('EUR', 7.8, 2), ('HKD', 0.91, 2),
  ('TWD', 0.22, 0), ('KRW', 0.0052, 0), ('THB', 0.2, 2), ('SGD', 5.3, 2),
  ('MYR', 1.55, 2), ('GBP', 9.1, 2), ('AUD', 4.7, 2), ('NZD', 4.3, 2),
  ('CAD', 5.2, 2), ('CHF', 8.1, 2), ('VND', 0.00028, 0), ('IDR', 0.00044, 0),
  ('MOP', 0.88, 2)
) AS r(code, rate, minor_unit) ON r.code = t."homeCurrency"
WHERE e."tripId" = t.id AND t."homeCurrency" <> 'CNY';
