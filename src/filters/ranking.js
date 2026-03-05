export function createRankingFilter() {
  let mode = "none"; // none | score_overall | rank_overall | score_area | rank_area

  return {
    id: "ranking",

    init({ rootEl, onChange }) {
      if (!rootEl) return;

      rootEl.innerHTML = `
        <h3>ランキング/スコア</h3>
        <select id="sortMode" style="width:100%; padding:6px 8px;">
          <option value="none">（並べ替えなし）</option>
          <option value="score_overall">全体スコア（高い順）</option>
          <option value="rank_overall">全体ランキング（小さい順）</option>
          <option value="score_area">地域スコア（高い順）</option>
          <option value="rank_area">地域ランキング（小さい順）</option>
        </select>
        <div style="margin-top:6px; font-size:12px; color:#555;">
          ※レーダー類似度が有効な場合は、類似度の並べ替えが優先されます
        </div>
      `;

      const sel = rootEl.querySelector("#sortMode");
      sel.addEventListener("change", () => {
        mode = sel.value;
        onChange?.();
      });
    },

    getRanker() {
      if (mode === "none") return null;

      if (mode.startsWith("score_")) {
        return {
          label: mode,
          priority: 10,
          scoreOf: (row) => {
            const v = Number(row[mode]);
            return Number.isFinite(v) ? v : null;
          },
          formatScore: (s) => (s == null ? "-" : Number(s).toFixed(3))
        };
      }

      if (mode.startsWith("rank_")) {
        // rankは小さいほど上位 → scoreを -rank にして降順に
        return {
          label: mode,
          priority: 10,
          scoreOf: (row) => {
            const v = Number(row[mode]);
            return Number.isFinite(v) ? -v : null;
          },
          formatScore: (s) => (s == null ? "-" : String(Math.round(-Number(s))))
        };
      }

      return null;
    },

    getState() { return { mode }; },
    setState(s) { mode = s?.mode ?? "none"; }
  };
}
``