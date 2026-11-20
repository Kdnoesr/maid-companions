// Offline analytical test; reads production source but does not modify it or use a browser.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../lib/client.js'), 'utf8');
function capture(re, name) { const m = source.match(re); assert(m, 'Source changed: ' + name); return m; }
const liquid = capture(/const LIQUID = \{([\s\S]*?)\n\s*\};/, 'LIQUID')[1];
function param(name) { const m = liquid.match(new RegExp('\\b' + name + ':\\s*([0-9.]+)')); assert(m, 'Missing LIQUID.' + name); return Number(m[1]); }
const strength = param('strength'), bezel = param('bezelPx'), zoom = param('zoom');
const threshold = Number(capture(/const LIQUID_RING_MIN_AREA = (\d+)/, 'area threshold')[1]);
assert.equal(strength, 0.8); assert.equal(bezel, 24); assert.equal(zoom, 0);
assert(source.includes('else if (ease !== "lin") m = m * m;'));
assert(source.includes('const k = LIQUID.strength * (kScale || 1);'));
assert(source.includes('const amp = m * k * sBezel;'));
assert(source.includes('const map = buildMap(w, h, radius, bezel);'));
assert(source.includes('!el.hasAttribute("data-composer-card") &&'));
assert(source.includes('const card = live.filter((el) => el.hasAttribute("data-composer-card"));'));
// Straight edge in original-pixel coordinates, before bitmap quantization/interpolation.
// depth s grows inward; displacement is inward; sampling coordinate is s + K*m².
const samples = 24000;
function calc(k) {
  let prev = -Infinity, minStep = Infinity, decreases = 0;
  for (let i = 0; i <= samples; i++) {
    const s = bezel * i / samples, t = 1 - s / bezel;
    const m = t * t * (3 - 2 * t);
    const coord = s + k * bezel * m * m;
    if (i) { const delta = coord - prev; minStep = Math.min(minStep, delta); if (delta < -1e-12) decreases++; }
    prev = coord;
  }
  const t = 1 - Math.sqrt(10) / 10;
  const peakSlope = 12 * t ** 3 * (1 - t) * (3 - 2 * t);
  return { strength: k, peakDisplacementPx: k * bezel, minimumDerivative: 1 - k * peakSlope, minimumSampleStepPx: minStep, decreasingIntervals: decreases };
}
const old = calc(strength), candidate = calc(0.4);
assert(old.decreasingIntervals > 0, '0.8 should fold');
assert.equal(candidate.decreasingIntervals, 0, '0.4 should be monotone');
console.log('source:', path.join(__dirname, '../lib/client.js'));
console.log('source parameters:', { strength, bezel, zoom, threshold });
console.log('classification: composer [data-composer-card] is distinct, but currently shares the small-target buildMap path; large panel uses lin path.');
console.log('continuous straight-edge model; 24,000 intervals; excludes 8-bit encoding, interpolation and corners');
console.log(JSON.stringify([old, candidate], null, 2));
