const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Reuse the lifecycle test's DOM/VM fixture, not its assertions or scenarios.
function fixture() {
  const harness = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const marker = 'const liquid = context.create();';
  const end = harness.indexOf(marker);
  assert.ok(end > 0, 'lifecycle fixture marker exists');
  let setup = harness.slice(0, end);
  const observer = 'ResizeObserver: class {constructor(){observers++} observe(){} unobserve(){} disconnect(){}},';
  assert.ok(setup.includes(observer), 'lifecycle ResizeObserver fixture exists');
  setup = setup.replace(observer, 'ResizeObserver: class {constructor(callback){observers++; captured.push(this); this.callback=callback} observe(){} unobserve(){} disconnect(){}},');
  return new Function('require', '__dirname', 'captured', setup + '\nreturn {context, Node, body};')(require, __dirname, []);
}

// A real observer supplies (ResizeObserverEntry[], ResizeObserver), not a task and delay.
test('ResizeObserver delivery schedules a rebuild without passing entries as a timer callback', () => {
  const {context} = fixture();
  let observer;
  context.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {} unobserve() {} disconnect() {}
  };
  context.setTimeout = (callback, delay) => {
    assert.equal(typeof callback, 'function', 'timer callback must be callable');
    assert.equal(typeof delay, 'number', 'timer delay must be numeric');
    return 1;
  };
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.doesNotThrow(() => observer.callback([{target: context.document.querySelectorAll()[0], contentRect: {width: 30, height: 30}}], observer));
  } finally { liquid.uninstall(); }
});

test('repeated panel refreshes keep the same navigation candidate', async () => {
  const {context, Node, body} = fixture();
  const overlay = new Node('overlay'), panel = new Node('panel');
  const first = new Node('nav'), second = new Node('nav');
  overlay.setAttribute('role', 'presentation');
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
  panel.offsetWidth = 600; panel.offsetHeight = 500;
  first.offsetWidth = second.offsetWidth = 100;
  panel.append(first, second); overlay.appendChild(panel); body.appendChild(overlay);
  context.document.querySelectorAll = () => [panel];
  const timers = new Map(); let nextTimer = 0;
  context.setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, {fn, delay}); return id; };
  context.clearTimeout = id => timers.delete(id);
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.equal(first.getAttribute('data-mc-navi'), '1', 'first eligible child selected initially');
    for (let i = 0; i < 2; i++) {
      liquid.refresh();
      const pending = [...timers.entries()].find(([, timer]) => timer.delay === 120);
      assert.ok(pending, 'refresh schedules debounced sync');
      timers.delete(pending[0]); pending[1].fn();
      assert.equal(first.getAttribute('data-mc-navi'), '1', 'refresh must not switch away from the existing navigation');
      assert.equal(second.getAttribute('data-mc-navi'), null, 'other eligible child remains untreated');
    }
  } finally { liquid.uninstall(); }
});
