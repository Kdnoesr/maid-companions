const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Reuse the established deterministic DOM and clock fixture, not its scenarios.
function fixture() {
  const harness = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = harness.indexOf('const liquid = context.create();');
  assert.ok(end > 0);
  return new Function('require', '__dirname', harness.slice(0, end) + ';return {context, card, advance};')(require, __dirname);
}

test('resize delivery does not discard queued cleanup of removed targets', () => {
  const {context, card, advance} = fixture();
  let observer;
  context.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {} unobserve() {} disconnect() {}
  };
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.ok(card.style.backdropFilter.includes('url(#test-'));
    context.document.querySelectorAll = () => [];
    card.remove();
    liquid.refresh(); // Removal schedules sync.
    advance(60);
    observer.callback([{target: card}], observer); // Resize arrives before sync.
    advance(120);
    assert.equal(card.style.backdropFilter, 'blur(3px)', 'removed target must be cleaned after the debounce');
  } finally { liquid.uninstall(); }
});
