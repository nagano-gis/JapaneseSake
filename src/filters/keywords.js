export function createKeywordsFilter({ tagFields }) {
  let selected = new Set();
  let textFilter = "";

  function applyListFilter(rootEl) {
    const items = rootEl.querySelectorAll("[data-tag-item]");
    for (const el of items) {
      const label = String(el.getAttribute("data-tag-label") ?? "");
      const ok = !textFilter || label.toLowerCase().includes(textFilter.toLowerCase());
      el.style.display = ok ? "" : "none";
    }
  }

  return {
    id: "keywords",

    init({ rootEl, onChange }) {
      if (!rootEl) return;

      rootEl.innerHTML = `
        <h3>キーワード（AND）</h3>
        <input class="kw-search" id="kwSearch" type="text" placeholder="絞り込み（例：fruity）">
        <div class="kw-list" id="kwList">
          ${tagFields.map(f => {
            const label = f.replace("flavortags_", "");
            return `
              <div class="kw-item" data-tag-item data-tag-label="${label}">
                <input type="checkbox" data-tag="${f}">
                <span>${label}</span>
              </div>
            `;
          }).join("")}
        </div>
        <div style="margin-top:8px; font-size:12px; color:#555;">
          選択したタグが <b>すべて 1</b> のデータだけ残ります（AND）
        </div>
      `;

      const search = rootEl.querySelector("#kwSearch");
      search.addEventListener("input", () => {
        textFilter = search.value ?? "";
        applyListFilter(rootEl);
      });

      rootEl.addEventListener("change", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (!t.matches("input[type=checkbox][data-tag]")) return;

        const field = t.dataset.tag;
        if (!field) return;

        if (t.checked) selected.add(field);
        else selected.delete(field);

        onChange?.();
      });
    },

    getPredicate() {
      if (selected.size === 0) return null;
      return (row) => {
        for (const f of selected) {
          if (Number(row[f]) !== 1) return false;
        }
        return true;
      };
    },

    getState() { return { selected: Array.from(selected) }; },
    setState(s) { selected = new Set(s?.selected ?? []); }
  };
}