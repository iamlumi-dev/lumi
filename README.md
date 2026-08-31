# lumiswork

Portfolio-Website von lumi. Dunkles, botanisches Terminal-Design nach
[`style.md`](style.md), mit einem filterbaren Portfolio-Grid.

**Zum Aufsetzen auf einem Server → [`SETUP.md`](SETUP.md).**

---

## Was drin ist

- **Homepage** — ein Viewport, zentriert, generativer p5-Hintergrund.
- **`/portfolio/`** — Grid aus Posts in fünf wählbaren Kachelgrößen,
  filterbar nach frei anlegbaren Kategorien, sortierbar nach neuste/älteste/a–z.
  Filter und Sortierung stehen in der URL und sind damit teilbar.
- **`/portfolio/<slug>`** — Detailseite eines Posts.
- **`/about/`** — Platzhalter, Inhalt kommt noch.
- **JSON-API** unter `/api` — liefert nur veröffentlichte Inhalte, nur lesend.

## Was noch fehlt

- **Admin-Login und Post-Editor.** Datenbank und Server sind darauf vorbereitet
  (Tabelle `users`, Einhängepunkte in `server/index.js`), gebaut ist es noch nicht.
  Details in [`SETUP.md`](SETUP.md#was-noch-fehlt).
- **Der About-Text.** Steht als Platzhalter in der Tabelle `pages`.

---

## Schnellstart lokal

```bash
npm install
npm rebuild better-sqlite3     # nur nötig, wenn npm die Install-Scripts blockt
cp .env.example .env
npm run setup                  # Schema anlegen + Demo-Inhalte
npm run dev                    # http://localhost:3000
```

`npm run db:seed -- --reset` überschreibt die Demo-Inhalte, `npm run db:migrate`
legt nur das Schema an (idempotent, gefahrlos wiederholbar).

---

## Aufbau

```
server/
  index.js        Express: statische Dateien, Sicherheits-Header, Routen
  config.js       Konfiguration aus .env, Marke (Name, Jahr) an einer Stelle
  db.js           SQLite-Verbindung (better-sqlite3, WAL)
  schema.sql      Datenbankschema, idempotent
  routes/api.js   öffentliche, lesende API
  lib/posts.js    Datenzugriff auf Posts, Medien, Kategorien
  lib/slug.js     URL-taugliche Slugs (inkl. Umlaute)

public/
  index.html          Homepage
  about/index.html    Über mich
  portfolio/index.html   Grid
  portfolio/post.html    Hülle der Detailseite
  404.html
  css/style.css       das gesamte Design-System, in Blöcke kommentiert
  js/site.js          Hintergrund-Sketch würfeln + Sample-and-Hold
  js/roots.js         generativer Hintergrund, Variante 1
  js/wheat.js         generativer Hintergrund, Variante 2
  js/portfolio.js     Grid, Filter, Sortierung
  js/post.js          Detailseite inkl. eigenem Audio-Player
  uploads/            hochgeladene Medien (nicht im Repo)

scripts/
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
| `pages` | Freitextseiten wie „about" |
| `users` | Admin-Zugang (noch ungenutzt, nur Passwort-**Hash**) |

Ein Post kann **nur Text**, **nur Bild**, **nur Ton**, **nur Video** oder jede
Mischung davon sein — nichts hängt voneinander ab. Ein Post ohne Medien ist
genauso gültig wie einer mit fünf.

### Kachelgrößen

| `size` | Fläche | gedacht für |
|---|---|---|
| `small` | 1 × 1 | Standard |
| `wide` | 2 × 1 | Querformate |
| `tall` | 1 × 2 | Hochformate |
| `large` | 2 × 2 | Hauptarbeiten |
| `banner` | volle Breite × 1 | Trenner, breite Panoramen |

Alle Größen sind ganzzahlige Vielfache derselben Zelle, und das Grid läuft mit
`grid-auto-flow: dense`. Dadurch packt sich jede beliebige Mischung lückenlos —
egal in welcher Reihenfolge die Posts stehen. Auf schmalen Bildschirmen werden
die Spannweiten gekappt (3 Spalten ab 1100 px, 2 ab 760 px, 1 ab 460 px; bei
einer Spalte wird jede Kachel quadratisch).

---

## Abweichungen von `style.md`

Der Style Guide beschreibt eine Seite ohne Grid und ohne Scrollen. Ein Portfolio
braucht beides. Bewusst abgewichen wird an genau diesen Stellen:

1. **Das Portfolio scrollt**, alle anderen Seiten bleiben ein Viewport.
2. **Es gibt ein Grid** — aber ohne Karten-Optik: keine Schatten, keine
   Rundungen, keine Flächenfarben. Eine Kachel ist eine 1,5-px-Linie in
   `--altbgclr`, sonst nichts.
3. **Es gibt Fotos/Videos.** Im Raster laufen sie entsättigt und grün getönt
   (`mix-blend-mode: color`), volle Farbe erst im Hover und auf der Detailseite.
   Damit bleibt die Übersicht monochrom.
4. **`filter` wird animiert**, obwohl der Guide nur `opacity`, `color`,
   `background-color`, `stroke`, `scale` und `font-style` vorsieht — anders
   lässt sich die Entsättigung nicht weich auflösen. Dauer und Easing bleiben
   bei `0.5s ease-in-out`.
5. **Die Navigation im Portfolio-Kopf ist dauerhaft sichtbar** statt „quiet".
   Auf einer scrollenden Arbeitsseite ist unklar, was „den Inhalt hovern"
   heißen soll. Auf Homepage, About und Detailseite ist die Quiet-UI aktiv.
6. **Focus/Dim dimmt auf `0.35` statt `0.12`.** Bei zehn Kacheln nebeneinander
   ist 0.12 unlesbar.
7. **Eigener Audio-Player.** Die nativen Browser-Controls sind hellgrau-weiß
   und würden die Palette sprengen; ersetzt durch Text-Button, dünne Linie und
   Zeitangabe in Xanh Mono.

Alles andere folgt dem Guide: fünf Farben, zwei Schriften, Kleinschreibung,
`ease-in-out`, Sample-and-Hold auf gehoverten Buttons, generativer Hintergrund,
`✧` im `<title>`, Kommentare deutsch, UI-Texte englisch.

## Barrierefreiheit

`prefers-reduced-motion` schaltet Übergänge, den Sample-and-Hold-Scale und den
animierten Hintergrund ab. Filter-Chips sind echte Buttons mit `aria-pressed`,
die Trefferzahl steht in einem `aria-live`-Bereich, und Tastaturfokus deckt die
Quiet-UI genauso auf wie der Mauszeiger.
