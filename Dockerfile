FROM node:24-alpine

RUN npm install -g pnpm@11.5.2

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]
