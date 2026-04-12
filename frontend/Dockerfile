# ── Stage 1: Build ───────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json* ./

RUN npm ci

# Copy source and build
COPY . .

# Set API URL at build time
ARG VITE_API_URL=https://clausion-production.up.railway.app
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config as template
COPY nginx.conf /etc/nginx/nginx-template.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway sets PORT env var (default 80)
ENV PORT=80

CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/nginx-template.conf > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
