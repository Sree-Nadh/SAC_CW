(function () {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>:host{display:block;width:100%;height:100%;}</style>
    <div id="chart" style="width:100%;height:100%"></div>
  `;

  const READY = new Set(["success", "ready", "loaded", undefined]);

  class Sunburst extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this._el = this.shadowRoot.getElementById("chart");

      this._props = { showLabels: true, maxDepth: 4 };
      this._binding = null;
      this._lastGoodBinding = null;
      this._renderTimer = null;
      this._loadingSince = 0;

      if (!window.Plotly) {
        const s = document.createElement("script");
        s.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
        s.async = true;
        document.head.appendChild(s);
      }
    }

    onCustomWidgetBeforeUpdate() {}
    onCustomWidgetResize() { if (window.Plotly) Plotly.Plots.resize(this._el); }
    onCustomWidgetDestroy() {}

    onCustomWidgetAfterUpdate(changed) {
      if (changed.properties) {
        Object.assign(this._props, changed.properties);
        this._scheduleRender();
      }
      if (changed.dataBinding) {
        this._binding = changed.dataBinding;
        const st = this._binding?.state;
        const looksReady = READY.has(st);
        const hasRows = Array.isArray(this._binding?.data) && this._binding.data.length > 0;
        if (looksReady && hasRows) {
          try { this._lastGoodBinding = JSON.parse(JSON.stringify(this._binding)); }
          catch { this._lastGoodBinding = this._binding; }
        }
        this._scheduleRender();
      }
    }

    _scheduleRender() {
      if (this._renderTimer) cancelAnimationFrame(this._renderTimer);
      this._renderTimer = requestAnimationFrame(() => {
        this._renderTimer = null;
        this.render();
      });
    }

    render() {
      const binding = this._lastGoodBinding ?? this._binding;

      if (!binding) {
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>Bind data to render</p>";
        return;
      }

      const st = binding.state;
      const looksReady = READY.has(st);
      if (!looksReady && !this._lastGoodBinding) {
        if (!this._loadingSince) this._loadingSince = performance.now();
        const ms = performance.now() - this._loadingSince;
        this._el.innerHTML = `<p style="text-align:center;color:#999;">Loading data… (${Math.round(ms/1000)}s)</p>`;
        return;
      } else {
        this._loadingSince = 0;
      }

      const model = this._normalizeBinding(binding);
      if (!model || !model.rows?.length || !model.dimCount) {
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>No usable data</p>";
        return;
      }

      const sep = "↳";
      const nodeMap = new Map();
      const ensure = (path) => {
        const id = path.join(sep);
        if (!nodeMap.has(id)) {
          const label = path[path.length - 1] || "Total";
          const parent = path.length <= 1 ? "" : path.slice(0, -1).join(sep);
          nodeMap.set(id, { id, label, parent, val: 0 });
        }
        return nodeMap.get(id);
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
      for (const [, n] of nodeMap) {
        labels.push(n.label);
        parents.push(n.parent);
        values.push(n.val);
        ids.push(n.id);
      }

      if (!window.Plotly) { setTimeout(() => this._scheduleRender(), 80); return; }

      const trace = {
        type: "sunburst",
        labels, parents, values, ids,
        branchvalues: "total",
        marker: { line: { color: "#fff", width: 1 } },
        textinfo: this._props.showLabels ? "label+value" : "none"
      };

      const md = Number(this._props.maxDepth);
      trace.maxdepth = (Number.isFinite(md) && md > 0) ? md : undefined;

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

    _normalizeBinding(db) {
      if (Array.isArray(db.data) && db.data.length && typeof db.data[0] === "object" && !Array.isArray(db.data[0])) {
        const rows = [];
        let dimCount = 0;
        for (const r of db.data) {
          const dimKeys = Object.keys(r)
            .filter(k => k.startsWith("dimensions_"))
            .sort((a,b) => parseInt(a.split("_")[1]||"0",10) - parseInt(b.split("_")[1]||"0",10));
          const dims = dimKeys.map(k => {
            const v = r[k];
            return (v && typeof v === "object") ? (v.label ?? v.id ?? "") : String(v ?? "");
          });
          const mKey = Object.keys(r).filter(k => k.startsWith("measures_"))[0];
          let val = 0;
          if (mKey) {
            const m = r[mKey];
            if (m && typeof m === "object") {
              let n = Number(m.raw);
              if (!Number.isFinite(n)) {
                const cleaned = String(m.formatted ?? "").replace(/[^\d.\-]/g, "");
                n = parseFloat(cleaned);
              }
              if (Number.isFinite(n)) val = n;
            }
          }
          dimCount = Math.max(dimCount, dims.length);
          rows.push({ dims, val });
        }
        return { rows, dimCount };
      }
      return null;
    }
  }

  customElements.define("com-sree-sac-sunburst", Sunburst);
})();
