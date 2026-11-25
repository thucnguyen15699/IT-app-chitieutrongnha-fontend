# ---- Build giao diện ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ---- Phục vụ bằng nginx; /api được chuyển tiếp sang container backend ----
FROM nginx:1.27-alpine
# Mẫu cấu hình: nginx tự thay ${BACKEND_HOST}, ${ROBOTS_TAG} khi khởi động.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_HOST=backend:8080 \
    ROBOTS_TAG="all"
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
