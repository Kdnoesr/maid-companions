// Run: node --test scripts/test-document-zoom-glass.cjs
// Source/fixture regression only: this is not a browser cascade or visual test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../lib/client.js'), 'utf8');
const zoom = '[data-document-zoom-controls]';

function selector() {
  const match = source.match(/const LIQUID_SELECTOR = \[([\s\S]*?)\]\.join\(","\)/);
  assert.ok(match, 'live liquid selector array found');
  // Evaluate the real array, including comments, instead of duplicating its entries.
  return vm.runInNewContext('[' + match[1] + '].join(",")');
}
function fixture() {
  const text = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = text.indexOf('const liquid = context.create();');
  assert.ok(end > 0);
  return new Function('require', '__dirname', text.slice(0, end) + '\nreturn {context, Node, body};')(require, __dirname);
}

test('live selector targets the toolbar itself, not its buttons', () => {
  const selections = selector().split(',');
  assert.equal(selections.filter(s => s === zoom).length, 1);
  assert.ok(!selections.some(s => s.includes(zoom) && s !== zoom));
  const {context, Node, body} = fixture();
  const toolbar = new Node('div'); toolbar.setAttribute('data-document-zoom-controls', '');
  toolbar.offsetWidth = 180; toolbar.offsetHeight = 36;
  const button = new Node('button'); toolbar.appendChild(button); body.appendChild(toolbar);
  const unrelated = new Node('div'); body.appendChild(unrelated);
  context.LIQUID_SELECTOR = selector();
  context.document.querySelectorAll = actual => {
    assert.equal(actual, selector(), 'implementation uses the real source selector');
    return actual.split(',').includes(zoom) ? [toolbar] : [];
  };
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.match(toolbar.style.getPropertyValue('backdrop-filter'), /url\(#test-/);
    for (const el of [button, unrelated]) {
      assert.equal(el.style.getPropertyValue('backdrop-filter'), '');
      assert.equal(el.style.getPropertyValue('-webkit-backdrop-filter'), '');
    }
  } finally { liquid.uninstall(); }
  assert.equal(toolbar.style.getPropertyValue('backdrop-filter'), '');
});

test('zoom CSS is owner-scoped and uses the dedicated layer token', () => {
  const rule = source.match(/body\[\$\{OWNER_ATTR\}\]\s+\[data-document-zoom-controls\]\s*\{([^{}]*)\}/);
  assert.ok(rule, 'owner-scoped zoom rule');
  const declarations = rule[1];
  assert.match(declarations, /background-color:\s*color-mix\(in srgb,\s*var\(--dsw-alias-bg-layer-1\)\s+40%,\s*transparent\)/);
  assert.match(declarations, /(?:^|\s)backdrop-filter:\s*blur\(1px\)/);
  assert.match(declarations, /-webkit-backdrop-filter:\s*blur\(1px\)/);
  assert.doesNotMatch(declarations, /--dsw-specific-menu/);
});

test('outer mutation observer subscribes to zoom attribute and refreshes on changes', () => {
  const start = source.indexOf('const SVG_NS_URI =', source.indexOf('function apply(ctx)'));
  const end = source.indexOf('resizeHandler = () =>', start);
  assert.ok(start >= 0 && end > start);
  let callback, observed, refreshes = 0;
  const body = {};
  const context = { body, enabledPref: true, observer: null,
    MutationObserver: class { constructor(cb) { callback = cb; } observe(target, options) { observed = {target, options}; } },
    setChatActive() {}, syncVisibility() {}, syncComposerMotion() {}, liquid: { refresh() { refreshes++; } } };
  vm.runInNewContext(source.slice(start, end), context);
  assert.equal(observed.target, body);
  assert.equal(observed.options.attributes, true);
  assert.equal(observed.options.subtree, true);
  assert.ok(observed.options.attributeFilter.includes('data-document-zoom-controls'));
  callback([{type:'attributes', attributeName:'data-document-zoom-controls', target:{nodeType:1, hasAttribute(){return false;}}}]);
  assert.equal(refreshes, 1);
});