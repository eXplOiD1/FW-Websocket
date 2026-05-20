# FW-Websocket — Lyvion Framework Realtime Server

Standalone WebSocket-Server für das **Lyvion Framework**. Stellt einen einzelnen
zentralen Echtzeit-Push-Kanal bereit (Notifications, Dashboard-Updates,
Catalyst-Events, …) — passend zu CLAUDE.md §43 „EIN zentraler WebSocket".

Wird **separat vom Framework** deployed (eigener Docker-Container, Portainer
Repository-Stack). Das Framework verbindet sich per HTTPS-Reverse-Proxy.

---

## Architektur

```
[Browser]  ───wss───►  [Reverse-Proxy /ws]  ───►  [FW-Websocket :3001]
   ▲                                                       │
   │                                                       │ HTTPS Token-Validate
   │                                                       ▼
[Framework UI] ◄──── push events ──────── [Framework PHP-API]
```

- **Eingehend (Browser):** socket.io WSS-Verbindung mit User-Token im Handshake
- **Ausgehend (Framework → WS):** `POST /api/notify` (persistente Notification)
  oder `POST /api/broadcast` (transientes UI-Event, kein DB-Eintrag)
- **Auth-Brücke:** Der Container ruft `POST {API_URL}/api/websocket-token.php`
  mit `X-Internal-Secret` Header auf, das Framework antwortet mit den
  User-Infos (oder 401)

---

## Installation (Empfohlen: Portainer Repository-Stack)

1. **Im Framework Secret abholen** — Login als Admin → Einstellungen → System
   → ⚡ WebSocket → 🔐 Internal Secret kopieren

2. **In Portainer** → Stacks → Add stack:
   - Name: `framework-ws`
   - Build method: **Repository**
   - Repository URL: `https://github.com/<owner>/FW-Websocket`
   - Authentication: an, falls Repo privat
   - Compose path: `docker-compose.yml`

3. **Environment-Variablen** unten im Stack-Formular eintragen.
   Einfachster Weg: Im Framework-UI den 📥 .env-Download-Button klicken
   und die Datei in Portainer per **"Load variables from .env file"**
   importieren — alle Werte sind dann auf einen Schlag drin.

   Manuell:

   | Variable | Wert | Pflicht |
   |---|---|---|
   | `STACK_NAME` | Container-Name (default `framework-ws`, für Test z.B. `framework-ws-test`) | ✓ |
   | `EXTERNAL_PORT` | Host-Port (default `3001`, für 2. Instanz z.B. `3002`) | ✓ |
   | `CORS_ORIGIN` | Framework-Domain (z.B. `https://lyvion.example.com`) | ✓ |
   | `API_URL` | Framework-Base-URL (z.B. `https://lyvion.example.com`) | ✓ |
   | `WS_INTERNAL_SECRET` | Secret aus Schritt 1 | ✓ |
   | `WS_HOST` | `0.0.0.0` (default) | – |
   | `LOG_LEVEL` | `info` (default) | – |

   **Multi-Instance auf demselben Docker-Host:** jeden Stack mit
   eigenem `STACK_NAME` (eindeutiger Container-Name) und eigenem
   `EXTERNAL_PORT` (eindeutige Host-Port-Bindung) deployen.

   **Multi-Site (eine Instanz, mehrere Frontends):** `CORS_ORIGIN` als
   komma-separierte Liste, z.B.
   `https://a.example.com,https://b.example.com`

4. **Reverse-Proxy** für HTTPS/WSS aufsetzen. Nginx-Proxy-Manager:
   Proxy Host anlegen, Source `host:3001`, "Websockets Support" anhaken.
   Manuelles Nginx-Snippet:

   ```nginx
   location /ws/ {
       proxy_pass http://127.0.0.1:3001/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_read_timeout 86400;
   }
   ```

5. **Deploy the stack.** Im Container-Log sollte stehen:
   `WebSocket server running on 0.0.0.0:3001`

6. **Im Framework** → Einstellungen → System → ⚡ WebSocket →
   WebSocket-Server-URL eintragen (z.B. `https://lyvion.example.com/ws`)
   → "Verbindung testen". Status sollte auf "Aktiviert" springen.

---

## Lokale Entwicklung (ohne Portainer)

```bash
git clone https://github.com/<owner>/FW-Websocket.git
cd FW-Websocket
cp .env.example .env
# .env editieren mit echten Werten
npm install
npm start
```

Health-Check: `curl http://localhost:3001/health` → `{"status":"ok"}`

---

## Health & Logging

| Endpoint | Zweck |
|---|---|
| `GET /health` | Liveness-Check für Reverse-Proxy / Docker HEALTHCHECK |
| `POST /api/notify` | Persistente Notification (vom Framework) |
| `POST /api/broadcast` | Transientes UI-Event ohne DB-Persistierung |
| `socket.io /` | Browser-WS-Verbindung |

Logs gehen nach stdout (in Portainer sichtbar).

---

## Sicherheit

- **`WS_INTERNAL_SECRET`** ist Pflicht in Produktion. Ohne Secret fällt das
  Framework auf eine Loopback-IP-Whitelist zurück — funktioniert nur wenn
  WS-Container und Framework auf dem selben Docker-Host laufen.
- **`CORS_ORIGIN`** NIEMALS auf `*` setzen in Produktion. Genaue Liste der
  erlaubten Browser-Origins eintragen.
- **Secret-Rotation:** im Framework regenerieren → den neuen Wert ins
  Portainer-Stack-Environment kopieren → Stack neu starten.

---

## Updates

Bei Code-Änderungen:
1. Repo aktualisieren (push ins GitHub-Repo)
2. In Portainer beim Stack: "Pull and redeploy"

Portainer pullt das Repo neu, baut das Image neu und startet den Container.
