const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(require.resolve('../lib/client.js'), 'utf8');
const start = source.indexOf('const roundedRectSDF =');
const end = source.indexOf('const instances = new Map()', start);
const mapSource = source.slice(start, end);
const setup =   'const clamp = (x,a,b) => Math.min(Math.max(x,a),b);' +
  'const smoothStep = (a,b,x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };' +
  'const LIQUID = {strength:0.8,zoom:0};';

function createMapFactory() {
  return vm.runInNewContext(setup + mapSource + '\nbuildMap;', {
    document: { createElement: () => {
      let image;
      return {
        getContext: () => ({ createImageData: (w,h) => ({w,h,data:new Uint8ClampedArray(w*h*4)}),
          putImageData: value => { image = value; } }),
        toDataURL: () => image,
      };
    } },
  });
}

test('original glass keeps its single achromatic displacement map', () => {
  const createMap = createMapFactory();
  const map = createMap(240, 152, 20, 24, null, 1, null, 10);
  const { w, h, data } = map.url;
  assert.equal(map.scale, 20);
  assert.ok(data[Math.floor(w / 2) * 4 + 1] > 200);
  const center = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
  assert.deepEqual(Array.from(data.slice(center, center + 4)), [128, 128, 128, 255]);
  assert.equal(createMap(240, 152, 20, 24, null, 1, null, 10), map);
  assert.doesNotMatch(source, /const (?:traceGlass|appendReflection) =/);
});
