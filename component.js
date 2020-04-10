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
          obj[prop] = value;

          if (prop in data) {
            if (typeof value === 'string' || typeof value === 'number') {
              this.setAttribute(prop, value);
            } else {
              this.rerender(prop, this.reactiveElements);
            }
          }
    
          return true;
        }
      });
    }


    connectedCallback() {
      this.assignClickHandlers();
      if (!this.reactiveElements) {
        this.reactiveElements = this.getReactiveElements(this.shadowRoot);
      }
      this.rerender(Object.keys(data), this.reactiveElements);
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
      if (!this.reactiveElements) {
        this.reactiveElements = this.getReactiveElements(this.shadowRoot);
      }
      this.rerender(name, this.reactiveElements);
    }


    rerender(names, reactiveElements, context) {
      context = context || this.data;
      if (typeof names === 'string') { names = [names]; }
  
      for (const name of names) {
        for (let i = 0; i < (reactiveElements[name] || []).length; i++) {
          const reactiveData = reactiveElements[name][i];
          
          switch(reactiveData.type) {
            case 'data':
              reactiveData.element.innerHTML = context[name];
              break;
            case 'list':
              reactiveData.parent.innerHTML = '';

              for (const val of context[name]) {
                const newElement = reactiveData.parent
                  .appendChild(reactiveData.element.cloneNode(true));
                
                context[reactiveData.varName] = val;
                this.rerender(
                  reactiveData.varName,
                  this.getReactiveElements(newElement),
                  context
                );
              }
              break;
            case 'computed':
              console.log('Setting computed')
              reactiveData.element.setAttribute(
                reactiveData.prop,
                reactiveData.val(context)
              );
              break;
          }
        }
      }
    }


    getReactiveElements(parent) {
      const reactiveElements = {};
      
      for (const element of parent.querySelectorAll('[data], [for], [bind]')) {
        let reactiveData = {};
        let name;

        if (element.hasAttribute('data')) {
          name = element.getAttribute('data');

          reactiveData = {
            type: 'data',
            element: element
          }
        } else if (element.hasAttribute('for')) {
          const config = element.getAttribute('for')
            .trim()
            .match(/(\S+)\s+(in|of)\s+(\S+)/);

          const varName = config[1];
          name = config[3];
          
          reactiveData = {
            type: 'list',
            varName: varName,
            parent: element.parentElement,
            element: element
          }
        } else if (element.hasAttribute('bind')) {
          name = element.getAttribute(':title');

          for (const attribute of element.attributes) {
            if (attribute.name.startsWith(':')) {
              reactiveData = {
                type: 'computed',
                element: element,
                prop: attribute.name.substring(1),
                val: (o) => o[attribute.value]
              }
            }
          }
        }

        reactiveElements[name] = reactiveElements[name] || [];
        reactiveElements[name].push(reactiveData);
      }

      return reactiveElements;
    }
  };

  return elementClass;
}
