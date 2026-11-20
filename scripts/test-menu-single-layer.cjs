// Regression against the live createLiquidGlass implementation, using the existing
// deterministic DOM/timer fixture. Run: node --test scripts/test-menu-single-layer.cjs
// This is a DOM/ownership test, not a browser rendering or CSS cascade test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const source = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = source.indexOf('const liquid = context.create();');
  assert.ok(end > 0, 'lifecycle fixture boundary must exist');
  return new Function('require', '__dirname', source.slice(0, end) + '\nreturn {context, Node, body, timers, advance};')(require, __dirname);
}
function makeMenu(Node, body) {
  const menu = new Node('div');
  menu.setAttribute('role', 'menu');
  menu.offsetWidth = 220; menu.offsetHeight = 150;
  body.appendChild(menu);
  return menu;
}
function filter(el) { return el.style.getPropertyValue('backdrop-filter'); }
function filtersInBody(body) { return body.children.filter(el => el.tag === 'svg'); }

function material(Node, menu, standard, webkit) {
  const layer = new Node('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.offsetWidth = menu.offsetWidth; layer.offsetHeight = menu.offsetHeight;
  layer.style.setProperty('backdrop-filter', standard, 'important');
  layer.style.setProperty('-webkit-backdrop-filter', webkit, 'important');
  menu.appendChild(layer);
  return layer;
}
function assertHostFilter(el, standard, webkit) {
  assert.equal(filter(el), standard);
  assert.equal(el.style.getPropertyPriority('backdrop-filter'), 'important');
  assert.equal(el.style.getPropertyValue('-webkit-backdrop-filter'), webkit);
  assert.equal(el.style.getPropertyPriority('-webkit-backdrop-filter'), 'important');
}

test('translucent menu filters its direct material only and restores host styles', () => {
  const {context, Node, body} = fixture();
  const menu = makeMenu(Node, body);
  menu.setAttribute('data-menu-material', 'translucent');
  menu.style.setProperty('backdrop-filter', 'blur(2px)', 'important');
  menu.style.setProperty('-webkit-backdrop-filter', 'blur(3px)', 'important');
  const layer = material(Node, menu, 'blur(7px)', 'blur(8px)');
  const other = material(Node, menu, 'blur(9px)', 'blur(10px)');
  context.document.querySelectorAll = () => [menu];
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.equal(filter(menu), 'none');
    assert.equal(menu.style.getPropertyValue('-webkit-backdrop-filter'), 'none');
    assert.match(filter(layer), /url\(#test-/, 'first direct material receives liquid filter');
    assert.match(layer.style.getPropertyValue('-webkit-backdrop-filter'), /url\(#test-/);
    assertHostFilter(other, 'blur(9px)', 'blur(10px)');
    assert.equal(filtersInBody(body).length, 1, 'one menu produces one SVG filter');
  } finally { liquid.uninstall(); }
  assertHostFilter(menu, 'blur(2px)', 'blur(3px)');
  assertHostFilter(layer, 'blur(7px)', 'blur(8px)');
  assertHostFilter(other, 'blur(9px)', 'blur(10px)');
  assert.equal(filtersInBody(body).length, 0);
});

test('replacing a translucent menu material transfers the filter and restores the old layer', () => {
  const {context, Node, body, advance} = fixture();
  const menu = makeMenu(Node, body);
  menu.setAttribute('data-menu-material', 'translucent');
  const oldLayer = material(Node, menu, 'blur(4px)', 'blur(5px)');
  context.document.querySelectorAll = () => [menu];
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    oldLayer.remove();
    const newLayer = material(Node, menu, 'blur(6px)', 'blur(7px)');
    liquid.refresh(); advance(120);
    assertHostFilter(oldLayer, 'blur(4px)', 'blur(5px)');
    assert.equal(filter(menu), 'none', 'parent must not acquire a second filter');
    assert.match(filter(newLayer), /url\(#test-/, 'replacement material receives filter');
    assert.equal(filtersInBody(body).length, 1, 'replacement does not leak SVG filters');
    liquid.uninstall();
    assertHostFilter(newLayer, 'blur(6px)', 'blur(7px)');
  } finally { liquid.uninstall(); }
  assert.equal(filtersInBody(body).length, 0);
});

test('translucent menu with missing material keeps host inline styles unchanged', () => {
  const {context, Node, body} = fixture();
  const menu = makeMenu(Node, body);
  menu.setAttribute('data-menu-material', 'translucent');
  menu.style.setProperty('backdrop-filter', 'blur(3px)', 'important');
  context.document.querySelectorAll = () => [menu];
  const liquid = context.create();
  liquid.install();
  try {
    assert.equal(filter(menu), 'blur(3px)');
    assert.equal(menu.style.getPropertyPriority('backdrop-filter'), 'important');
  } finally { liquid.uninstall(); }
});

test('invalid material dimensions restore host filters and recover', () => {
  const {context, Node, body, advance} = fixture();
  const menu = makeMenu(Node, body);
  menu.setAttribute('data-menu-material', 'translucent');
  const layer = material(Node, menu, 'blur(4px)', 'blur(5px)');
  context.document.querySelectorAll = () => [menu];
  const liquid = context.create(); liquid.install();
  try {
    for (const [w, h] of [[0, 150], [3, 150], [700, 700]]) {
      layer.offsetWidth = w; layer.offsetHeight = h; liquid.refresh(); advance(120);
      assert.equal(filter(menu), '');
      assertHostFilter(layer, 'blur(4px)', 'blur(5px)');
      layer.offsetWidth = 220; layer.offsetHeight = 150; liquid.refresh(); advance(120);
      assert.equal(filter(menu), 'none');
      assert.match(filter(layer), /url\(#test-/);
    }
  } finally { liquid.uninstall(); }
});

test('canvas failure restores native material and permits recovery', () => {
  for (const mode of ['null', 'throw']) {
    const {context, Node, body, advance} = fixture();
    const menu = makeMenu(Node, body); menu.setAttribute('data-menu-material', 'translucent');
    const layer = material(Node, menu, 'blur(4px)', 'blur(5px)');
    context.document.querySelectorAll = () => [menu];
    const liquid = context.create(); liquid.install();
    const original = context.document.createElement;
    context.document.createElement = tag => tag === 'canvas' ? {getContext() { if (mode === 'throw') throw Error('canvas unavailable'); return null; }} : original(tag);
    try {
      menu.offsetWidth = layer.offsetWidth = 221; // force a cache miss
      liquid.refresh(); advance(120);
      assert.equal(filter(menu), ''); assertHostFilter(layer, 'blur(4px)', 'blur(5px)');
      context.document.createElement = original; liquid.refresh(); advance(120);
      assert.equal(filter(menu), 'none'); assert.match(filter(layer), /url\(#test-/);
    } finally { liquid.uninstall(); }
  }
});

test('in-place transition between material and legacy menu restores both owners', () => {
  const {context, Node, body, advance} = fixture();
  const menu = makeMenu(Node, body);
  menu.setAttribute('data-menu-material', 'translucent');
  menu.style.setProperty('backdrop-filter', 'blur(2px)', 'important');
  menu.style.setProperty('-webkit-backdrop-filter', 'blur(3px)', 'important');
  const layer = material(Node, menu, 'blur(4px)', 'blur(5px)');
  context.document.querySelectorAll = () => [menu];
  const liquid = context.create(); liquid.install();
  try {
    menu.removeAttribute('data-menu-material'); liquid.refresh(); advance(120);
    assertHostFilter(layer, 'blur(4px)', 'blur(5px)');
    assert.match(filter(menu), /url\(#test-/);
    menu.setAttribute('data-menu-material', 'translucent'); liquid.refresh(); advance(120);
    assert.equal(filter(menu), 'none');
    assert.match(filter(layer), /url\(#test-/);
  } finally { liquid.uninstall(); }
  assertHostFilter(menu, 'blur(2px)', 'blur(3px)');
  assertHostFilter(layer, 'blur(4px)', 'blur(5px)');
});

test('legacy menu without a material retains parent fallback and restores host styles', () => {
  const {context, Node, body} = fixture();
  const menu = makeMenu(Node, body);
  menu.style.setProperty('backdrop-filter', 'blur(7px)', 'important');
  menu.style.setProperty('-webkit-backdrop-filter', 'blur(8px)', 'important');
  context.document.querySelectorAll = () => [menu];
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.match(filter(menu), /url\(#test-/);
    assert.equal(liquid.install(), true);
    assert.equal(filtersInBody(body).length, 1, 'idempotent install creates one SVG');
  } finally { liquid.uninstall(); }
  assert.equal(filter(menu), 'blur(7px)');
  assert.equal(menu.style.getPropertyPriority('backdrop-filter'), 'important');
  assert.equal(menu.style.getPropertyValue('-webkit-backdrop-filter'), 'blur(8px)');
  assert.equal(menu.style.getPropertyPriority('-webkit-backdrop-filter'), 'important');
  assert.equal(filtersInBody(body).length, 0);
});

test('removing target eligibility restores native menu and removes its SVG', () => {
  const {context, Node, body, advance} = fixture();
  const menu = makeMenu(Node, body);
  menu.setAttribute('data-menu-material', 'translucent');
  menu.style.setProperty('backdrop-filter', 'blur(2px)', 'important');
  menu.style.setProperty('-webkit-backdrop-filter', 'blur(3px)', 'important');
  const layer = material(Node, menu, 'blur(4px)', 'blur(5px)');
  let eligible = true; context.document.querySelectorAll = () => eligible ? [menu] : [];
  const liquid = context.create(); liquid.install();
  try {
    eligible = false; menu.removeAttribute('role'); liquid.refresh(); advance(120);
    assertHostFilter(menu, 'blur(2px)', 'blur(3px)');
    assertHostFilter(layer, 'blur(4px)', 'blur(5px)');
    assert.equal(filtersInBody(body).length, 0);
    eligible = true; menu.setAttribute('role', 'menu'); liquid.refresh(); advance(120);
    assert.equal(filter(menu), 'none'); assert.match(filter(layer), /url\(#test-/);
  } finally { liquid.uninstall(); }
  assertHostFilter(menu, 'blur(2px)', 'blur(3px)');
  assertHostFilter(layer, 'blur(4px)', 'blur(5px)');
});

test('menu insertion, removal, and pending work after uninstall', () => {
  const {context, Node, body, timers, advance} = fixture();
  let targets = [];
  context.document.querySelectorAll = () => targets;
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  const first = makeMenu(Node, body);
  targets = [first]; liquid.refresh();
  assert.match(filter(first), /url\(#test-/, 'new menu is mounted synchronously');
  targets = []; liquid.refresh(); advance(120);
  assert.equal(filter(first), '', 'removed target is restored on sync');
  assert.equal(filtersInBody(body).length, 0);
  const second = makeMenu(Node, body);
  targets = [second]; liquid.refresh();
  assert.match(filter(second), /url\(#test-/);
  assert.ok(timers.size > 0);
  liquid.uninstall();
  assert.equal(timers.size, 0);
  advance(1000);
  assert.equal(filter(second), '');
  assert.equal(filtersInBody(body).length, 0);
  liquid.install();
  assert.match(filter(second), /url\(#test-/, 'reinstall remounts');
  liquid.uninstall();
});
