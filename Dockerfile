# Stage 1: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV PATH="/app/node_modules/.bin:$PATH"
RUN mkdir -p data uploads public content
RUN BUILDING_DOCKER_IMAGE=1 next build

# Stage 2: Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.codex ./.codex
COPY --from=builder /app/public ./public

# Copy content (blog posts etc.) from build stage
COPY --from=builder /app/content ./content

# Data & uploads dirs — will be mounted as volumes in production
RUN mkdir -p data uploads .next/cache .next/server && \
    chown -R nextjs:nodejs data uploads content .next .codex

USER nextjs

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "server.js"]
