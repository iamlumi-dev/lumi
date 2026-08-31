# Setup

Anleitung zum Aufsetzen von **lumiswork** auf einem eigenen Server.
Gedacht für jemanden, der sich mit Linux-Servern auskennt, aber dieses Projekt
noch nicht kennt. Beispiele gehen von Debian/Ubuntu aus.

---

## 1. Was das Ding ist

- **Backend:** Node.js mit Express, Daten in einer **SQLite-Datei**.
  Kein externer Datenbankserver, kein Docker nötig.
- **Frontend:** statisches HTML/CSS/JS, kein Build-Step. Was in `public/`
  liegt, wird genau so ausgeliefert.
- **Zustand** liegt an genau zwei Orten:
  `data/lumiswork.db` (Inhalte) und `public/uploads/` (Medien).
  Wer diese beiden sichert, hat alles.

---

## 2. Voraussetzungen

| | Version | Anmerkung |
|---|---|---|
| Node.js | **≥ 20.10**, empfohlen 22 LTS | |
| npm | passend zur Node-Version | |
| Build-Tools | `build-essential`, `python3` | nur falls `better-sqlite3` aus Quellen gebaut werden muss |
| ffmpeg | optional | nur für die Platzhalter-Medien des Seeds |

```bash
sudo apt update
sudo apt install -y build-essential python3 git
# Node über NodeSource oder nvm installieren
```

---

## 3. Installation

```bash
sudo adduser --system --group --home /srv/lumiswork lumiswork
sudo -u lumiswork -H bash

cd /srv/lumiswork
git clone <repo-url> .
npm ci --omit=dev
```

### Falls `better-sqlite3` nicht baut

`better-sqlite3` enthält eine native Erweiterung. Neuere npm-Versionen
**blockieren Install-Scripts standardmäßig** — dann fehlt die kompilierte
`.node`-Datei und der Start scheitert mit
`Could not locate the bindings file`.

```bash
npm rebuild better-sqlite3
# und/oder:
npm install-scripts approve better-sqlite3     # npm ≥ 11
```

Prüfen:

```bash
ls node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

---

## 4. Konfiguration

```bash
cp .env.example .env
```

`.env` anpassen:

```ini
PORT=3000
NODE_ENV=production
DATABASE_PATH=./data/lumiswork.db
SESSION_SECRET=<hier den erzeugten Zufallswert einsetzen>
TRUST_PROXY=1          # 1, weil nginx/Caddy davor steht
```

Secret erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_SECRET` wird erst vom späteren Admin-Login gebraucht, sollte aber
jetzt schon richtig gesetzt sein. `.env` gehört **nicht** ins Repo
(steht in `.gitignore`) und sollte `chmod 600` sein.

Name, Portfolio-Titel und Jahreszahl stehen zentral in `server/config.js`
unter `site` — dort ändern, nicht in den HTML-Dateien suchen.

---

## 5. Datenbank anlegen

```bash
npm run db:migrate      # Schema — idempotent, gefahrlos wiederholbar
npm run db:seed         # Demo-Inhalte, nur wenn die DB noch leer ist
```

`npm run db:seed -- --reset` **löscht alle Posts, Kategorien und Seiten** und
legt die Demo-Inhalte neu an. Auf einem Produktivsystem mit echten Inhalten
also nicht ausführen.

Auf einem echten Server will man den Seed meist gar nicht — `db:migrate` genügt,
dann startet die Seite mit einem leeren Portfolio.

---

## 6. Start prüfen

```bash
npm start
curl -s localhost:3000/api/posts | head -c 200
```

---

## 7. Als Dienst laufen lassen (systemd)

`/etc/systemd/system/lumiswork.service`:

```ini
[Unit]
Description=lumiswork
After=network.target

[Service]
Type=simple
User=lumiswork
Group=lumiswork
WorkingDirectory=/srv/lumiswork
EnvironmentFile=/srv/lumiswork/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5

# Absicherung
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/lumiswork/data /srv/lumiswork/public/uploads
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lumiswork
sudo systemctl status lumiswork
journalctl -u lumiswork -f
```

`ProtectSystem=strict` macht das Dateisystem schreibgeschützt — die beiden
`ReadWritePaths` sind genau die Stellen, an die der Dienst schreiben muss
(SQLite-Datei samt WAL, und die Uploads). Fehlen sie, startet der Dienst,
aber jedes Schreiben scheitert.

---

## 8. Reverse Proxy und TLS

### Caddy (kürzer, TLS automatisch)

```
lumi.example.com {
    encode zstd gzip
    reverse_proxy localhost:3000
    request_body {
        max_size 100MB      # Reserve für spätere Medien-Uploads
    }
}
```

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name lumi.example.com;

    ssl_certificate     /etc/letsencrypt/live/lumi.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lumi.example.com/privkey.pem;

    client_max_body_size 100M;   # Reserve für spätere Medien-Uploads

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name lumi.example.com;
    return 301 https://$host$request_uri;
}
```

Zertifikat mit `certbot --nginx -d lumi.example.com`.

**Wichtig:** Wenn ein Proxy davor steht, muss `TRUST_PROXY=1` in der `.env`
stehen. Sonst sieht das Rate-Limiting nur die IP des Proxys und zählt alle
Besucher als einen.

---

## 9. Was die App selbst schon absichert

Ist bereits in `server/index.js` konfiguriert, muss also nicht nachgerüstet
werden — aber gut zu wissen:

- **Helmet** mit enger Content-Security-Policy. Erlaubt sind als Fremd-Hosts
  nur `fonts.googleapis.com`, `fonts.gstatic.com` und `cdnjs.cloudflare.com`
  (p5.js). Inline-Scripts und Inline-Styles sind **verboten** — deshalb liegt
  jeder Style im Stylesheet und jedes Script in einer eigenen Datei.
  Wer eine neue Fremd-Ressource einbindet, muss die CSP dort erweitern,
  sonst blockt der Browser sie stillschweigend.
- **HSTS**, `frame-ancestors: none`, `nosniff`, `referrer-policy`.
- **Rate-Limiting** auf `/api`: 240 Anfragen pro Minute und IP.
- **Uploads** werden mit `X-Content-Type-Options: nosniff` und
  `Content-Disposition: inline` ausgeliefert und nie als Verzeichnis gelistet.
- **Keine Stacktraces** nach außen.
- Alle SQL-Abfragen laufen über **Prepared Statements**.

---

## 10. Sicherungen

Zu sichern sind genau zwei Dinge:

```bash
#!/bin/bash
# /usr/local/bin/lumiswork-backup
set -euo pipefail
DEST=/var/backups/lumiswork
STAMP=$(date +%F)
mkdir -p "$DEST"

# SQLite konsistent sichern — NICHT einfach die Datei kopieren,
# solange der Dienst läuft (WAL-Modus).
sqlite3 /srv/lumiswork/data/lumiswork.db ".backup '$DEST/db-$STAMP.sqlite'"

tar czf "$DEST/uploads-$STAMP.tar.gz" -C /srv/lumiswork/public uploads

find "$DEST" -type f -mtime +30 -delete
```

Täglich per Cron oder systemd-Timer. Wiederherstellen: Dienst stoppen,
Datei nach `data/lumiswork.db` zurückkopieren, Uploads entpacken, Dienst starten.

---

## 11. Aktualisieren

```bash
sudo -u lumiswork -H bash
cd /srv/lumiswork
git pull
npm ci --omit=dev
npm run db:migrate        # neue Tabellen/Spalten, wenn welche dazugekommen sind
exit
sudo systemctl restart lumiswork
```

---

## 12. Wenn etwas nicht geht

| Symptom | Ursache |
|---|---|
| `Could not locate the bindings file` | native Erweiterung fehlt → `npm rebuild better-sqlite3` (siehe Abschnitt 3) |
| `SQLITE_READONLY` / `unable to open database file` | Rechte auf `data/`, oder `ReadWritePaths` in der systemd-Unit fehlt |
| Seite lädt, Portfolio bleibt bei „loading …" | `/api/posts` antwortet nicht → `journalctl -u lumiswork` |
| Portfolio zeigt „nothing here" | Datenbank ist leer → `npm run db:migrate` gelaufen? Posts angelegt? |
| Kein Hintergrund-Canvas | p5-CDN blockiert oder CSP zu eng → Browser-Konsole prüfen |
| Schrift ist Fallback-Monospace | Google Fonts blockiert → notfalls Fonts lokal ablegen und CSP anpassen |
| Alles hinter dem Proxy hat dieselbe IP | `TRUST_PROXY=1` fehlt in der `.env` |

---

## Was noch fehlt

Der **Admin-Bereich** (Login, Posts anlegen/bearbeiten, Kategorien verwalten,
Medien hochladen) ist noch nicht gebaut. Vorbereitet ist:

- Tabelle `users` in `server/schema.sql` — nimmt ausschließlich einen
  Passwort-**Hash** auf, nie ein Klartextpasswort.
- `SESSION_SECRET` in der `.env`.
- Zwei Einhängepunkte in `server/index.js`, im Code mit `ADMIN` markiert:
  `/admin` für die Oberfläche, `/api/admin` für die schreibenden Endpunkte.
- `POST_SIZES` und `MEDIA_KINDS` in `server/lib/posts.js` als einzige Quelle
  der erlaubten Werte — die Auswahlfelder im Editor sollten daraus kommen.
- `uniqueSlug()` in `server/lib/slug.js` für kollisionsfreie URLs.

Beim Bau zu beachten:

- Passwörter mit **argon2id** oder bcrypt hashen.
- Session-Cookies: `httpOnly`, `secure`, `sameSite: 'lax'`.
- **CSRF-Schutz** für alle schreibenden Routen.
- Eigenes, striktes Rate-Limit auf die Login-Route (z. B. 10 Versuche
  pro 15 Minuten und IP).
- Beim Datei-Upload den Dateityp am **Inhalt** prüfen, nicht an der Endung,
  und die Datei unter einem selbst erzeugten Namen speichern.
  **SVG nicht annehmen** — SVG kann Skripte enthalten. (Die Platzhalter-SVGs
  des Seeds sind selbst erzeugt und deshalb unbedenklich; die CSP verhindert
  zusätzlich, dass Skripte darin ausgeführt würden.)
- Die Größe eines Posts nur aus `POST_SIZES` akzeptieren — das Schema
  erzwingt das per `CHECK`, die API sollte es trotzdem vorher prüfen.
