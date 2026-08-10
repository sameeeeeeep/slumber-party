/* ============================================================================
   JIGSAW GEOMETRY — shared by /puzzle/wall and the dashboard's preview.

   Real interlocking pieces, not a grid of rectangles. Two things make that work:

   1. EVERY SEAM IS DECIDED ONCE, not per piece. The knob between two pieces has
      to be a tab on one side and a blank on the other, so the sign lives on the
      SEAM (H for vertical seams, V for horizontal) and both neighbours read it.
      Get this wrong and the picture has gaps and overlaps.

   2. A PIECE IS BIGGER THAN ITS CELL. A knob sticks out by TAB of a cell on each
      side, so the element is (1 + 2·TAB) cells across and the background has to be
      scaled and offset to compensate — see piece() for the arithmetic.

   The shape is one <clipPath> per edge signature in objectBoundingBox units, so
   it scales with the element and 44 pieces share at most a handful of paths. The
   signs come from a seeded PRNG keyed on the puzzle, so a projector that reloads
   mid-round draws exactly the same cut.
   ========================================================================== */
(function () {
  const TAB = 0.24;                 // knob reach, in cells

  /* mulberry32: small, fast, and the same sequence for the same seed in every
     browser — which is the only property that matters here */
  function rng(seed) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(seed).length; i++) {
      h ^= String(seed).charCodeAt(i); h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* the seams. H[y][x] is the seam between (x,y) and (x+1,y); V[y][x] between
     (x,y) and (x,y+1). +1 means the left/upper piece bulges into the other. */
  function seams(seed, cols, rows) {
    const r = rng(seed);
    const H = [], V = [];
    for (let y = 0; y < rows; y++) {
      H.push(Array.from({ length: Math.max(0, cols - 1) }, () => (r() < 0.5 ? -1 : 1)));
    }
    for (let y = 0; y < Math.max(0, rows - 1); y++) {
      V.push(Array.from({ length: cols }, () => (r() < 0.5 ? -1 : 1)));
    }
    return { H, V };
  }

  /* One edge, walked clockwise. u runs 0→1 along it; v is depth outwards from the
     piece. A flat edge is v=0 the whole way; a knob is the neck-head-neck curve
     below, which is the shape everyone recognises as a jigsaw. */
  const KNOB = [
    // [u, v] control triples for three cubics, then the run-out
    [[0.36, 0.00], [0.42, 0.05], [0.34, 0.10], [0.34, 0.16]],
    [[0.34, 0.26], [0.42, 0.30], [0.50, 0.30]],
    [[0.58, 0.30], [0.66, 0.26], [0.66, 0.16]],
    [[0.66, 0.10], [0.58, 0.05], [0.64, 0.00]],
  ];

  /* place a canonical (u,v) onto a given side of the cell, in CELL units */
  function put(side, u, v) {
    if (side === 0) return [u, -v];               // top,    out is up
    if (side === 1) return [1 + v, u];            // right,  out is right
    if (side === 2) return [1 - u, 1 + v];        // bottom, out is down
    return [-v, 1 - u];                           // left,   out is left
  }

  /* cell units → the element's own 0..1 box, which is TAB bigger on every side */
  const box = (n) => (n + TAB) / (1 + 2 * TAB);

  function edgePath(side, sign) {
    const pt = (u, v) => {
      const [x, y] = put(side, u, v * sign);
      return `${box(x).toFixed(4)} ${box(y).toFixed(4)}`;
    };
    if (!sign) {                                  // a flat outside edge
      const [u, v] = [1, 0];
      return ` L ${pt(u, v)}`;
    }
    let d = ` L ${pt(KNOB[0][0][0], KNOB[0][0][1])}`;
    d += ` C ${pt(KNOB[0][1][0], KNOB[0][1][1])}, ${pt(KNOB[0][2][0], KNOB[0][2][1])}, ${pt(KNOB[0][3][0], KNOB[0][3][1])}`;
    d += ` C ${pt(KNOB[1][0][0], KNOB[1][0][1])}, ${pt(KNOB[1][1][0], KNOB[1][1][1])}, ${pt(KNOB[1][2][0], KNOB[1][2][1])}`;
    d += ` C ${pt(KNOB[2][0][0], KNOB[2][0][1])}, ${pt(KNOB[2][1][0], KNOB[2][1][1])}, ${pt(KNOB[2][2][0], KNOB[2][2][1])}`;
    d += ` C ${pt(KNOB[3][0][0], KNOB[3][0][1])}, ${pt(KNOB[3][1][0], KNOB[3][1][1])}, ${pt(KNOB[3][2][0], KNOB[3][2][1])}`;
    d += ` L ${pt(1, 0)}`;
    return d;
  }

  /* the four edge signs for one piece, read off the seams */
  function signs(sm, i, cols, rows) {
    const x = i % cols, y = Math.floor(i / cols);
    return [
      y === 0 ? 0 : -sm.V[y - 1][x],              // top: the seam above, inverted
      x === cols - 1 ? 0 : sm.H[y][x],            // right
      y === rows - 1 ? 0 : sm.V[y][x],            // bottom
      x === 0 ? 0 : -sm.H[y][x - 1],              // left: the seam left, inverted
    ];
  }

  window.JIGSAW = {
    TAB,

    /* Every shape the grid needs, as one <svg> of clipPaths. Pieces with the same
       four signs share a path, so a 44-piece board defines a dozen or so rather
       than 44. */
    defs(seed, cols, rows) {
      const sm = seams(seed, cols, rows);
      const seen = new Map();
      for (let i = 0; i < cols * rows; i++) {
        const s = signs(sm, i, cols, rows);
        const key = s.join('');
        if (seen.has(key)) continue;
        let d = `M ${box(0).toFixed(4)} ${box(0).toFixed(4)}`;
        for (let side = 0; side < 4; side++) d += edgePath(side, s[side]);
        seen.set(key, d + ' Z');
      }
      const id = (key) => `jz-${String(seed).replace(/[^a-z0-9]/gi, '').slice(-8)}-${key.replace(/-/g, 'n')}`;
      return {
        svg: `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>` +
          [...seen].map(([key, d]) =>
            `<clipPath id="${id(key)}" clipPathUnits="objectBoundingBox"><path d="${d}"/></clipPath>`).join('') +
          `</defs></svg>`,
        clipFor: (i) => `url(#${id(signs(sm, i, cols, rows).join(''))})`,
      };
    },

    /* Where a piece sits, how big its element is, and how to place the image
       inside it. The element is TAB bigger on each side, so:
         background-size = cols / (1+2·TAB) of the element
         background-position solves p%·(box − image) = (TAB − x) cells
       At TAB=0 this reduces to x/(cols−1), the plain-grid formula it replaces. */
    piece(i, cols, rows) {
      const x = i % cols, y = Math.floor(i / cols);
      const k = 1 + 2 * TAB;
      const px = (TAB - x) / (k - cols) * 100;
      const py = (TAB - y) / (k - rows) * 100;
      return {
        x, y,
        inset: `${-TAB * 100}%`,
        bgSize: `${(cols / k) * 100}% ${(rows / k) * 100}%`,
        bgPos: `${px.toFixed(4)}% ${py.toFixed(4)}%`,
      };
    },
  };
})();
