const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/client.js'), 'utf8');
const start = source.indexOf('		function createLiquidGlass()');
const end = source.indexOf('function apply(ctx)', start);
assert(start > 0 && end > start);
let observers = 0, accelerated = true;
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
const context = { document: { body, querySelectorAll: () => [card], createElement(tag) { const n = new Node(tag); if(tag === 'canvas') { n.getContext = () => ({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}); n.toDataURL = () => 'data:image/png;base64,AA'; } return n; }, createElementNS(ns,tag) { return new Node(tag); } },
  window: {addEventListener(){},removeEventListener(){}}, CSS:{supports:()=>true}, hasAcceleratedWebGL:()=>accelerated,
  ResizeObserver: class {constructor(){observers++} observe(){} unobserve(){} disconnect(){}},
  getComputedStyle:()=>({visibility:'visible',display:'block',position:'static',isolation:'auto',borderTopLeftRadius:'4px'}),
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, console, Float32Array, Math,
  LIQUID:{strength:.8,zoom:0,dispersion:0,bezelPx:24,blurPx:1,saturate:1,brightness:1.05}, LIQUID_FILTER_ID:'test', LIQUID_SELECTOR:'card', LIQUID_RING_MIN_AREA:260000, LIQUID_PIXEL_BUDGET:2000000, LIQUID_RING_WIDTH:28 };
vm.createContext(context); vm.runInContext(source.slice(start,end) + ';this.create = createLiquidGlass;', context);
const liquid = context.create();
assert.equal(observers,0, 'initially disabled does not install');
accelerated = false; assert.equal(liquid.install(),false); assert.equal(observers,0);
accelerated = true; assert.equal(liquid.install(),true); assert.ok(card.style.backdropFilter.includes('url(#test-'));
liquid.install(); assert.equal(observers,1, 'install is idempotent');
liquid.uninstall(); assert.equal(card.style.backdropFilter,'blur(3px)'); assert.equal(card.style.webkitBackdropFilter,'blur(4px)'); assert.equal(card.style.backgroundColor,'red');
liquid.install(); assert.equal(observers,2, 'restart creates a fresh observer'); liquid.uninstall();
assert.equal(card.style.backdropFilter,'blur(3px)');
card.style.setProperty('backdrop-filter','blur(8px)','important');
liquid.install(); liquid.uninstall();
assert.equal(card.style.getPropertyValue('backdrop-filter'),'blur(8px)');
assert.equal(card.style.getPropertyPriority('backdrop-filter'),'important');
liquid.install(); card.style.setProperty('backdrop-filter','blur(9px)','important'); liquid.uninstall();
assert.equal(card.style.getPropertyValue('backdrop-filter'),'blur(9px)');
assert.equal(card.style.getPropertyPriority('backdrop-filter'),'important');
const overlay = new Node('overlay'), panel = new Node('panel'), nav = new Node('nav');
overlay.setAttribute('role','presentation'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
panel.offsetWidth=600; panel.offsetHeight=500; panel.appendChild(nav); overlay.appendChild(panel); body.appendChild(overlay);
panel.style.setProperty('position','static','important'); panel.style.setProperty('isolation','auto','important');
panel.style.setProperty('background-color','red','important'); nav.style.setProperty('background-image','none','important');
context.document.querySelectorAll = () => [panel];
liquid.install();
assert.equal(panel.getAttribute('data-mc-rim-error'), null);
assert.equal(panel.style.position, 'relative');
assert.equal(panel.style.isolation, 'isolate');
assert.equal(nav.getAttribute('data-mc-navi'), '1');
assert.match(nav.style.backgroundImage, /linear-gradient/);
assert.ok(overlay.children.some(child => child.hasAttribute('data-mc-glass-veil')), 'rim creates veil');
liquid.uninstall();
assert.equal(nav.hasAttribute('data-mc-navi'), false);
assert.equal(overlay.children.some(child => child.hasAttribute('data-mc-glass-veil')), false, 'uninstall removes veil');
for (const [el, prop, value] of [[panel,'position','static'],[panel,'isolation','auto'],[panel,'background-color','red'],[nav,'background-image','none']]) { assert.equal(el.style.getPropertyValue(prop),value); assert.equal(el.style.getPropertyPriority(prop),'important'); }
liquid.install();
assert.equal(nav.getAttribute('data-mc-navi'), '1', 'reinstall applies nav treatment');
assert.equal(panel.style.position, 'relative', 'reinstall applies rim');
for (const [el, prop, value] of [[panel,'position','fixed'],[panel,'isolation','auto'],[panel,'background-color','blue'],[nav,'background-image','url(host)']]) el.style.setProperty(prop,value,'important');
liquid.uninstall();
for (const [el, prop, value] of [[panel,'position','fixed'],[panel,'isolation','auto'],[panel,'background-color','blue'],[nav,'background-image','url(host)']]) { assert.equal(el.style.getPropertyValue(prop),value); assert.equal(el.style.getPropertyPriority(prop),'important'); }
// Host inserts and removes a panel while liquid glass remains enabled.
context.document.querySelectorAll = () => [];
liquid.install();
context.document.querySelectorAll = () => [panel];
liquid.refresh();
assert.equal(panel.style.position, 'relative', 'new panel mounted synchronously');
assert.equal(nav.getAttribute('data-mc-navi'), '1');
liquid.uninstall();
assert.equal(panel.style.getPropertyValue('position'), 'fixed');
assert.equal(nav.style.getPropertyValue('background-image'), 'url(host)');
assert.equal(overlay.children.some(child => child.hasAttribute('data-mc-glass-veil')), false);
// Refresh mounts new targets immediately, but batches removal until 120ms after
// the final refresh. Count queries to distinguish one sync from multiple syncs.
assert.equal(timers.size, 0, 'previous teardown clears all timers');
let targets = [card], queries = 0;
context.document.querySelectorAll = () => { queries++; return targets; };
liquid.install();
targets = [];
liquid.refresh();
assert.match(card.style.backdropFilter, /url\(#test-/, 'removal is deferred');
advance(80);
liquid.refresh();
const afterRefresh = queries;
advance(119);
assert.equal(queries, afterRefresh, 'sync waits for the final debounce deadline');
assert.match(card.style.backdropFilter, /url\(#test-/);
advance(1);
assert.equal(queries, afterRefresh + 1, 'burst runs exactly one delayed sync');
assert.equal(card.style.getPropertyValue('backdrop-filter'), 'blur(9px)', 'sync unmounts removed target');
liquid.uninstall();
assert.equal(timers.size, 0);

// Pending refresh and rim timers must not resurrect styles or DOM after shutdown.
targets = [panel];
liquid.install();
liquid.refresh();
assert.ok(timers.size >= 4, 'refresh and rim callbacks are pending');
liquid.uninstall();
assert.equal(timers.size, 0, 'uninstall cancels refresh and rim timers');
const afterUninstallQueries = queries;
advance(1000);
assert.equal(queries, afterUninstallQueries, 'no delayed sync runs after uninstall');
assert.equal(panel.style.getPropertyValue('position'), 'fixed');
assert.equal(nav.style.getPropertyValue('background-image'), 'url(host)');
assert.equal(nav.hasAttribute('data-mc-navi'), false);
assert.equal(overlay.children.some(child => child.hasAttribute('data-mc-glass-veil')), false);
liquid.refresh();
assert.equal(timers.size, 0, 'refresh while disabled schedules nothing');
console.log('liquid lifecycle tests passed');
