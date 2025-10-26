(function () {
  const template = document.createElement("template");
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
      this._dataBinding = null;

      if (!window.Plotly) {
        const s = document.createElement("script");
        s.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
        s.async = true;
        s.onload = () => console.log("[SunburstDebug] Plotly loaded");
        document.head.appendChild(s);
      }
    }

    onCustomWidgetBeforeUpdate() {}
    onCustomWidgetResize() { this.render(); }
    onCustomWidgetDestroy() {}

    onCustomWidgetAfterUpdate(changedProps) {
      if (changedProps.properties)
        Object.assign(this._props, changedProps.properties);

      if (changedProps.dataBinding) {
        this._dataBinding = changedProps.dataBinding;
        try {
          console.log("[SunburstDebug] dataBinding:", JSON.parse(JSON.stringify(this._dataBinding)));
        } catch (e) {
          console.log("[SunburstDebug] dataBinding (raw):", this._dataBinding);
        }
      }

      this.render();
    }

    render() {
      if (!this._dataBinding) {
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>Bind data to render</p>";
        return;
      }

      if (this._dataBinding.state && this._dataBinding.state !== "success") {
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>Loading data...</p>";
        return;
      }

      const model = this._normalizeBinding(this._dataBinding);
      if (!model || !model.rows?.length || !model.dimLabels?.length) {
        console.warn("[SunburstDebug] Unusable binding model:", model);
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>No usable data</p>";
        return;
      }

      // --- Build hierarchy ---
      const sep = "↳";
      const map = new Map();
      const ensure = (arr) => {
        const id = arr.join(sep);
        if (!map.has(id)) {
          const label = arr[arr.length - 1] || "Total";
          const parent = arr.length <= 1 ? "" : arr.slice(0, -1).join(sep);
          map.set(id, { id, label, parent, val: 0 });
        }
        return map.get(id);
      };

      ensure(["Total"]);
      for (const row of model.rows) {
        const dims = row.dims;
        const val = row.val;
        let p = ["Total"];
        ensure(p).val += val;
        for (const d of dims) {
          p = [...p, d];
          ensure(p).val += val;
        }
      }

      // --- Plotly arrays ---
      const labels = [], parents = [], values = [], ids = [];
      for (const [, n] of map) {
        labels.push(n.label);
        parents.push(n.parent);
        values.push(n.val);
        ids.push(n.id);
      }

      if (!window.Plotly) {
        console.log("[SunburstDebug] Waiting for Plotly...");
        setTimeout(() => this.render(), 100);
        return;
      }

      const trace = {
        type: "sunburst",
        labels, parents, values, ids,
        branchvalues: "total",
        marker: { line: { color: "#fff", width: 1 } },
        textinfo: this._props.showLabels ? "label+value" : "none",
        maxdepth: this._props.maxDepth || null
      };

      const layout = {
        margin: { l: 10, r: 10, t: 10, b: 10 },
        sunburstcolorway: [
          "#636efa","#EF553B","#00cc96","#ab63fa",
          "#FFA15A","#19d3f3","#FF6692","#B6E880",
          "#FF97FF","#FECB52"
        ],
        extendsunburstcolors: true
      };

      Plotly.react(this._plot, [trace], layout, { displayModeBar: false, responsive: true });
    }

    /** Normalize the SAC binding that uses "dimensions_0", "measures_0" structure */
    _normalizeBinding(db) {
      if (!Array.isArray(db.data) || !db.data.length) return null;

      const rows = [];
      for (const r of db.data) {
        const dims = [];
        let val = 0;
        for (const k of Object.keys(r)) {
          if (k.startsWith("dimensions_")) {
            const v = r[k];
            if (v && typeof v === "object") dims.push(v.label ?? v.id ?? "");
          }
          if (k.startsWith("measures_")) {
            const m = r[k];
            if (m && typeof m === "object") val = Number(m.raw ?? m.formatted ?? 0);
          }
        }
        rows.push({ dims, val });
      }

      // Derive dimension labels (for logging)
      const firstRow = db.data[0];
      const dimLabels = Object.keys(firstRow).filter(k => k.startsWith("dimensions_"));
      console.log("[SunburstDebug] Parsed rows:", rows.length, "Dims:", dimLabels.length);

      return { rows, dimLabels };
    }
  }
//Version 4
  customElements.define("com-sree-sac-sunburst-debug", SunburstDebug);
})();
