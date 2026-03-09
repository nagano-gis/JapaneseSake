import "@esri/calcite-components/main.css";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
defineCustomElements(window);

import "./style.css";

import { FEATURE_KEYS, FEATURE_LABELS } from "./config/features.js";

// 地図なしテスト
import { initMap } from "./map/initMap.stub.js";
import { syncToMap } from "./map/sync.stub.js";

// データもスタブ
import { loadLayerRows } from "./data/sourceFeatureLayer.stub.js";
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
const FEATURE_LAYER_URL =
  "https://services.arcgis.com/XXXXX/ArcGIS/rest/services/YourLayer/FeatureServer/0";

// CSV併用（必要ならtrue）
const USE_CSV_FOR_RADAR = false;
const CSV_RADAR_URL = "/data/test.csv"; // id,f1..f6 を含む想定

// ====== DOM ======
// ★#queryDiv は廃止：レーダーは #tab-radar に描画する（index.html の新構成）
const radarRoot = document.querySelector("#tab-radar");
const resultsDiv = document.querySelector("#resultsDiv");

// （任意）フィルター側も見つからないと困るのでチェックしておくとデバッグが楽
const nameRoot = document.querySelector("#filter-name");
const prefRoot = document.querySelector("#filter-prefecture");
const catRoot = document.querySelector("#filter-category");
const rankRoot = document.querySelector("#filter-ranking");
const keywordsRoot = document.querySelector("#tab-keywords");

if (!radarRoot) throw new Error("#tab-radar が見つかりません（index.html のタブ構成を確認）");
if (!keywordsRoot) throw new Error("#tab-keywords が見つかりません（index.html のタブ構成を確認）");
if (!resultsDiv) throw new Error("#resultsDiv が見つかりません。");

// これらは “無いとフィルターが出ない” ので、落とすならここで落とす方が分かりやすい
if (!nameRoot) throw new Error("#filter-name が見つかりません。");
if (!prefRoot) throw new Error("#filter-prefecture が見つかりません。");
if (!catRoot) throw new Error("#filter-category が見つかりません。");
if (!rankRoot) throw new Error("#filter-ranking が見つかりません。");

// ====== 起動 ======
(async () => {
  try {
    initCharts();

    // 地図初期化（スタブなら null が返ってもOK）
    const { view, layer, layerView } = await initMap({
      layerUrl: FEATURE_LAYER_URL,
      center: [138.18, 36.65],
      zoom: 8
    });

    // FeatureLayer から属性ロード（スタブからでも同じIF）
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
      radarRoot.innerHTML = "<p>データがありません。</p>";
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

    // レーダーフィルター：描画先は #tab-radar（radarRoot）
    const radarFilter = createRadarFilter({
      featureKeys: FEATURE_KEYS,
      featureLabels: FEATURE_LABELS
    });

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

      // 地図同期（スタブでも安全：syncToMap が空実装ならOK）
      const topObjectIds = top.map(r => r.item.objectId);
      syncToMap(layerView, filteredObjectIds, topObjectIds);
    }, 120);

    // 各フィルターのUIを初期化（描画先を新DOMに統一）
    fm.initAll({
      rootMap: {
        // 基本フィルタタブ
        name: nameRoot,
        prefecture: prefRoot,
        category: catRoot,
        ranking: rankRoot,

        // フレーバータブ（上下）
        radar: radarRoot,
        keywords: keywordsRoot
      },
      data: store.rows,
      onChange: update
    });

    // 結果カードの「地図へ」ボタン（地図スタブ時は layer/view が無いのでガード）
    resultsDiv.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button[data-objectid]");
      if (!btn) return;

      const oid = Number(btn.getAttribute("data-objectid"));
      if (!Number.isFinite(oid)) return;

      // ★地図があるときだけ動かす（スタブでは layer/view が null の可能性）
      if (!layer || !view || typeof layer.queryFeatures !== "function" || typeof view.goTo !== "function") {
        console.warn("地図が初期化されていないため、ズーム処理をスキップしました。");
        return;
      }

      const res = await layer.queryFeatures({
        objectIds: [oid],
        outFields: ["*"],
        returnGeometry: true
      });

      const f = res.features?.[0];
      if (!f) return;

      await view.goTo(
        { target: f.geometry, zoom: Math.max(view.zoom, 12) },
        { duration: 500 }
      );
    });

    // 初回表示
    update();

  } catch (err) {
    console.error(err);
    // ★エラー出力先も #tab-radar にする（#queryDiv は存在しないため）
    radarRoot.innerHTML = `<pre style="color:red;">${escapeHtml(String(err))}</pre>`;
    resultsDiv.innerHTML = "";
  }
})();
``


// import "@esri/calcite-components/main.css";
// import { defineCustomElements } from "@esri/calcite-components/dist/loader";

// defineCustomElements(window);

// import "./style.css";

// import { FEATURE_KEYS, FEATURE_LABELS } from "./config/features.js";

// // import { initMap } from "./map/initMap.js";
// import { initMap } from "./map/initMap.stub.js";
// // import { syncToMap } from "./map/sync.js";
// import { syncToMap } from "./map/sync.stub.js";

// // import { loadLayerRows } from "./data/sourceFeatureLayer.js";
// import { loadLayerRows } from "./data/sourceFeatureLayer.stub.js";
// import { buildStore } from "./data/store.js";
// import { loadRadarCsvMap } from "./data/sourceCsvRadar.js";
// import { overwriteRadarFromCsv } from "./data/merge.js";

// import { FilterManager } from "./filters/manager.js";
// import { createRadarFilter } from "./filters/radar.js";
// import { createNameFilter } from "./filters/name.js";
// import { createPrefectureFilter } from "./filters/prefecture.js";
// import { createCategoryFilter } from "./filters/category.js";
// import { createKeywordsFilter } from "./filters/keywords.js";
// import { createRankingFilter } from "./filters/ranking.js";

// import { initCharts, renderQueryRadar, renderResultRadars } from "./ui/charts.js";
// import { renderResultsShell } from "./ui/templates.js";
// import { escapeHtml } from "./utils/dom.js";
// import { createThrottled } from "./utils/math.js";

// // ====== 設定（URLは仮）======
// const FEATURE_LAYER_URL = "https://services.arcgis.com/XXXXX/ArcGIS/rest/services/YourLayer/FeatureServer/0";

// // CSV併用（必要ならtrue）
// const USE_CSV_FOR_RADAR = false;
// const CSV_RADAR_URL = "/data/test.csv"; // id,f1..f6 を含む想定

// // ====== DOM ======
// const queryDiv = document.querySelector("#queryDiv");
// const resultsDiv = document.querySelector("#resultsDiv");

// if (!queryDiv) throw new Error("#queryDiv が見つかりません。");
// if (!resultsDiv) throw new Error("#resultsDiv が見つかりません。");

// // ====== 起動 ======
// (async () => {
//   try {
//     initCharts();

//     // 地図初期化（長野県あたり）
//     const { view, layer, layerView } = await initMap({
//       layerUrl: FEATURE_LAYER_URL,
//       center: [138.18, 36.65],
//       zoom: 8
//     });

//     // FeatureLayer から属性ロード
//     const baseOutFields = [
//       "id",
//       "name",
//       "name_area",
//       "category",
//       ...FEATURE_KEYS,
//       "rank_overall",
//       "score_overall",
//       "rank_area",
//       "score_area"
//     ];

//     const { rows, tagFields } = await loadLayerRows({
//       layerUrl: FEATURE_LAYER_URL,
//       baseOutFields
//     });

//     if (!rows.length) {
//       queryDiv.innerHTML = "<p>FeatureLayerにデータがありません。</p>";
//       resultsDiv.innerHTML = "";
//       return;
//     }

//     // store作成（型寄せ＋候補生成）
//     const store = buildStore(rows, tagFields);

//     // CSV併用（f1..f6だけ上書き）
//     if (USE_CSV_FOR_RADAR) {
//       const radarMap = await loadRadarCsvMap(CSV_RADAR_URL);
//       const hit = overwriteRadarFromCsv(store.rows, radarMap);
//       console.log(`CSVから f1..f6 を上書き: ${hit}件`);
//     }

//     // ====== FilterManager 作成 ======
//     const fm = new FilterManager({ topN: 10 });

//     // レーダーフィルターは queryDiv にUIを描く
//     const radarFilter = createRadarFilter({ featureKeys: FEATURE_KEYS, featureLabels: FEATURE_LABELS });

//     fm.register(createNameFilter({ field: "name" }));
//     fm.register(createPrefectureFilter({ field: "name_area" }));
//     fm.register(createCategoryFilter({ field: "category" }));
//     fm.register(createKeywordsFilter({ tagFields: store.tagFields }));
//     fm.register(createRankingFilter());
//     fm.register(radarFilter);

//     // 更新処理（throttle）
//     const update = createThrottled(() => {
//       const { top, filteredObjectIds } = fm.applyAll(store.rows);

//       // Query radar（現在のqueryVec）
//       renderQueryRadar(radarFilter.getQueryVec());

//       // 結果UI
//       resultsDiv.innerHTML = renderResultsShell(top);
//       renderResultRadars(top);

//       // 地図同期：候補をフィルタ、上位をハイライト
//       const topObjectIds = top.map(r => r.item.objectId);
//       syncToMap(layerView, filteredObjectIds, topObjectIds);
//     }, 120);

//     // 各フィルターのUIを初期化
//     fm.initAll({
//       rootMap: {

//         // その他タブ
//         name: document.querySelector("#filter-name"),
//         prefecture: document.querySelector("#filter-prefecture"),
//         category: document.querySelector("#filter-category"),
//         ranking: document.querySelector("#filter-ranking"),

//         // 2タブ目（上下）
//         radar: document.querySelector("#tab-radar"),
//         keywords: document.querySelector("#tab-keywords"),


//         // radar: queryDiv,
//         // name: document.querySelector("#filter-name"),
//         // prefecture: document.querySelector("#filter-prefecture"),
//         // category: document.querySelector("#filter-category"),
//         // keywords: document.querySelector("#filter-keywords"),
//         // ranking: document.querySelector("#filter-ranking")
//       },
//       data: store.rows,
//       onChange: update
//     });

//     // 結果カードの「地図へ」ボタン：該当 feature にズーム
//     resultsDiv.addEventListener("click", async (e) => {
//       const btn = e.target?.closest?.("button[data-objectid]");
//       if (!btn) return;

//       const oid = Number(btn.getAttribute("data-objectid"));
//       if (!Number.isFinite(oid)) return;

//       // geometry付きで1件だけ再クエリしてズーム
//       const res = await layer.queryFeatures({
//         objectIds: [oid],
//         outFields: ["*"],
//         returnGeometry: true
//       });
//       const f = res.features?.[0];
//       if (!f) return;

//       await view.goTo({ target: f.geometry, zoom: Math.max(view.zoom, 12) }, { duration: 500 });
//     });

//     // 初回表示
//     update();

//   } catch (err) {
//     console.error(err);
//     queryDiv.innerHTML = `<pre style="color:red;">${escapeHtml(String(err))}</pre>`;
//     resultsDiv.innerHTML = "";
//   }
// })();