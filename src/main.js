import "./style.css";

import { FEATURE_KEYS, FEATURE_LABELS } from "./config/features.js";

// import { initMap } from "./map/initMap.js";
import { initMap } from "./map/initMap.stub.js";
// import { syncToMap } from "./map/sync.js";
import { syncToMap } from "./map/sync.stub.js";

import { loadLayerRows } from "./data/sourceFeatureLayer.js";
import { buildStore } from "./data/store.js";
import { loadRadarCsvMap } from "./data/sourceCsvRadar.js";
import { overwriteRadarFromCsv } from "./data/merge.js";

import { FilterManager } from "./filters/manager.js";
import { createRadarFilter } from "./filters/radar.js";
import { createNameFilter } from "./filters/name.js";
import { createPrefectureFilter } from "./filters/prefecture.js";
import { createCategoryFilter } from "./filters/category.js";
import { createKeywordsFilter } from "./filters/keywords.js";
import { createRankingFilter } from "./filters/ranking.js";

import { initCharts, renderQueryRadar, renderResultRadars } from "./ui/charts.js";
import { renderResultsShell } from "./ui/templates.js";
import { escapeHtml } from "./utils/dom.js";
import { createThrottled } from "./utils/math.js";

// ====== 設定（URLは仮）======
const FEATURE_LAYER_URL = "https://services.arcgis.com/XXXXX/ArcGIS/rest/services/YourLayer/FeatureServer/0";

// CSV併用（必要ならtrue）
const USE_CSV_FOR_RADAR = false;
const CSV_RADAR_URL = "/data/test.csv"; // id,f1..f6 を含む想定

// ====== DOM ======
const queryDiv = document.querySelector("#queryDiv");
const resultsDiv = document.querySelector("#resultsDiv");

if (!queryDiv) throw new Error("#queryDiv が見つかりません。");
if (!resultsDiv) throw new Error("#resultsDiv が見つかりません。");

// ====== 起動 ======
(async () => {
  try {
    initCharts();

    // 地図初期化（長野県あたり）
    const { view, layer, layerView } = await initMap({
      layerUrl: FEATURE_LAYER_URL,
      center: [138.18, 36.65],
      zoom: 8
    });

    // FeatureLayer から属性ロード
    const baseOutFields = [
      "id",
      "name",
      "name_area",
      "category",
      ...FEATURE_KEYS,
      "rank_overall",
      "score_overall",
      "rank_area",
      "score_area"
    ];

    const { rows, tagFields } = await loadLayerRows({
      layerUrl: FEATURE_LAYER_URL,
      baseOutFields
    });

    if (!rows.length) {
      queryDiv.innerHTML = "<p>FeatureLayerにデータがありません。</p>";
      resultsDiv.innerHTML = "";
      return;
    }

    // store作成（型寄せ＋候補生成）
    const store = buildStore(rows, tagFields);

    // CSV併用（f1..f6だけ上書き）
    if (USE_CSV_FOR_RADAR) {
      const radarMap = await loadRadarCsvMap(CSV_RADAR_URL);
      const hit = overwriteRadarFromCsv(store.rows, radarMap);
      console.log(`CSVから f1..f6 を上書き: ${hit}件`);
    }

    // ====== FilterManager 作成 ======
    const fm = new FilterManager({ topN: 10 });

    // レーダーフィルターは queryDiv にUIを描く
    const radarFilter = createRadarFilter({ featureKeys: FEATURE_KEYS, featureLabels: FEATURE_LABELS });

    fm.register(createNameFilter({ field: "name" }));
    fm.register(createPrefectureFilter({ field: "name_area" }));
    fm.register(createCategoryFilter({ field: "category" }));
    fm.register(createKeywordsFilter({ tagFields: store.tagFields }));
    fm.register(createRankingFilter());
    fm.register(radarFilter);

    // 更新処理（throttle）
    const update = createThrottled(() => {
      const { top, filteredObjectIds } = fm.applyAll(store.rows);

      // Query radar（現在のqueryVec）
      renderQueryRadar(radarFilter.getQueryVec());

      // 結果UI
      resultsDiv.innerHTML = renderResultsShell(top);
      renderResultRadars(top);

      // 地図同期：候補をフィルタ、上位をハイライト
      const topObjectIds = top.map(r => r.item.objectId);
      syncToMap(layerView, filteredObjectIds, topObjectIds);
    }, 120);

    // 各フィルターのUIを初期化
    fm.initAll({
      rootMap: {
        radar: queryDiv,
        name: document.querySelector("#filter-name"),
        prefecture: document.querySelector("#filter-prefecture"),
        category: document.querySelector("#filter-category"),
        keywords: document.querySelector("#filter-keywords"),
        ranking: document.querySelector("#filter-ranking")
      },
      data: store.rows,
      onChange: update
    });

    // 結果カードの「地図へ」ボタン：該当 feature にズーム
    resultsDiv.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button[data-objectid]");
      if (!btn) return;

      const oid = Number(btn.getAttribute("data-objectid"));
      if (!Number.isFinite(oid)) return;

      // geometry付きで1件だけ再クエリしてズーム
      const res = await layer.queryFeatures({
        objectIds: [oid],
        outFields: ["*"],
        returnGeometry: true
      });
      const f = res.features?.[0];
      if (!f) return;

      await view.goTo({ target: f.geometry, zoom: Math.max(view.zoom, 12) }, { duration: 500 });
    });

    // 初回表示
    update();

  } catch (err) {
    console.error(err);
    queryDiv.innerHTML = `<pre style="color:red;">${escapeHtml(String(err))}</pre>`;
    resultsDiv.innerHTML = "";
  }
})();