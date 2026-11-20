const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/client.js'), 'utf8');
const start = source.indexOf('		function createLiquidGlass()');
const end = source.indexOf('function apply(ctx)', start);
assert(start > 0 && end > start);
let observers = 0, accelerated = true, radius = 4, encodes = 0;
// Deterministic timers: advance time without relying on wall-clock scheduling.
let now = 0, nextTimer = 1;
const timers = new Map();
function fakeSetTimeout(fn, delay = 0) { const id = nextTimer++; timers.set(id, {fn, due: now + delay}); return id; }
function fakeClearTimeout(id) { timers.delete(id); }
function advance(ms) {
  const end = now + ms;
  for (;;) {
    const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
    if (!next) break;
    now = next[1].due; timers.delete(next[0]); next[1].fn();
  }
  now = end;
}
class Style {
  constructor() { this.values = {}; this.priorities = {}; }
  getPropertyValue(k) { return this.values[k] || ''; }
  getPropertyPriority(k) { return this.priorities[k] || ''; }
  setProperty(k,v,p='') { if (!v) return this.removeProperty(k); this.values[k] = v; this.priorities[k] = p; }
  removeProperty(k) { delete this.values[k]; delete this.priorities[k]; }
}
for (const [js, css] of Object.entries({backdropFilter:'backdrop-filter', webkitBackdropFilter:'-webkit-backdrop-filter', backgroundColor:'background-color', backgroundImage:'background-image', position:'position', isolation:'isolation'})) Object.defineProperty(Style.prototype, js, {get() {return this.getPropertyValue(css)}, set(v) {this.setProperty(css,v)}});
class Node {
  constructor(tag) { this.tag = tag; this.style = new Style(); this.attrs = {}; this.children = []; this.isConnected = true; this.offsetWidth = 30; this.offsetHeight = 30; }
  setAttribute(k,v) { this.attrs[k] = v; } setAttributeNS(ns,k,v) { this.setAttribute(k,v); }
  hasAttribute(k) { return Object.hasOwn(this.attrs,k); } getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  append(...nodes) { for (const n of nodes) this.appendChild(n); } appendChild(n) { this.children.push(n); n.parentElement = this; n.parentNode = this; n.isConnected = true; return n; }
  remove() { if (this.parentElement) { const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this), 1); this.parentElement = null; } this.isConnected = false; }
  insertBefore(n, ref) { if (n.parentElement) n.remove(); const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, n); n.parentElement = this; n.parentNode = this; n.isConnected = true; return n; }
  querySelector() { return null; }
  getBoundingClientRect() { return {left:0,top:0,width:this.offsetWidth,height:this.offsetHeight}; }
}
const body = new Node('body'); const card = new Node('card'); card.setAttribute('data-composer-card','');
Object.assign(card.style, {backdropFilter:'blur(3px)', webkitBackdropFilter:'blur(4px)', backgroundColor:'red', position:'static', isolation:'auto'});
const context = { document: { body, querySelectorAll: () => [card], createElement(tag) { const n = new Node(tag); if(tag === 'canvas') { n.getContext = () => ({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}); n.toDataURL = () => { encodes++; return 'data:image/png;base64,AA'; }; } return n; }, createElementNS(ns,tag) { return new Node(tag); } },
  window: {addEventListener(){},removeEventListener(){}}, CSS:{supports:()=>true}, hasAcceleratedWebGL:()=>accelerated,
  ResizeObserver: class {constructor(){observers++} observe(){} unobserve(){} disconnect(){}},
  getComputedStyle:()=>({visibility:'visible',display:'block',position:'static',isolation:'auto',borderTopLeftRadius: radius + 'px'}),
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, console, Float32Array, Math,
  LIQUID:{strength:.8,zoom:0,dispersion:0,bezelPx:24,blurPx:1,saturate:1,brightness:1.05}, LIQUID_FILTER_ID:'test', LIQUID_SELECTOR:'card', LIQUID_RING_MIN_AREA:260000, LIQUID_PIXEL_BUDGET:2000000, LIQUID_RING_WIDTH:28 };
vm.createContext(context); vm.runInContext(source.slice(start,end) + ';this.create = createLiquidGlass;', context);
// Count completed buildMap calls via its canvas encoding, without replacing the
// production function. A thrown/aborted build before encoding is not counted.
const liquid = context.create();
assert.equal(liquid.install(), true);
assert.match(card.style.backdropFilter, /url\(#test-/, 'real target was mounted');
assert.ok(encodes > 0, 'initial install generated a map');
const failures = [];
function check(label, action, shouldGenerate) {
  const before = encodes;
  action();
  advance(120); // include the debounced sync as well as synchronous work
  const delta = encodes - before;
  console.log(label + ': ' + before + ' -> ' + encodes + ' (+' + delta + ')');
  try {
    if (shouldGenerate) assert.ok(delta > 0, label + ' should regenerate');
    else assert.equal(delta, 0, label + ' should reuse the map');
  } catch (err) { failures.push(err.message); }
}
check('unchanged repeated refresh', () => { liquid.refresh(); liquid.refresh(); liquid.refresh(); }, false);
check('width changed', () => { card.offsetWidth = 40; liquid.refresh(); }, true);
check('unchanged after width change', () => { liquid.refresh(); }, false);
check('height changed', () => { card.offsetHeight = 42; liquid.refresh(); }, true);
check('radius changed', () => { radius = 7; liquid.refresh(); }, true);
check('unchanged after radius change', () => { liquid.refresh(); }, false);
liquid.uninstall();
assert.equal(timers.size, 0, 'teardown cancels timers');
if (failures.length) {
  console.error('Map cache expectations failed:\n' + failures.join('\n'));
  process.exitCode = 1;
} else console.log('glass map cache tests passed');
