(function () {

  const template = document.createElement('template')
  template.innerHTML = `
  <style>
      #root div {
          margin: 0.5rem;
      }
      #root .title {
          font-weight: bold;
          margin-top: 1rem;
      }
      #root select, #root input {
          width: 100%;
          padding: 0.3rem;
      }
      #root label {
          margin-left: 0.3rem;
      }
  </style>
  <div id="root" style="width: 100%; height: 100%; padding: 1rem;">
      <div class="title">Color Scheme</div>
      <div>
          <select id="colorScheme">
              <option value="Blues">Blues</option>
              <option value="Greens">Greens</option>
              <option value="Reds">Reds</option>
              <option value="Oranges">Oranges</option>
              <option value="Purples">Purples</option>
              <option value="Viridis">Viridis</option>
              <option value="Rainbow">Rainbow</option>
              <option value="Portland">Portland</option>
              <option value="Jet">Jet</option>
          </select>
      </div>
      
      <div class="title">Label Settings</div>
      <div>
          <input id="showLabels" type="checkbox" />
          <label for="showLabels">Show Labels</label>
      </div>
      
      <div class="title">Text Information</div>
      <div>
          <select id="textInfo">
              <option value="label">Label only</option>
              <option value="label+percent parent">Label + Percent</option>
              <option value="label+value">Label + Value</option>
              <option value="label+value+percent parent">Label + Value + Percent</option>
              <option value="percent parent">Percent only</option>
              <option value="value">Value only</option>
          </select>
      </div>
      
      <div style="margin-top: 1.5rem;">
          <button id="button" style="width: 100%; padding: 0.5rem; background: #0070f2; color: white; border: none; border-radius: 4px; cursor: pointer;">Apply</button>
      </div>
  </div>
  `

  class Styling extends HTMLElement {
    constructor () {
      super()

      this._shadowRoot = this.attachShadow({ mode: 'open' })
      this._shadowRoot.appendChild(template.content.cloneNode(true))
      this._root = this._shadowRoot.getElementById('root')

      this._button = this._shadowRoot.getElementById('button')
      this._button.addEventListener('click', () => {
        const colorScheme = this._shadowRoot.getElementById('colorScheme').value
        const showLabels = this._shadowRoot.getElementById('showLabels').checked
        const textInfo = this._shadowRoot.getElementById('textInfo').value
        
        this.dispatchEvent(new CustomEvent('propertiesChanged', { 
          detail: { 
            properties: { 
              colorScheme, 
              showLabels,
              textInfo
            } 
          } 
        }))
      })
    }

    // ------------------
    // LifecycleCallbacks
    // ------------------
    async onCustomWidgetBeforeUpdate (changedProps) {
    }

    async onCustomWidgetAfterUpdate (changedProps) {
      if (changedProps.colorScheme) {
        this._shadowRoot.getElementById('colorScheme').value = changedProps.colorScheme
      }
      if (changedProps.showLabels !== undefined) {
        this._shadowRoot.getElementById('showLabels').checked = changedProps.showLabels
      }
      if (changedProps.textInfo) {
        this._shadowRoot.getElementById('textInfo').value = changedProps.textInfo
      }
    }

    async onCustomWidgetResize (width, height) {
    }

    async onCustomWidgetDestroy () {
      this.dispose()
    }

    // ------------------
    //
    // ------------------

    dispose () {
    }
  }

  customElements.define('com-sap-sac-sample-plotly-sunburst-styling', Styling)
})()