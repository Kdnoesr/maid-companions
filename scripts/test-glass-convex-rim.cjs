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

test('convex rim keeps encoded displacement bounded and preserves edge sample order', () => {
  const createMap = createMapFactory();
  for (const [width,height,bezel,radius] of [[36,18,8,9],[240,152,24,20],[680,160,24,20]]) {
    const target = Math.min(10, 0.4545 * bezel);
    const map = createMap(width,height,radius,bezel,null,1,'convex-rim',target);
    const {w,h,data} = map.url;
    assert.ok(Math.max(w,h) <= 256);
    assert.equal(map.scale, 2 * target);
    let previous = -Infinity;
    for (let y = 0; y < h/2; y++) {
      const i = (y*w + Math.floor(w/2))*4;
      const shift = map.scale * (data[i+1]/255 - 0.5);
      const depth = (y+0.5)*height/h;
      assert.ok(shift >= 0 && shift <= target);
      assert.ok(depth + shift > previous);
      if (depth >= bezel) assert.equal(data[i+1], kNeutral);
      assert.equal(data[i], kNeutral);
      const reflected = data[((h-1-y)*w + Math.floor(w/2))*4+1];
      assert.ok(Math.abs(data[i+1] + reflected - 255) <= 1);
      previous = depth + shift;
    }
    const legacy = createMap(width,height,radius,bezel,null,1,null,target);
    assert.notDeepEqual(map.url.data, legacy.url.data);
    assert.equal(createMap(width,height,radius,bezel,null,1,'convex-rim',target), map);
  }
});
const kNeutral = 128;
