const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(process.env.MC_COMPARE_ROOT || path.join(__dirname, '..'), 'lib/client.js'), 'utf8');
const start = source.indexOf('const rebuildAll =');
const end = source.indexOf('const schedule =', start);
assert.ok(start >= 0 && end > start);

test('adding a popup applies it immediately without rebuilding the existing composer', () => {
  const card = {}, popup = {}, stale = {};
  const original = {};
  const instances = new Map([[card, original], [stale, {}]]);
  const applied = [], removed = [];
  const run = vm.runInNewContext(source.slice(start, end) + '\nmountNew;', {
    instances, liveBubbles: new Set(), discoverBubbles() {}, collectTargets: () => [card, popup],
    mount(el) { const inst = {}; instances.set(el, inst); return inst; },
    unmount(el) { removed.push(el); instances.delete(el); },
    applyTo(el, inst) { assert.equal(inst, instances.get(el)); applied.push(el); },
  });
  run();
  assert.deepEqual(removed, [stale]);
  assert.deepEqual(applied, [popup]);
  assert.equal(instances.get(card), original);
  run();
  assert.deepEqual(applied, [popup]);
});

test('ordinary refresh reconciles immediately without scheduling a full rebuild', () => {
  const start = source.indexOf('refresh() {', source.indexOf('const schedule ='));
  const end = source.indexOf('debug() {', start);
  assert.ok(start >= 0 && end > start);
  let scans = 0, scheduled = 0;
  const glass = vm.runInNewContext('({' + source.slice(start, end) + '})', {
    ro: {}, mountNew() { scans++; }, schedule() { scheduled++; }, sync() {},
  });
  glass.refresh();
  assert.equal(scans, 1);
  assert.equal(scheduled, 0);
});
