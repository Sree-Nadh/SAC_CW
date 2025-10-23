
var getScriptPromisify = (src) => {
  return new Promise((resolve) => {
    $.getScript(src, resolve);
  });
};

(function () {
  const parseMetadata = (metadata) => {
    const { dimensions: dimsMap, mainStructureMembers: measMap } = metadata;
    const dims = [];
    for (const key in dimsMap) dims.push({ key, ...dimsMap[key] });
    const meas = [];
    for (const key in measMap) meas.push({ key, ...measMap[key] });
    return { dims, meas };
  };

  class Renderer {
    constructor(root) {
      this._root = root;
      this._plotReady = false;
    }

    async render(dataBinding, branchValues, maxDepth) {
      await getScriptPromisify("https://cdn.plot.ly/plotly-2.29.1.min.js");
      this.dispose();

      if (!dataBinding || dataBinding.state !== "success") return;

      const { data, metadata } = dataBinding;
      const { dims, meas } = parseMetadata(metadata);
      if (!data || data.length === 0 || dims.length === 0 || meas.length === 0) {
        this._root.innerHTML = "No data";
        return;
      }

      // Build hierarchical arrays
      const labels = [];
      const parents = [];
      const values = [];
      const keyIndex = new Map();

      const touch = (label, parent) => {
        const key = `${label}|${parent || ""}`;
        if (!keyIndex.has(key)) {
          labels.push(label);
          parents.push(parent || "");
          values.push(0);
          keyIndex.set(key, labels.length - 1);
        }
        return keyIndex.get(key);
      };

      data.forEach((row) => {
        const path = dims.map((d) => row[d.key].label);
        const val = Number(row[meas[0].key].raw) || 0;
        let parent = "";
        path.forEach((node, i) => {
          const idx = touch(node, parent);
          if (i === path.length - 1) values[idx] += val;
          parent = node;
        });
      });

      const chartData = [{
        type: "sunburst",
        labels,
        parents,
        values,
        branchvalues: branchValues || "total",
        maxdepth: maxDepth || 0,
        hovertemplate: "%{label}<br>%{value}<extra></extra>"
      }];

      const layout = {
        margin: { l: 0, r: 0, t: 0, b: 0 },
        width: this._root.clientWidth,
        height: this._root.clientHeight
      };

      Plotly.newPlot(this._root, chartData, layout, { displayModeBar: false });
      this._plotReady = true;

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (this._plotReady) {
          Plotly.relayout(this._root, {width: this._root.clientWidth, height: this._root.clientHeight});
        }
      });
      resizeObserver.observe(this._root);
      this._resizeObserver = resizeObserver;
    }

    dispose() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      if (this._plotReady && this._root) {
        try { Plotly.purge(this._root); } catch (e) {}
        this._plotReady = false;
      }
    }
  }

  const template = document.createElement("template");
  template.innerHTML = `
  <style>
    #chart { width:100%; height:100%; }
  </style>
  <div id="chart"></div>
  `;

  class Main extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));
      this._root = this._shadowRoot.getElementById("chart");
      this._renderer = new Renderer(this._root);
    }

    async onCustomWidgetAfterUpdate() {
      this._renderer.render(this.dataBinding, this.branchValues, this.maxDepth);
    }

    async onCustomWidgetResize() {
      this._renderer.render(this.dataBinding, this.branchValues, this.maxDepth);
    }

    async onCustomWidgetDestroy() {
      this._renderer.dispose();
    }
  }

  customElements.define("com-sap-sac-sample-plotly-sunburst", Main);
})();
