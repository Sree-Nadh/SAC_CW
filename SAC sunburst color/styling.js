// styling.js - minimal stub for SAC
(function () {
  const tmpl = document.createElement("template");
  tmpl.innerHTML = `
    <style>:host{display:block;padding:8px;font:12px system-ui,sans-serif}</style>
    <div>
      <label><input id="labels" type="checkbox" checked> Show Labels</label><br>
      <label>Max Depth: <input id="depth" type="number" min="0" step="1" value="4"></label><br>
      <small>0 = show all levels</small><br><br>
      <button id="apply">Apply</button>
    </div>
  `;

  class Styling extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(tmpl.content.cloneNode(true));
    }

    onCustomWidgetAfterUpdate(properties) {
      const showLabels = properties.showLabels ?? true;
      const maxDepth = properties.maxDepth ?? 4;
      this.shadowRoot.getElementById("labels").checked = showLabels;
      this.shadowRoot.getElementById("depth").value = maxDepth;
    }

    connectedCallback() {
      this.shadowRoot.getElementById("apply").addEventListener("click", () => {
        const props = {
          showLabels: this.shadowRoot.getElementById("labels").checked,
          maxDepth: Number(this.shadowRoot.getElementById("depth").value || 4)
        };
        this.dispatchEvent(new CustomEvent("propertiesChanged", { detail: { properties: props } }));
      });
    }
  }

  customElements.define("com-sree-sac-sunburst-styling", Styling);
})();
