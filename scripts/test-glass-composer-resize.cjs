const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const harness = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = harness.indexOf('const liquid = context.create();');
  assert.ok(end > 0);
  const env = new Function('require', '__dirname', harness.slice(0, end) + '\nreturn {context, Node, body, card, advance};')(require, __dirname);
  const constants = fs.readFileSync(path.join(__dirname, '../src/client/parts/31-material-constants.js'), 'utf8');
  vm.runInContext(constants.slice(constants.indexOf('const MAT ='), constants.indexOf('const LIQUID_FILTER_ID')), env.context);
  env.Node.prototype.matches = () => false;
  env.body.parentElement = null;
  env.context.CHAT_SELECTOR = "[data-chat]";
  return env;
}

test('composer keeps its own glass when a long draft crosses the panel area threshold', () => {
  const {context, Node, body, card, advance} = fixture();
  let deliverResize;
  context.ResizeObserver = class {
    constructor(callback) { deliverResize = target => callback([{ target }], this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const host = body.appendChild(new Node('composer-host'));
  host.appendChild(card);
  card.offsetWidth = 900;
  card.offsetHeight = 100;
  card.getBoundingClientRect = () => ({left:380, top:400, width:card.offsetWidth, height:card.offsetHeight});
  const liquid = context.create();
  try {
    assert.equal(liquid.install(), true);
    const filter = card.style.backdropFilter;
    assert.equal(card.style.getPropertyValue("--mc-composer-filter"), filter);
    assert.match(filter, /url\(#test-.*blur\(1px\) saturate\(1\) brightness\(1.05\)/);
    for (const height of [289, 425, 100]) {
      card.offsetHeight = height;
      deliverResize(card);
      advance(120);
      assert.equal(host.children.filter(node => node.hasAttribute('data-mc-glass-veil')).length, 0, 'composer must not create a separate panel veil at height ' + height);
      assert.equal(card.style.backdropFilter, filter);
    }
  } finally {
    liquid.uninstall();
  }
  assert.equal(card.style.getPropertyValue("--mc-composer-filter"), "");
});
