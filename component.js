export default class Component extends HTMLElement {
  constructor(content) {
    super();

    this.attachShadow({ mode: 'open' })
      .appendChild(content.cloneNode(true));
  }
}


export function define(options) {
  if (typeof options === 'string') {
    options = {
      id: options
    };
  }

  const template = document.getElementById(options.id);
  const content = template.content;

  const [data, watchers] = computeReactive(options);
  
  const elementClass = buildElementClass(
    data, content, options.methods
  );

  customElements.define(options.id, elementClass);
}


function computeReactive(options) {
  const watchers = {};
  const data = {};
  options.data = options.data || {};
  for (const key in options.data) {
    switch (typeof options.data[key]) {
      case 'function':
        data[key] = undefined;
        watchers[key] = options.data[key];
        break;
      case 'object':
        if (typeof options.data[key][Symbol.iterator] === 'function') {
          data[key] = options.data[key];
        } else {
          if (options.data[key].default) {
            data[key] = options.data[key].default;
          }
          if (options.data[key].watcher) {
            watchers[key] = options.data[key].watcher;
          }
        }
        break;
      default:
        data[key] = options.data[key];
        break;
    }
  }

  return [data, watchers];
}


function buildElementClass(data, content, methods) {
  const attributes = Object.keys(data);

  const elementClass = class extends Component {
    static get observedAttributes() {
      return attributes;
    }


    constructor() {
      super(content);
      this.slots = undefined;
      this.data = new Proxy({}, {
        get: (obj, prop) => {
          return this.getAttribute(prop) || obj[prop] || data[prop]
        },
        set: (obj, prop, value) => {
          if (prop in data) {
            if (typeof value === 'string' || typeof value === 'number') {
              this.setAttribute(prop, value);
            } else {
              this.rerender(prop);
            }
          }

          obj[prop] = value;
    
          return true;
        }
      });
    }


    connectedCallback() {
      this.assignClickHandlers();
      this.rerender(Object.keys(data));
    }


    assignClickHandlers() {
      const clickElements = this.shadowRoot.querySelectorAll('[\\@click]');

      for (const clickElement of clickElements) {
        clickElement.addEventListener(
          'click',
          methods[clickElement.getAttribute('@click')]
            .bind(this.data)
        );
      }
    }


    attributeChangedCallback(name) {
      this.rerender(name);
    }


    rerender(names) {
      this.cacheReactiveElements();
      if (typeof names === 'string') { names = [names]; }
  
      for (const name of names) {
        for (const element of this.reactiveElements[name]) {
          element.innerHTML = this.data[name];
        }
      }
    }


    cacheReactiveElements() {
      if (this.reactiveElements) {
        return this.reactiveElements;
      }

      this.reactiveElements = {};

      for (const dataName in data) {
        this.reactiveElements[dataName] = [];
      }
      
      for (const element of this.shadowRoot.querySelectorAll('[data]')) {
        this.reactiveElements[element.getAttribute('data')].push(element);
      }

      return this.reactiveElements;
    }
  };

  return elementClass;
}
