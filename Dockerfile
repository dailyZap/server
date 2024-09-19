FROM node:22-alpine

RUN apk add --no-cache tzdata
ENV TZ=utc
ENV PORT=80

WORKDIR /app
COPY build .
COPY package.json .
COPY prisma prisma
ENV NODE_ENV=production

RUN corepack enable && echo "nodeLinker: node-modules" > .yarnrc.yml && yarn workspaces focus --production && yarn setup

EXPOSE 80

CMD npx prisma migrate deploy && node src/server.js
