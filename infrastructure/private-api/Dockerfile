FROM node:24.19.0-bookworm-slim
RUN npm install --global npm@11.9.0 --ignore-scripts --no-audit --no-fund
WORKDIR /workspace
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/client/package.json ./apps/client/package.json
COPY apps/collaboration/package.json ./apps/collaboration/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/application/package.json ./packages/application/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/sync/package.json ./packages/sync/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=node:node . .
RUN npm run build:packages && npm run build --workspace=@greiva/api
USER node
CMD ["npm", "run", "start:private", "-w", "@greiva/api"]
