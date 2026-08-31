// sketch 2 — "wheat": ein punktraster, das per 3d-noise sehr langsam weht.
// die instanz wird abgelegt, damit "theme" sie entfernen kann
window.__bgInstance = new p5((s) => {
  const GAP = 22;
  let z = 0;

  s.setup = () => {
    const c = s.createCanvas(s.windowWidth, s.windowHeight);
    c.parent('p5-bg-container');
    s.noStroke();
    s.background(20, 24, 20);
  };

  s.draw = () => {
    // teiltransparent → leichte nachzieh-spur
    s.background(20, 24, 20, 170);

    for (let y = GAP / 2; y < s.height; y += GAP) {
      for (let x = GAP / 2; x < s.width; x += GAP) {
        const n = s.noise(x * 0.01, y * 0.01, z);
        const m = s.noise(x * 0.01 + 100, y * 0.01 + 100, z);

        const ox = s.map(n, 0, 1, -18, 18);
        const oy = s.map(m, 0, 1, -12, 12);
        const size = s.map(n, 0, 1, 1.5, 3.5);
        const alpha = s.map(m, 0, 1, 15, 140);

        s.fill(168, 179, 135, alpha);
        s.circle(x + ox, y + oy, size);
      }
    }

    z += 0.005;
  };

  s.windowResized = () => s.resizeCanvas(s.windowWidth, s.windowHeight);
}, 'p5-bg-container');
