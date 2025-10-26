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

    // --- SAC lifecycle ---
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

    // --- Rendering logic ---
    render() {
      // No binding at all
      if (!this._dataBinding) {
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>Bind data to render</p>";
        return;
      }

      // Skip if SAC is still loading data
      if (this._dataBinding.state && this._dataBinding.state !== "success") {
        console.log("[SunburstDebug] Waiting for data, current state:", this._dataBinding.state);
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>Loading data...</p>";
        return;
      }

      // Normalize SAC binding to usable format
      const model = this._normalizeBinding(this._dataBinding);
      if (!model || !model.rows?.length || !model.dimIds?.length || !model.measureId) {
        console.warn("[SunburstDebug] Unusable binding model:", model);
        this._plot.innerHTML = "<p style='text-align:center;color:#999;'>No data or unknown format</p>";
        return;
      }

      // Build hierarchy
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
        const dims = model.dimIds.map(h => String(row[h] ?? "(blank)"));
        const v = Number(row[model.measureId]) || 0;
        let p = ["Total"];
        ensure(p).val += v;
        for (const d of dims) {
          p = [...p, d];
          ensure(p).val += v;
        }
      }

      // Convert to Plotly arrays
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
        textinfo: this._props.showLabels ? "label+value" : "none"
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

      if (Number(this._props.maxDepth) > 0)
        trace.maxdepth = Number(this._props.maxDepth);

      Plotly.react(this._plot, [trace], layout, {
        displayModeBar: false,
        responsive: true
      });
    }

    // --- Binding Normalizer ---
    _normalizeBinding(db) {
      // Simple format: top-level dimensions + measures + data
      if (db.dimensions?.length && db.measures?.length && Array.isArray(db.data)) {
        if (db.data.length && typeof db.data[0] === "object" && !Array.isArray(db.data[0])) {
          return {
            rows: db.data,
            dimIds: db.dimensions.map(d => d.id ?? d.name ?? d.key).filter(Boolean),
            measureId: db.measures[0].id ?? db.measures[0].name ?? db.measures[0].key
          };
        }
      }

      // Metadata format
      if (db.metadata?.dimensions?.length && db.metadata?.measures?.length && Array.isArray(db.data)) {
        const dimIds = db.metadata.dimensions.map(d => d.id ?? d.name ?? d.key).filter(Boolean);
        const measureId = db.metadata.measures[0]?.id ?? db.metadata.measures[0]?.name ?? db.metadata.measures[0]?.key;
        if (!dimIds.length || !measureId) return null;

        // Object rows
        if (db.data.length && typeof db.data[0] === "object" && !Array.isArray(db.data[0])) {
          return { rows: db.data, dimIds, measureId };
        }

        // Array rows
        if (db.data.length && Array.isArray(db.data[0])) {
          const headers = [...dimIds, measureId];
          const rows = db.data.map(arr => {
            const o = {};
            for (let i = 0; i < headers.length && i < arr.length; i++) o[headers[i]] = arr[i];
            return o;
          });
          return { rows, dimIds, measureId };
        }
      }

      console.warn("[SunburstDebug] Unhandled binding shape:", db);
      return null;
    }
  }
//Version 3
  customElements.define("com-sree-sac-sunburst-debug", SunburstDebug);
})();
