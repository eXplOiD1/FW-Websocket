# Framework WebSocket-Server (socket.io). Node 20 (package.json: node >=18).
# Der Quellcode wird INS IMAGE kopiert — kein Bind-Mount, kein Host-File
# nötig. Deploy via Portainer → Stacks → Repository (siehe docker-compose.yml).
FROM node:20-alpine

WORKDIR /app

# Deps zuerst (Layer-Cache).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# App-Quellcode ins Image.
COPY . .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${WS_PORT:-3001}/health" >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
