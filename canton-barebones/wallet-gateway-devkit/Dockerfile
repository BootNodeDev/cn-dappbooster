# Built from the repository root so the npm-workspaces lockfile is in context.
# See canton-barebones/docker-compose.yaml for the build.context / dockerfile wiring.

FROM node:24-alpine AS build
WORKDIR /app
ENV HUSKY=0
# Copy the root lockfile plus every workspace manifest first, so the install
# layer caches independently of source changes. npm ci needs all manifests
# present to reconstruct the workspace tree from the single root lockfile.
COPY package.json package-lock.json ./
COPY canton-connect-kit/package.json canton-connect-kit/
COPY carpincho-wallet/package.json carpincho-wallet/
COPY canton-barebones/package.json canton-barebones/
COPY canton-barebones/wallet-gateway-devkit/package.json canton-barebones/wallet-gateway-devkit/
COPY dapp/daml/package.json dapp/daml/
COPY dapp/e2e/package.json dapp/e2e/
COPY dapp/frontend/package.json dapp/frontend/
# --ignore-scripts skips the root husky prepare hook (no .git in the image) and
# unrelated workspace postinstalls; the devkit build needs none of them.
RUN npm ci --ignore-scripts
COPY canton-barebones/wallet-gateway-devkit/tsconfig.json canton-barebones/wallet-gateway-devkit/
COPY canton-barebones/wallet-gateway-devkit/src canton-barebones/wallet-gateway-devkit/src
RUN npm run build --workspace @canton-dappbooster/wallet-gateway-devkit

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY canton-connect-kit/package.json canton-connect-kit/
COPY carpincho-wallet/package.json carpincho-wallet/
COPY canton-barebones/package.json canton-barebones/
COPY canton-barebones/wallet-gateway-devkit/package.json canton-barebones/wallet-gateway-devkit/
COPY dapp/daml/package.json dapp/daml/
COPY dapp/e2e/package.json dapp/e2e/
COPY dapp/frontend/package.json dapp/frontend/
RUN npm ci --omit=dev --ignore-scripts
COPY canton-barebones/config/environments canton-barebones/config/environments
COPY --from=build /app/canton-barebones/wallet-gateway-devkit/dist canton-barebones/wallet-gateway-devkit/dist
WORKDIR /app/canton-barebones/wallet-gateway-devkit
EXPOSE 3010
CMD ["node", "dist/server.js"]
