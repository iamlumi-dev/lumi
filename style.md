# Style Guide — "madebystockkii"

Dieses Dokument beschreibt **ausschließlich das visuelle Design** der Website
`madebystockkii`. Es ist als Vorlage für eine andere KI gedacht, die eine
*inhaltlich völlig andere* Website im *gleichen Look & Feel* bauen soll.
Konzept, Inhalte und Seitenstruktur sind **nicht** Teil dieser Vorgabe —
nur das Aussehen und das Verhalten der Oberfläche.

---

## 1. Gesamteindruck in einem Satz

Ein dunkles, fast schwarzgrünes Terminal-Fenster, in dem hinter dem Inhalt
langsam etwas Organisches wächst (Wurzeln oder ein Weizenfeld aus Punkten) —
minimalistisch, zentriert, mit sehr wenig UI, das sich erst beim Hover
zu erkennen gibt. Ruhig, botanisch, leicht mystisch, bewusst „unfertig"
und handgemacht statt poliert.

Stichworte: *dark botanical*, *terminal aesthetic*, *generative art*,
*ultra-minimal*, *quiet UI*, *nichts schreit*.

---

## 2. Farbpalette

Fünf CSS-Custom-Properties, mehr gibt es nicht. Keine weiteren Farben erfinden.

```css
:root {
    --bgclr:    #0B1306;  /* Hintergrund: sehr dunkles, entsättigtes Waldgrün-Schwarz */
    --txtclr:   #cce3c3;  /* Fließtext: helles, mildes Salbeigrün */
    --titleclr: #B5E19E;  /* Überschriften/Footer: helleres, sattes Blattgrün */
    --altbgclr: #36611E;  /* Flächen: mittleres Moosgrün (Buttons, Chips, Linien) */
    --acntclr:  #6CC23D;  /* Akzent: kräftiges Grasgrün, nur für aktive Zustände */
}
```

Regeln:

- **Monochrom grün.** Es gibt keine zweite Farbfamilie. Kein Blau, kein Rot,
  kein Orange — auch nicht für Fehler oder Hinweise. Wenn Differenzierung
  nötig ist: über Helligkeit, Opazität oder Kursivschrift, nicht über Farbton.
- **Kein reines Weiß und kein reines Schwarz.** `#0B1306` ist das dunkelste,
  `#cce3c3` das hellste Element.
- `--acntclr` ist **sparsam**: nur für den gerade aktiven/gehoverten Ast eines
  interaktiven Elements. Nie als Flächenfarbe für ganze Blöcke.
- Wenn ein aktives Element `--acntclr` als Hintergrund bekommt, wird sein Text
  auf `--bgclr` invertiert (dunkler Text auf hellem Grün).
- Der Canvas-Hintergrund nutzt zwei feste RGB-Werte außerhalb der Variablen:
  Löschfarbe `rgb(20, 24, 20)` und Zeichenfarbe `rgb(168, 179, 135)`
  (ein staubiges Olivgrün). Diese beibehalten.

---

## 3. Typografie

Zwei Google Fonts, konsequent aufgeteilt:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cal+Sans&family=Xanh+Mono:ital@0;1&display=swap" rel="stylesheet">
```

| Rolle | Font | Einsatz |
|---|---|---|
| Display / Überschriften | **Cal Sans**, sans-serif | `h1`, Mittelpunkt-Labels — freundlich-geometrisch, leicht rund |
| Alles andere | **Xanh Mono**, monospace | Fließtext, Buttons, Footer, Labels, Listen |

Regeln:

- **Alles ist kleingeschrieben.** Titel, Buttons, Navigation, Footer:
  `whoami`, `hardware`, `socials`, `shop`, `back`, `coming soon …`.
  Kein Title Case, kein ALL CAPS, keine `text-transform`-Tricks — der Text
  wird einfach klein geschrieben.
- Nur ein Schriftschnitt pro Font (400 regular). Für Xanh Mono existiert
  zusätzlich der **Italic** — und der ist ausschließlich ein *Hover-Effekt*,
  keine semantische Auszeichnung.
- Keine `font-size`-Skala mit vielen Stufen. Faktisch verwendet:
  Browser-Default für `h1`, `2rem` für zentrale Labels, `0.85rem` für
  Detail-Einträge. Mehr Stufen sind nicht nötig.
- `line-height` bleibt Default; nur bei mehrzeiligen Kleintexten `1.2`.
- Kein `letter-spacing`, kein `text-shadow`, keine Verläufe auf Text.
- Typografische Details: `&copy;`, `…` als echtes Ellipsen-Zeichen,
  `✧` als Trenner in `<title>`-Tags (`seitenname ✧ madebystockkii`).

---

## 4. Layout

```
┌─────────────────────────────────────────────┐
│  (generativer p5-Canvas, fixed, z-index:-1) │
│                                             │
│              ┌───────────────┐              │
│              │   TITEL (h1)  │              │
│              │   inhalt      │              │
│              │  [b][b][b][b] │              │
│              └───────────────┘              │
│                                             │
│ © footer                                    │
└─────────────────────────────────────────────┘
```

- `body` ist ein **Flex-Container**: `column`, `justify-content: center`,
  `align-items: center`, `min-height: 100vh`, `margin: 0`.
  Der Inhalt sitzt also immer **vertikal und horizontal mittig**.
- Ein einziger Content-Wrapper (`#middleSection`) mit `width: 50%`.
  Für Ansichten, die mehr Platz brauchen, eine Modifier-Klasse:
  `width: min(92vw, 720px)`.
- **Kein Grid, keine Sidebar, keine Navbar, keine Cards, keine Sections
  mit Hintergrundfarbe.** Es gibt genau eine Spalte in der Bildschirmmitte.
- Der Titel-Block hat eine feste Höhe von `10vh` und zentriert seinen Inhalt.
- Die Button-Reihe ist ein Flex-Row, `max-width: 500px`, zentriert.
- Der Footer klebt absolut in der **linken unteren Bildschirmecke**
  (`position: absolute; bottom: 0; left: 0; margin: 0`) — nicht zentriert,
  nicht als Balken. Nur eine kleine Zeile in `--titleclr`.
- Es wird **nicht gescrollt**. Jede Seite ist ein Viewport.

---

## 5. Komponenten

### Buttons

Das einzige echte UI-Element. Rechteckig, flach, klein.

```css
button {
  font-family: "xanh mono";
  background-color: var(--altbgclr);
  color: var(--txtclr);
  border: none;
  width: 100%;
  max-width: 70px;
  transition: color 0.8s ease-in-out;
}
button:hover {
  font-style: italic;
  scale: var(--sh-value);
}
```

- **Kein `border-radius`** (Ausnahme: Chips/Kategorie-Labels mit `4px`).
- Kein Rand, kein Schatten, kein Verlauf, kein Icon.
- Buttons werden in `<a href="…"><button>…</button></a>` gewickelt.
- Sehr schmal (`max-width: 70px`) — die Labels sind absichtlich kurze
  Ein-Wort-Begriffe.

### Chips / Kategorie-Labels

`--altbgclr` als Fläche, `--txtclr` als Text, `padding: 0.3rem 0.6rem`,
`border-radius: 4px`, Xanh Mono. Im aktiven Zustand: Fläche `--acntclr`,
Text `--bgclr`.

### Verbindungslinien (SVG)

Wenn Elemente verbunden werden: dünne SVG-`line`s, `stroke: var(--altbgclr)`,
`stroke-width: 1.5` (aktiv: `--acntclr`, `2`). Keine Pfeilspitzen,
keine gestrichelten Linien, keine Kurven.

---

## 6. Interaktion & Motion — das Herzstück

Der Charakter der Seite entsteht durch drei Bewegungs-Ideen. Diese sind
das Wichtigste beim Nachbau.

### a) Quiet UI: Navigation verschwindet, bis man hinschaut

Auf Geräten mit echtem Zeiger ist die Button-Leiste fast unsichtbar
(`opacity: .1`, Text `transparent`) und wird erst sichtbar, wenn der Nutzer
den Content-Wrapper hovert. Auf Touch-Geräten (kein Hover) bleibt sie
dauerhaft sichtbar.

```css
@media (hover: hover) and (pointer: fine) {
  #selections { opacity: .1; }
  #selections button { color: transparent; }
  #middleSection:hover #selections { opacity: 1; }
  #middleSection:hover #selections button { color: var(--txtclr); }
}
```

Der Übergang ist **langsam**: `transition: opacity 0.5s ease-in-out` am
Container, `color 0.8s ease-in-out` am Button. Nichts poppt.

### b) Sample-and-Hold Hover-Scale

Ein kleines Script schreibt alle **115 ms** eine neue Zufallszahl zwischen
`1.05` und `1.25` in die CSS-Variable `--sh-value`. Buttons benutzen sie als
`scale` im Hover. Ergebnis: ein gehoverter Button **zittert/pulsiert
unregelmäßig** — wie ein Modular-Synth-Sample-and-Hold. Das ist ein
Signature-Detail, nicht Deko.

```js
function startSampleAndHold(min, max, holdTime) {
    function sample() {
        const value = Math.random() * (max - min) + min;
        document.documentElement.style.setProperty('--sh-value', value.toFixed(3));
        setTimeout(sample, holdTime);
    }
    sample();
}
startSampleAndHold(1.05, 1.25, 115);
```

Zusätzlich kippt der Button-Text beim Hover auf `font-style: italic`.

### c) Focus/Dim bei zusammenhängenden Gruppen

Hovert man ein Element einer Gruppe, wird die ganze Gruppe auf `--acntclr`
hervorgehoben und **alles andere auf `opacity: 0.12` gedimmt** (Klasse
`.mm-focusing` am Container, `.mm-active` an den Mitgliedern). Übergänge
jeweils `0.3s ease-in-out`.

### Motion-Grundregeln

- Easing immer `ease-in-out`.
- Dauern: `0.3s` für Zustandswechsel innerhalb einer Gruppe,
  `0.5s`–`0.8s` für Auftauchen/Verschwinden von UI, `1s` für Page-Load.
- Animiert werden nur `opacity`, `color`, `background-color`, `stroke`,
  `scale`, `font-style`. **Keine** Slide-ins, keine Bounces, kein Parallax.

---

## 7. Der generative Hintergrund (p5.js)

Pflicht-Bestandteil des Looks. Ein fixierter Canvas hinter allem:

```html
<div id="p5-bg-container" style="position: fixed; inset: 0; z-index: -1; pointer-events: none;"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
```

Beim Laden wird **zufällig eine von zwei Sketches** nachgeladen — die Seite
sieht bei jedem Besuch anders aus:

```js
const scripts = ['js/roots.js', 'js/wheat.js'];
const chosenScript = scripts[Math.floor(Math.random() * scripts.length)];
const scriptTag = document.createElement('script');
scriptTag.src = chosenScript;
document.body.appendChild(scriptTag);
```

**Sketch 1 — „roots":** Von zufälligen Bildschirmrändern wachsen Linienzüge
nach innen. Jede Wurzel hat eine Startdicke (6–12 px), verjüngt sich pro
Schritt (`×0.92–0.98`), lenkt per Perlin-Noise ab, knickt gelegentlich
zufällig ab und verzweigt sich mit 8 % Wahrscheinlichkeit. Ist sie zu dünn
oder außerhalb, verblasst sie langsam (`alpha -= 0.15`) und wird entfernt.
Alle 90 Frames spawnt eine neue, max. 100 gleichzeitig.
Strichfarbe `rgba(168, 179, 135, ~90)`, `strokeJoin(BEVEL)`,
`strokeCap(SQUARE)`, `noFill()`. Hintergrund pro Frame `background(20,24,20)`.

**Sketch 2 — „wheat":** Ein Raster aus Punkten im Abstand von 22 px. Jeder
Punkt wird per 3D-Perlin-Noise verschoben (±18 px / ±12 px) und bekommt aus
demselben Noise-Wert seine Größe (1.5–3.5 px) und Alpha (15–140). Die
z-Achse läuft mit `0.005` pro Frame weiter → das Feld „weht" sehr langsam.
Farbe wieder `rgb(168, 179, 135)`. Hintergrund `background(20,24,20,170)`
(teiltransparent → leichte Nachzieh-Spur).

Gemeinsame Merkmale, die man beim Nachbau treffen muss:

- **Sehr langsam.** Nichts blitzt, nichts zuckt.
- **Niedriger Kontrast.** Der Hintergrund darf den Text nie stören.
- **Perlin-Noise statt harter Zufall** für die Bewegung.
- `windowResized` → `resizeCanvas` ist immer implementiert.
- `pointer-events: none`, der Canvas ist rein dekorativ.

---

## 8. Technische Konventionen

- **Plain HTML/CSS/JS.** Kein React, kein Tailwind, kein Build-Step nötig
  (im Projekt liegt zwar Eleventy in `package.json`, benutzt wird es nicht).
- Ein einziges globales Stylesheet `css/style.css`, per `<link>` eingebunden.
  CSS ist mit Kommentar-Bannern in Blöcke geteilt:
  `/*=== GENERAL STYLING ===*/`, `/*=== FONTS ===*/`, …
- Verschachtelte CSS-Regeln (native Nesting) werden verwendet — kein Präprozessor.
- Jede Unterseite ist ein eigenes `index.html` in einem eigenen Ordner
  (`/whoami/`, `/shop/` …) und dupliziert Head, Canvas und die beiden
  Inline-Scripts. Das ist gewollt simpel.
- IDs statt Klassen für Layout-Elemente (`#middleSection`, `#selections`,
  `#content`, `#title`), Klassen nur für Komponenten-Varianten.
- Responsive nur über zwei Mechanismen: `@media (max-width: 280px)`
  (Buttons stapeln) und `@media (hover: hover) and (pointer: fine)`
  (Quiet-UI an/aus). Keine Breakpoint-Kaskade.
- Kommentare im Code auf Deutsch, UI-Texte auf Englisch.

---

## 9. Do / Don't

**Do**
- Alles zentrieren, viel leerer Raum.
- Kleinschreibung überall.
- Langsame, weiche Übergänge.
- UI zurückhaltend halten — lieber ein Element weglassen.
- Den lebendigen Canvas-Hintergrund als Träger der Atmosphäre nutzen.
- Grün, Grün, Grün.

**Don't**
- Keine Karten, Boxen, Panels, Schatten, Glassmorphism, Verläufe.
- Keine Icons, keine Emojis in der UI (Ausnahme: `✧` im `<title>`).
- Keine zweite Akzentfarbe, kein Light-Mode.
- Keine Scroll-Animationen, kein Parallax, keine großen Hero-Bilder.
- Keine Rundungen über 4 px.
- Keine Fotos oder Illustrationen — Grafik entsteht nur generativ.

---

## 10. Copy-Paste-Basis

Minimales Grundgerüst für eine neue Seite in diesem Stil:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>seitenname ✧ projektname</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cal+Sans&family=Xanh+Mono:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="p5-bg-container" style="position: fixed; inset: 0; z-index: -1; pointer-events: none;"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>

  <div id="middleSection">
    <header><div id="title"><h1>seitenname</h1></div></header>
    <main id="content"><p>coming soon …</p></main>
    <div id="selections">
      <a href="../"><button>back</button></a>
    </div>
    <footer><p>&copy; made by … 2026</p></footer>
  </div>

  <script>/* zufälligen Background-Sketch laden */</script>
  <script>/* startSampleAndHold(1.05, 1.25, 115) */</script>
</body>
</html>
```

---

## Anmerkung

`stockkii/hardware/test.html` enthält einen **verworfenen** hellen Entwurf
(warmes Studio-Weiß `#fbfaf7`, Playfair-Display-Serife, Beige-Linien).
Der gehört **nicht** zum Design-System und darf nicht als Referenz dienen.
Maßgeblich ist ausschließlich `stockkii/css/style.css` plus die drei
JS-Dateien.
