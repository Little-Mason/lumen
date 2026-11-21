FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期只需要能通过 env 校验，真实密钥在运行时注入。
# 用 RUN 内联环境变量而非 ARG，避免占位密钥进入镜像 history / BuildKit secret 警告。
RUN DATABASE_URL="postgresql://lumen:lumen@db:5432/lumen?schema=public" \
    AUTH_SECRET="build-time-placeholder-not-used-in-runtime" \
    NEXT_PUBLIC_SITE_URL="http://localhost:3000" \
    npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY scripts/healthcheck.mjs ./healthcheck.mjs
USER nextjs
EXPOSE 3000
# DB 不通时 /api/health 返回 503，容器会如实变成 unhealthy，不伪装成健康。
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "healthcheck.mjs"]
CMD ["node", "server.js"]
