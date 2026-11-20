const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/client.js'), 'utf8');
test('only visible bubbles get instances and removed bubbles ignore stale deliveries', () => {
  const composer = {};
  const targets = Array.from({length: 200}, () => ({isConnected: true, matches: () => true}));
  let found = targets;
  const instances = new Map([[composer, {}]]);
  const watched = new Set(), applied = [];
  const observer = {observe: el => watched.add(el), unobserve: el => watched.delete(el)};
  const start = source.indexOf('let bubbleObserver =');
  const end = source.indexOf('const rebuildAll =', start);
  assert.ok(start >= 0 && end > start);
  const engine = vm.runInNewContext(source.slice(start, end) + '\nbubbleObserver = observer; ({discoverBubbles, onBubbleIntersection});', {
    observer, instances, CHAT_SELECTOR: '[data-chat-flow]', document: {querySelectorAll: () => found},
    mount(el) { const instance = {}; instances.set(el, instance); return instance; },
    unmount: el => instances.delete(el), applyTo: el => applied.push(el),
  });
  const entry = (target, isIntersecting) => ({target, isIntersecting, intersectionRect: {width: 100, height: 24}});
  engine.discoverBubbles();
  assert.equal(watched.size, 200);
  engine.onBubbleIntersection(targets.map((el, i) => entry(el, i < 4)), observer);
  assert.equal(instances.size, 5);
  engine.onBubbleIntersection([entry(targets[0], false), entry(targets[100], true)], observer);
  assert.equal(instances.size, 5);
  assert.ok(!instances.has(targets[0]));
  found = targets.slice(101);
  engine.discoverBubbles();
  engine.onBubbleIntersection([entry(targets[100], true)], observer);
  assert.deepEqual([...instances.keys()], [composer]);
  assert.equal(applied.length, 5);
  const invalid = found[0];
  engine.onBubbleIntersection([entry(invalid, true)], observer);
  invalid.matches = () => false;
  engine.onBubbleIntersection([entry(invalid, true)], observer);
  assert.ok(!instances.has(invalid));
  assert.ok(!watched.has(invalid));
});

test('resize deliveries coalesce and only apply to connected dirty instances', () => {
  const card = {isConnected: true}, menu = {isConnected: true}, removed = {isConnected: true};
  const observer = {}, instances = new Map([[card, {}], [menu, {}], [removed, {}]]);
  const jobs = [], applied = [];
  const start = source.indexOf('let resizeTimer = null;', source.indexOf('let bubbleObserver ='));
  const end = source.indexOf('const rebuildAll =', start);
  assert.ok(start >= 0 && end > start);
  const resize = vm.runInNewContext(source.slice(start, end) + '\nonResize;', {
    ro: observer, instances, setTimeout(fn) { jobs.push(fn); return jobs.length; },
    applyTo(el) { applied.push(el); },
  });
  resize([{target: menu}], {});
  resize([{target: card}, {target: removed}], observer);
  resize([{target: card}], observer);
  instances.delete(removed);
  assert.equal(jobs.length, 1);
  jobs[0]();
  assert.deepEqual(applied, [card]);
});
