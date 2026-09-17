# Этап 1: сборка приложения
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Этап 2: production-образ
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Копируем всю src с ресурсами (i18n, sql и т.п.)
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD ["node", "dist/main"]