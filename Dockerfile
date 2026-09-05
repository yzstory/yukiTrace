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
ENV NEXT_TELEMETRY_DISABLED=1
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
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
