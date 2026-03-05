
import { createDebounced } from "../utils/math.js";

export function createNameFilter({ field = "name" } = {}) {
  let q = "";

  return {
    id: "name",

    init({ rootEl, onChange }) {
      if (!rootEl) return;

      rootEl.innerHTML = `
        <h3>名称</h3>
        <input id="nameQuery" type="text" placeholder="名称を部分一致で検索" style="width:100%; padding:6px 8px;">
      `;

      const input = rootEl.querySelector("#nameQuery");
      const fire = createDebounced(() => {
        q = String(input.value ?? "").trim();
        onChange?.();
      }, 200);

      input.addEventListener("input", fire);
    },

    getPredicate() {
      if (!q) return null;
      const ql = q.toLowerCase();
      return (row) => String(row[field] ?? "").toLowerCase().includes(ql);
    },

    getState() { return { q }; },
    setState(s) { q = s?.q ?? ""; }
  };
}