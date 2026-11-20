// Regression for ordinary (non-modern-material) menu overlays.
// Run: node --test scripts/test-glass-small-map-failure.cjs
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

for (const failure of ['null', 'throw']) {
  for (const stage of ['initial', 'resize']) {
    test(failure + ' canvas on ' + stage + ' restores host filters and permits retry', async t => {
      const {context, Node, body, advance} = fixture();
      const menu = new Node('div');
      menu.setAttribute('role', 'menu');
      menu.offsetWidth = 220; menu.offsetHeight = 150;
      menu.style.setProperty('backdrop-filter', 'blur(7px)', 'important');
      menu.style.setProperty('-webkit-backdrop-filter', 'blur(8px)', 'important');
      body.appendChild(menu);
      context.document.querySelectorAll = () => [menu];
      let failing = stage === 'initial', attempts = 0, successes = 0;
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
            if (failing && failure === 'throw') { attempts++; throw Error('canvas encoding failed'); }
            successes++; return toDataURL.apply(node, args);
          };
        }
        return node;
      };
      const liquid = context.create();
      try {
        assert.equal(liquid.install(), true);
        if (stage === 'resize') {
          assert.match(menu.style.getPropertyValue('backdrop-filter'), /url\(#test-/);
          assert.ok(successes > 0, 'initial map succeeded');
          menu.offsetWidth = 221; // cache miss
          failing = true; liquid.refresh(); advance(120);
        }
        await t.test('failure restores both original values and priorities', () => {
          assert.ok(attempts > 0, 'injected canvas failure was reached');
          assert.deepEqual([
            menu.style.getPropertyValue('backdrop-filter'), menu.style.getPropertyPriority('backdrop-filter'),
            menu.style.getPropertyValue('-webkit-backdrop-filter'), menu.style.getPropertyPriority('-webkit-backdrop-filter'),
          ], ['blur(7px)', 'important', 'blur(8px)', 'important']);
        });
        failing = false;
        const before = successes;
        liquid.refresh(); advance(120);
        await t.test('retry generates a map and applies glass', () => {
          assert.ok(successes > before, 'retry generated a map');
          assert.match(menu.style.getPropertyValue('backdrop-filter'), /url\(#test-/);
          assert.match(menu.style.getPropertyValue('-webkit-backdrop-filter'), /url\(#test-/);
        });
      } finally { liquid.uninstall(); }
    });
  }
}
