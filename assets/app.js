// 영닥터 아틀라스 — app.js (ES module, 외부 의존 0)
// 순수 함수(placeStair · entryCell · searchItems)는 export 해서 node 테스트가 import 한다.
// 브라우저 초기화는 맨 아래 `if (typeof document !== 'undefined')` 안에만 둔다.

const STAIR_LABELS = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦"];

function num(v) {
  if (typeof v === "string" && v.trim() !== "") v = Number(v);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 부록 B — 행동 증거로 계단을 정한다. a = {q2,q3,q4,q5}, 각 number|null.
 *  값: q2 1|2|3|4 · q3 3|4 · q4 5|7 · q5 6|7. 상한(caps): q3 없음→2, q5 없음→5 (q4 없음은 상한 없음).
 *  evidence = min(caps…, max(values…)); 값이 하나도 없으면 1. */
export function placeStair(a) {
  a = a || {};
  const q2 = num(a.q2), q3 = num(a.q3), q4 = num(a.q4), q5 = num(a.q5);
  const values = [q2, q3, q4, q5].filter((v) => v !== null);
  if (!values.length) return 1;
  const caps = [];
  if (q3 === null) caps.push(2);
  if (q5 === null) caps.push(5);
  const evidence = Math.min(...caps, Math.max(...values));
  return Math.max(1, Math.min(7, evidence));
}

/** 진입 칸 = stair × Q6 층. 그 칸이 has_nodes 가 아니면 같은 층에서 |계단 차| 가 가장 작은 has_nodes 칸(동률은 낮은 계단).
 *  0층은 띠 하나(L0-S0). 없으면 null. cells = [{id?, layer, stair, state}] */
export function entryCell(stair, q6Layer, cells) {
  const s = num(stair), layer = num(q6Layer);
  const list = (cells || []).map((c) => ({ ...c, layer: num(c.layer), stair: num(c.stair), id: c.id || `L${c.layer}-S${c.stair}` }));
  const has = list.filter((c) => c.state === "has_nodes");
  if (layer === 0) {
    const band = has.find((c) => c.layer === 0);
    return band ? band.id : null;
  }
  const exact = has.find((c) => c.layer === layer && c.stair === s);
  if (exact) return exact.id;
  const same = has.filter((c) => c.layer === layer).sort((x, y) => Math.abs(x.stair - s) - Math.abs(y.stair - s) || x.stair - y.stair);
  return same.length ? same[0].id : null;
}

/** search.json 항목을 부분 일치로 고른다(제목 3 · 요약 2 · 함정 1 · FAQ 1 · id 1, 모든 낱말이 맞아야 함). 상위 limit. */
export function searchItems(items, q, limit = 20) {
  const nfc = (x) => (x || "").toString().normalize("NFC").toLowerCase();
  const terms = nfc(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const score = (it) => {
    let total = 0;
    for (const t of terms) {
      let hit = 0;
      if (nfc(it.title).includes(t)) hit += 3;
      if (nfc(it.summary).includes(t)) hit += 2;
      if ((it.traps || []).some((x) => nfc(x).includes(t))) hit += 1;
      if ((it.faq || []).some((x) => nfc(x).includes(t))) hit += 1;
      if (nfc(it.id).includes(t)) hit += 1;
      if (!hit) return 0;
      total += hit;
    }
    return total;
  };
  return (items || [])
    .map((it) => [score(it), it])
    .filter(([sc]) => sc > 0)
    .sort((x, y) => y[0] - x[0])
    .slice(0, limit)
    .map(([, it]) => it);
}

// ---------- 브라우저 ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가(사생활 모드 등) — 화면은 그대로 동작 */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 무시 */ } },
};

function init() {
  const html = document.documentElement;
  const base = html.dataset.base || "";
  const dataEl = document.getElementById("atlas-data");
  let data = null;
  if (dataEl) { try { data = JSON.parse(dataEl.textContent); } catch { data = null; } }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // 테마: auto → light → dark
  const applyTheme = (t) => {
    if (t === "light" || t === "dark") html.dataset.theme = t; else delete html.dataset.theme;
    $$("[data-theme-toggle]").forEach((b) => { b.textContent = { light: "밝게", dark: "어둡게" }[t] || "자동"; });
  };
  applyTheme(store.get("atlas.theme", "auto"));
  $$("[data-theme-toggle]").forEach((b) => b.addEventListener("click", () => {
    const cur = store.get("atlas.theme", "auto");
    const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
    store.set("atlas.theme", next); applyTheme(next);
  }));

  // 만들 예정 보기
  const applyPlanned = (on) => {
    html.classList.toggle("show-planned", !!on);
    $$("[data-show-planned]").forEach((c) => { c.checked = !!on; });
  };
  applyPlanned(store.get("atlas.showPlanned", false));
  $$("[data-show-planned]").forEach((c) => c.addEventListener("change", () => { store.set("atlas.showPlanned", c.checked); applyPlanned(c.checked); }));

  // OS: 내 OS 가 아닌 노드는 옅게(색으로)
  const applyOs = (os) => {
    if (os) html.dataset.os = os; else delete html.dataset.os;
    $$("button[data-os]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.os === os)));
    $$("[data-os]:not(button)").forEach((el) => {
      const list = (el.dataset.os || "any").split(/\s+/);
      const mine = !os || list.includes("any") || list.includes(os);
      el.classList.toggle("os-other", !mine);
    });
  };
  applyOs(store.get("atlas.os", null));
  $$("button[data-os]").forEach((b) => b.addEventListener("click", () => {
    const cur = store.get("atlas.os", null);
    const next = cur === b.dataset.os ? null : b.dataset.os;
    if (next) store.set("atlas.os", next); else store.del("atlas.os");
    applyOs(next);
  }));

  // 「해봤다」
  const done = new Set(store.get("atlas.done", []));
  const applyDone = () => {
    $$("[data-node-id]").forEach((el) => el.classList.toggle("done", done.has(el.dataset.nodeId)));
    $$("input[data-done-id]").forEach((c) => { c.checked = done.has(c.dataset.doneId); });
  };
  applyDone();
  $$("input[data-done-id]").forEach((c) => c.addEventListener("change", () => {
    if (c.checked) done.add(c.dataset.doneId); else done.delete(c.dataset.doneId);
    store.set("atlas.done", Array.from(done)); applyDone();
  }));

  // 지도: 내 계단 열 + 한 칸 위 열 강조, 진입 칸에 「여기부터」
  const applyStair = () => {
    const stair = num(store.get("atlas.stair", null));
    $$(".cell, .stair-head").forEach((el) => { el.classList.remove("mine", "above", "entry"); });
    $$(".entry-mark").forEach((m) => { m.hidden = true; });
    if (!stair) return;
    $$(`.cell[data-stair="${stair}"], .stair-head[data-stair="${stair}"]`).forEach((el) => el.classList.add("mine"));
    if (stair < 7) $$(`.cell[data-stair="${stair + 1}"], .stair-head[data-stair="${stair + 1}"]`).forEach((el) => el.classList.add("above"));
    const entry = store.get("atlas.entryCell", null) || (data && data.entry_cells && data.entry_cells[String(stair)]) || null;
    if (entry) {
      const cell = $(`.cell[data-cell="${entry}"]`);
      if (cell) { cell.classList.add("entry"); const m = $(".entry-mark", cell); if (m) m.hidden = false; }
    }
  };
  applyStair();
  $$("[data-set-stair]").forEach((el) => el.addEventListener("click", () => {
    const s = num(el.dataset.setStair);
    if (!s) return;
    store.set("atlas.stair", s); store.del("atlas.entryCell"); applyStair();
  }));

  // 자기 배치
  const placement = $("[data-placement]");
  $$("[data-open-placement]").forEach((b) => b.addEventListener("click", () => {
    if (!placement) return;
    placement.hidden = false;
    placement.scrollIntoView({ behavior: "smooth", block: "start" });
    const first = $("input", placement); if (first) first.focus({ preventScroll: true });
  }));
  const form = $("[data-placement-form]");
  if (form && placement) {
    const result = $("[data-placement-result]", placement);
    const os0 = store.get("atlas.os", null);
    if (os0) { const r = $(`input[name="q0"][value="${os0}"]`, form); if (r) r.checked = true; }
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const v = (k) => { const x = fd.get(k); return x === null || x === "" ? null : num(x); };
      const os = fd.get("q0");
      if (os) { store.set("atlas.os", os); applyOs(os); }
      const stair = placeStair({ q2: v("q2"), q3: v("q3"), q4: v("q4"), q5: v("q5") });
      const q1 = v("q1"), layer = v("q6");
      const cell = layer === null ? null : entryCell(stair, layer, data ? data.cells : []);
      const stairInfo = (data && data.stairs || []).find((s) => s.id === stair) || { label: STAIR_LABELS[stair], name: "" };
      const entryNode = stairInfo.entry_node;
      store.set("atlas.stair", stair);
      if (cell) store.set("atlas.entryCell", cell); else store.del("atlas.entryCell");
      if (layer !== null) store.set("atlas.layer", layer);
      applyStair();
      const range = stair < 7 ? `${STAIR_LABELS[stair]}~${STAIR_LABELS[stair + 1]}` : STAIR_LABELS[stair];
      const parts = [];
      parts.push(`<p class="big">내 자리: ${esc(range)} <span class="muted">— ${esc(stairInfo.label)} ${esc(stairInfo.name)}</span></p>`);
      if (q1 !== null && q1 < stair) parts.push(`<p>설문상 자기 평가보다 한 칸 위에 계십니다. 행동 증거를 따릅니다.</p>`);
      if (cell) {
        const cellInfo = (data.cells || []).find((c) => c.id === cell);
        parts.push(`<p>진입 칸 <a href="${esc(base + (cellInfo ? cellInfo.url : "index.html"))}">${esc(cell)}</a> — 지도에서 「여기부터」 표시를 따라가세요.</p>`);
      } else if (layer !== null) {
        parts.push(`<p>${esc(layer)}층에는 아직 볼 수 있는 노드가 없습니다. 계단 ${esc(stairInfo.label)}의 진입 노드부터 보세요.</p>`);
      }
      if (entryNode) parts.push(`<p><a class="btn btn-primary" href="${esc(base + "nodes/" + entryNode + ".html")}">진입 노드로</a></p>`);
      parts.push(`<p><button type="button" class="btn" data-placement-change>바꾸기</button></p>`);
      result.innerHTML = `<div class="result-card">${parts.join("")}</div>`;
      form.hidden = true;
      $("[data-placement-change]", result).addEventListener("click", () => { form.hidden = false; result.innerHTML = ""; });
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    form.addEventListener("reset", () => { result.innerHTML = ""; });
  }

  // 검색
  const input = $("[data-search-input]");
  const results = $("[data-search-results]");
  if (input && results) {
    let index = null, timer = 0;
    const load = async () => {
      if (index) return index;
      try { const r = await fetch(base + "search.json", { cache: "no-cache" }); index = await r.json(); } catch { index = []; }
      return index;
    };
    const render = (items, q) => {
      if (!q.trim()) { results.hidden = true; results.innerHTML = ""; return; }
      const showPlanned = html.classList.contains("show-planned");
      const vis = items.filter((it) => showPlanned || it.status !== "planned");
      results.innerHTML = vis.length
        ? vis.map((it) => `<a href="${esc(base + it.url)}" data-status="${esc(it.status)}" data-os="${esc((it.os || ["any"]).join(" "))}" data-node-id="${esc(it.id)}">`
          + `${esc(it.title)} <span class="where">L${esc(it.layer)}-${STAIR_LABELS[it.stair] || it.stair}${it.status !== "ready" ? " · " + (it.status === "draft" ? "초안" : "만들 예정") : ""}</span></a>`).join("")
        : `<div class="none">맞는 노드가 없습니다. 노드 페이지의 폼으로 물어 주세요.</div>`;
      results.hidden = false;
      applyOs(store.get("atlas.os", null)); applyDone();
    };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => { const idx = await load(); render(searchItems(idx, input.value, 20), input.value); }, 150);
    });
    input.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { input.value = ""; render([], ""); } });
    input.closest("form").addEventListener("submit", (ev) => ev.preventDefault());
    document.addEventListener("click", (ev) => { if (!results.contains(ev.target) && ev.target !== input) results.hidden = true; });
    input.addEventListener("focus", () => { if (results.innerHTML) results.hidden = false; });
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}
