FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.9.0 --activate
WORKDIR /app

# ── 依赖 ──
FROM base AS deps
# postinstall 会执行 prisma generate，需要 schema 与 config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ── 构建 ──
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_AMAP_JS_KEY=""
ARG NEXT_PUBLIC_AMAP_SECURITY_CODE=""
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_AMAP_JS_KEY="${NEXT_PUBLIC_AMAP_JS_KEY}"
ENV NEXT_PUBLIC_AMAP_SECURITY_CODE="${NEXT_PUBLIC_AMAP_SECURITY_CODE}"
RUN pnpm prisma generate && pnpm build

# ── 迁移镜像：postgres:16-alpine 自带 psql，比装 prisma CLI 小一个数量级 ──
FROM postgres:16-alpine AS migrate
WORKDIR /app
COPY prisma/migrations ./migrations
COPY deploy/migrate.sh ./migrate.sh
RUN chmod +x ./migrate.sh
ENTRYPOINT ["./migrate.sh"]

# ── 运行镜像：仅 standalone 输出 ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# tzdata 让容器的 TZ 生效（业务时间一律按旅程时区渲染，这里只影响日志与系统时间）
RUN apk add --no-cache tzdata \
 && addgroup -S nodejs && adduser -S nextjs -G nodejs \
 && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
