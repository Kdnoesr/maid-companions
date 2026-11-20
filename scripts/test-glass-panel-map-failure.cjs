const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Exercise the production createLiquidGlass in the established lifecycle DOM/clock.
function fixture() {
  const harness = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = harness.indexOf('const liquid = context.create();');
  assert.ok(end > 0, 'lifecycle fixture marker exists');
  return new Function('require', '__dirname', harness.slice(0, end) + '\nreturn {context, Node, body, advance};')(require, __dirname);
}

const original = {
  'backdrop-filter': 'blur(3px)',
  '-webkit-backdrop-filter': 'blur(4px)',
  'background-color': 'red',
  'background-image': 'url(host.png)',
  position: 'static',
  isolation: 'auto',
};

// Exercise real resize listeners, rather than calling refresh as a proxy for an event.
for (const failure of ['getContext returns null', 'toDataURL throws']) {
  for (const outcome of ['resize recovery', 'uninstall after failure']) {
    test(failure + ': ' + outcome, () => {
      const {context, Node, body, advance} = fixture();
      const listeners = new Map();
      context.window.addEventListener = (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      };
      context.window.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
      context.window.dispatchEvent = event => {
        for (const fn of [...(listeners.get(event.type) || [])]) fn.call(context.window, event);
      };
      const overlay = new Node('overlay'), panel = new Node('panel');
      overlay.setAttribute('role', 'presentation');
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
      panel.offsetWidth = 600; panel.offsetHeight = 500;
      overlay.appendChild(panel); body.appendChild(overlay);
      context.document.querySelectorAll = () => [panel];
      let failing = true, attempts = 0;
      const createElement = context.document.createElement;
      context.document.createElement = function(tag) {
        const node = createElement.call(this, tag);
        if (tag === 'canvas') {
          const getContext = node.getContext, toDataURL = node.toDataURL;
          node.getContext = (...args) => {
            if (failing && failure === 'getContext returns null') { attempts++; return null; }
            return getContext.apply(node, args);
          };
          node.toDataURL = (...args) => {
            if (failing && failure === 'toDataURL throws') { attempts++; throw new Error('canvas encoding failed'); }
            return toDataURL.apply(node, args);
          };
        }
        return node;
      };
      const liquid = context.create();
      try {
        assert.equal(liquid.install(), true);
        assert.ok(attempts > 0, 'initial canvas failure was reached');
        assert.ok(panel.hasAttribute('data-mc-rim-error'), 'failure records a diagnostic');
        assert.equal(overlay.children.filter(child => child.hasAttribute('data-mc-glass-veil')).length, 0);
        if (outcome === 'resize recovery') {
          failing = false;
          context.window.dispatchEvent({type: 'resize'});
          advance(120);
          assert.equal(overlay.children.filter(child => child.hasAttribute('data-mc-glass-veil')).length, 1, 'resize retries and restores glass');
          assert.equal(panel.getAttribute('data-mc-rim-error'), null, 'success clears the diagnostic');
        }
      } finally {
        liquid.uninstall();
      }
      assert.equal(panel.getAttribute('data-mc-rim-error'), null, 'uninstall clears the diagnostic');
      assert.equal((listeners.get('resize') || new Set()).size, 0, 'uninstall removes resize listeners');
    });
  }
}

for (const failure of ['getContext returns null', 'toDataURL throws']) {
  for (const stage of ['initial installation', 'resize after successful installation']) {
    test(failure + ' during ' + stage, async t => {
      const {context, Node, body, advance} = fixture();
      const overlay = new Node('overlay'), panel = new Node('panel');
      overlay.setAttribute('role', 'presentation');
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
      panel.offsetWidth = 600; panel.offsetHeight = 500;
      for (const [prop, value] of Object.entries(original)) panel.style.setProperty(prop, value, 'important');
      overlay.appendChild(panel); body.appendChild(overlay);
      context.document.querySelectorAll = () => [panel];
      let failing = stage === 'initial installation', attempts = 0;
      const createElement = context.document.createElement;
      context.document.createElement = function(tag) {
        const node = createElement.call(this, tag);
        if (tag === 'canvas') {
          const getContext = node.getContext, toDataURL = node.toDataURL;
          node.getContext = (...args) => {
            if (failing && failure === 'getContext returns null') { attempts++; return null; }
            return getContext.apply(node, args);
          };
          node.toDataURL = (...args) => {
            if (failing && failure === 'toDataURL throws') { attempts++; throw new Error('canvas encoding failed'); }
            return toDataURL.apply(node, args);
          };
        }
        return node;
      };
      const veils = () => overlay.children.filter(child => child.hasAttribute('data-mc-glass-veil'));
      const liquid = context.create();
      try {
        assert.equal(liquid.install(), true);
        if (stage !== 'initial installation') {
          assert.equal(veils().length, 1, 'successful install creates a veil');
          panel.offsetWidth = 620; // Different dimensions force a new map, not a cache hit.
          failing = true;
          liquid.refresh(); advance(120);
        }
        await t.test('failed map removes veil and restores original inline styles', () => {
          assert.ok(attempts > 0, 'the intended canvas failure was reached');
          const errors = [];
          if (veils().length !== 0) errors.push('veil remains after map failure');
          for (const [prop, value] of Object.entries(original)) {
            if (panel.style.getPropertyValue(prop) !== value || panel.style.getPropertyPriority(prop) !== 'important') {
              errors.push(prop + ' was not restored with its priority');
            }
          }
          assert.deepEqual(errors, []);
        });
        failing = false;
        liquid.refresh(); advance(120);
        await t.test('later successful refresh restores glass', () => {
          assert.equal(veils().length, 1, 'veil is recreated');
          assert.equal(panel.style.position, 'relative');
          assert.equal(panel.style.isolation, 'isolate');
          assert.notEqual(panel.style.backgroundColor, original['background-color']);
        });
      } finally { liquid.uninstall(); }
    });
  }
}
