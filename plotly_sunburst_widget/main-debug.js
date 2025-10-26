(function () {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>:host { display:block; width:100%; height:100%; }</style>
    <div id="chart" style="width:100%;height:100%"></div>
  `;

  class SunburstDebug extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this._el = this.shadowRoot.getElementById("chart");
      this._props = { showLabels: true, maxDepth: 0 };
      this._binding = null;

      // Load Plotly dynamically (JSON-upload safe)
      if (!window.Plotly) {
        const s = document.createElement("script");
        s.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
        s.async = true;
        s.onload = () => console.log("[SunburstDebug] Plotly loaded");
        document.head.appendChild(s);
      }
    }

    onCustomWidgetBeforeUpdate() {}
    onCustomWidgetResize() { if (window.Plotly) Plotly.Plots.resize(this._el); }
    onCustomWidgetDestroy() {}

    onCustomWidgetAfterUpdate(changed) {
      if (changed.properties) Object.assign(this._props, changed.properties);
      if (changed.dataBinding) {
        this._binding = changed.dataBinding;
        try { console.log("[SunburstDebug] dataBinding:", JSON.parse(JSON.stringify(this._binding))); }
        catch { console.log("[SunburstDebug] dataBinding (raw):", this._binding); }
      }
      this.render();
    }

    render() {
      if (!this._binding) {
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>Bind data to render</p>";
        return;
      }
      if (this._binding.state && this._binding.state !== "success") {
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>Loading data...</p>";
        return;
      }

      const model = this._normalizeBinding(this._binding);
      if (!model || !model.rows?.length || !model.dimCount) {
        console.warn("[SunburstDebug] Unusable binding model:", model);
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>No usable data</p>";
        return;
      }

      const sep = "↳";
      const map = new Map();
      const ensure = (path) => {
        const id = path.join(sep);
        if (!map.has(id)) {
          const label = path[path.length - 1] || "Total";
          const parent = path.length <= 1 ? "" : path.slice(0, -1).join(sep);
          map.set(id, { id, label, parent, val: 0 });
        }
        return map.get(id);
      };

      ensure(["Total"]);

      for (const r of model.rows) {
        const v = Number.isFinite(r.val) ? r.val : 0;
        let p = ["Total"];
        ensure(p).val += v;
        for (const d of r.dims) {
          p = [...p, d];
          ensure(p).val += v;
        }
      }

      const labels = [], parents = [], values = [], ids = [];
      for (const [, n] of map) {
        labels.push(n.label);
        parents.push(n.parent);
        values.push(n.val);
        ids.push(n.id);
      }

      if (!window.Plotly) { setTimeout(() => this.render(), 80); return; }

      console.log("[SunburstDebug] nodes:", ids.length, "sum:", values.reduce((a,b)=>a+b,0));

      const trace = {
        type: "sunburst",
        labels, parents, values, ids,
        branchvalues: "total",
        marker: { line: { color: "#fff", width: 1 } },
        textinfo: this._props.showLabels ? "label+value" : "none"
      };
      const md = Number(this._props.maxDepth);
      if (Number.isFinite(md) && md > 0) trace.maxdepth = md;

      const layout = {
        margin: { l: 10, r: 10, t: 10, b: 10 },
        sunburstcolorway: [
          "#636efa","#EF553B","#00cc96","#ab63fa",
          "#FFA15A","#19d3f3","#FF6692","#B6E880",
          "#FF97FF","#FECB52"
        ],
        extendsunburstcolors: true
      };

      Plotly.react(this._el, [trace], layout, { displayModeBar: false, responsive: true });
    }

    // ------- Binding Normalizer for your tenant shape -------
    _normalizeBinding(db) {
      if (!Array.isArray(db.data) || !db.data.length) return null;

      const rows = [];
      let dimCount = 0;

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
            if (m && typeof m === "object") {
              // Try raw first
              let n = Number(m.raw);
              if (!Number.isFinite(n)) {
                // Fallback to formatted like "€1,234.56"
                const cleaned = String(m.formatted ?? "").replace(/[^\d.\-]/g, "");
                n = parseFloat(cleaned);
              }
              if (!Number.isFinite(n)) n = 0;
              val = n;
            }
          }
        }

        dimCount = Math.max(dimCount, dims.length);
        rows.push({ dims, val });
      }

      console.log(`[SunburstDebug] Parsed rows: ${rows.length} | Dims: ${dimCount}`);
      return { rows, dimCount };
    }
  }
// Version 5
  customElements.define("com-sree-sac-sunburst-debug", SunburstDebug);
})();
