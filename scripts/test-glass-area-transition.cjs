// Regression: a page-sized dialog becomes a small glass target after a resize.
// Run: node --test scripts/test-glass-area-transition.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const source = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = source.indexOf('const liquid = context.create();');
  assert.ok(end > 0, 'lifecycle fixture boundary exists');
  return new Function('require', '__dirname', source.slice(0, end) + '\nreturn {context, Node, body, advance};')(require, __dirname);
}

const original = {
  position: 'static', isolation: 'auto',
  'background-color': 'red', 'background-image': 'url(host.png)',
  'backdrop-filter': 'blur(3px)', '-webkit-backdrop-filter': 'blur(4px)',
};

for (const failure of ['null', 'throw']) {
  test('large dialog shrinks with canvas ' + failure + ', restores host and retries', async t => {
    const {context, Node, body, advance} = fixture();
    const overlay = new Node('overlay'), panel = new Node('panel');
    overlay.setAttribute('role', 'presentation');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.offsetWidth = 600; panel.offsetHeight = 500; // above 260000
    for (const [prop, value] of Object.entries(original)) panel.style.setProperty(prop, value, 'important');
    overlay.appendChild(panel); body.appendChild(overlay);
    context.document.querySelectorAll = () => [panel];
    let failing = false, attempts = 0, successes = 0;
    const createElement = context.document.createElement;
    context.document.createElement = function(tag) {
      const node = createElement.call(this, tag);
      if (tag === 'canvas') {
        const getContext = node.getContext, toDataURL = node.toDataURL;
        node.getContext = (...args) => {
          if (failing && failure === 'null') { attempts++; return null; }
          return getContext.apply(node, args);
        };
        node.toDataURL = (...args) => {
          if (failing && failure === 'throw') { attempts++; throw new Error('canvas encoding failed'); }
          successes++; return toDataURL.apply(node, args);
        };
      }
      return node;
    };
    const veils = () => overlay.children.filter(child => child.hasAttribute('data-mc-glass-veil'));
    const liquid = context.create();
    try {
      assert.equal(liquid.install(), true);
      assert.ok(successes > 0, 'large map generated');
      assert.equal(veils().length, 1, 'large dialog initially has a veil');
      const oldVeil = veils()[0];
      panel.offsetWidth = 220; panel.offsetHeight = 150; // below threshold and cache miss
      failing = true;
      liquid.refresh(); advance(120);
      await t.test('failed transition removes old veil and restores inline styles', () => {
        assert.ok(attempts > 0, 'cache miss reaches injected canvas failure');
        const errors = [];
        if (veils().length || oldVeil.parentElement) errors.push('old veil remains');
        for (const [prop, value] of Object.entries(original)) {
          if (panel.style.getPropertyValue(prop) !== value || panel.style.getPropertyPriority(prop) !== 'important') errors.push(prop + ' not restored with priority');
        }
        assert.deepEqual(errors, []);
      });
      failing = false;
      const before = successes;
      liquid.refresh(); advance(120);
      await t.test('retry generates small map and applies filters', () => {
        assert.ok(successes > before, 'retry generated a map');
        assert.equal(veils().length, 0, 'small target has no veil');
        assert.match(panel.style.getPropertyValue('backdrop-filter'), /url\(#test-/);
        assert.match(panel.style.getPropertyValue('-webkit-backdrop-filter'), /url\(#test-/);
      });
    } finally { liquid.uninstall(); }
  });
}
