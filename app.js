// Grok Bot desk — Plan B: polls JSON under /d/{DATA_PATH}/ every 15s. Every FOMO URL comes from the JSON (links.py).
(() => {
  const POLL = 15000, $ = s => document.querySelector(s), view = $("#view");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let COINS = [], actShown = 30;
  let S = null, CH = null, ACT = null, lastOk = null, failAt = null, retryIn = 0, range = "LIVE", coinCache = {}, auditSeen = {};
  // ---- data path: #d=... once, then localStorage
  const h = location.hash;
  // Keep #d= in the URL (iOS Add to Home Screen captures the current URL; standalone apps have their own localStorage).
  if (h.startsWith("#d=")) localStorage.setItem("dp", h.slice(3).split("&")[0]);
  const DP = localStorage.getItem("dp");
  const PFX = DP ? `#d=${DP}&` : "#";
  if (DP && !location.hash.startsWith("#d=")) history.replaceState(null, "", location.pathname + PFX + location.hash.replace(/^#/, ""));
  const go = r => { location.hash = PFX.slice(1) + r.replace(/^#/, ""); };
  window.deskGo = go;
  function fixLinks() { document.querySelectorAll('a[href^="#/"]').forEach(a => a.setAttribute("href", PFX + a.getAttribute("href").slice(1))); }
  const base = () => `d/${DP}/`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = (v, d = 2) => v == null ? "n/a" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const kusd = v => v == null ? "n/a" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + Math.round(v);
  const tm = t => t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const price = p => p == null ? "n/a" : p >= 1 ? "$" + p.toFixed(4) : "$" + p.toPrecision(4);

  async function getJSON(p) { const r = await fetch(base() + p + "?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function poll() {
    if (!DP) { failAt = Date.now(); render(); return; }
    try {
      [S, CH, ACT] = await Promise.all([getJSON("state.json"), getJSON("chart.json"), getJSON("activity.json")]);
      getJSON("coins.json").then(c => { COINS = c; }).catch(() => { });
      lastOk = new Date(); failAt = null;
      const m = route().coin; if (m) await loadCoin(m);
    } catch (e) { failAt = Date.now(); retryIn = POLL / 1000; }
    render();
  }
  async function loadCoin(m) { try { coinCache[m] = await getJSON(`coin/${m}.json`); } catch (e) { coinCache[m] = coinCache[m] || { missing: true }; } }
  setInterval(() => { if (failAt) { retryIn = Math.max(0, retryIn - 1); banner(); } }, 1000);
  function banner() {
    const b = $("#banner");
    if (!DP) {
      if (b.dataset.form) return;
      b.hidden = false; b.dataset.form = 1;
      b.innerHTML = `<div>Open the desk once with its private link (…#d=…), or paste it here:</div>
        <div style="display:flex;gap:8px;margin-top:8px"><input id="pl" placeholder="Paste private link" autocomplete="off" autocapitalize="off"
        style="flex:1;min-width:0;height:40px;border-radius:10px;border:0;padding:0 10px;font:inherit;font-size:16px">
        <button id="plsave" style="min-width:64px;height:40px;border-radius:10px;background:#000;color:#fff;font-weight:600">Save</button></div>`;
      $("#plsave").onclick = () => {
        const v = $("#pl").value.trim(), m = v.match(/[#&?]d=([A-Za-z0-9_-]{32,})/) || v.match(/^([A-Za-z0-9_-]{32,})$/);
        if (!m) { $("#pl").value = ""; $("#pl").placeholder = "No d= found, paste the full link"; return; }
        localStorage.setItem("dp", m[1]); location.replace(location.pathname + "#d=" + m[1] + "&/home"); location.reload();
      };
      return;
    }
    if (failAt) { b.hidden = false; b.textContent = `Desk offline · retrying in ${retryIn}s · last update ${lastOk ? tm(lastOk) : "never"}`; }
    else b.hidden = true;
  }
  function route() {
    let hs = location.hash.replace(/^#/, "");
    if (hs.startsWith("d=")) hs = hs.includes("&") ? hs.slice(hs.indexOf("&") + 1) : "";
    const p = hs.replace(/^\//, "").split("/");
    return { tab: p[0] || "home", coin: p[0] === "coin" ? p[1] : null, audit: p[0] === "audit" ? p[1] : null, agent: p[0] === "agents" ? p[1] : null };
  }
  window.addEventListener("hashchange", async () => { window._scrolled = null; const r = route(); if (r.coin || r.audit) await loadCoin(r.coin || r.audit); render(); scrollTo(0, 0); });

  // ---- odometer
  let prevBal = null;
  function odo(text, prev) {
    return [...text].map((ch, i) => {
      if (!/\d/.test(ch)) return `<span class="odo"><span>${ch}</span></span>`;
      const was = prev && prev[i] && /\d/.test(prev[i]) ? +prev[i] : +ch, d = +ch;
      const col = Array.from({ length: 10 }, (_, k) => `<span>${k}</span>`).join("");
      const delay = RM ? 0 : (text.length - i) * 30;
      return `<span class="odo" data-from="${was}" data-to="${d}" style="--d:${delay}ms"><span style="transform:translateY(-${was * 1.05}em);transition-delay:${delay}ms">${col}</span></span>`;
    }).join("");
  }
  function rollOdo() { document.querySelectorAll(".odo[data-to]").forEach(o => requestAnimationFrame(() => requestAnimationFrame(() => { o.firstChild.style.transform = `translateY(-${o.dataset.to * 1.05}em)`; }))); }

  const AG = { scanner: ["Scanner", "#64d2ff"], auditor: ["Auditor", "#00d35a"], analyst: ["Analyst", "#ffd60a"], executor: ["Executor", "#00d35a"], risk: ["Risk", "#ff6b9a"] };
  const skel = (h, r = 14) => `<div class="skel" style="height:${h}px;border-radius:${r}px;margin-bottom:12px"></div>`;

  function nav() {
    const unread = ACT ? ACT.filter(a => a.ts > (localStorage.getItem("seen") || "")).length : 0;
    return `<div class="nav"><a class="avatar" href="#/account" aria-label="Account">${esc((S?.account?.fomoHandle || "A")[0].toUpperCase())}</a>
      <span class="brand">Grok Bot <small>›</small></span>
      <input class="search" id="q" placeholder="Search name, symbol or mint" autocomplete="off">
      <a class="bell" href="#/activity" aria-label="Activity"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>${unread ? "<i></i>" : ""}</a></div>`;
  }

  function filterRange(pts) {
    if (range === "ALL" || !pts.length) return pts;
    const now = Date.now(), win = { LIVE: null, "1H": 36e5, "4H": 4 * 36e5, "1D": 864e5, "1W": 7 * 864e5 }[range];
    if (range === "LIVE") return pts.filter(p => p.t >= CH.nightStart);
    return pts.filter(p => now - new Date(p.t) <= win);
  }

  function actRow(a) {
    const ic = { bought: "B", sold: "+", stopped: "−", rejected: "×" }[a.kind];
    const href = a.kind === "rejected" ? `#/audit/${a.mint}` : `#/coin/${a.mint}`;
    const cls = a.kind === "sold" ? "up" : a.kind === "stopped" ? "down" : "muted";
    return `<a class="row" href="${href}"><div class="ic ${a.kind}">${ic}</div><div class="tx"><b>${esc(a.title)}</b><small>${esc(a.subtitle)}</small></div><div class="val ${cls}">${esc(a.value)}</div></a>`;
  }

  function agentCard(k) {
    const a = S.agents[k], [nm, col] = AG[k], st = S.settings;
    const who = `<div class="who"><span class="dot ${a.paused ? "off" : ""}" style="background:${a.paused ? "" : col}"></span>${nm}${a.paused ? " · paused" : ""}</div>`;
    let body = "";
    if (k === "scanner") {
      const f = a.feed || [];
      body = `<div class="head">${a.pools} pools</div><div class="feed">${f.length ? f.map(x => x.verdict === "pass"
        ? `<div class="pass"><b>${esc(x.text)}</b></div>` : `<div class="kill"><b>${esc(x.name)}</b><em>${esc(x.reason)}</em></div>`).join("") : `<div class="muted">Listening for graduations</div>`}</div>`;
    } else if (k === "auditor") {
      const run = a.running, last = a.last, L = run ? run.layers : last ? last.layers : [];
      const strips = Array.from({ length: 8 }, (_, i) => { const l = L[i]; const c = !l ? (run && i === L.length ? "scan" : "") : l.pass ? "ok" : l.pass === false ? "bad" : ""; return `<i class="${c}"></i>`; }).join("");
      const line = run ? "taking apart..." : last ? (last.passed ? "8/8 → Executor" : esc(last.reason)) : "No coin taken apart yet";
      body = `<div class="head">${a.taken} taken apart</div><div class="strips">${strips}</div><div style="margin-top:14px;font-size:15px">${line}</div>`;
      return `<div class="card agentcard" onclick="deskGo('#/audit/${last?.mint || ""}')">${who}${body}<div class="foot"><span>${a.rejected} rejected</span><span>${last ? esc(last.name || "") : ""}</span></div></div>`;
    } else if (k === "analyst") {
      body = `<div class="head">Scoring</div><canvas class="ring" data-score="${a.last ? a.last.score : ""}"></canvas>`;
      return `<div class="card agentcard">${who}${body}<div class="foot"><span>${a.scored} scored${a.mode === "rules" ? " · rules" : ""}</span><span>${a.last ? esc(a.last.name || "") : "Waiting for a coin"}</span></div></div>`;
    } else if (k === "executor") {
      const b = a.bar, lastT = a.last;
      let barHtml = "";
      if (b) { const el = (Date.now() - new Date(b.started)) / 1200; const done = b.mode === "PAPER" ? el >= 1 : !!lastT && lastT.mint === b.mint; barHtml = `<div class="bar"><i style="width:${done ? 100 : Math.min(99, el * 100)}%"></i></div><div style="margin-top:8px;font-size:15px">${done ? "✓ Filled" : "Executing... " + Math.round(Math.min(99, el * 100)) + "%"}</div>`; }
      body = `<div class="head">${a.trades} trades</div><div style="margin-top:8px;font-size:17px">${lastT ? usd(lastT.size) + " · " + st["executor.stack_pct"] + "% of stack" : "No trade yet"}</div>${barHtml}`;
    } else {
      body = `<div class="head">${a.guarding ? "Guarding" : "Idle"}</div><div style="margin-top:8px;font-size:17px">${a.lastExit || "No exit yet"}</div>
        <div style="display:flex;gap:8px;margin-top:14px"><span class="pill red">stop -${st["risk.stop_pct"]}%</span><span class="pill green">trail ${st["risk.trail_pct"]}%</span></div>`;
    }
    return `<div class="card agentcard">${who}${body}<div class="foot"><span>${a.decisions.length ? tm(a.decisions[0].ts) : ""}</span></div></div>`;
  }

  function home() {
    if (!S) return nav() + skel(80) + skel(240) + skel(36) + skel(300, 42);
    const bal = usd(S.balance), up = S.todayPct >= 0;
    const html = nav() + `<div class="balance"><div class="big">${odo(bal, prevBal)}</div>${S.mode === "PAPER" ? '<span class="pill paper">PAPER</span>' : ""}</div>
      ${S.mode === "LIVE" ? `<div class="muted" style="font-size:13px">LIVE = your stack + closed LIVE P&L + open marks · PAPER ${usd(S.paperBalance)}</div>` : ""}
      <div class="sub"><span class="${up ? "up" : "down"}">${up ? "+" : ""}${S.todayPct.toFixed(2)}%</span><span class="muted">today</span><span class="pill green">${S.multiplier.toFixed(2)}×</span></div>
      <div class="chartbox"><canvas id="bal"></canvas>${(CH.marks || []).length ? "" : '<div class="chart-empty">Waiting for the first trade</div>'}</div>
      <div class="ranges">${["LIVE", "1H", "4H", "1D", "1W", "ALL"].map(r => `<button class="${r === range ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}</div>
      ${S.ticket ? `<div class="note" style="padding:12px 0 0">${esc(S.ticket)}</div>` : ""}
      <div class="h2">Agents · ${Object.values(S.agents).filter(a => !a.paused).length} running</div>
      <div class="carousel">${Object.keys(AG).map(agentCard).join("")}</div>
      <div class="h2">Activity <a href="#/activity">See all</a></div>
      <div class="rows">${ACT.length ? ACT.slice(0, 5).map(actRow).join("") : '<div class="empty">Nothing yet tonight</div>'}</div>`;
    prevBal = bal; return html;
  }

  function agentsTab() {
    if (!S) return `<div class="title">Agents</div>` + skel(220, 20).repeat(3);
    const open = S.open.length > 0;
    const cmd = { scanner: "pause scanner", auditor: "pause auditor", analyst: "pause analyst", executor: "pause executor", risk: "pause risk" };
    return `<div class="title">Agents</div>` + Object.keys(AG).map(k => {
      const a = S.agents[k], [nm, col] = AG[k], locked = k === "risk" && open;
      const count = { scanner: a.pools, auditor: a.taken, analyst: a.scored, executor: a.trades, risk: a.guarding }[k];
      const dec = a.decisions.length ? a.decisions.map(x => `<span class="faint">${tm(x.ts)}</span><a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.name || x.mint.slice(0, 6))}</a><span class="v">${esc(x.verdict)}${x.reason ? " · " + esc(x.reason) : ""}</span>`).join("") : `<span></span><span class="muted">No decisions yet</span><span></span>`;
      return `<div class="agentfull"><div class="top"><span class="dot ${a.paused ? "off" : ""}" style="background:${a.paused ? "" : col}"></span><b>${nm}</b><span class="muted">${count} today</span>
        <span class="switch ${a.paused ? "" : "on"} ${locked ? "locked" : ""} ro" title="Plan B: send '${a.paused ? "resume" : "pause"} ${k}' to the Telegram bot"><i></i></span></div>
        <div class="note" style="padding:6px 0 0">${locked ? "Locked while a position is open" : `Read-only here · Telegram: “${a.paused ? "resume" : "pause"} ${k}”`}</div>
        <div class="dec">${dec}</div><a class="link" href="#/account?${k}">Settings</a></div>`;
    }).join("");
  }

  function activityTab() {
    if (!ACT) return `<div class="title">Activity</div>` + skel(400);
    localStorage.setItem("seen", ACT[0]?.ts || "");
    const more = ACT.length > actShown ? `<button class="link" id="more" style="width:100%">Show 30 more</button>` : "";
    return `<div class="title">Activity</div><div class="rows">${ACT.length ? ACT.slice(0, actShown).map(actRow).join("") : '<div class="empty">Nothing yet tonight</div>'}</div>${more}`;
  }

  const GROUPS = { scanner: "Scanner", auditor: "Auditor", analyst: "Analyst", "analyst.rules": "Analyst (rules)", executor: "Executor", risk: "Risk", desk: "Desk" };
  const RANGES = { pct: [0, 100], usd: [0, 100000] };
  function accountTab() {
    if (!S) return `<div class="title">Account</div>` + skel(300) + skel(400);
    const a = S.account, st = S.settings;
    const groups = {};
    Object.entries(st).forEach(([k, v]) => { const g = k.startsWith("analyst.rules.") ? "analyst.rules" : k.split(".")[0]; (groups[g] = groups[g] || []).push([k, v]); });
    const setRows = Object.keys(GROUPS).map(g => `<div class="setgroup" id="set-${g.replace(".", "-")}"><h3>${GROUPS[g]}</h3><div class="rows">${(groups[g] || []).map(([k, v]) => {
      const short = k.replace(/^.*\./, "");
      const num = typeof v === "number";
      return `<div class="setrow ro"><div class="l"><span>${short.replace(/_/g, " ")}</span>${num ? `<input type="number" value="${v}" disabled>` : `<span class="muted">${esc(v ?? "not set")}</span>`}</div>
        ${num ? `<input type="range" min="0" max="${Math.max(v * 2, 1)}" step="any" value="${v}" disabled>` : ""}<div class="l"><code>set ${short} to …</code></div></div>`;
    }).join("")}</div></div>`).join("");
    return `<div class="title">Account</div>
      <div class="rows">
        <div class="row"><div class="tx"><b>Mode</b><small>Telegram: “paper” or “live” (then type LIVE)</small></div><span class="pill ${a.mode === "PAPER" ? "paper" : "green"}">${a.mode}</span></div>
        <div class="row"><div class="tx"><b>Stack</b><small>${a.mode === "PAPER" ? "Simulated PAPER balance" : "Telegram: “stack 1240”"}</small></div><div class="val">${usd(a.stack)}</div></div>
        <a class="row" href="${esc(a.profileUrl)}" target="_blank" rel="noopener"><div class="tx"><b>Your FOMO profile</b><small>@${esc(a.fomoHandle)}</small></div><div class="val muted">›</div></a>
        <button class="row" id="invite" style="width:100%;text-align:left" data-url="${esc(a.signupUrl)}"><div class="tx"><b>Invite a friend</b><small>Share your FOMO invite</small></div><div class="val muted">›</div></button>
      </div>
      <div class="setgroup"><h3>Notifications</h3><div class="rows">
        <div class="row"><div class="tx"><b>Telegram</b><small>${a.notifier.connected ? "Connected · " + esc(a.notifier.bot) : "Not connected"}</small></div><span class="dot ${a.notifier.connected ? "" : "off"}"></span></div>
        <a class="row" href="https://t.me/${esc((a.notifier.bot || "").replace("@", ""))}" target="_blank" rel="noopener"><div class="tx"><b>Send test push</b><small>Send “status” to the bot</small></div><div class="val muted">›</div></a>
        <div class="row"><div class="tx"><b>Web push</b><small>${esc(a.push)}</small></div><span class="pill grey">off</span></div>
      </div></div>
      <div class="note">Plan B hosting: settings are read-only here. Change them in Telegram, e.g. “set stop to -8%”.</div>${setRows}`;
  }

  function coinScreen(m) {
    const c = coinCache[m];
    const top = `<div class="screen-top"><a class="back" href="#/home">‹ Back</a></div>`;
    if (!c) return top + skel(60) + skel(80) + skel(260);
    if (c.missing) { const k = COINS.find(x => x.mint === m); return top + `<div class="title">${esc(k?.name || m.slice(0, 6))}</div><div class="empty">Seen tonight, not taken apart · no candles yet</div>${k ? `<a class="btn" href="${esc(k.link)}" target="_blank" rel="noopener">Open on FOMO</a>` : ""}`; }
    const pos = c.position, open = pos && !pos.closed_at, entry = pos?.entry_price;
    const since = entry && c.price ? (100 * (c.price / entry - 1)) : null;
    const ex = c.exit;
    return top + `<div style="display:flex;align-items:center;gap:8px"><div class="title" style="margin:0">${esc(c.name)}</div>${S?.mode === "PAPER" ? '<span class="pill paper">PAPER</span>' : ""}</div>
      <div class="muted" style="display:flex;gap:8px;align-items:center;margin-top:4px">${esc(c.symbol || "")} · Solana · ${c.ageH != null ? c.ageH + "h old" : ""}
      ${c.layers.length ? `<a class="chip" href="#/audit/${m}">🛡 ${c.passedLayers}/8</a>` : ""}</div>
      <div class="big" style="font-size:44px;margin-top:12px">${price(c.price)}</div>
      ${since != null ? `<div class="${since >= 0 ? "up" : "down"}">${since >= 0 ? "▲" : "▼"} ${Math.abs(since).toFixed(2)}% since entry</div>` : ""}
      <div class="chartbox" style="height:260px"><canvas id="cnd"></canvas>${c.candles.length ? "" : '<div class="chart-empty">No candles yet</div>'}</div>
      <div class="stats"><div><small>Market cap</small>${kusd(c.marketCap)}</div><div><small>Liquidity</small>${kusd(c.liquidity)}</div>
      <div><small>24h volume</small>${kusd(c.volume24h)}</div><div><small>Holders</small>${c.holders ?? "n/a"}</div></div>
      ${open ? `<div class="h2">Your position</div><div class="rows"><div class="row"><div class="tx"><b>${usd(pos.size_usd)} in · Executor</b><small>entry ${price(entry)}</small></div></div>
        <div class="row"><div class="tx"><b>Stop line</b><small>-${ex.stopPct}%</small></div><div class="val down">${price(ex.stopLine)}</div></div>
        <div class="row"><div class="tx"><b>Trail line</b><small>${ex.trailLine ? "active" : "starts at " + price(ex.trailStartLine)}</small></div><div class="val up">${ex.trailLine ? price(ex.trailLine) : "–"}</div></div>
        <div class="row"><div class="tx"><b>Timeout</b><small>dead-money exit</small></div><div class="val">${Math.floor(ex.timeoutLeftS / 3600)}h ${Math.floor(ex.timeoutLeftS % 3600 / 60)}m left</div></div></div>` : ""}
      <a class="btn ${open ? "red" : ""}" href="${esc(c.coinUrl)}" target="_blank" rel="noopener">${open ? "Sell on FOMO" : "Buy on FOMO"}</a>`;
  }

  function auditScreen(m) {
    const top = `<div class="screen-top"><a class="back" href="#/home">‹ Back</a></div><div class="title">Auditor</div>`;
    if (!m) return top + `<div class="empty">No coin taken apart yet</div>`;
    const c = coinCache[m];
    if (!c) return top + skel(220) + skel(300);
    if (c.missing || !c.layers.length) return top + `<div class="empty">No coin taken apart yet</div>`;
    const L = Array.from({ length: 8 }, (_, i) => c.layers.find(l => l.n === i + 1));
    const red = L.find(l => l && !l.pass), done = L.filter(Boolean).length;
    const sig = c.signal;
    const verdict = red ? `<div class="verdict down">Rejected · ${esc(red.value)}</div><div class="muted">Grok Bot won't buy ${esc(c.name)}</div>`
      : done === 8 ? `<div class="verdict up">Cleared · 8/8 parts</div><div class="muted">Sent to Executor${sig ? " · " + usd(sig.size_usd) : ""}</div>` : `<div class="verdict">taking apart...</div>`;
    return top + `<div style="font-size:20px;font-weight:600">${esc(c.name)}</div>
      <div class="discs" id="discs" data-mint="${m}">${L.map((l, i) => `<div class="disc" data-i="${i}" data-s="${!l ? "na" : l.pass ? "ok" : "bad"}"></div>`).join("")}</div>
      ${verdict}
      <div class="rows" style="margin-top:16px">${L.map((l, i) => `<div class="row"><div class="tx"><b>${i + 1} · ${esc(l ? l.name : ["Mint authority", "Freeze authority", "Dev wallet", "Top 10 holders", "Liquidity", "Pool age", "Bundled wallets", "Delegations"][i])}</b><small>${l ? esc(l.source || "") : ""}</small></div>
        <div class="val ${!l ? "faint" : l.pass ? "up" : "down"}">${l ? esc(l.value) : "not checked"}</div></div>`).join("")}</div>
      <div class="rows" style="margin-top:16px"><div class="row"><div class="tx"><b>Take apart before buying</b><small>Telegram: “set auditor.enabled to false” (asks twice)</small></div><span class="switch ${S?.settings["auditor.enabled"] ? "on" : ""} ro"><i></i></span></div></div>
      <a class="btn" href="${esc(c.coinUrl)}" target="_blank" rel="noopener">Open on FOMO</a>`;
  }

  function animateDiscs() {
    const box = $("#discs"); if (!box) return;
    const ds = [...box.children], m = box.dataset.mint;
    const finish = d => d.classList.add(d.dataset.s);
    if (RM || auditSeen[m]) { ds.forEach(finish); return; }
    auditSeen[m] = true;
    let i = 0;
    (function step() {
      if (i >= ds.length) return; const d = ds[i];
      if (d.dataset.s === "na") { ds.slice(i).forEach(finish); return; }
      d.classList.add("beam");
      setTimeout(() => { d.classList.remove("beam"); setTimeout(() => { finish(d); i++; step(); }, 150); }, 350);
    })();
  }

  function render() {
    banner();
    const r = route();
    document.querySelectorAll(".tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === r.tab));
    let html;
    if (r.coin) html = coinScreen(r.coin);
    else if (r.audit !== null && r.tab === "audit") html = auditScreen(r.audit || S?.agents?.auditor?.last?.mint);
    else if (r.tab === "agents") html = agentsTab();
    else if (r.tab === "activity") html = activityTab();
    else if (r.tab.startsWith("account")) html = accountTab();
    else html = home();
    const q = document.activeElement?.id === "q" ? $("#q").value : null;
    view.innerHTML = html;
    if (q !== null) { const el = $("#q"); el.value = q; el.focus(); }
    fixLinks(); rollOdo();
    const bal = $("#bal"); if (bal && CH) Charts.line(bal, filterRange(CH.points), CH.marks.filter(mk => filterRange([{ t: mk.t }]).length || range === "ALL"), CH.start);
    document.querySelectorAll(".ring").forEach(cv => Charts.ring(cv, cv.dataset.score === "" ? null : +cv.dataset.score, S.settings["analyst.min_score"]));
    const cnd = $("#cnd"); if (cnd) { const c = coinCache[r.coin]; Charts.candles(cnd, c.candles, c.exit?.exitLine, c.position?.entry_price); }
    animateDiscs();
    document.querySelectorAll(".ranges button").forEach(b => b.onclick = () => { range = b.dataset.r; render(); });
    const inv = $("#invite"); if (inv) inv.onclick = async () => { const u = inv.dataset.url; try { if (navigator.share) await navigator.share({ url: u, title: "FOMO" }); else throw 0; } catch (e) { try { await navigator.clipboard.writeText(u); } catch (_) { } toast("Link copied"); } };
    const mo = $("#more"); if (mo) mo.onclick = () => { actShown += 30; render(); };
    const sec = (location.hash.split("?")[1] || ""); if (sec && r.tab.startsWith("account")) { const g = document.getElementById("set-" + sec); if (g && !window._scrolled) { g.scrollIntoView(); window._scrolled = sec; } }
    const qi = $("#q"); if (qi) qi.onkeydown = e => { if (e.key === "Enter") search(qi.value.trim()); };
  }
  function search(x) {
    if (!x) return; const lx = x.toLowerCase();
    const pool = [...COINS, ...(ACT || []).map(a => ({ mint: a.mint, name: a.title.replace(/^\w+ /, "") }))];
    const hit = pool.find(p => p.mint === x || (p.name || "").toLowerCase() === lx || (p.symbol || "").toLowerCase() === lx.replace("$", "")) || pool.find(p => (p.name || "").toLowerCase().includes(lx));
    if (hit) go(`#/coin/${hit.mint}`); else toast("Not on the desk tonight");
  }
  function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
  render(); poll(); setInterval(poll, POLL);
  setInterval(() => { const b = S && S.agents.executor.bar; if (b && Date.now() - new Date(b.started) < 2500 && route().tab === "home") render(); }, 400);
})();
