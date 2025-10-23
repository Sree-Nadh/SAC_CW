var getScriptPromisify = (src) => {
  return new Promise((resolve) => {
    $.getScript(src, resolve);
  });
};

(function () {
  console.log('[Sunburst] Widget script loaded');

  const parseMetadata = metadata => {
    const { dimensions: dimensionsMap, mainStructureMembers: measuresMap } = metadata
    const dimensions = []
    for (const key in dimensionsMap) {
      const dimension = dimensionsMap[key]
      dimensions.push({ key, ...dimension })
    }
    const measures = []
    for (const key in measuresMap) {
      const measure = measuresMap[key]
      measures.push({ key, ...measure })
    }
    console.log('[Sunburst] Parsed metadata:', { dimensions, measures });
    return { dimensions, measures, dimensionsMap, measuresMap }
  }

  class Renderer {
    constructor (root) {
      this._root = root
      this._plotly = null
      console.log('[Sunburst] Renderer initialized');
    }

    async render (dataBinding, colorScheme, showLabels, textInfo) {
      console.log('[Sunburst] Render called with:', { 
        dataBinding, 
        colorScheme, 
        showLabels, 
        textInfo 
      });

      try {
        // Load Plotly
        console.log('[Sunburst] Loading Plotly...');
        await getScriptPromisify("https://cdn.plot.ly/plotly-2.26.0.min.js");
        console.log('[Sunburst] Plotly loaded successfully');

        this.dispose()

        if (!dataBinding) {
          console.warn('[Sunburst] No dataBinding provided');
          this._root.innerHTML = '<div style="padding: 20px; text-align: center;">No data binding configured</div>';
          return;
        }

        console.log('[Sunburst] DataBinding state:', dataBinding.state);

        if (dataBinding.state !== 'success') {
          console.warn('[Sunburst] DataBinding not successful:', dataBinding.state);
          this._root.innerHTML = '<div style="padding: 20px; text-align: center;">Waiting for data...</div>';
          return;
        }

        const { data, metadata } = dataBinding
        console.log('[Sunburst] Data received:', { 
          rowCount: data?.length, 
          metadata 
        });

        if (!data || data.length === 0) {
          console.warn('[Sunburst] No data available');
          this._root.innerHTML = '<div style="padding: 20px; text-align: center;">No data available</div>';
          return;
        }

        const { dimensions, measures } = parseMetadata(metadata)

        if (dimensions.length === 0) {
          console.warn('[Sunburst] No dimensions configured');
          this._root.innerHTML = '<div style="padding: 20px; text-align: center;">Please add dimensions to the Dimensions feed</div>';
          return;
        }

        if (measures.length === 0) {
          console.warn('[Sunburst] No measures configured');
          this._root.innerHTML = '<div style="padding: 20px; text-align: center;">Please add a measure to the Measures feed</div>';
          return;
        }

        // Build hierarchical structure for sunburst
        const labels = []
        const parents = []
        const values = []
        const ids = []

        // Add root
        labels.push('Total')
        parents.push('')
        values.push(0)
        ids.push('root')

        console.log('[Sunburst] Building hierarchy from', data.length, 'rows');

        // Process each data row
        data.forEach((row, idx) => {
          let parentId = 'root'
          let currentPath = ''

          // Build hierarchy through dimensions
          dimensions.forEach((dimension, dimIdx) => {
            const dimValue = row[dimension.key]?.label || row[dimension.key]?.raw || 'Unknown'
            currentPath += (currentPath ? '/' : '') + dimValue
            const currentId = currentPath

            // Check if this node already exists
            const existingIndex = ids.indexOf(currentId)
            
            if (existingIndex === -1) {
              // New node
              labels.push(String(dimValue))
              parents.push(parentId)
              ids.push(currentId)
              
              // If this is the last dimension, use the measure value
              if (dimIdx === dimensions.length - 1) {
                const measureValue = row[measures[0].key]?.raw || 0
                values.push(Number(measureValue))
              } else {
                values.push(0) // Intermediate nodes
              }
            } else if (dimIdx === dimensions.length - 1) {
              // Update existing leaf node value
              const measureValue = row[measures[0].key]?.raw || 0
              values[existingIndex] += Number(measureValue)
            }

            parentId = currentId
          })
        })

        // Calculate root value as sum of all leaf values
        const leafValues = data.map(row => Number(row[measures[0].key]?.raw || 0))
        values[0] = leafValues.reduce((sum, val) => sum + val, 0)

        console.log('[Sunburst] Hierarchy built:', {
          nodeCount: labels.length,
          labels: labels.slice(0, 10), // First 10 for debugging
          parents: parents.slice(0, 10),
          values: values.slice(0, 10)
        });

        // Create sunburst trace
        const trace = {
          type: 'sunburst',
          labels: labels,
          parents: parents,
          values: values,
          ids: ids,
          branchvalues: 'total',
          marker: {
            colorscale: colorScheme || 'Blues',
            line: { width: 2 }
          },
          textinfo: showLabels ? (textInfo || 'label+percent parent') : 'none',
          hovertemplate: '<b>%{label}</b><br>Value: %{value}<br>Percent: %{percentParent}<extra></extra>'
        }

        const layout = {
          margin: { l: 0, r: 0, b: 0, t: 0 },
          sunburstcolorway: [
            '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A',
            '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'
          ]
        }

        const config = {
          responsive: true,
          displayModeBar: false
        }

        console.log('[Sunburst] Creating Plotly chart...');
        Plotly.newPlot(this._root, [trace], layout, config)
        console.log('[Sunburst] Chart created successfully');

      } catch (error) {
        console.error('[Sunburst] Error during render:', error);
        this._root.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
      }
    }

    dispose () {
      console.log('[Sunburst] Disposing chart');
      if (this._root) {
        try {
          Plotly.purge(this._root)
        } catch (e) {
          console.warn('[Sunburst] Error disposing:', e);
        }
      }
    }
  }

  const template = document.createElement('template')
  template.innerHTML = `
  <style>
      #root {
          width: 100%;
          height: 100%;
          min-height: 300px;
      }
      #chart {
          width: 100%;
          height: 100%;
      }
  </style>
  <div id="root" style="width: 100%; height: 100%;">
      <div id="chart"></div>
  </div>
  `

  class Main extends HTMLElement {
    constructor () {
      super()
      console.log('[Sunburst] Main constructor called');

      this._shadowRoot = this.attachShadow({ mode: 'open' })
      this._shadowRoot.appendChild(template.content.cloneNode(true))
      this._root = this._shadowRoot.getElementById('root')
      this._renderer = new Renderer(this._root)
    }

    // ------------------
    // LifecycleCallbacks
    // ------------------
    async onCustomWidgetBeforeUpdate (changedProps) {
      console.log('[Sunburst] onCustomWidgetBeforeUpdate:', changedProps);
    }

    async onCustomWidgetAfterUpdate (changedProps) {
      console.log('[Sunburst] onCustomWidgetAfterUpdate:', changedProps);
      this.render()
    }

    async onCustomWidgetResize (width, height) {
      console.log('[Sunburst] onCustomWidgetResize:', { width, height });
      this.render()
    }

    async onCustomWidgetDestroy () {
      console.log('[Sunburst] onCustomWidgetDestroy');
      this.dispose()
    }

    // ------------------
    //
    // ------------------
    render () {
      if (!document.contains(this)) {
        console.log('[Sunburst] Widget not in DOM yet, delaying render');
        setTimeout(this.render.bind(this), 0)
        return
      }

      console.log('[Sunburst] Starting render with props:', {
        dataBinding: this.dataBinding,
        colorScheme: this.colorScheme,
        showLabels: this.showLabels,
        textInfo: this.textInfo
      });

      this._renderer.render(
        this.dataBinding, 
        this.colorScheme, 
        this.showLabels,
        this.textInfo
      )
    }

    dispose () {
      console.log('[Sunburst] Main dispose called');
      this._renderer.dispose()
    }
  }

  customElements.define('com-sap-sac-sample-plotly-sunburst', Main)
  console.log('[Sunburst] Custom element defined');

})()