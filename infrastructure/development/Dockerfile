# All language runtimes, native build prerequisites and browsers stay in this image.
FROM node:24.19.0-bookworm-slim
ARG RUST_VERSION=1.98.1
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    CARGO_HOME=/opt/cargo \
    RUSTUP_HOME=/opt/rustup \
    PATH=/opt/cargo/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git build-essential pkg-config \
      libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev \
      libssl-dev librsvg2-dev libayatana-appindicator3-dev \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@11.9.0 --ignore-scripts --no-audit --no-fund \
    && test "$(node --version)" = "v24.19.0" \
    && test "$(npm --version)" = "11.9.0"
RUN curl --fail --show-error --location --retry 3 \
      https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init \
      --output /tmp/rustup-init \
    && curl --fail --show-error --location --retry 3 \
      https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init.sha256 \
      --output /tmp/rustup-init.sha256 \
    && cd /tmp && sha256sum --check rustup-init.sha256 \
    && chmod +x rustup-init \
    && ./rustup-init -y --no-modify-path --profile minimal --default-toolchain "$RUST_VERSION" \
    && rm rustup-init rustup-init.sha256

WORKDIR /workspace
COPY package.json package-lock.json .npmrc ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/collaboration/package.json ./apps/collaboration/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/protocol/package.json ./packages/protocol/package.json
COPY packages/sync/package.json ./packages/sync/package.json
RUN npm ci --no-audit --no-fund \
    && npm exec -- playwright install --with-deps chromium
COPY --chown=node:node . .
RUN mkdir -p /evidence \
    && chown node:node /workspace /workspace/node_modules /evidence \
    && chown -R node:node /opt/cargo
USER node
CMD ["npm", "run", "dev"]
