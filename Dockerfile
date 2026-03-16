FROM node:24-alpine AS development-dependencies-env
ENV CI=true
RUN corepack enable pnpm
COPY . /app
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS production-dependencies-env
ENV CI=true
RUN corepack enable pnpm
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS build-env
RUN corepack enable pnpm
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm run setup && pnpm run build

FROM node:24-alpine
RUN corepack enable pnpm
COPY ./package.json pnpm-lock.yaml /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["pnpm", "run", "start"]
