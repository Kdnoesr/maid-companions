// Exercise the live implementation with the existing deterministic DOM/canvas fixture.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixture = fs.readFileSync(path.join(__dirname, 'test-glass-map-cache.cjs'), 'utf8');
const marker = 'const liquid = context.create();';
const cutoff = fixture.indexOf(marker);
if (cutoff < 0) throw new Error('glass fixture marker missing');
// Expose the real closure function without replacing its algorithm or cache.
const setup = fixture.slice(0, cutoff).replace(
  "source.slice(start,end) + ';this.create = createLiquidGlass;'",
  "source.slice(start,end).replace('const instances = new Map();', 'globalThis.testBuildMap = buildMap; const instances = new Map();') + ';this.create = createLiquidGlass;'"
);
vm.runInThisContext('(function(require, __dirname) {\n' + setup + `
const liquid = context.create();
const build = (...args) => context.testBuildMap(...args);
const base = [30, 30, 4, 24];
function check(label, args, expected) {
  const before = encodes;
  const result = build(...args);
  assert.ok(result, label + ': map created');
  assert.equal(encodes - before, expected, label + ': encoding count');
  return result;
}
const first = check('initial', base, 1);
assert.strictEqual(check('identical', base, 0), first);
for (const [label, args] of [
  ['width', [31,30,4,24]], ['height', [30,31,4,24]],
  ['radius', [30,30,5,24]], ['bezel', [30,30,4,25]],
  ['area', [30,30,4,24,{w:50,h:40,r:4,ox:1,oy:2}]],
  ['scale', [30,30,4,24,undefined,2]],
  ['ease', [30,30,4,24,undefined,undefined,'lin']]
]) check(label, args, 1);
assert.strictEqual(check('old parameters hit', base, 0), first);
// Base plus seven variants fills eight entries. Touching base makes width LRU.
check('ninth entry', [32,30,4,24], 1);
assert.strictEqual(check('recently used survives', base, 0), first);
check('least recently used evicted', [31,30,4,24], 1);
context.LIQUID.strength = 0.9;
check('strength changed', base, 1);
context.LIQUID.strength = 0.8;
check('strength restored hits', base, 0);
context.LIQUID.zoom = 0.1;
check('zoom changed', base, 1);
context.LIQUID.zoom = 0;
check('zoom restored hits', base, 0);
// A null 2D context is a failed generation and must be retried, not cached.
const originalCreate = context.document.createElement;
let failedAttempts = 0;
context.document.createElement = function(tag) {
  const node = originalCreate.call(this, tag);
  if (tag === 'canvas' && failedAttempts++ === 0) node.getContext = () => null;
  return node;
};
const failedArgs = [45,30,4,24];
assert.equal(build(...failedArgs), null);
check('retry after failed context', failedArgs, 1);
check('successful retry cached', failedArgs, 0);
context.document.createElement = originalCreate;
// Cache belongs to the createLiquidGlass instance and survives uninstall.
assert.equal(liquid.install(), true);
liquid.uninstall();
assert.equal(timers.size, 0);
const beforeReinstall = encodes;
assert.equal(liquid.install(), true);
assert.equal(encodes, beforeReinstall, 'reinstall reuses cached map');
liquid.uninstall();
const other = context.create();
const beforeOther = encodes;
assert.equal(other.install(), true);
assert.ok(encodes > beforeOther, 'new instance has a fresh cache');
other.uninstall();
assert.equal(timers.size, 0);
console.log('glass cache boundary tests passed');
` + '\n})')(require, __dirname);
