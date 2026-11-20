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

test('physical glass bends inward and reflects more at the illuminated edge', () => {
  const createMap = createMapFactory();
  const width = 240, height = 152, bezel = 24;
  const map = createMap(width, height, 20, bezel, null, 1, 'physical', 10);
  const {w,h,data} = map.url;
  const at = (y, channel) => data[(y*w + Math.floor(w/2))*4 + channel];
  assert.ok(at(0, 1) > 200);
  assert.ok(at(0, 2) > at(h-1, 2) + 8);
  assert.equal(at(bezel + 1, 1), kNeutral);
  assert.equal(at(bezel + 1, 2), 0);
  assert.ok(map.scale > 0 && map.scale <= 20);
  let previous = -Infinity;
  for (let y = 0; y <= bezel; y++) {
    const sample = y + map.scale * (at(y, 1)/255 - 0.5);
    assert.ok(sample > previous, 'background sampling must not fold back');
    previous = sample;
  }
});

test('spectral mode bounds fringe, retains reflection and switches back to one sample', () => {
  const makeNode = () => ({ attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }, remove() { this.removed = true; } });
  const from = source.indexOf('const opticalPrimitive =');
  const to = source.indexOf('const mount =', from);
  const update = vm.runInNewContext(source.slice(from, to) + '\nupdateOpticalFilter;', {
    SVGNS: 'svg', document: { createElementNS(_, tag) { return Object.assign(makeNode(), { tag }); } },
  });
  const filter = { added: [], append(...nodes) { this.added.push(...nodes); } };
  const green = makeNode();
  update(filter, green, 12, true);
  const { red, blue, nodes } = green.__mcOptics;
  assert.ok(+red.attributes.scale < 12 && +blue.attributes.scale > 12);
  assert.ok((blue.attributes.scale - red.attributes.scale) / 2 <= 0.900001);
  assert.equal(nodes.at(-1).attributes.in2, 'transmitted');
  update(filter, green, 10, true);
  assert.equal(green.__mcOptics.nodes, nodes);
  update(filter, green, 10, false);
  assert.ok(nodes.every(node => node.removed));
  assert.equal(green.attributes.result, 'transmitted');
  assert.deepEqual(Array.from(green.__mcOptics.nodes, node => node.tag), ['feColorMatrix', 'feComposite']);
});
