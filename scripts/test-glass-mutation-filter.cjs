const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual outer observer and its surrounding predicates, not a copy.
const source = fs.readFileSync(path.join(__dirname, '../lib/client.js'), 'utf8');
const start = source.indexOf('const SVG_NS_URI =', source.indexOf('function apply(ctx)'));
const end = source.indexOf('resizeHandler = () =>', start);
assert.ok(start >= 0 && end > start, 'outer observer filter found in runtime client.js');

function fixture() {
  let callback, refreshes = 0;
  const context = {
    enabledPref: true, observer: null, body: {},
    CHAT_SELECTOR: "[data-chat-flow]",
    MutationObserver: class { constructor(cb) { callback = cb; } observe() {} },
    setChatActive() {}, syncVisibility() {}, syncComposerMotion() {},
    liquid: { refresh() { refreshes++; } },
  };
  vm.runInNewContext(source.slice(start, end), context);
  return { deliver(records) { callback(records); return refreshes; } };
}

const svgNS = 'http://www.w3.org/2000/svg';
function element(tag, attrs = {}, namespaceURI = 'http://www.w3.org/1999/xhtml') {
  const node = { nodeType: 1, tagName: tag.toUpperCase(), localName: tag, namespaceURI, children: [], parentNode: null,
    hasAttribute(name) { return Object.hasOwn(attrs, name); },
    getAttribute(name) { return attrs[name] ?? null; },
    appendChild(child) { this.children.push(child); child.parentNode = this; child.parentElement = this; return child; },
    querySelector(selector) { if (selector.includes('filter')) return this.children.find(x => x.localName === 'filter') ?? null; return null; },
    matches(selector) { return selector.includes('data-mc-glass-veil') && this.hasAttribute('data-mc-glass-veil'); },
    closest(selector) { for (let n = this; n; n = n.parentElement) if (n.matches(selector)) return n; return null; },
    contains(other) { return this === other || this.children.some(child => child.contains?.(other)); },
  };
  return node;
}
function pluginSvg() {
  const svg = element('svg', { width: '0', height: '0', 'aria-hidden': 'true', 'data-mc-glass-svg': '' }, svgNS);
  svg.appendChild(element('filter', { id: 'dsh-maid-companion-liquid-glass-0' }, svgNS));
  return svg;
}
function change(addedNodes = [], removedNodes = [], target = element('div')) {
  return { type: 'childList', target, addedNodes, removedNodes };
}

test('host text node additions and removals trigger refresh', () => {
  for (const record of [change([{nodeType: 3, textContent: 'host'}]), change([], [{nodeType: 3, textContent: 'host'}])]) {
    assert.equal(fixture().deliver([record]), 1);
  }
});
test('chat text batches skip refresh, but structural changes still trigger it', () => {
  const chatNode = element('div');
  chatNode.closest = () => chatNode;
  const text = change([{nodeType: 3}], [], chatNode);
  const structural = change([element('div')], [], chatNode);
  const harness = fixture();
  for (let i = 0; i < 100; i++) assert.equal(harness.deliver([text]), 0);
  assert.equal(harness.deliver([text, structural]), 1);
});
test('host SVG additions and removals trigger refresh', () => {
  const svg = element('svg', {}, svgNS);
  for (const record of [change([svg]), change([], [svg])]) assert.equal(fixture().deliver([record]), 1);
});
test('plugin filter SVG additions and removals do not trigger refresh', () => {
  const svg = pluginSvg();
  for (const record of [change([svg]), change([], [svg])]) assert.equal(fixture().deliver([record]), 0);
});
test('detached children removed inside plugin SVG do not trigger refresh', () => {
  const svg = pluginSvg();
  const removed = element('filter', {}, svgNS);
  assert.equal(fixture().deliver([change([], [removed], svg)]), 0);
  assert.equal(fixture().deliver([change([], [{nodeType: 3}], svg)]), 0);
});

test('plugin veil additions and removals do not trigger refresh', () => {
  const veil = element('div', {'data-mc-glass-veil': ''});
  for (const record of [change([veil]), change([], [veil])]) assert.equal(fixture().deliver([record]), 0);
});
test('mixed host and plugin mutations trigger refresh', () => {
  const veil = element('div', {'data-mc-glass-veil': ''});
  const text = {nodeType: 3, textContent: 'host'};
  assert.equal(fixture().deliver([change([pluginSvg(), text])]), 1);
  assert.equal(fixture().deliver([change([veil]), change([], [element('svg', {}, svgNS)])]), 1);
});
test('host attributes trigger refresh', () => {
  for (const attributeName of ['data-phase', 'role', 'class', 'data-menu-material', 'aria-hidden', 'data-composer-card', 'aria-modal', 'data-context-menu'])
    assert.equal(fixture().deliver([{type: 'attributes', target: element('div'), attributeName}]), 1);
});

test('observer subscribes to attributes that change target eligibility', () => {
  const match = source.match(/observer\.observe\(body, \{ childList: true, subtree: true, attributes: true, attributeFilter: \[([^\]]+)\]/);
  assert.ok(match);
  for (const name of ['role', 'class', 'data-menu-material', 'aria-hidden', 'data-composer-card', 'aria-modal', 'data-context-menu'])
    assert.ok(match[1].includes('\"' + name + '\"'), name);
});
