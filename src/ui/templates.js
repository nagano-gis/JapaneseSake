import { escapeHtml } from "../utils/dom.js";

export function cardTemplate(r, idx) {
  const canvasId = `radar-${escapeHtml(String(r.item.id ?? "noid"))}-${idx}`;

  const name = r.item.name ?? "(no name)";
  const id = r.item.id ?? "(no id)";
  const area = r.item.name_area ?? "";
  const cat = r.item.category ?? "";

  const meta = r.sortLabel
    ? `${escapeHtml(r.sortLabel)}=${escapeHtml(r.sortValueText)}`
    : `score=${escapeHtml(r.sortValueText ?? "-")}`;

  return `
    <div style="border:1px solid #eee; border-radius:10px; padding:10px;">
      <div style="display:flex; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-weight:700;">${escapeHtml(name)}</div>
          <div style="font-size:12px; color:#555;">
            id=${escapeHtml(String(id))} / ${escapeHtml(area)} / ${escapeHtml(cat)} / ${meta}
          </div>
        </div>

        <button type="button"
          data-objectid="${escapeHtml(String(r.item.objectId))}"
          style="height:32px;">
          地図へ
        </button>
      </div>

      <div class="radar-wrap">
        <canvas id="${canvasId}" width="240" height="180"></canvas>
      </div>
    </div>
  `;
}

export function renderResultsShell(top) {
  return `
    <h2>結果（上位${top.length}件）</h2>
    <div class="cards">
      ${top.map((r, idx) => cardTemplate(r, idx)).join("")}
    </div>
  `;
}