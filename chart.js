// Hand-drawn canvas charts. No library. DPR aware.
const Charts = (() => {
  const C = { green: "#00d35a", red: "#ff453a", blue: "#0a84ff", orange: "#ff9f0a", t2: "rgba(235,235,245,0.6)", t3: "rgba(235,235,245,0.3)", c2: "#2c2c2e" };
  function setup(cv) {
    const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    return [g, r.width, r.height];
  }
  function dashed(g, x0, x1, y, color) { g.save(); g.setLineDash([4, 4]); g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.restore(); }

  // Balance line: points [{t,v}], marks [{t,kind,text}], start value
  function line(cv, pts, marks, start, progress = 1) {
    const [g, W, H] = setup(cv);
    const top = 64, bot = H - 14;
    if (!pts.length) { const y = (top + bot) / 2; dashed(g, 0, W, y, C.t3); return; }
    const ts = pts.map(p => +new Date(p.t)), vs = pts.map(p => p.v).concat([start]);
    let t0 = ts[0], t1 = Math.max(ts[ts.length - 1], t0 + 60000);
    let lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * .12; lo -= pad; hi += pad;
    const X = t => 8 + (W - 16) * (t - t0) / (t1 - t0), Y = v => bot - (bot - top) * (v - lo) / (hi - lo);
    dashed(g, 0, W, Y(start), C.t3);
    const n = Math.max(2, Math.ceil(pts.length * progress));
    const P = pts.slice(0, n).map(p => [X(+new Date(p.t)), Y(p.v)]);
    if (P.length === 1) P.push([W - 8, P[0][1]]);
    const grad = g.createLinearGradient(0, top, 0, bot); grad.addColorStop(0, "rgba(0,211,90,0.28)"); grad.addColorStop(1, "rgba(0,211,90,0)");
    g.beginPath(); g.moveTo(P[0][0], bot); P.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(P[P.length - 1][0], bot); g.closePath(); g.fillStyle = grad; g.fill();
    g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.strokeStyle = C.green; g.lineWidth = 2; g.lineJoin = "round"; g.stroke();
    const last = P[P.length - 1]; g.fillStyle = C.green; g.beginPath(); g.arc(last[0], last[1], 4, 0, 7); g.fill();
    // marks above the line; never overlap: a later mark moves up a row
    g.font = "600 11px -apple-system, sans-serif"; const placed = [];
    (marks || []).forEach(m => {
      const t = +new Date(m.t); if (t < t0 || t > t1) return;
      const x = X(t), w = g.measureText(m.text).width + 12; let row = 0;
      while (placed.some(p => p.row === row && Math.abs(p.x - x) < (p.w + w) / 2 + 4)) row++;
      placed.push({ x, w, row });
      const y = 6 + (2 - Math.min(row, 2)) * 20, col = m.kind === "bought" ? C.blue : m.kind === "sold" ? C.green : C.red;
      const bx = Math.min(Math.max(x - w / 2, 2), W - w - 2);
      g.globalAlpha = .18; g.fillStyle = col; rr(g, bx, y, w, 17, 8); g.fill(); g.globalAlpha = 1;
      g.fillStyle = col; g.fillText(m.text, bx + 6, y + 12.5);
      g.strokeStyle = col; g.globalAlpha = .4; g.beginPath(); g.moveTo(x, y + 17); g.lineTo(x, bot); g.setLineDash([2, 3]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    });
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // Candles [{t,o,h,l,c,v}] with volume bars; exitLine = orange dashed "Risk trailing stop"
  function candles(cv, cs, exitLine, entry) {
    const [g, W, H] = setup(cv);
    if (!cs.length) { dashed(g, 0, W, H / 2, C.t3); return; }
    const volH = 40, top = 10, bot = H - volH - 8;
    let lo = Math.min(...cs.map(c => c.l)), hi = Math.max(...cs.map(c => c.h));
    if (exitLine) { lo = Math.min(lo, exitLine); hi = Math.max(hi, exitLine); }
    if (entry) { lo = Math.min(lo, entry); hi = Math.max(hi, entry); }
    if (hi - lo <= 0) { hi *= 1.01; lo *= .99; }
    const Y = v => bot - (bot - top) * (v - lo) / (hi - lo), n = cs.length, cw = Math.max(2, Math.min(10, (W - 60) / n * .7)), step = (W - 60) / Math.max(n, 1);
    const vmax = Math.max(...cs.map(c => c.v), 1e-9);
    cs.forEach((c, i) => {
      const x = 8 + i * step + step / 2, up = c.c >= c.o, col = up ? C.green : C.red;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
      const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); g.fillRect(x - cw / 2, y1, cw, Math.max(1, y2 - y1));
      g.globalAlpha = .45; const vh = (volH - 4) * c.v / vmax; g.fillRect(x - cw / 2, H - vh - 2, cw, vh); g.globalAlpha = 1;
    });
    g.font = "11px -apple-system, sans-serif";
    if (entry) { dashed(g, 0, W - 52, Y(entry), C.t3); }
    if (exitLine) {
      g.save(); g.setLineDash([6, 4]); g.strokeStyle = C.orange; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, Y(exitLine)); g.lineTo(W - 52, Y(exitLine)); g.stroke(); g.restore();
      g.fillStyle = C.orange; g.fillText("Risk trailing stop", 8, Y(exitLine) - 5);
    }
    g.fillStyle = C.t2; g.fillText(fmtP(hi), W - 50, top + 10); g.fillText(fmtP(lo), W - 50, bot);
  }
  function fmtP(p) { return p >= 1 ? p.toFixed(2) : p.toPrecision(3); }

  function ring(cv, score, thr) {
    const [g, W, H] = setup(cv); const r = Math.min(W, H) / 2 - 8, cx = W / 2, cy = H / 2;
    g.lineWidth = 12; g.lineCap = "round"; g.strokeStyle = C.c2; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    if (score != null) { g.strokeStyle = score >= thr ? C.green : "#ffd60a"; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * score / 100); g.stroke(); }
    g.fillStyle = "#fff"; g.font = "600 34px -apple-system, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(score == null ? "–" : score, cx, cy);
  }
  return { line, candles, ring };
})();
