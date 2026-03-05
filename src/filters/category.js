export function createCategoryFilter({ field = "category" } = {}) {
  let selected = "";

  return {
    id: "category",

    init({ rootEl, data, onChange }) {
      if (!rootEl) return;

      const values = Array.from(new Set(data.map(r => r[field]).filter(v => v != null && String(v).trim() !== ""))).sort();

      rootEl.innerHTML = `
        <h3>カテゴリ</h3>
        <select id="catSelect" style="width:100%; padding:6px 8px;">
          <option value="">すべて</option>
          ${values.map(v => `<option value="${String(v)}">${String(v)}</option>`).join("")}
        </select>
      `;

      const sel = rootEl.querySelector("#catSelect");
      sel.addEventListener("change", () => {
        selected = sel.value;
        onChange?.();
      });
    },

    getPredicate() {
      if (!selected) return null;
      return (row) => String(row[field] ?? "") === selected;
    },

    getState() { return { selected }; },
    setState(s) { selected = s?.selected ?? ""; }
  };
}