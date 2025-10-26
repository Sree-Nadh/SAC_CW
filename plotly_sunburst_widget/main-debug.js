(function () {
  // ---------- Template ----------
  const template = document.createElement("template");
  template.innerHTML = `
    <style>:host{display:block;width:100%;height:100%;}</style>
    <div id="chart" style="width:100%;height:100%"></div>
  `;

  // ---------- Debug helpers ----------
  const DEBUG = true; // set false to silence logs
  const t0 = performance.now();
  const T = () => (performance.now() - t0).toFixed(1).padStart(7, " ");
  const log  = (...a) => DEBUG && console.log (`[SunburstDebug ${T()}ms]`, ...a);
  const warn = (...a) => DEBUG && console.warn(`[SunburstDebug ${T()}ms]`, ...a);

  // ready states we treat as “good to render”
  const READY = new Set(["success", "ready", "loaded", undefined]);

  class SunburstDebug extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this._el = this.shadowRoot.getElementById("chart");

      this._props = { showLabels: true, maxDepth: 0 };
      this._binding = null;           // latest SAC payload (may be "loading")
      this._lastGoodBinding = null;   // deep-cloned successful payload
      this._loadingSince = 0;         // for on-screen timer
      this._renderTimer = null;       // debounce handle

      // Dynamically load Plotly (JSON-upload safe)
      if (!window.Plotly) {
        const s = document.createElement("script");
        s.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
        s.async = true;
        s.onload = () => log("Plotly loaded");
        document.head.appendChild(s);
      }
    }

    // ---------- SAC lifecycle ----------
    onCustomWidgetBeforeUpdate() {}
    onCustomWidgetResize() { if (window.Plotly) Plotly.Plots.resize(this._el); }
    onCustomWidgetDestroy() {}

    onCustomWidgetAfterUpdate(changed) {
      if (changed.properties) {
        Object.assign(this._props, changed.properties);
        log("PROPS", this._props);
        this._scheduleRender("props");
      }

      if (changed.dataBinding) {
        this._binding = changed.dataBinding;

        // log state + quick stats
        const st = this._binding?.state;
        const rowsLen = Array.isArray(this._binding?.data) ? this._binding.data.length : 0;
        log("STATE", st, "• rows=", rowsLen);

        // cache a deep-cloned snapshot ONLY when ready/has rows
        const looksReady = READY.has(st);
        const hasRows   = rowsLen > 0;

        if (looksReady && hasRows) {
          try {
            // deep clone to avoid later mutations overwriting our good snapshot
            this._lastGoodBinding = JSON.parse(JSON.stringify(this._binding));
            log("CACHED good binding (deep clone)");
          } catch {
            // as a fallback keep a reference
            this._lastGoodBinding = this._binding;
            warn("Failed deep clone; using reference snapshot");
          }
        } else {
          log("Not caching (transient state)");
        }

        try { log("dataBinding", JSON.parse(JSON.stringify(this._binding))); }
        catch { log("dataBinding (raw)", this._binding); }

        this._scheduleRender("data");
      }
    }

    // ---------- Debounced render ----------
    _scheduleRender(reason) {
      if (this._renderTimer) cancelAnimationFrame(this._renderTimer);
      this._renderTimer = requestAnimationFrame(() => {
        this._renderTimer = null;
        this.render(reason);
      });
    }

    // ---------- Rendering ----------
    render(reason = "unknown") {
      // Prefer last good snapshot to avoid getting stuck on "loading"
      const binding = this._lastGoodBinding ?? this._binding;

      if (!binding) {
        log("RENDER BLOCKED: no binding at all");
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>Bind data to render</p>";
        return;
      }

      const st = binding.state;
      const looksReady = READY.has(st);

      if (!looksReady && !this._lastGoodBinding) {
        // only show loading when we don't yet have a good snapshot
        if (!this._loadingSince) this._loadingSince = performance.now();
        const ms = performance.now() - this._loadingSince;
        log("RENDER BLOCKED:", { reason: "loading", st, sinceMs: ms.toFixed(0) });
        this._el.innerHTML =
          `<p style="text-align:center;color:#999;">Loading data… (${Math.round(ms/1000)}s)</p>`;
        return;
      } else {
        this._loadingSince = 0;
      }

      // Normalize to rows for hierarchy building
      const model = this._normalizeBinding(binding);
      if (!model || !model.rows?.length || !model.dimCount) {
        warn("Unusable binding model:", model);
        this._el.innerHTML = "<p style='text-align:center;color:#999;'>No usable data</p>";
        return;
      }

      // Build hierarchy (ids are full paths to keep uniqueness)
      const sep = "↳";
      const map = new Map();
      const ensure = (path) => {
        const id = path.join(sep);
        if (!map.has(id)) {
          const label  = path[path.length - 1] || "Total";
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

      log("TRACE stats:", { nodes: ids.length, sum: values.reduce((a,b)=>a+b,0), reason, maxDepth: this._props.maxDepth });

      if (!window.Plotly) {
        log("WAITING for Plotly, will retry");
        setTimeout(() => this._scheduleRender("plotly-wait"), 80);
        return;
      }

      const trace = {
        type: "sunburst",
        labels, parents, values, ids,
        branchvalues: "total",
        marker: { line: { color: "#fff", width: 1 } },
        textinfo: this._props.showLabels ? "label+value" : "none"
      };

      const md = Number(this._props.maxDepth);
      trace.maxdepth = (Number.isFinite(md) && md > 0) ? md : undefined; // 0/NaN => auto

      const layout = {
        margin: { l: 10, r: 10, t: 10, b: 10 },
        sunburstcolorway: [
          "#636efa","#EF553B","#00cc96","#ab63fa",
          "#FFA15A","#19d3f3","#FF6692","#B6E880",
          "#FF97FF","#FECB52"
        ],
        extendsunburstcolors: true
      };

      Plotly.react(this._el, [trace], layout, { displayModeBar: false, responsive: true })
        .then(() => log("RENDER OK"))
        .catch(err => warn("RENDER ERROR:", err));
    }

    // ---------- Binding normalizer (dimensions_* / measures_* rows) ----------
    _normalizeBinding(db) {
      if (!Array.isArray(db.data) || !db.data.length) {
        warn("NORMALIZE: no rows in binding.data");
        return null;
      }

      const rows = [];
      let dimCount = 0;

      for (const r of db.data) {
        // sort dimension keys by numeric suffix to keep order stable
        const dimKeys = Object.keys(r)
          .filter(k => k.startsWith("dimensions_"))
          .sort((a,b) => parseInt(a.split("_")[1]||"0",10) - parseInt(b.split("_")[1]||"0",10));

        const dims = dimKeys.map(k => {
          const v = r[k];
          return (v && typeof v === "object") ? (v.label ?? v.id ?? "") : String(v ?? "");
        });

        // choose first measure_* and parse robustly
        const mKey = Object.keys(r).filter(k => k.startsWith("measures_"))
          .sort((a,b) => parseInt(a.split("_")[1]||"0",10) - parseInt(b.split("_")[1]||"0",10))[0];

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

      const sum = rows.reduce((a, r) => a + (Number.isFinite(r.val) ? r.val : 0), 0);
      log(`NORMALIZE: rows=${rows.length} dimCount=${dimCount} sum=${sum}`);
      if (!Number.isFinite(sum) || sum === 0) {
        warn("NORMALIZE: measure sum is 0 or NaN — check measure parsing / filters");
      }

      return { rows, dimCount };
    }

    // ---------- Utility: export current binding (call from console) ----------
    downloadBinding() {
      const binding = this._lastGoodBinding ?? this._binding;
      if (!binding) return;
      const blob = new Blob([JSON.stringify(binding, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "sunburst-binding.json"; a.click();
      URL.revokeObjectURL(url);
    }
  }

  // tag must match your index.json Version - 7
  customElements.define("com-sree-sac-sunburst-debug", SunburstDebug);
})();
