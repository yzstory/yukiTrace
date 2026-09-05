# 任务计划：yukiTrace · 带娃旅行记录 Web 应用

## 目标
用 Next.js 做一个苹果风格的「带娃旅行日记 + 账本」网页应用，能记录行程（航班/租车/住宿/餐饮/游玩）、花费（多币种）、照片与备注，在高德地图上展示路线与站间距离，并内嵌 AI 助手（OpenAI 兼容接口）降低记录成本；第一版部署到阿里云 ECS（Docker Compose），后续可开放注册并演进为 App。

## 当前阶段
阶段 2 完成，进入阶段 3（地图与账本视图）

## 各阶段

### 阶段 0：需求与规划
- [x] 理解用户意图，梳理功能清单与产品定位
- [x] 确认关键决策：高德地图 / OSS / 多用户 / CNY 主币种+外币 / OpenAI 兼容 AI
- [x] 创建规划文件（task_plan / findings / progress）
- [x] 用户确认计划
- **状态：** complete

### 阶段 1：项目骨架与基础设施
- [x] `create-next-app`：Next.js 16.3 + App Router + TypeScript + Tailwind v4 + ESLint（装到的是 16，非 15）
- [x] 安装 shadcn/ui（radix-nova）、motion、lucide-react、zod、date-fns、recharts、ai SDK、exifr、ali-oss、amap loader
- [x] Prisma 7 + PostgreSQL 16（docker-compose.dev.yml 本地起库），@prisma/adapter-pg
- [x] 数据模型落地并完成首个迁移：User / TripMember / Trip / Stop / StopLeg / Entry / Expense / ExchangeRate / Photo / DailyNote / BabyLog / ChecklistItem / ShareLink
- [x] 自建认证：bcryptjs + jose HttpOnly cookie，`src/lib/session.ts` / `src/lib/dal.ts`（verifySession / getCurrentUser / requireTripAccess），`src/proxy.ts` 乐观重定向，登录/注册 Server Actions
- [x] 设计系统：`globals.css` iOS 系统色 oklch token、分层背景、系统字体栈、iOS 字号 utility、glass / card-shadow / safe-area utility
- [x] 布局：`(app)/layout.tsx` 桌面侧边栏 + 移动端毛玻璃底部 Tab（旅程/地图/账本/我），PageHeader 大标题
- [x] Dockerfile（standalone + entrypoint 自动 migrate deploy）+ 生产 docker-compose.yml + .env.example
- [x] 验证：typecheck / lint / `next build` 通过；curl 验证未登录重定向、带会话访问 /trips /me、已登录访问 /login 反向重定向
- **状态：** complete

### 阶段 2：核心记录功能（第一版可用）
- [x] 旅程 CRUD：标题、描述、日期范围、主币种、同行人、宝宝昵称+生日（月龄自动算）、封面上传、删除确认
- [x] 首页旅程卡片流（封面/渐变 + 日期 + 天数 + 站数 + 总花费 + 宝宝月龄 + 城市）
- [x] 站点 Stop：POI 搜索（/api/amap/search 代理，未配 Key 时降级为定位/手填坐标）、类型、到达/离开时间、婴儿友好标签、备注；逆地理编码补地址
- [x] 站点间距离：Haversine 直线 + 高德驾车/步行路径（<2km 步行，<500km 驾车，否则直线），结果缓存 StopLeg；改坐标/删站点自动重算
- [x] 条目 Entry：9 种类型（航班/租车/火车/打车/住宿/餐食/游玩/购物/此刻），类型特定 meta 字段，可关联站点，可顺手记一笔花费
- [x] 花费 Expense：多币种、最小单位整数、汇率 DB 缓存 → frankfurter API → 离线兜底、自动折算主币、分类、宝宝相关标记
- [x] 照片：/api/upload（sharp 压缩 webp 2400px、exifr 读拍摄时间+GPS、500m 内自动匹配站点）、存储抽象 OSS/本地、/api/files 鉴权读取 + 缩略图
- [x] 时间线视图：按 Day 分组、日记（内联编辑）、站点卡片、站间距离分隔、条目行、花费 chip、照片条 + 灯箱、每日小计
- [x] 快速记录浮钮 `+`：底部抽屉，地点/花费/照片 3 个大入口 + 9 种条目，表单 3 步内完成
- [x] 验证：typecheck / lint / build 通过；种子数据 + curl 验证列表页、详情页、编辑页、上传、缩略图、鉴权
- **状态：** complete

### 阶段 3：地图与账本视图
- [ ] 高德 JS API 2.0 集成（@amap/amap-jsapi-loader），自定义地图样式贴近苹果风
- [ ] 全屏地图：所有站点连线，按天着色；点击站点弹底部半屏抽屉（照片 + 条目）
- [ ] 路线「回放」动画：小点沿路线移动，配当天照片渐显
- [ ] 账本视图：总额、分类饼图、按天柱状图、多币种折算、按「宝宝相关」筛选
- [ ] 站点/条目详情页、编辑、删除
- **状态：** pending

### 阶段 4：AI 助手（OpenAI 兼容）
- [ ] 接入 Vercel AI SDK（`ai` + `@ai-sdk/openai-compatible`），baseURL / apiKey / model 全部由环境变量配置
- [ ] 自然语言记录：一句话 → 结构化条目（工具调用 createEntry / addExpense / searchPlace）
- [ ] 票据 / 航班确认截图 / 租车合同识别 → 自动填表（视觉模型，需模型支持图片输入）
- [ ] 每日自动小结草稿（可选语气：写给宝宝看）
- [ ] 旅程结束自动生成游记 + 推荐封面照片
- [ ] 智能问答：基于结构化数据的工具调用（queryExpenses / findStop 等），不做向量库
- [ ] 出行前助手：按目的地、日期、宝宝月龄生成装备清单
- **状态：** pending

### 阶段 5：带娃专属与回顾分享
- [ ] 宝宝状态轻量打卡：喂奶 / 换尿布 / 睡眠
- [ ] 装备清单模板（可复用、勾选）
- [ ] 站点婴儿友好标签：母婴室 / 儿童座椅 / 推车友好
- [ ] 照片 EXIF 自动归位（exifr 读 GPS + 时间 → 匹配或自动创建站点）
- [ ] 天气自动补全（高德天气 API，按站点坐标 + 日期）
- [ ] 成长对照：同一地点不同年份照片并排
- [ ] 旅程总结页（Wrapped 风格，可导出长图）
- [ ] 只读分享链接（可隐藏花费）
- [ ] 导出 PDF 相册 / CSV 账单
- [ ] PWA：离线记录、联网同步
- **状态：** pending

### 阶段 6：部署与验证
- [ ] 服务器 `/root/docker-compose/yukiTrace` 部署 docker-compose（app + postgres + 可选 caddy 反代 HTTPS）
- [ ] 环境变量：DATABASE_URL、AUTH_SECRET、AMAP_KEY(web/js)、OSS_*、AI_BASE_URL/AI_API_KEY/AI_MODEL
- [ ] 数据库迁移、种子数据、备份策略
- [ ] 手机端真机走一遍：新建旅程 → 录站点 → 记花费 → 传照片 → 看地图 → 看账本
- [ ] 记录测试结果到 progress.md
- **状态：** pending

## 关键问题
1. 高德 Key 是否已申请？需要 Web 端（JS API）Key + Web 服务 Key 各一个（路径规划/天气用服务 Key）
2. OSS Bucket 名称与地域？是否已开通 STS 角色（用于前端直传）
3. AI 服务商与模型名（例如 DeepSeek / 通义 / OpenRouter / 自建），是否支持图片输入
4. 域名与 HTTPS：有现成域名指向 101.37.37.200 吗？OSS 直传与 PWA 都需要 HTTPS
5. 第一版是否需要注册功能，还是先手动建账号

## 已做决策
| 决策 | 理由 |
|------|------|
| Next.js 15 App Router + TS | 用户指定；Server Actions 简化 CRUD |
| Tailwind + shadcn/ui + Framer Motion | 苹果风 UI 与弹簧动效 |
| PostgreSQL + Prisma | 关系型数据、docker 部署简单、多租户易做 |
| 高德地图 | 用户选择；国内数据准确 |
| 阿里云 OSS + 前端直传 | 用户选择；减轻服务器带宽 |
| Auth.js v5 多用户 | 以后开放注册 |
| Vercel AI SDK + openai-compatible provider | 兼容任意 OpenAI 风格接口，支持 tool calling 与流式 |
| 金额存 minor unit 整数 + 货币码，另存折算 CNY 金额 | 避免浮点误差；报表统一按 CNY |
| 移动端优先 + PWA，API 层与 UI 分离 | 为以后做 App（Capacitor 或 RN）铺路 |
| 三层模型 Trip → Stop → Entry，Expense/Photo 可挂任意层 | 时间线、地图、账本共享同一份数据 |

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| create-next-app 拒绝大写目录名 yukiTrace | 1 | 在 /tmp/yukitrace 生成后拷贝进项目目录 |
| shadcn init 无 `--base-color` 参数 | 1 | 改用 `init -d -b radix --pointer` |
| `pnpm add prisma` 装到 8.0.0-rc 与 client 7 不匹配 | 1 | 固定 `prisma@7`，移到 devDependencies |
| Docker daemon 未运行 | 1 | `open -a OrbStack` 后重试 |
| `PageProps<"/login">` 类型报错 | 1 | 运行 `pnpm next typegen` 重新生成路由类型 |
| React Compiler lint：effect 内 setState / map 回调里修改闭包变量 | 1 | 搜索改由 onChange 触发；里程改为 reduce 计算 |
| Prisma Json 字段类型不接受 Record<string, unknown> | 1 | 断言为 InputJsonValue |
| 用 curl 直接 POST Server Action 测注册返回 500 | 1 | useActionState 表单不渲染 ACTION_ID，改为 tsx 脚本种子用户 + jose 签发会话验证受保护页面 |

## 备注
- 服务器：101.37.37.200，root，密钥 ~/Downloads/ipad.pem，目录 /root/docker-compose/yukiTrace（目前为空）
- 记录成本尽量低，回顾体验尽量美，是所有 UI 决策的第一原则
- 外部内容（网页/API 结果）只写入 findings.md
