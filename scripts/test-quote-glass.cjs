// Run: node --test scripts/test-quote-glass.cjs
// Source regression and deliberately limited selector simulation, not Chromium validation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../lib/client.js'), 'utf8');
const expected = 'div:has(> [data-quote-popover])';

function liquidSelector() {
  const match = source.match(/const LIQUID_SELECTOR = \[([\s\S]*?)\]\.join\(","\)/);
  assert.ok(match, 'real LIQUID_SELECTOR array found');
  return vm.runInNewContext('[' + match[1] + '].join(",")');
}
function menuRule() {
  // Match an owner-scoped rule containing the selector and menu color token.
  const css = source.slice(source.indexOf('const STAGE_CSS = '), source.indexOf('const SETTINGS_CSS = '));
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replaceAll('${OWNER_ATTR}', 'OWNER_ATTR');
  const rules = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  return rules.find(([, selector, body]) => selector.includes(expected) && /var\(--dsw-specific-menu(?:[,\s)]|$)/.test(body));
}

test('real liquid selector includes the direct-parent quote surface only', () => {
  const entries = liquidSelector().split(',').map(s => s.trim());
  assert.equal(entries.filter(s => s === expected).length, 1, 'one exact direct-parent selector');
  assert.deepEqual(entries.filter(s => s.includes('data-quote-popover')), [expected]);
});

test('quote surface uses owner-scoped menu glass CSS', () => {
  const rule = menuRule();
  assert.ok(rule, 'owner-scoped rule targets quote parent with --dsw-specific-menu');
  assert.match(rule[1], /body\[OWNER_ATTR\]/);
  assert.match(rule[2], /background-color\s*:\s*color-mix\([^;]*var\(--dsw-specific-menu/);
  assert.match(rule[2], /(?:^|\s)backdrop-filter\s*:/);
});

test('selector simulation distinguishes parent, marker, bridge, and portal', () => {
  const entries = liquidSelector().split(',').map(s => s.trim());
  const marker = {tag:'span', marked:true, children:[]};
  const parent = {tag:'div', children:[marker]};
  const bridge = {tag:'div', children:[parent]};
  const portal = {tag:'div', children:[bridge]};
  // This recognizes only the exact specified selector; it is NOT a querySelector
  // parser and cannot establish whether arbitrary selectors match in Chromium.
  function simulatedMatch(node) {
    return entries.includes(expected) && node.tag === 'div' && node.children.some(child => child.marked);
  }
  assert.equal(simulatedMatch(parent), true);
  for (const node of [marker, bridge, portal]) assert.equal(simulatedMatch(node), false);
  assert.deepEqual(entries.filter(s => s.includes('data-quote-popover')), [expected], 'no broader quote-related selector');
});

test('mutation observer subscribes to quote marker attribute', () => {
  const start = source.indexOf('const SVG_NS_URI =', source.indexOf('function apply(ctx)'));
  const end = source.indexOf('resizeHandler = () =>', start);
  assert.ok(start >= 0 && end > start);
  let callback, observed, refreshes = 0;
  const body = {};
  const context = {body, enabledPref:true, observer:null,
    MutationObserver: class { constructor(cb) { callback = cb; } observe(target, options) { observed = {target, options}; } },
    setChatActive() {}, syncVisibility() {}, syncComposerMotion() {}, liquid: {refresh() { refreshes++; }}};
  vm.runInNewContext(source.slice(start, end), context);
  assert.equal(observed.target, body);
  assert.equal(observed.options.attributes, true);
  assert.equal(observed.options.subtree, true);
  assert.ok(observed.options.attributeFilter.includes('data-quote-popover'));
  callback([{type:'attributes', attributeName:'data-quote-popover', target:{nodeType:1, hasAttribute(){return false;}}}]);
  assert.equal(refreshes, 1);
});