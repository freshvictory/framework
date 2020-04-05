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
  const slots = [...content.querySelectorAll('slot')]
    .map(s => s.getAttribute('name'));

  const [data, watchers] = computeReactive(options, slots);
  
  const elementClass = buildElementClass(
    data, watchers, content, slots
  );

  customElements.define(options.id, elementClass);
}


function computeReactive(options, slots) {
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
        data[key] = options.data[key].default;
        watchers[key] = options.data[key].watcher;
        break;
      default:
        data[key] = options.data[key];
        break;
    }
  }

  for (const slot of slots) {
    if (!data[slot]) {
      data[slot] = undefined;
    }
  }

  return [data, watchers];
}


function buildElementClass( data, watchers, content) {
  const attributes = Object.keys(data);

  const elementClass = class extends Component {
    static get observedAttributes() {
      return attributes;
    }


    constructor() {
      super(content);
      this.slots = undefined;
      this.data = new Proxy(data, {
        get: (obj, prop) => {
          return this.getAttribute(prop) || obj[prop]
        },
        set: (obj, prop, value) => {
          if (prop in obj) {
            this.setAttribute(prop, value);
            obj[prop] = value;
          }
    
          return true;
        }
      });
    }


    connectedCallback() {
      this.rerender([]);
    }


    attributeChangedCallback(name, oldValue, newValue) {
      if (name in watchers) {
        watchers[name](oldValue, newValue);
      }

      this.rerender(name);
    }


    rerender(names) {
      this.initSlots();
      if (typeof names === 'string') { names = [names]; }
  
      for (const name of names) {
        if ('push' in this.slots[name]) {
          this.slots[name].forEach(s => s.innerHTML = this.data[name]);
        } else {
          this.slots[name].innerHTML = this.data[name];
        }
      }
    }


    initSlots() {
      if (this.slots) {
        return this.slots;
      }

      this.slots = {};

      for (const slot of this.shadowRoot.querySelectorAll('slot')) {
        const name = slot.getAttribute('name');
        if (name) {
          if (this.slots[name]) {
            if ('push' in this.slots[name]) {
              this.slots[name].push(slot);
            } else {
              this.slots[name] = [this.slots[name], slot];
            }
          } else {
            this.slots[name] = slot;
          }
        }
      }
    }
  };

  return elementClass;
}
