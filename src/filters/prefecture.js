export function createPrefectureFilter({ field = "name_area" } = {}) {
  let selected = "";

  return {
    id: "prefecture",

    init({ rootEl, data, onChange }) {
      if (!rootEl) return;

      const values = Array.from(new Set(data.map(r => r[field]).filter(v => v != null && String(v).trim() !== ""))).sort();

      rootEl.innerHTML = `
        <h3>都道府県</h3>
        <select id="prefSelect" style="width:100%; padding:6px 8px;">
          <option value="">すべて</option>
          ${values.map(v => `<option value="${String(v)}">${String(v)}</option>`).join("")}
        </select>
      `;

      const sel = rootEl.querySelector("#prefSelect");
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
``