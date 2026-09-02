# lumiswork

Portfolio-Website von lumi. Dunkles, botanisches Terminal-Design nach
[`style.md`](style.md), mit einem filterbaren Portfolio-Grid.

**Zum Aufsetzen auf einem Server → [`SETUP.md`](SETUP.md).**

---

## Was drin ist

- **Homepage** — ein Viewport, zentriert, generativer p5-Hintergrund. Unter dem
  Titel steht ein zufälliger **Splash-Text**; ein Klick würfelt einen neuen.
  Unten links sitzt ein **Terminal** (siehe unten).
- **`/portfolio/`** — Grid aus Posts in fünf wählbaren Kachelgrößen,
  filterbar nach frei anlegbaren Kategorien, sortierbar nach neuste/älteste/a–z.
  Filter und Sortierung stehen in der URL und sind damit teilbar.
- **`/portfolio/<slug>`** — Detailseite eines Posts.
- **`/shoutouts/`** — Empfehlungen: Sachen von anderen Leuten, die lumi gut
  findet. Liste statt Raster, filterbar nach Art (song / album / artist /
  video / other). Nur der Name ist Pflicht — Link, Titel, Notiz und Titelbild
  sind alle optional. Ein YouTube-Link bringt sein Vorschaubild selbst mit.
- **`/friends/`** — Links zu den Seiten anderer Leute. Inhalt aus der
  Datenbank, im Editor pflegbar (Name, Adresse, optional eine Zeile dazu).
- **`/colophon/`** — wie die Seite gebaut ist: Farben, Schriften, der
  generative Hintergrund, die Quiet-UI. Text ebenfalls aus der Datenbank.
- **`/about/`** — drei Reiter (whoami / contact / setup), die den Mittelteil
  austauschen statt zu scrollen. Inhalt kommt aus der Datenbank, Reiter sind
  per `#hash` verlinkbar. `about.js` misst beim Laden alle Reiter durch und
  friert die Höhe auf den höchsten ein, damit beim Umschalten nichts springt.
- **JSON-API** unter `/api` — liefert nur veröffentlichte Inhalte, nur lesend.

- **`/login/` und `/admin/`** — Anmeldung und Editor. Beide sind nirgends
  verlinkt; `/admin/` ist auch für Suchmaschinen gesperrt.

## Das Terminal

Nur auf der Startseite. Eingeklappt ist es genau die Zeile `© made by lumi 2026`
unten links — ein Klick öffnet ein Fenster, das sich an der Titelleiste
verschieben lässt (Position bleibt im `localStorage`). `—` oder `Esc` klappt es
wieder ein.

**Navigation:** `work`, `about`, `shoutouts`, `friends`, `colophon`
**Spielereien:** `theme` (Hintergrund umschalten — wheat, roots, off),
`matrix`, `plant`, `glitch`, `cowsay <text>`
**Nützlich:** `search <wort>`, `random`, `splash`, `fetch`, `clear`, `exit`, `help`
**Nicht in `help`:** `login`, `grep` (dasselbe wie `search`), `portfolio`,
`whoami`, `home`, `recs`, `ls`, `sudo`

Die Spielereien liegen in `public/js/term-toys.js` und werden von `terminal.js`
dazugemischt — ein neuer Befehl ist ein Eintrag in dem Objekt, sonst nichts.
Sie bekommen beim Aufruf einen Kontext mit den Ausgabefunktionen des Terminals
und greifen nie selbst ans DOM. `matrix`, `plant` und `glitch` halten sich an
`prefers-reduced-motion`. Pfeiltasten blättern durch die Eingaben.

`fetch` zeigt eine fastfetch-Parodie. Die Angaben zu Betriebssystem und Browser
werden clientseitig aus dem User-Agent geraten und **nirgendwohin geschickt**.

## Eine neue Textseite anlegen

Braucht kein neues Script:

1. Zeile in `REQUIRED_PAGES` in `scripts/migrate.js` — **nicht** in den Seed.
   Der Seed läuft auf einem laufenden Server nie; `migrate.js` legt die Zeile
   mit `INSERT OR IGNORE` an und lässt vorhandene unangetastet.
2. Hülle nach `public/<slug>/index.html` kopieren, `data-page="<slug>"` am
   `<body>` setzen.
3. Optional: Eintrag in den Navigationsleisten und ein Befehl in `terminal.js`.

Der Rest — Laden, Layout, Fehlerbehandlung — kommt aus `public/js/page.js`.

## Was noch fehlt
- **Die Kontaktlinks.** Der Reiter zeigt „coming soon …", solange keine Links
  in der Tabelle `links` stehen. Format steht als Kommentar in `scripts/seed.js`.
- **Die Demo-Posts** im Portfolio sind Platzhalter und wollen ersetzt werden.

---

## Schnellstart lokal

```bash
npm install
npm rebuild better-sqlite3     # nur nötig, wenn npm die Install-Scripts blockt
cp .env.example .env
npm run setup                  # Schema anlegen + Demo-Inhalte
npm run dev                    # http://localhost:3000
```

`npm run db:seed -- --reset` überschreibt die Demo-Inhalte — sichert vorher
und **bricht ab**, wenn eigene Inhalte in der Datenbank stehen (siehe
[`SETUP.md`](SETUP.md#5-datenbank-anlegen)). `npm run db:migrate`
legt nur das Schema an (idempotent, gefahrlos wiederholbar) und trägt dabei
auch Spalten nach, die zu einer schon bestehenden Tabelle dazugekommen sind.

---

## Aufbau

```
server/
  index.js        Express: statische Dateien, Sicherheits-Header, Routen
  config.js       Konfiguration aus .env, Marke (Name, Jahr) an einer Stelle
  db.js           SQLite-Verbindung (better-sqlite3, WAL)
  schema.sql      Datenbankschema, idempotent
  auth.js         Passwort-Hashing (scrypt), Sessions, Middleware
  routes/api.js   öffentliche, lesende API
  routes/auth.js  Anmelden, Abmelden, Passwort ändern
  routes/admin.js geschützte Schreib-API inkl. Upload
  lib/posts.js    Datenzugriff auf Posts, Medien, Kategorien
  lib/pages.js    Datenzugriff auf Freitextseiten und Links
  lib/splashes.js Splash-Texte
  lib/shoutouts.js Empfehlungen
  lib/layout.js   Anordnung des Portfolios: Zeilen, Spalten, Plätze
  lib/poster.js   Standbilder für Videos, kleine Fassungen für Bilder
  lib/waveform.js Hüllkurve einer Audiodatei
  lib/write.js    alle schreibenden Zugriffe
  lib/validate.js Prüfung aller Werte, die von außen kommen
  lib/slug.js     URL-taugliche Slugs (inkl. Umlaute)

public/
  index.html          Homepage
  about/index.html    Über mich, mit Reitern
  shoutouts/index.html Empfehlungen
  friends/index.html  Hülle — Inhalt kommt aus pages
  colophon/index.html Hülle — Inhalt kommt aus pages
  portfolio/index.html   Grid
  portfolio/post.html    Hülle der Detailseite
  404.html
  css/style.css       das gesamte Design-System, in Blöcke kommentiert
  js/site.js          lädt den Hintergrund-Sketch
  js/roots.js         generativer Hintergrund — derzeit stillgelegt
  js/wheat.js         generativer Hintergrund — der aktive
  js/portfolio.js     Grid, Filter, Sortierung
  js/about.js         Reiter der About-Seite
  js/shoutouts.js     Empfehlungsliste
  js/page.js          generische Textseite (friends, colophon, …)
  js/term-toys.js     die Spielereien des Terminals
  js/audioviz.js      Wellenform und Partikel-Visualizer
  js/splash.js        Splash-Text würfeln
  js/terminal.js      das Terminal auf der Startseite
  js/login.js         Anmeldeformular
  login/index.html    Anmeldeseite
  admin/              Editor — liegt hinter dem Login-Riegel
  js/post.js          Detailseite inkl. eigenem Audio-Player
  uploads/            hochgeladene Medien (nicht im Repo)

scripts/
  admin.js        Admin-Konto anlegen / Passwort ändern
  backup.js       Sicherung der Datenbank
  restore.js      Sicherung zurückspielen
  migrate.js      Schema anlegen
  seed.js         Demo-Inhalte
  placeholders.js erzeugt die Platzhalter-Medien (SVG generativ, AV per ffmpeg)

data/             SQLite-Datei (nicht im Repo)
```

---

## Datenmodell

| Tabelle | wofür |
|---|---|
| `posts` | Titel, Slug, Kurztext, Langtext, **Kachelgröße**, veröffentlicht, angepinnt |
| `media` | 0..n Medien pro Post — `image`, `video` oder `audio`, frei mischbar |
| `categories` | frei anlegbare Kategorien |
| `post_categories` | n:m-Verknüpfung |
| `pages` | Freitextseiten. Gleiche `tab_group` = Reiter derselben Seite, `position` bestimmt die Reihenfolge, `layout` die Darstellung |
| `links` | Einträge einer Seite: Label, URL, optional eine Zeile dazu. Trägt sowohl die Kontaktlinks als auch die Friends-Liste |
| `shoutouts` | Empfehlungen. Bewusst eine eigene Tabelle und nicht `posts` — ein Shoutout ist keine eigene Arbeit und soll im Portfolio nicht mitgezählt werden |
| `grid_rows`, `grid_cells` | die Anordnung des Portfolios (siehe oben) |
| `splashes` | die Zeilen unter dem Titel auf der Startseite. Kein Längenlimit, kein Umbruch außer an gesetzten Zeilenumbrüchen |
| `users` | Admin-Zugang, nur Passwort-**Hash** |
| `sessions` | offene Anmeldungen, nur der **Hash** des Session-Tokens |

### Seiten-Layouts

| `layout` | rendert |
|---|---|
| `prose` | Leerzeilen trennen Absätze, eine Zeile `## text` wird eine Zwischenüberschrift |
| `list` | jede Zeile ein Listeneintrag |
| `links` | `body` als optionaler Einleitungstext, Einträge aus `links`. Ohne Einträge: „coming soon …" |

Im Layout `list` gilt eine kleine Konvention, damit sich Gruppen ohne HTML
tippen lassen:

| Zeile | wird zu |
|---|---|
| `audio:` | Überschrift, eröffnet eine Gruppe |
| `mixing: hd 560s` | beschriftete Zeile in der laufenden Gruppe |
| alles andere | schlichter Eintrag |

### Zwischenspeicher

Die öffentliche API antwortet mit `max-age=0` und einem ETag: Der Browser
fragt jedes Mal nach und bekommt meist nur ein `304` zurück — billig und
immer aktuell. Bewusst **ohne** `stale-while-revalidate`; das lieferte nach
dem Anlegen bis zu eine Minute lang noch den alten Stand aus, was beim
eigenen Nachschauen nur verwirrt. `s-maxage` gilt nur für einen
vorgeschalteten Cache, nicht für den Browser.

### Anmeldung

- Passwörter werden mit **scrypt** aus dem Node-Standard gehasht (N=2¹⁵, r=8,
  32 Byte Salt). Bewusst ohne zusätzliche Abhängigkeit: kein natives Modul,
  das beim Aufsetzen wieder gebaut werden müsste.
- Die Session ist ein Zufallstoken im Cookie; in der Datenbank liegt nur dessen
  SHA-256-Hash. Ein Datenbank-Leck ergibt also keine gültige Session.
- Cookie: `httpOnly`, `sameSite=lax`, `secure` in Produktion.
- Jede schreibende Anfrage braucht zusätzlich das **CSRF-Token** der Session
  als `X-CSRF-Token`-Header.
- **Zweiter Faktor** (TOTP nach RFC 6238), optional pro Konto, mit acht
  Wiederherstellungs-Codes. Selbst gerechnet in `server/lib/totp.js` statt als
  Abhängigkeit — es ist ein HMAC und eine Modulo-Rechnung, und es lässt sich
  gegen die Testvektoren des Standards nachprüfen. Derselbe Code gilt nie
  zweimal (`totp_last_step`).
- **Begrenzung der Anmeldeversuche**: 10 Fehlversuche pro 15 Minuten und 30
  pro Tag, je IP. Gerechnet aus der Tabelle `login_attempts`, also **neustart-
  fest**. Abgewiesene Versuche zählen selbst nicht mit — sonst verlängerte
  jeder weitere Klick die eigene Sperre.
- **Jeder Versuch wird protokolliert**, in der Datenbank und als eine Zeile im
  Journal. Im Editor unter `account → login attempts` einsehbar; das
  Logformat ist für fail2ban gemacht (Filter in `SETUP.md`).
- Die Fehlermeldung verrät nicht, ob es den Benutzernamen gibt, und es wird
  auch ohne Treffer ein Hash geprüft, damit die Antwortzeit nichts preisgibt.
- `/admin` wird **vor** `express.static` abgeriegelt — sonst würde der
  statische Handler die Dateien vorher ungeschützt ausliefern.

### Uploads

Mehrere Dateien gleichzeitig, eine Anfrage pro Datei, damit jede ihre eigene
Fortschrittsanzeige hat (`XMLHttpRequest` — `fetch` kennt keinen
Upload-Fortschritt). Erlaubt sind Bild-, Video- und Audio-Typen aus einer
festen Liste; **SVG ausdrücklich nicht**, weil SVG Skripte enthalten kann.
Der Dateiname wird selbst vergeben, der Originalname geht nie in den Pfad ein.

Die Grenze steht in `MAX_UPLOAD_MB` (Standard 500, `0` schaltet sie ab). Der
Reverse Proxy hat sein eigenes Limit — siehe `SETUP.md`.

### Abgeleitete Medien

Die Übersicht zeigt **nie** das Original:

- **Videos** bekommen beim Upload ein Standbild (`media.poster`, per ffmpeg
  eine Sekunde hinein — Bild null ist oft schwarz). Die Kachel lädt damit
  **null Bytes** vom Video und spielt erst im Hover.
  `preload="metadata"` wäre keine Lösung: bei einem mp4, dessen moov-Atom am
  Ende liegt, holt der Browser dafür fast die ganze Datei.
- **Große Bilder** bekommen eine Fassung von 1200 px (`media.thumb`), ab
  300 kB Originalgröße. Ein Cover von 6372 × 6372 px und 46 MB wird damit
  zu 171 kB.

Gemessen an lumis acht Posts: die Übersicht lud **57 MB**, jetzt **1,45 MB**.

Nachträglich erzeugen: `npm run media:prepare` (idempotent, sichert vorher).
Ohne ffmpeg entfällt beides und die Seite funktioniert unverändert, nur
schwerer.

### Audio

**In der Übersicht** steht die Wellenform des Stücks, wie man sie von
SoundCloud kennt: Balken, an der Mittellinie gespiegelt. Sie wird beim Upload
einmal berechnet (`server/lib/waveform.js`) und als **1 kB** neben der Datei
abgelegt — aus 4 MB Audio. Die Kachel lädt die Audiodatei also nie.

Je Balken werden Spitzenwert und Effektivwert gemischt: der Spitzenwert allein
macht bei gemasterter Musik einen gleichmäßigen Block, der Effektivwert allein
sieht schlapp aus. Skaliert wird auf den lautesten Punkt der jeweiligen Datei,
damit leise Aufnahmen keine flache Linie sind.

Beim Überfahren zeigt eine Linie die Stelle, und der Link der Kachel bekommt
sie als `?t=` angehängt: ein Klick öffnet die Detailseite genau dort. Der Link
wird dabei nur umgeschrieben, nicht abgefangen — Mittelklick und Tastatur
funktionieren weiter.

**Auf der Detailseite** trägt dieselbe Wellenform den Abspielbalken: der
abgespielte Teil steht heller da, ein Klick oder Ziehen springt an die Stelle.
Darüber läuft ein **Partikelfeld**, gespeist aus einem `AnalyserNode`.

Das Feld spricht bewusst dieselbe Sprache wie der Hintergrund der Seite: dort
steht ein Punktraster im Wind, hier wird eines von der Musik geschoben. Jeder
Punkt hat einen Ruheplatz und ein Frequenzband — die Energie in seinem Band
drückt ihn nach außen und lässt ihn heller werden, eine Feder zieht ihn zurück.
Ein Bass-Anschlag (ein Sprung im gleitenden Mittel der untersten Bänder) stößt
das ganze Feld kurz auseinander.

**Die Lautstärke** wird durch Ziehen auf dem Partikelfeld geregelt, hoch lauter,
runter leiser — auf dem Handy deutlich angenehmer als ein schmaler Regler.
`touch-action: none` sorgt dafür, dass dabei nicht die Seite scrollt. Ein Klick
ohne Ziehen spielt ab oder hält an, Pfeiltasten regeln ebenfalls.

### YouTube

Gespeichert wird nur die Video-ID, egal in welcher Form die Adresse eingefügt
wurde. Angezeigt wird zuerst nur das Vorschaubild mit einem `play`-Knopf; der
Player von `youtube-nocookie.com` wird erst nach dem Klick eingehängt. Vorher
lädt nichts von YouTube außer dem Standbild.

### Mailadressen

Links, deren URL mit `mailto:` beginnt, werden von der API **zerlegt**
ausgeliefert (`{ user, domain }` statt `url`). Weder das HTML noch die
JSON-Antwort enthalten jemals `name@domain` am Stück; der Browser setzt die
Adresse erst zusammen, wenn jemand den Link berührt oder fokussiert.

Das hält Harvester ab, die Quelltext oder API-Antworten nach Mailmustern
durchsuchen — also die große Mehrheit. Gegen einen Scraper, der die Seite
rendert und JavaScript ausführt, hilft es **nicht**. Mehr ist ohne
Kontaktformular auch nicht zu holen.

Ein Post kann **nur Text**, **nur Bild**, **nur Ton**, **nur Video** oder jede
Mischung davon sein — nichts hängt voneinander ab. Ein Post ohne Medien ist
genauso gültig wie einer mit fünf.

### Die Anordnung

Das Portfolio ist **kein Zellenraster**. In einem Raster kann eine Zelle leer
bleiben — genau daraus entstehen Lücken. Hier gibt es keine Zellen:

- Eine **Zeile** verteilt ihre Breite unter ihren **Spalten**, gewichtet.
- Eine **Spalte** verteilt ihre Höhe unter ihren **Kacheln**.

Beides summiert sich immer auf das Ganze. Es gibt also keinen Platz, der zu
niemandem gehört — eine Lücke ist **nicht darstellbar**, nicht bloß
unwahrscheinlich. Das gilt auch beim Filtern: fällt eine Kachel weg, verteilt
sich ihr Platz auf die verbleibenden, weil die Gewichte relativ sind.

Das Gewicht ist damit ein **exaktes Verhältnis, kein Wunsch**: eine Spalte mit
Gewicht 1 neben einer mit 2 ist immer genau halb so breit.

| | |
|---|---|
| `grid_rows.units` | Höhe der Zeile, 1–4 Einheiten (eine Einheit = ein Viertel der Breite) |
| `grid_cells.weight` | Anteil an der Zeilenbreite, relativ zu den Nachbarspalten |
| `posts.cell_id`, `posts.slot` | in welcher Spalte, an welcher Stelle darin |

Gepflegt wird das im Editor unter **layout**: Zeilen anlegen und verschieben,
Höhe wählen, Spalten hinzufügen und gewichten, Posts einsortieren und stapeln.
Eine Vorschauleiste zeigt die Verhältnisse. Posts ohne Spalte hängen selbsttätig
hinten an, zwei je Zeile — ein neuer Post erscheint also ohne Zutun.

Auf schmalen Schirmen werden breite Zeilen in Stücke geteilt (höchstens zwei
Spalten unter 760 px, eine unter 460 px). Jedes Stück ist wieder eine volle
Zeile, also weiterhin lückenlos.

Sortiert der Besucher nach neuste/älteste/a–z, greift die eigene Anordnung
nicht mehr — dann werden Zeilen selbsttätig gebaut, ebenfalls lückenlos.

Nachgemessen im Browser über 40 zufällige Anordnungen bei drei Fensterbreiten
(120 Messungen): **größte Abweichung 0,03 px, keine leere Spalte gerendert.**

> Die Spalte `posts.size` aus dem alten Raster steht noch in der Datenbank,
> wird aber nirgends mehr benutzt.

---

## Abweichungen von `style.md`

Der Style Guide beschreibt eine Seite ohne Grid und ohne Scrollen. Ein Portfolio
braucht beides. Bewusst abgewichen wird an diesen Stellen:

1. **Das Portfolio scrollt**, alle anderen Seiten bleiben ein Viewport.
2. **Es gibt ein Grid** — aber ohne Karten-Optik: keine Schatten, keine
   Rundungen, keine Verläufe. Eine Kachel ist eine 1,5-px-Linie in
   `--altbgclr`, sonst nichts.
3. **Es gibt Fotos/Videos.** Im Raster laufen sie entsättigt und grün getönt
   (`mix-blend-mode: color`), volle Farbe erst im Hover und auf der Detailseite.
   Damit bleibt die Übersicht monochrom.
4. **Der Kacheltext sitzt auf einem deckenden Balken** in `--bgclr` — also auf
   einer Fläche, die der Guide so nicht vorsieht. Ohne ihn stünde der Text
   direkt auf dem Medium und wäre bei ähnlichem Farbton nicht mehr lesbar;
   bei Posts ohne Medium wirkte er außerdem verloren.
5. **`filter` wird animiert**, obwohl der Guide nur `opacity`, `color`,
   `background-color`, `stroke` und `font-style` vorsieht — anders lässt sich
   die Entsättigung nicht weich auflösen. Dauer und Easing bleiben bei
   `0.5s ease-in-out`.
6. **Die Navigation im Portfolio-Kopf ist dauerhaft sichtbar** statt „quiet".
   Auf einer scrollenden Arbeitsseite ist unklar, was „den Inhalt hovern"
   heißen soll. Auf Homepage, About und Detailseite ist die Quiet-UI aktiv.
7. **Focus/Dim dimmt auf `0.7` statt `0.12`.** Bei zehn Kacheln nebeneinander
   ist 0.12 unlesbar.
8. **Eigener Audio-Player.** Die nativen Browser-Controls sind hellgrau-weiß
   und würden die Palette sprengen; ersetzt durch Text-Button, dünne Linie und
   Zeitangabe in Xanh Mono.
9. **Kein Sample-and-Hold.** Der Guide nennt das pulsierende `scale` auf
   gehoverten Buttons ein Signature-Detail; im Gebrauch stört es. Der
   Hover-Effekt ist jetzt nur noch die Kursivstellung. Damit entfällt auch
   der Taktgeber in `site.js` und die Variable `--sh-value`.
10. **Chips sind kantig.** Der Guide erlaubt ihnen als einziger Komponente
    `border-radius: 4px` — damit waren sie die einzigen runden Elemente der
    Seite. Jetzt haben sie dieselben Ecken wie alle anderen Buttons.
11. **Der ausgewählte Chip nutzt `--titleclr`, nicht `--acntclr`.** Sonst
    steht neben dem Überschriften-Grün ein dritter Grünton in der Filterleiste.
    `--acntclr` bleibt für die Hover-Akzente reserviert (Kachelrahmen,
    Kacheltitel, Prev/Next, Fokus-Outline, Audio-Regler).
12. **Die About-Seite hat Reiter.** Der Guide kennt nur eine Spalte ohne
    Umschalter. Die Alternative wäre Scrollen gewesen — Reiter halten die
    Ein-Viewport-Regel, kosten dafür einen Klick.
13. **Fließtext auf der About-Seite ist linksbündig** in einer zentrierten
    Spalte. Der Guide zentriert alles; ab dem zweiten Absatz ist mittig
    geflatterter Satz aber mühsam zu lesen.
14. **Die Startseite hat ein Terminal.** Ein verschiebbares Fenster ist im
    Guide nicht vorgesehen — es hält sich aber an dessen Regeln: rechteckig,
    1,5-px-Linie in `--altbgclr`, kein Schatten, kein Radius, Xanh Mono.
    Eingeklappt ist es exakt die Footer-Zeile, die vorher dort stand.
15. **Nur ein Hintergrund-Sketch.** Der Guide würfelt bei jedem Besuch zwischen
    „roots" und „wheat"; „roots" ist vorerst stillgelegt. Die Datei liegt
    weiter unter `public/js/roots.js` — zum Reaktivieren genügt es, sie in
    `site.js` wieder in die Liste `scripts` aufzunehmen.

Alles andere folgt dem Guide: fünf Farben, zwei Schriften, Kleinschreibung,
`ease-in-out`, Quiet-UI, generativer Hintergrund, `✧` im `<title>`,
Kommentare deutsch, UI-Texte englisch.

## Barrierefreiheit

`prefers-reduced-motion` schaltet Übergänge und den animierten Hintergrund ab.
Filter-Chips sind echte Buttons mit `aria-pressed`, die Trefferzahl steht in
einem `aria-live`-Bereich, und Tastaturfokus deckt die Quiet-UI genauso auf wie
der Mauszeiger.
