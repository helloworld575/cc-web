# Stage 1: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN ./node_modules/.bin/next build

# Stage 2: Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Content & data dirs — will be mounted as volumes in production
RUN mkdir -p data uploads content/posts && \
    chown -R nextjs:nodejs data uploads content

USER nextjs

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--max-old-space-size=256 --optimize-for-size"

CMD ["node", "server.js"]
