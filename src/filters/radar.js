import { FEATURE_KEYS, FEATURE_LABELS } from "../config/features.js";
import { clamp01, createThrottled } from "../utils/math.js";
import { cosineSimilarityMissing, peakIndexRow } from "../logic/similarity.js";

function getFeatureValues(row, keys) {
  return keys.map((k) => {
    const v = row[k];
    const n = Number(v);
    return Number.isFinite(n) ? clamp01(n) : 0;
  });
}

export function createRadarFilter({ featureKeys = FEATURE_KEYS, featureLabels = FEATURE_LABELS } = {}) {
  let enabled = true;
  let queryVec = Array(featureKeys.length).fill(0.5);

  function setLabel(rootEl, k, val) {
    const el = rootEl.querySelector(`#val-${k}`);
    if (el) el.textContent = Number(val).toFixed(2);
  }

  function readFromSliders(rootEl) {
    return featureKeys.map((k) => {
      const s = rootEl.querySelector(`#slider-${k}`);
      const v = s ? Number(s.value) : 0.5;
      return clamp01(Number.isFinite(v) ? v : 0.5);
    });
  }

  return {
    id: "radar",

    init({ rootEl, data, onChange }) {
      if (!rootEl) return;

      rootEl.innerHTML = `
        <h2>レーダー（形）</h2>

        <div style="display:flex; gap:10px; align-items:center; margin:6px 0;">
          <label style="display:flex; gap:8px; align-items:center;">
            <input type="checkbox" id="radarEnabled" checked>
            <span>類似度で並べ替えを有効</span>
          </label>
          <button id="btn-reset" type="button">リセット（0.5）</button>
          <button id="btn-target0" type="button">先頭地物の形にする</button>
        </div>

        <div class="query-editor">
          <canvas id="queryRadar" width="320" height="240"></canvas>
          <div style="font-size:12px; color:#555;">
            スライダーで f1〜f6（0〜1）を調整。<br>
            類似度（cosine）で上位を抽出します。
          </div>
        </div>

        <div class="sliders">
          ${featureKeys.map((k, i) => `
            <div class="slider-row">
              <div class="slider-name">${featureLabels[i]}</div>
              <input id="slider-${k}" type="range" min="0" max="1" step="0.01" value="0.50">
              <div class="slider-val" id="val-${k}">0.50</div>
            </div>
          `).join("")}
        </div>
      `;

      const chk = rootEl.querySelector("#radarEnabled");
      chk.addEventListener("change", () => {
        enabled = chk.checked;
        onChange?.();
      });

      // slider更新はthrottle
      const fire = createThrottled(() => {
        queryVec = readFromSliders(rootEl);
        onChange?.();
      }, 120);

      featureKeys.forEach((k) => {
        const s = rootEl.querySelector(`#slider-${k}`);
        s.addEventListener("input", () => {
          setLabel(rootEl, k, s.value);
          fire();
        });
        s.addEventListener("change", () => {
          setLabel(rootEl, k, s.value);
          fire();
        });
      });

      // リセット
      rootEl.querySelector("#btn-reset").addEventListener("click", () => {
        queryVec = Array(featureKeys.length).fill(0.5);
        featureKeys.forEach((k, i) => {
          const s = rootEl.querySelector(`#slider-${k}`);
          if (s) s.value = queryVec[i];
          setLabel(rootEl, k, queryVec[i]);
        });
        onChange?.();
      });

      // 先頭地物（data[0]）を使う
      rootEl.querySelector("#btn-target0").addEventListener("click", () => {
        if (!data?.length) return;
        queryVec = getFeatureValues(data[0], featureKeys);
        featureKeys.forEach((k, i) => {
          const s = rootEl.querySelector(`#slider-${k}`);
          if (s) s.value = queryVec[i];
          setLabel(rootEl, k, queryVec[i]);
        });
        onChange?.();
      });
    },

    getRanker() {
      if (!enabled) return null;

      // queryVecを行形式に
      const qRow = {};
      featureKeys.forEach((k, i) => { qRow[k] = queryVec[i]; });

      const qPeak = peakIndexRow(qRow, featureKeys);

      return {
        label: "similarity",
        priority: 20,

        scoreOf: (row) => {
          // 「尖る向きが違うなら別物」：peak軸が違うものは除外
          const iPeak = peakIndexRow(row, featureKeys);
          if (qPeak !== -1 && iPeak !== -1 && qPeak !== iPeak) return null;

          return cosineSimilarityMissing(qRow, row, featureKeys, 2);
        },

        formatScore: (s) => (s == null ? "-" : Number(s).toFixed(4))
      };
    },

    getQueryVec() { return queryVec.slice(); },
    isEnabled() { return enabled; },

    getState() { return { enabled, queryVec }; },
    setState(s) {
      enabled = Boolean(s?.enabled);
      if (Array.isArray(s?.queryVec) && s.queryVec.length === featureKeys.length) {
        queryVec = s.queryVec.map(x => clamp01(Number(x)));
      }
    }
  };
}
``