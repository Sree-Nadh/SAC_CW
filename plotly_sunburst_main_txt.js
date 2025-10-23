var getScriptPromisify = (src) => {
  return new Promise((resolve) => {
    $.getScript(src, resolve);
  });
};

(function () {

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
    return { dimensions, measures, dimensionsMap, measuresMap }
  }

  class Renderer {
    constructor (root) {
      this._root = root
      this._plotly = null
    }

    async render (dataBinding, colorScheme, showLabels, textInfo) {
      await getScriptPromisify("https://cdn.plot.ly/plotly-2.26.0.min.js");
      this.dispose()

      if (dataBinding.state !== 'success') { return }

      const { data, metadata } = dataBinding
      const { dimensions, measures } = parseMetadata(metadata)

      if (dimensions.length === 0 || measures.length === 0) {
        return
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

      // Process each data row
      data.forEach((row, idx) => {
        let parentId = 'root'
        let currentPath = ''

        // Build hierarchy through dimensions
        dimensions.forEach((dimension, dimIdx) => {
          const dimValue = row[dimension.key].label || row[dimension.key].raw
          currentPath += (currentPath ? '/' : '') + dimValue
          const currentId = currentPath

          // Check if this node already exists
          const existingIndex = ids.indexOf(currentId)
          
          if (existingIndex === -1) {
            // New node
            labels.push(dimValue)
            parents.push(parentId)
            ids.push(currentId)
            
            // If this is the last dimension, use the measure value
            if (dimIdx === dimensions.length - 1) {
              values.push(row[measures[0].key].raw || 0)
            } else {
              values.push(0) // Intermediate nodes
            }
          } else if (dimIdx === dimensions.length - 1) {
            // Update existing leaf node value
            values[existingIndex] += (row[measures[0].key].raw || 0)
          }

          parentId = currentId
        })
      })

      // Calculate root value as sum of all leaf values
      const leafValues = data.map(row => row[measures[0].key].raw || 0)
      values[0] = leafValues.reduce((sum, val) => sum + val, 0)

      // Create sunburst trace
      const trace = {
        type: 'sunburst',
        labels: labels,
        parents: parents,
        values: values,
        ids: ids,
        branchvalues: 'total',
        marker: {
          colorscale: colorScheme,
          line: { width: 2 }
        },
        textinfo: showLabels ? textInfo : 'none',
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

      Plotly.newPlot(this._root, [trace], layout, config)
    }

    dispose () {
      if (this._root) {
        Plotly.purge(this._root)
      }
    }
  }

  const template = document.createElement('template')
  template.innerHTML = `
  <style>
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

      this._shadowRoot = this.attachShadow({ mode: 'open' })
      this._shadowRoot.appendChild(template.content.cloneNode(true))
      this._root = this._shadowRoot.getElementById('root')
      this._renderer = new Renderer(this._root)
    }

    // ------------------
    // LifecycleCallbacks
    // ------------------
    async onCustomWidgetBeforeUpdate (changedProps) {
    }

    async onCustomWidgetAfterUpdate (changedProps) {
      this.render()
    }

    async onCustomWidgetResize (width, height) {
      this.render()
    }

    async onCustomWidgetDestroy () {
      this.dispose()
    }

    // ------------------
    //
    // ------------------
    render () {
      if (!document.contains(this)) {
        // Delay the render to assure the custom widget is appended on dom
        setTimeout(this.render.bind(this), 0)
        return
      }

      this._renderer.render(
        this.dataBinding, 
        this.colorScheme, 
        this.showLabels,
        this.textInfo
      )
    }

    dispose () {
      this._renderer.dispose()
    }
  }

  customElements.define('com-sap-sac-sample-plotly-sunburst', Main)

})()