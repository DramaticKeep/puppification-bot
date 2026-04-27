# syntax=docker/dockerfile:1.7

# Multi-stage build for the puppification-discord-bot monorepo.
#
# The repo holds three locally-linked packages:
#   - emotion-classifier  (depends on @huggingface/transformers)
#   - puppifier           (depends on emotion-classifier via file:..)
#   - puppification-discord-bot (depends on both via file:..)
#
# We must build them in dependency order so each `tsc` sees the
# previous package's `dist/`. The runtime stage copies the whole
# /app tree to keep npm's symlink topology for `file:` deps intact,
# then prunes dev deps to slim the image.
#
# Base image is intentionally Debian (bookworm-slim), NOT Alpine:
# `onnxruntime-node` (pulled in transitively by @huggingface/transformers)
# only ships glibc prebuilt binaries.

# -----------------------------------------------------------------------------
# Stage 1: builder
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY emotion-classifier/        emotion-classifier/
COPY puppifier/                 puppifier/
COPY puppification-discord-bot/ puppification-discord-bot/

RUN cd emotion-classifier        && npm ci && npm run build
RUN cd puppifier                 && npm ci && npm run build
RUN cd puppification-discord-bot && npm ci && npm run build

# -----------------------------------------------------------------------------
# Stage 2: runtime
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HF_HOME=/data/hf

WORKDIR /app

COPY --from=builder /app /app

RUN cd emotion-classifier         && npm prune --omit=dev \
 && cd ../puppifier               && npm prune --omit=dev \
 && cd ../puppification-discord-bot && npm prune --omit=dev

WORKDIR /app/puppification-discord-bot

CMD ["node", "dist/src/index.js"]
