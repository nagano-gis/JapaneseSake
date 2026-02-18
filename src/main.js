// src/main.js
import "./style.css";

import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";

// Chart.js は最初に一度だけ register
Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// ========== 設定 ==========
const FEATURE_KEYS = ["f1", "f2", "f3", "f4", "f5", "f6"];
const FEATURE_LABELS = ["観点1", "観点2", "観点3", "観点4", "観点5", "観点6"];

// ========== DOM ==========
const queryDiv = document.querySelector("#queryDiv");
const resultsDiv = document.querySelector("#resultsDiv");
// #viewDiv は地図側（ArcGIS JS 等）で使う想定。ここでは触りません。

if (!queryDiv) throw new Error("#queryDiv が見つかりません。index.html に <div id='queryDiv'></div> が必要です。");
if (!resultsDiv) throw new Error("#resultsDiv が見つかりません。index.html に <div id='resultsDiv'></div> が必要です。");

// ========== Utility ==========
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function createThrottled(fn, waitMs = 120) {
  let timer = null;
  let lastArgs = null;

  return (...args) => {
    lastArgs = args;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, waitMs);
  };
}

// ========== CSV Load ==========
async function loadSakeData() {
  const res = await fetch("/data/test.csv");
  if (!res.ok) throw new Error(`CSV取得に失敗: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim() !== "");
  if (nonEmptyLines.length === 0) return [];

  const headers = nonEmptyLines[0].split(",").map((h) => h.trim());

  return nonEmptyLines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};

    headers.forEach((h, i) => {
      const v = (values[i] ?? "").trim();

      if (
        v === "" ||
        v === "#VALUE!" ||
        v === "#N/A" ||
        v === "#DIV/0!" ||
        v === "#REF!"
      ) {
        obj[h] = null;
        return;
      }

      const n = Number(v);
      obj[h] = !Number.isNaN(n) ? n : v;
    });

    return obj;
  });
}

function normalizeFeaturesInPlace(rows, keys) {
  for (const row of rows) {
    for (const k of keys) {
      if (row[k] === "" || row[k] == null) row[k] = null;
      else {
        const n = Number(row[k]);
        row[k] = Number.isNaN(n) ? null : n;
      }
    }
  }
}

function getFeatureValues(row, keys) {
  return keys.map((k) => {
    const v = row[k];
    return (v == null || Number.isNaN(v)) ? 0 : clamp01(Number(v));
  });
}

// ========== Similarity ==========
function cosineSimilarityMissing(a, b, keys, minCommonDims = 2) {
  let dot = 0, normA = 0, normB = 0, common = 0;

  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (va == null || vb == null) continue;

    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
    common++;
  }
  if (common < minCommonDims) return null;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return null;

  return dot / denom;
}

function peakIndexRow(row, keys) {
  let best = -Infinity, idx = -1;
  for (let i = 0; i < keys.length; i++) {
    const v = row[keys[i]];
    if (v == null) continue;
    if (v > best) { best = v; idx = i; }
  }
  return idx;
}

function queryAsRow(queryVec) {
  const obj = { id: "__query__" };
  FEATURE_KEYS.forEach((k, i) => (obj[k] = queryVec[i]));
  return obj;
}

/**
 * クエリに近い上位N件。
 * 「尖る向きが違うなら別物」→ peak軸が違うものは除外（確実）。
 */
function topNSimilarByQuery(queryVec, all, keys, topN = 10) {
  const qRow = queryAsRow(queryVec);
  const qPeak = peakIndexRow(qRow, keys);

  const scored = [];
  for (const item of all) {
    const iPeak = peakIndexRow(item, keys);
    if (qPeak !== -1 && iPeak !== -1 && qPeak !== iPeak) continue;

    const sim = cosineSimilarityMissing(qRow, item, keys, 2);
    if (sim == null) continue;

    scored.push({ item, sim });
  }

  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, topN);
}

// ========== UI Templates ==========
function renderQueryUI() {
  // slider はラベルとセットで使うのが推奨 [1](https://github.com/alexabreu/calcite-components)
  return `
    <h2>クエリ（形）を編集</h2>

    <div class="query-editor">
      <canvas id="queryRadar" width="320" height="240"></canvas>
      <div class="hint">下のスライダーで f1〜f6（0〜1）を調整</div>
    </div>

    <div class="sliders">
      ${FEATURE_KEYS.map((k, i) => `
        <div class="slider-row">
          <div class="slider-name">${escapeHtml(FEATURE_LABELS[i])}</div>
          <calcite-slider
            id="slider-${k}"
            min="0" max="1" step="0.01"
            value="0.50"
            precise
          ></calcite-slider>
          <div class="slider-val" id="val-${k}">0.50</div>
        </div>
      `).join("")}
    </div>

    <div class="query-actions">
      <calcite-button id="btn-reset" appearance="outline" scale="s">リセット（0.5）</calcite-button>
      <calcite-button id="btn-target0" appearance="outline" scale="s">先頭地物の形にする</calcite-button>
    </div>
  `;
}

function cardTemplate(r, idx) {
  // Cardは heading/description/footer など slot を使って構成する [3](https://r.esri.com/calcite/reference/calcite_slider.html)
  const canvasId = `radar-${escapeHtml(String(r.item.id ?? "noid"))}-${idx}`;

  return `
    <calcite-card>
      <span slot="heading">${escapeHtml(r.item.name ?? "(no name)")}</span>
      <span slot="description">id=${escapeHtml(String(r.item.id))} / sim=${r.sim.toFixed(4)}</span>

      <div class="radar-wrap">
        <canvas id="${canvasId}" width="240" height="180"></canvas>
      </div>

      <div slot="footer-start">
        <calcite-chip value="similar">類似</calcite-chip>
      </div>

      <div slot="footer-end">
        <calcite-button appearance="outline" scale="s" data-id="${escapeHtml(String(r.item.id))}">
          詳細
        </calcite-button>
      </div>
    </calcite-card>
  `;
}

// ========== Charts ==========
let queryChart = null;
let resultCharts = [];

function destroyResultCharts() {
  for (const c of resultCharts) c.destroy();
  resultCharts = [];
}

function renderQueryRadar(queryVec) {
  const canvas = document.getElementById("queryRadar");
  if (!canvas) return;

  if (queryChart) queryChart.destroy();

  queryChart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: FEATURE_LABELS,
      datasets: [{
        label: "query",
        data: queryVec,
        fill: true,
        backgroundColor: "rgba(0, 122, 194, 0.18)",
        borderColor: "rgba(0, 122, 194, 0.95)",
        pointBackgroundColor: "rgba(0, 122, 194, 1)",
        borderWidth: 2,
        pointRadius: 3
      }]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: { stepSize: 0.25, display: true },
          pointLabels: { font: { size: 12 } }
        }
      }
    }
  });
}

function renderResults(top10) {
  resultsDiv.innerHTML = `
    <h2>類似上位10件</h2>
    <calcite-card-group class="cards">
      ${top10.map((r, idx) => cardTemplate(r, idx)).join("")}
    </calcite-card-group>
  `;

  // カード内レーダー
  destroyResultCharts();

  for (let i = 0; i < top10.length; i++) {
    const r = top10[i];
    const canvasId = `radar-${String(r.item.id ?? "noid")}-${i}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) continue;

    const values = getFeatureValues(r.item, FEATURE_KEYS);

    const chart = new Chart(canvas, {
      type: "radar",
      data: {
        labels: FEATURE_LABELS,
        datasets: [{
          label: "f1〜f6",
          data: values,
          fill: true,
          backgroundColor: "rgba(0, 122, 194, 0.15)",
          borderColor: "rgba(0, 122, 194, 0.85)",
          pointBackgroundColor: "rgba(0, 122, 194, 1)",
          borderWidth: 2,
          pointRadius: 2
        }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          r: {
            min: 0,
            max: 1,
            ticks: { display: false },
            grid: { color: "rgba(0,0,0,0.12)" },
            angleLines: { color: "rgba(0,0,0,0.12)" },
            pointLabels: { display: false }
          }
        }
      }
    });

    resultCharts.push(chart);
  }
}

// ========== Sliders <-> Query ==========
function setSlidersFromQuery(queryVec) {
  FEATURE_KEYS.forEach((k, i) => {
    const el = document.getElementById(`slider-${k}`);
    if (el) el.value = queryVec[i];
  });
}

function readQueryFromSliders() {
  return FEATURE_KEYS.map((k) => {
    const el = document.getElementById(`slider-${k}`);
    const v = el ? Number(el.value) : 0.5;
    return clamp01(Number.isNaN(v) ? 0.5 : v);
  });
}

function updateValueLabels() {
  FEATURE_KEYS.forEach(k => {
    const s = document.getElementById(`slider-${k}`);
    const v = document.getElementById(`val-${k}`);
    if (s && v) v.textContent = Number(s.value).toFixed(2);
  });
}

function updateValueLabelForKey(k) {
  const slider = document.getElementById(`slider-${k}`);
  const label = document.getElementById(`val-${k}`);
  if (!slider || !label) return;

  // slider.value は number または string になり得るので Number() で揃える
  const v = Number(slider.value);
  label.textContent = Number.isNaN(v) ? "-" : v.toFixed(2);
}

function updateAllValueLabels() {
  for (const k of FEATURE_KEYS) updateValueLabelForKey(k);
}

// ========== Main ==========
(async () => {
  try {
    const data = await loadSakeData();
    if (data.length === 0) {
      queryDiv.innerHTML = "<p>CSVにデータがありません。</p>";
      resultsDiv.innerHTML = "";
      return;
    }

    normalizeFeaturesInPlace(data, FEATURE_KEYS);

    // 左：編集UI
    queryDiv.innerHTML = renderQueryUI();

    // 初期クエリ：0.5（または data[0] の形にしてもOK）
    let queryVec = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    setSlidersFromQuery(queryVec);

    // クエリレーダー初期描画
    renderQueryRadar(queryVec);

    // 更新（スライダー操作に追従）
    const update = createThrottled(() => {
      queryVec = readQueryFromSliders();
      renderQueryRadar(queryVec);

      const top10 = topNSimilarByQuery(queryVec, data, FEATURE_KEYS, 10);
      renderResults(top10);

      // ★ここに「地図ハイライト/選択」処理をつなげられます（必要なら）
      // onTop10Updated(top10);
    }, 120);

    // Sliderイベント：input（ドラッグ中）/change（確定）を両方拾う [2](https://esrijapan.github.io/arcgis-dev-resources/tips/calcite-design-system/get-started/)
    // FEATURE_KEYS.forEach((k) => {
    //   const el = document.getElementById(`slider-${k}`);
    //   if (!el) return;

    //   el.addEventListener("calciteSliderInput", update);
    //   el.addEventListener("calciteSliderChange", update);
    // });
    FEATURE_KEYS.forEach((k) => {
      const slider = document.getElementById(`slider-${k}`);
      if (!slider) return;

      // ドラッグ中：ラベルを追従
      slider.addEventListener("calciteSliderInput", () => {
        updateValueLabelForKey(k);
        // ついでに検索更新を走らせるならここで update() を呼ぶ
        // update();
      });

      // 確定時：最終値も反映
      slider.addEventListener("calciteSliderChange", () => {
        updateValueLabelForKey(k);
        // update();
      });
    });

    // ボタン：リセット
    document.getElementById("btn-reset")?.addEventListener("click", () => {
      queryVec = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      setSlidersFromQuery(queryVec);
      update();
    });

    // ボタン：先頭地物の形にする
    document.getElementById("btn-target0")?.addEventListener("click", () => {
      queryVec = getFeatureValues(data[0], FEATURE_KEYS);
      setSlidersFromQuery(queryVec);
      update();
    });

    // 初回反映
    update();

  } catch (err) {
    console.error(err);
    queryDiv.innerHTML = `<pre style="color:red;">${escapeHtml(String(err))}</pre>`;
    resultsDiv.innerHTML = "";
  }
})();
////////
import "@arcgis/core/assets/esri/themes/light/main.css";

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";

const map = new Map({
  basemap: "streets"
});

const view = new MapView({
  container: "viewDiv",
  map: map,
  center: [138.18, 36.65], // 長野県あたり
  zoom: 8
});
