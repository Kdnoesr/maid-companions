const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../lib/client.js'), 'utf8');
const start = source.indexOf('const reducedTransparency =');
const end = source.indexOf('// ── 通用设置', start);
assert.ok(start >= 0 && end > start);

test('feature switches independently mount and remove their effects', () => {
  const attrs = new Set();
  let stage = false;
  let installs = 0;
  let uninstalls = 0;
  const store = () => ({ value: true, getSnapshot() { return this.value; }, subscribe(fn) { this.notify = fn; } });
  const portraitStore = store(), glassStore = store(), enabledStore = store();
  const preference = { matches: false, addEventListener(type, listener) {
    assert.equal(type, 'change');
    this.notify = listener;
  } };
  const ctx = {
    window: { matchMedia: () => preference },
    enabledPref: true, portraitStore, glassStore, enabledStore,
    OWNER_ATTR: 'portrait', GLASS_ATTR: 'glass',
    body: { hasAttribute: name => attrs.has(name), removeAttribute: name => attrs.delete(name),
      toggleAttribute: (name, on) => on ? attrs.add(name) : attrs.delete(name) },
    stage: { remove() { stage = false; } },
    syncVisibility() { stage = true; attrs.add('portrait'); },
    syncComposerMotion() {}, setChatActive() {}, clearTimeout() {},
    resizeTimer: undefined, motionTimer: undefined, motionPhase: undefined, lastChatActive: false,
    liquid: { install() { installs++; }, uninstall() { uninstalls++; } },
  };
  vm.runInNewContext(source.slice(start, end), ctx);
  const check = (portrait, glass, counts) => {
    assert.equal(stage, portrait);
    assert.equal(attrs.has('portrait'), portrait);
    assert.equal(attrs.has('glass'), glass);
    assert.deepEqual([installs, uninstalls], counts);
  };
  check(true, true, [1, 0]);
  preference.matches = true; preference.notify();
  check(true, false, [1, 1]);
  preference.matches = false; preference.notify();
  check(true, true, [2, 1]);
  portraitStore.value = false; portraitStore.notify();
  check(false, true, [2, 1]);
  glassStore.value = false; glassStore.notify();
  check(false, false, [2, 2]);
  portraitStore.value = true; portraitStore.notify();
  check(true, false, [2, 2]);
  ctx.enabledPref = false; enabledStore.notify();
  check(false, false, [2, 2]);
  ctx.enabledPref = true; enabledStore.notify();
  check(true, false, [2, 2]);
});

test('composer seat clears the footer gradient when either feature is active', () => {
  assert.ok(source.includes('body:is([${OWNER_ATTR}], [${GLASS_ATTR}]) [data-composer-seat] {\n\tbackground: transparent !important;'));
});
