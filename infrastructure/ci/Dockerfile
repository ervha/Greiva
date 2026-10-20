# CI uses the same pinned JavaScript toolchain as development; no host installs.
FROM node:24.19.0-bookworm-slim
ENV CI=true PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
WORKDIR /workspace
RUN npm install --global npm@11.9.0 --ignore-scripts --no-audit --no-fund
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/client/package.json ./apps/client/package.json
COPY apps/collaboration/package.json ./apps/collaboration/package.json
COPY packages/application/package.json ./packages/application/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/sync/package.json ./packages/sync/package.json
RUN npm ci --no-audit --no-fund \
    && npx playwright install --with-deps chromium
COPY . .
CMD ["bash", "scripts/ci-verify.sh"]
