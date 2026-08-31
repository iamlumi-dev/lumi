// sketch 1 — "roots": linienzuege wachsen von zufaelligen bildschirmraendern nach innen.
// die instanz wird abgelegt, damit "theme" sie entfernen kann
window.__bgInstance = new p5((s) => {
  const MAX_ROOTS = 100;
  const SPAWN_EVERY = 90;
  const STEP = 8;              // pixel pro wachstumsschritt
  let roots = [];

  class Root {
    constructor(x, y, angle, width) {
      this.angle = angle;
      this.width = width ?? s.random(6, 12);
      this.taper = s.random(0.92, 0.98);
      this.noiseSeed = s.random(1000);
      this.t = 0;
      this.alpha = 90;
      this.dying = false;
      // der ganze bisherige pfad — der hintergrund wird jeden frame geloescht,
      // also muss die wurzel ihre eigene spur kennen und neu zeichnen.
      this.points = [{ x, y, w: this.width }];
    }

    grow() {
      if (this.dying) { this.alpha -= 0.15; return; }

      const last = this.points[this.points.length - 1];

      // perlin-noise lenkt sanft ab …
      this.angle += (s.noise(this.noiseSeed + this.t) - 0.5) * 0.6;
      // … und gelegentlich knickt die wurzel hart ab
      if (s.random() < 0.02) this.angle += s.random(-1, 1);

      const x = last.x + Math.cos(this.angle) * STEP;
      const y = last.y + Math.sin(this.angle) * STEP;
      this.width *= this.taper;
      this.t += 0.08;
      this.points.push({ x, y, w: this.width });

      if (this.width < 0.5 || x < -80 || x > s.width + 80 || y < -80 || y > s.height + 80) {
        this.dying = true;
      }

      // verzweigung
      if (roots.length < MAX_ROOTS && s.random() < 0.08) {
        roots.push(new Root(x, y, this.angle + s.random(-0.9, 0.9), this.width * 0.7));
      }
    }

    draw() {
      const a = Math.max(this.alpha, 0);
      if (a <= 0) return;
      for (let i = 1; i < this.points.length; i++) {
        const p0 = this.points[i - 1];
        const p1 = this.points[i];
        s.stroke(168, 179, 135, a);
        s.strokeWeight(Math.max(p1.w, 0.3));
        s.line(p0.x, p0.y, p1.x, p1.y);
      }
    }

    get dead() {
      return this.alpha <= 0;
    }
  }

  // startpunkt auf einem zufaelligen rand, richtung grob zur bildmitte
  function spawn(forcedEdge) {
    const edge = forcedEdge ?? Math.floor(s.random(4));
    let x, y;
    if (edge === 0)      { x = 0;        y = s.random(s.height); }
    else if (edge === 1) { x = s.width;  y = s.random(s.height); }
    else if (edge === 2) { x = s.random(s.width);  y = 0; }
    else                 { x = s.random(s.width);  y = s.height; }
    const angle = Math.atan2(s.height / 2 - y, s.width / 2 - x) + s.random(-0.6, 0.6);
    roots.push(new Root(x, y, angle));
  }

  s.setup = () => {
    const c = s.createCanvas(s.windowWidth, s.windowHeight);
    c.parent('p5-bg-container');
    s.strokeJoin(s.BEVEL);
    s.strokeCap(s.SQUARE);
    s.noFill();
    for (let i = 0; i < 8; i++) spawn(i % 4);   // je zwei pro kante
  };

  s.draw = () => {
    s.background(20, 24, 20);
    if (s.frameCount % SPAWN_EVERY === 0 && roots.length < MAX_ROOTS) spawn();

    // erst alle wachsen lassen, dann zeichnen — sonst zeichnet man neue
    // zweige mitten in der schleife, die sie gerade erzeugt hat
    const current = roots.slice();
    for (const r of current) r.grow();
    for (const r of roots) r.draw();

    roots = roots.filter((r) => !r.dead);
  };

  s.windowResized = () => s.resizeCanvas(s.windowWidth, s.windowHeight);
}, 'p5-bg-container');
