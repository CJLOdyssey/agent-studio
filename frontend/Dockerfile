# ── Build stage ──
# Build arg for npm registry (default: npmmirror for China users)
# Override for overseas: --build-arg NPM_REGISTRY=https://registry.npmjs.org
ARG NPM_REGISTRY=https://registry.npmmirror.com
FROM node:22-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --registry=${NPM_REGISTRY}

COPY index.html tsconfig.json vite.config.ts ./
COPY public/ public/
COPY src/ src/

RUN npm run build

# ── Serve stage ──
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
