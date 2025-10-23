
(function () {
  const template = document.createElement('template');
  template.innerHTML = `
  <style>
    #root div { margin: 0.5rem; }
    #root .title { font-weight: bold; }
  </style>
  <div id="root" style="width:100%;height:100%;">
    <div class="title">Branch Values</div>
    <select id="branchValues">
      <option value="total">Total</option>
      <option value="remainder">Remainder</option>
    </select>
    <div class="title">Max Depth (0 = all)</div>
    <input id="maxDepth" type="number" value="0" />
    <div><button id="apply">Apply</button></div>
  </div>
  `;

  class Styling extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: 'open' });
      this._shadowRoot.appendChild(template.content.cloneNode(true));
      this._shadowRoot.getElementById('apply').addEventListener('click', () => {
        const branchValues = this._shadowRoot.getElementById('branchValues').value;
        const maxDepth = Number(this._shadowRoot.getElementById('maxDepth').value);
        this.dispatchEvent(new CustomEvent('propertiesChanged', {
          detail: { properties: { branchValues, maxDepth } }
        }));
      });
    }

    async onCustomWidgetAfterUpdate(changedProps) {
      if (changedProps.branchValues) this._shadowRoot.getElementById('branchValues').value = changedProps.branchValues;
      if (changedProps.maxDepth !== undefined) this._shadowRoot.getElementById('maxDepth').value = changedProps.maxDepth;
    }
  }

  customElements.define('com-sap-sac-sample-plotly-sunburst-styling', Styling);
})();
