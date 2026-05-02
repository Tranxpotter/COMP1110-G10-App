FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye

ARG NODE_VERSION=20.19.4

# Keep dependencies minimal for Expo; add build tools for native modules if needed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# Upgrade Node to satisfy React Native engine requirements.
RUN npm install -g n \
    && n ${NODE_VERSION} \
    && n prune

USER node
