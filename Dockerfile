FROM docker.m.daocloud.io/library/node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM docker.m.daocloud.io/library/node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/content ./content
COPY --from=builder /app/src/agent/prompt.yaml ./src/agent/prompt.yaml

RUN pnpm install --prod --frozen-lockfile

VOLUME ["/app/baiLu-data", "/app/log"]

ENV NARRATIVE_PORT=3724

EXPOSE 3724

CMD ["node", "dist/agent/server.js"]
