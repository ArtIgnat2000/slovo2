# Пилотный API: без npm-зависимостей, поэтому сборка — это копирование файлов.
# Образ подходит и для x86_64 Synology, и для ARM64 (DSM 7.2+, Container Manager).
FROM node:22-alpine

ENV NODE_ENV=production \
    TZ=Europe/Moscow \
    PORT=8080 \
    DB_PATH=/data/slovo.db \
    BACKUP_DIR=/data/backups

WORKDIR /app

COPY package.json ./package.json
COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /data/backups \
 && addgroup -S app \
 && adduser -S -G app app \
 && chown -R app:app /app /data

USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.mjs"]
