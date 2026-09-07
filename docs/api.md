# Trace JSON API（/api/v1）

给小程序、App 或脚本用的接口。和网页走的是同一套服务层（`src/lib/services/*`），校验规则、时区处理、汇率折算、操作历史都一致。

## 鉴权

两种方式，二选一：

| 方式 | 适用 | 说明 |
|---|---|---|
| `Authorization: Bearer tra_…` | 小程序 / App / 脚本 | 由 `POST /api/v1/auth/login` 或 `signup` 签发，可在「我 → 开发者选项 → MCP 接入」里查看与撤销 |
| 会话 cookie | 浏览器同源请求 | 网页登录后自动带上 |

MCP 令牌（`trc_…`）只能用于 `/api/mcp`，且只读，**不能**调用 `/api/v1`。

请求体一律 JSON（`Content-Type: application/json`）。成功返回 200 与 JSON；写操作没有返回值时返回 `{ "ok": true }`。失败返回 `{ "error": "给人看的中文" }`，状态码：

| 状态码 | 含义 |
|---|---|
| 400 | 参数不合法（错误信息与网页表单提示相同） |
| 401 | 未登录 / 令牌无效 |
| 403 | 没有权限（如非所有者删旅程） |
| 404 | 旅程不存在或不可见 |
| 409 | 记录已被别人改过，需刷新 version |
| 429 | 触发频率限制 |
| 503 | AI 未配置或暂时不可用 |

## 快速开始

```bash
BASE=https://trace.example.com
TOKEN=$(curl -s $BASE/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"secret","device":"我的手机"}' | jq -r .token)

curl -s $BASE/api/v1/trips -H "authorization: Bearer $TOKEN" | jq '.trips[0]'
```

## 接口一览

### 账号

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/login` | `{ email, password, device? }` → `{ token, user }` |
| POST | `/auth/signup` | `{ email, password, name, device? }` → `{ token, user }`（`ALLOW_SIGNUP=false` 时 403） |
| POST | `/auth/logout` | 撤销当前令牌（cookie 登录则清会话） |
| GET | `/me` | 当前用户 |
| GET | `/tokens` | 我的令牌（含 scope、最近使用） |
| POST | `/tokens` | `{ name, scope: "api" \| "mcp" }` → `{ token }`，每人最多 10 个 |
| DELETE | `/tokens/{id}` | 撤销 |

### 旅程

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/trips` | `{ trips: [...] }`，含站点数、照片数、总花费、城市、我的角色 |
| POST | `/trips` | 见下方「旅程字段」→ `{ id }` |
| GET | `/trips/{tripId}` | 全量详情：`trip`、`stops`（每站含 `entries` / `expenses` / `photos` / `legFromPrev`）、`looseEntries`、`looseExpenses`、`loosePhotos`、`babyLogs`、`dailyNotes`、`totalHomeMinor`、`totalDistanceM` |
| PUT | `/trips/{tripId}` | 整体替换，字段同 POST |
| DELETE | `/trips/{tripId}` | 仅所有者 |
| PUT | `/trips/{tripId}/cover` | `{ coverKey }`，`null` 清除；封面先经 `/api/upload`（`purpose=cover`）上传 |

旅程字段：`title`（必填）、`startDate` / `endDate`（`YYYY-MM-DD`）、`homeCurrency`（如 `CNY`）、`timezone`（IANA，默认 `Asia/Shanghai`）、`description?`、`babyName?`、`babyBirthDate?`、`travelers?`（数组或逗号分隔字符串）。

### 记录

时间一律用**当地时间**字符串 `YYYY-MM-DDTHH:mm`，服务端按站点或旅程时区解析。金额用原币的常规单位（`1800` 日元、`12.5` 元），服务端换算最小单位并折算主币种与人民币。

| 方法 | 路径 | 请求体 |
|---|---|---|
| POST | `/trips/{tripId}/stops` | `name`、`lat`、`lng`、`arriveAt`，可选 `type`（`CITY/AIRPORT/STATION/HOTEL/RESTAURANT/ATTRACTION/SHOP/PARK/OTHER`）、`leaveAt`、`address`、`city`、`amapPoiId`、`timezone`、`note`、`babyTags`（数组）→ `{ id, city, address, arriveAt }` |
| PUT | `/trips/{tripId}/stops/{stopId}` | 同上，整体替换 |
| DELETE | `/trips/{tripId}/stops/{stopId}` | |
| POST | `/trips/{tripId}/entries` | `type`（`FLIGHT/CAR_RENTAL/TRAIN/TAXI/HOTEL/MEAL/ACTIVITY/SHOPPING/MOMENT`）、`title`、`startAt`，可选 `stopId`、`endAt`、`note`、`meta`（对象）；顺手记账：`amount`、`currency`、`category`、`isBaby` → `{ id, expenseId }` |
| PUT | `/trips/{tripId}/entries/{entryId}` | 同上 |
| DELETE | `/trips/{tripId}/entries/{entryId}` | |
| POST | `/trips/{tripId}/expenses` | `title`、`amount`、`paidAt`，可选 `currency`、`category`（`TRANSPORT/ACCOMMODATION/FOOD/ACTIVITY/SHOPPING/BABY/OTHER`）、`isBaby`、`stopId`、`entryId`、`note`、`rate` → `{ id, amountHomeMinor, currency, rate }` |
| DELETE | `/trips/{tripId}/expenses/{expenseId}` | 修改走下方「记录」接口 |
| PATCH | `/trips/{tripId}/photos/{photoId}` | `{ caption }`；上传照片走 `/api/upload`（multipart：`tripId`、`files[]`、可选 `stopId` / `entryId`） |
| DELETE | `/trips/{tripId}/photos/{photoId}` | |
| POST | `/trips/{tripId}/photos/{photoId}/analyze` | 重试 AI 识别 |
| POST | `/trips/{tripId}/baby-logs` | `type`（`FEED/DIAPER/SLEEP/WAKE/MEDICINE/OTHER`）、`at`、`note?` → `{ id }` |
| DELETE | `/trips/{tripId}/baby-logs/{id}` | |
| PUT | `/trips/{tripId}/notes/{YYYY-MM-DD}` | `{ content }` |

### 记录的查改删（带版本号）

任何记录都可以用统一接口查看、修改、删除，并附带操作历史。`kind` 取 `stop / entry / expense / photo / babyLog / dailyNote / checklistItem`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/trips/{tripId}/records/{kind}/{refId}` | `{ record, version, values, timezone, stops, canEdit, history }` |
| PATCH | 同上 | `{ version, values }`，`values` 的键与 GET 返回一致；version 不符 → 409 |
| DELETE | 同上 | `{ version }` 或 `?version=` |
| POST | `/trips/{tripId}/records/{kind}/{refId}/confirm` | `{ version }`，核对 AI 写入无误 |
| POST | `/trips/{tripId}/activities/{activityId}/undo` | 撤销一次 AI 写入 |

### 家人、分享、清单、整理、AI、护照

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/trips/{tripId}/members` | 成员与有效邀请（邀请仅所有者可见） |
| DELETE | `/trips/{tripId}/members/{userId}` | 移除家人（所有者） |
| POST | `/trips/{tripId}/members/leave` | 自己退出 |
| POST | `/trips/{tripId}/invites` | → `{ token, url }`，30 天有效 |
| DELETE | `/trips/{tripId}/invites/{id}` | 撤销邀请 |
| GET | `/invites/{token}` | 邀请预览（不需登录） |
| POST | `/invites/{token}` | 接受邀请 → `{ tripId }` |
| GET / POST | `/trips/{tripId}/share-links` | 只读分享链接；POST `{ hideExpense }` → `{ id, token, url }` |
| PATCH / DELETE | `/trips/{tripId}/share-links/{id}` | `{ hideExpense }` / 撤销 |
| GET / POST | `/trips/{tripId}/checklist` | 列表 / 新增 `{ group, text }` |
| PATCH / DELETE | `/trips/{tripId}/checklist/{id}` | `{ checked }` / 删除 |
| POST | `/trips/{tripId}/checklist/template` | 追加带娃默认清单 → `{ added }` |
| POST | `/trips/{tripId}/checklist/reset` | 全部取消勾选 |
| GET | `/trips/{tripId}/tidy` | 整理报告：重复账单、AI 待核对、缺关联、识别失败 |
| POST | `/trips/{tripId}/tidy` | 一键整理 → `{ linked, analyzed }` |
| POST | `/trips/{tripId}/tidy/keep-duplicates` | `{ fingerprint }` |
| POST | `/trips/{tripId}/ai/daily-draft` | `{ date, tone?: "default" \| "to_baby" }` → `{ draft }` |
| POST | `/trips/{tripId}/ai/family-digest` | `{ date }` → `{ draft }` |
| POST | `/trips/{tripId}/ai/summary` | → `{ text }` |
| POST | `/trips/{tripId}/ai/packing-list` | → `{ count }` |
| GET | `/passport` | 护照：统计与每枚章（含是否盖章、文案、底图） |
| POST | `/passport/stamps` | `{ city }` 盖一枚 / `{ all: true }` 全部盖章 |
| GET | `/rates?from=JPY&to=CNY&at=2026-09-07` | 汇率 |

### 仍在 /api 下、同样接受 Bearer 的接口

| 路径 | 说明 |
|---|---|
| `POST /api/upload` | 照片 / 封面 / 小票上传（multipart） |
| `POST /api/ai/chat` | AI 对话（流式，Vercel AI SDK UI Message Stream 协议） |
| `POST /api/ai/transcribe` | 语音转文字 |
| `POST /api/ai/import` | 粘贴确认单解析成草稿 |
| `GET /api/amap/search` | 地点搜索 |
| `GET /api/export/{tripId}` | 账单 CSV |
| `GET /api/files/{key}` | 图片（成员可读） |
| `POST /api/sync` | 离线队列回放 |
