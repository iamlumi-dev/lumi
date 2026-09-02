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
| ffmpeg | **empfohlen** | Standbilder für Videos und kleine Fassungen großer Bilder. Ohne ffmpeg bleiben Video-Kacheln leer und die Übersicht lädt die Originale |

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
SESSION_DAYS=14        # wie lange eine Anmeldung gilt
MAX_UPLOAD_MB=500      # 0 schaltet die Grenze ab
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

`db:migrate` legt fehlende Tabellen und Indizes an **und** trägt Spalten nach,
die zu einer schon bestehenden Tabelle dazugekommen sind (`CREATE TABLE IF NOT
EXISTS` allein würde eine vorhandene Tabelle unverändert lassen). Nach jedem
`git pull` also mit ausführen — die Liste steht oben in `scripts/migrate.js`.

`npm run db:seed -- --reset` legt die Demo-Inhalte neu an. Davor passiert
zweierlei, damit nie etwas verloren geht:

1. Es wird **immer** eine Sicherung nach `data/backups/` geschrieben.
2. Stehen in der Datenbank Inhalte, die nicht wörtlich aus dem Seed stammen,
   **bricht der Befehl ab** und nennt sie beim Namen. Erst
   `--reset --force` verwirft sie wirklich.

```bash
npm run media:prepare                # fehlende Standbilder/Verkleinerungen nachziehen
npm run db:backup                    # Sicherung von Hand
npm run db:restore                   # vorhandene Sicherungen auflisten
npm run db:restore -- <datei>        # eine zurückspielen
```

`db:restore` sichert den aktuellen Stand, bevor es ihn überschreibt — auch ein
versehentliches Zurückspielen kostet also nichts. Aufgehoben werden die
letzten 30 Sicherungen; sie liegen neben der Datenbank und **nicht** im Repo.

Auf einem echten Server will man den Seed meist gar nicht — `db:migrate` genügt,
dann startet die Seite mit einem leeren Portfolio.

---

## 5b. Admin-Konto anlegen

```bash
npm run admin:create -- lumi
```

Das Passwort wird abgefragt und **nicht angezeigt** — es steht damit weder in
der Befehlszeile noch in der Shell-Historie. Mindestens 12 Zeichen; eine
Passphrase aus vier Wörtern reicht völlig.

Derselbe Befehl mit einem vorhandenen Benutzernamen **ändert** das Passwort und
beendet dabei alle offenen Anmeldungen. Das ist auch der Weg zurück, wenn das
Passwort verloren geht — es gibt bewusst keine Zurücksetzen-per-Mail-Funktion.

Anmelden dann unter `/login/`, der Editor liegt unter `/admin/`. Beide sind
nirgends auf der Seite verlinkt.

### Zweiten Faktor einschalten

Im Editor unter **account → two-factor → set up**: QR-Code mit einer
Authenticator-App scannen (Aegis, Ente Auth, Google Authenticator …), den
sechsstelligen Code eintippen, fertig. Danach werden **acht
Wiederherstellungs-Codes einmalig angezeigt** — die gehören in den
Passwort-Manager, jeder bringt einmalig hinein, wenn das Handy weg ist.

Ist der zweite Faktor aktiv, reicht ein gestohlenes Passwort nicht mehr, und
Durchprobieren über das Netz ist damit erledigt.

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
        max_size 600MB      # muss über MAX_UPLOAD_MB liegen
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

    client_max_body_size 600M;   # muss über MAX_UPLOAD_MB liegen

    # große Uploads brauchen Geduld, sonst bricht der Proxy sie ab
    proxy_request_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

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
Besucher als einen — und die Begrenzung der Anmeldeversuche wäre wirkungslos.

**Ebenso wichtig:** Das Limit des Proxys muss **über** `MAX_UPLOAD_MB` liegen,
sonst bricht er große Uploads ab, bevor die App sie überhaupt sieht. Wer
`MAX_UPLOAD_MB=0` setzt, muss auch hier abschalten (`client_max_body_size 0;`
bei nginx).

---

## 9. Was die App selbst schon absichert

Ist bereits in `server/index.js` konfiguriert, muss also nicht nachgerüstet
werden — aber gut zu wissen:

- **Helmet** mit enger Content-Security-Policy. Erlaubte Fremd-Hosts:
  `fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com` (p5.js),
  `i.ytimg.com` (YouTube-Vorschaubilder) und `www.youtube-nocookie.com`
  (der Player, der erst nach einem Klick lädt). Inline-Scripts und
  Inline-Styles sind **verboten** — deshalb liegt jeder Style im Stylesheet
  und jedes Script in einer eigenen Datei.
  Wer eine neue Fremd-Ressource einbindet, muss die CSP dort erweitern,
  sonst blockt der Browser sie stillschweigend.
- **HSTS**, `frame-ancestors: none`, `nosniff`, `referrer-policy`.
- **Rate-Limiting** auf `/api`: 240 Anfragen pro Minute und IP.
- **Uploads** werden mit `X-Content-Type-Options: nosniff` und
  `Content-Disposition: inline` ausgeliefert und nie als Verzeichnis gelistet.
- **Keine Stacktraces** nach außen.
- Alle SQL-Abfragen laufen über **Prepared Statements**.
- **Passwörter** als scrypt-Hash, **Session-Tokens** nur als SHA-256-Hash.
- **CSRF-Token** für jede schreibende Anfrage, zusätzlich zu `sameSite=lax`.
- **Begrenzung der Anmeldeversuche**: 10 Fehlversuche pro 15 Minuten und
  30 pro Tag, je IP-Adresse. Gerechnet wird aus der Tabelle
  `login_attempts`, nicht aus einem Zähler im Arbeitsspeicher — ein
  Neustart setzt sie also **nicht** zurück. Abgewiesene Versuche zählen
  selbst nicht mit, sonst verlängerte jeder weitere Klick die eigene Sperre.
- **Zweiter Faktor** (TOTP, RFC 6238) optional pro Konto, mit
  Wiederherstellungs-Codes. Derselbe Code gilt nie zweimal.
- **`/admin` wird vor `express.static` abgeriegelt** — die Reihenfolge in
  `server/index.js` ist hier sicherheitsrelevant und sollte nicht verschoben
  werden.
- **Uploads** nur aus einer festen Typenliste, ohne SVG, mit selbst vergebenem
  Dateinamen.

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
npm run db:backup         # zuerst. immer.
git pull
npm ci --omit=dev
npm run db:migrate        # neue Tabellen/Spalten, wenn welche dazugekommen sind
exit
sudo systemctl restart lumiswork
```

### Warum das die Inhalte nicht anfassen kann

Der entscheidende Punkt: **Code und Inhalte sind getrennt.**

| liegt in Git | liegt nur auf dem Server |
|---|---|
| `server/`, `public/`, `scripts/`, Dokumentation | `data/lumiswork.db` — alle Posts, Splashes, Shoutouts, Texte, Konten |
| | `public/uploads/` — alle hochgeladenen Dateien |
| | `.env` |

`git pull` kann die Datenbank also gar nicht überschreiben — sie steht in
`.gitignore` und war nie im Repo. `db:migrate` legt nur fehlende Tabellen,
Spalten und Indizes an; es löscht nichts und ändert keine Zeile. Der einzige
Befehl im Projekt, der Inhalte wegwerfen kann, ist
`db:seed -- --reset --force` — und der ist **auf dem Server nie nötig**.

Der Seed ist ausschließlich dafür da, eine leere Datenbank mit Demo-Inhalten
zu füllen, damit man beim Entwickeln etwas zu sehen hat.

---

## 11b. Anmeldeversuche im Blick behalten

Jeder Versuch landet in der Datenbank **und** als eine Zeile im Journal:

```
lumiswork login ok ip=1.2.3.4 user="lumi"
lumiswork login FAILED ip=5.6.7.8 user="admin" reason=bad_credentials
```

Im Editor stehen die letzten 25 unter **account → login attempts**, dazu eine
Zusammenfassung der letzten 24 Stunden. Auf dem Server:

```bash
journalctl -u lumiswork | grep 'lumiswork login FAILED'
```

### fail2ban

Die Begrenzung in der App gilt pro IP-Adresse. Gegen jemanden, der von vielen
Adressen aus probiert, hilft nur eine Sperre in der Firewall. Dafür gibt es
das Logformat oben.

`/etc/fail2ban/filter.d/lumiswork.conf`:

```ini
[Definition]
failregex = ^.*lumiswork login FAILED ip=<HOST> .*$
ignoreregex =
```

`/etc/fail2ban/jail.d/lumiswork.conf`:

```ini
[lumiswork]
enabled  = true
backend  = systemd
journalmatch = _SYSTEMD_UNIT=lumiswork.service
filter   = lumiswork
maxretry = 15
findtime = 1h
bantime  = 24h
```

Prüfen:

```bash
sudo fail2ban-regex "$(journalctl -u lumiswork -n 200 --no-pager)" \
     /etc/fail2ban/filter.d/lumiswork.conf
sudo fail2ban-client status lumiswork
```

`maxretry` ist absichtlich höher als das App-Limit (15 gegen 10): so greift
zuerst die sanfte Bremse der App und erst danach die harte Sperre der Firewall.

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
| Login gesperrt, obwohl das Passwort stimmt | Fehlversuche derselben IP im Fenster. Warten, oder `DELETE FROM login_attempts WHERE ip = '…'` |
| Code aus der App wird nicht angenommen | Uhr des Handys prüfen. Toleranz ist ±30 s. Ein bereits benutzter Code gilt nicht nochmal — den nächsten abwarten |
| Handy verloren | einen der Wiederherstellungs-Codes im Code-Feld eingeben, danach im Editor neu einrichten |

---

## Was noch fehlt

Nichts Grundsätzliches mehr. Offen sind nur Inhalte:

- Die **Kontaktlinks** auf der About-Seite (Reiter zeigt bis dahin
  „coming soon …").
- Die **Demo-Posts** im Portfolio wollen durch echte ersetzt werden.
- Die **Beispiel-Shoutouts** ebenso — sie sind als Platzhalter erkennbar
  benannt.

Wenn später ein weiterer Inhaltstyp dazukommt: Der Editor ist als Registry
gebaut. Ein neuer Abschnitt braucht einen Eintrag in `SECTIONS` in
`public/admin/admin.js` und einen Knopf in der Kopfleiste — der Rest ist
Datenzugriff in `server/lib/write.js` und ein paar Routen in
`server/routes/admin.js`.
