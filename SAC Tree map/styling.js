(function () {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `
    <style>:host{display:block;padding:8px;font:12px system-ui,sans-serif}</style>
    <div>
      <label><input id="labels" type="checkbox" checked> Show Labels</label><br>
      <label>Max Depth: <input id="depth" type="number" min="0" step="1" value="4"></label><br>
      <label>Tiling:
        <select id="tiling">
          <option value="squarify" selected>Squarify</option>
          <option value="binary">Binary</option>
          <option value="slice">Slice</option>
          <option value="dice">Dice</option>
          <option value="slice-dice">Slice-Dice</option>
        </select>
      </label><br><br>
      <small>Depth 0 = show all levels</small><br><br>
      <button id="apply">Apply</button>
    </div>
  `;

  class Styling extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(tmpl.content.cloneNode(true));
    }

    onCustomWidgetAfterUpdate(p) {
      const showLabels = p.showLabels ?? true;
      const maxDepth   = p.maxDepth   ?? 4;
      const tiling     = p.tiling     ?? "squarify";
      this.shadowRoot.getElementById("labels").checked = showLabels;
      this.shadowRoot.getElementById("depth").value   = maxDepth;
      this.shadowRoot.getElementById("tiling").value  = tiling;
    }

    connectedCallback() {
      this.shadowRoot.getElementById("apply").addEventListener("click", () => {
        const props = {
          showLabels: this.shadowRoot.getElementById("labels").checked,
          maxDepth: Number(this.shadowRoot.getElementById("depth").value || 4),
          tiling: this.shadowRoot.getElementById("tiling").value
        };
        this.dispatchEvent(new CustomEvent("propertiesChanged", { detail: { properties: props } }));
      });
    }
  }

  customElements.define("com-sree-sac-treemap-styling", Styling);
})();
