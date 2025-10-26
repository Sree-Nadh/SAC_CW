(function () {
  let template = document.createElement("template");
  template.innerHTML = `
    <style>:host { display:block; width:100%; height:100%; }</style>
    <div id="chart"></div>
  `;

  class SunburstDebug extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this._plot = this.shadowRoot.getElementById("chart");
      this._props = { showLabels: true, maxDepth: 0 };

      // ✅ dynamically load Plotly
      if (!window.Plotly) {
        const s = document.createElement("script");
        s.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
        s.onload = () => console.log("[SunburstDebug] Plotly loaded");
        document.head.appendChild(s);
      }
    }

    // Lifecycle hooks
    onCustomWidgetBeforeUpdate() {}
    onCustomWidgetResize() {}
    onCustomWidgetDestroy() {}

    onCustomWidgetAfterUpdate(changedProps) {
      if (changedProps.properties) Object.assign(this._props, changedProps.properties);
      if (changedProps.dataBinding) this._dataBinding = changedProps.dataBinding;
      this.render();
    }

    render() {
      if (!this._dataBinding || !this._dataBinding.data) {
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>Bind data to render</p>";
        return;
      }

      const db = this._dataBinding;
      const dims = db.dimensions.map(d => d.id);
      const measure = db.measures[0].id;
      const sep = "↳";
      const nodeMap = new Map();
      const ensure = arr => {
        const id = arr.join(sep);
        if (!nodeMap.has(id)) {
          const label = arr[arr.length - 1] || "Total";
          const parent = arr.length <= 1 ? "" : arr.slice(0, -1).join(sep);
          nodeMap.set(id, { id, label, parent, val: 0 });
        }
        return nodeMap.get(id);
      };
      ensure(["Total"]);
      for (const row of db.data) {
        const dvals = dims.map(h => String(row[h] ?? "(blank)"));
        const v = Number(row[measure]) || 0;
        let p = ["Total"];
        ensure(p).val += v;
        for (const d of dvals) {
          p = [...p, d];
          ensure(p).val += v;
        }
      }

      const labels = [], parents = [], values = [], ids = [];
      for (const [, n] of nodeMap) {
        labels.push(n.label);
        parents.push(n.parent);
        values.push(n.val);
        ids.push(n.id);
      }

      if (!window.Plotly) {
        console.warn("Plotly not loaded yet, retrying...");
        setTimeout(() => this.render(), 100);
        return;
      }

      Plotly.react(this._plot, [{
        type: "sunburst",
        labels, parents, values, ids,
        branchvalues: "total",
        marker: { line: { color: "#fff", width: 1 } },
        textinfo: this._props.showLabels ? "label+value" : "none",
        maxdepth: this._props.maxDepth || null
      }], {
        margin: { l: 10, r: 10, t: 10, b: 10 },
        sunburstcolorway: ["#636efa","#EF553B","#00cc96","#ab63fa","#FFA15A","#19d3f3","#FF6692"],
        extendsunburstcolors: true
      }, { displayModeBar: false });
    }
  }

  customElements.define("com-sree-sac-sunburst-debug", SunburstDebug);
})();