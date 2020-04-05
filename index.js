import { define } from './component.js';


function start() {
  define('post-content');
}

window.addEventListener('load', () => start());

setTimeout(() => document.querySelector('post-content').data.title = "Goodbye!", 2000)
