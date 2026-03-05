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

import { FEATURE_KEYS, FEATURE_LABELS } from "../config/features.js";
import { clamp01 } from "../utils/math.js";

let registered = false;

export function initCharts() {
  if (registered) return;
  Chart.register(
    RadarController,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
  );
  registered = true;
}

function getFeatureValues(row, keys) {
  return keys.map((k) => {
    const v = row[k];
    const n = Number(v);
    return Number.isFinite(n) ? clamp01(n) : 0;
  });
}

let queryChart = null;
let resultCharts = [];

export function destroyResultCharts() {
  for (const c of resultCharts) c.destroy();
  resultCharts = [];
}

export function renderQueryRadar(queryVec) {
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
        r: { min: 0, max: 1, ticks: { stepSize: 0.25, display: true } }
      }
    }
  });
}

export function renderResultRadars(top) {
  destroyResultCharts();

  for (let i = 0; i < top.length; i++) {
    const r = top[i];
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
        scales: { r: { min: 0, max: 1, ticks: { display: false }, pointLabels: { display: false } } }
      }
    });

    resultCharts.push(chart);
  }
}