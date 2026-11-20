// Run: node --test scripts/test-glass-stale-target.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  const source = fs.readFileSync(path.join(__dirname, 'test-liquid-lifecycle.cjs'), 'utf8');
  const end = source.indexOf('const liquid = context.create();');
  assert.ok(end > 0, 'lifecycle fixture boundary exists');
  return new Function('require', '__dirname', source.slice(0, end) + '\nreturn {context, Node, body};')(require, __dirname);
}

test('refresh immediately cleans a connected reused target while retaining a valid target', () => {
  const {context, Node, body} = fixture();
  const stale = new Node('card'), valid = new Node('card');
  stale.setAttribute('data-composer-card', '');
  body.append(stale, valid);
  const original = {'backdrop-filter': 'blur(7px)', '-webkit-backdrop-filter': 'blur(8px)'};
  for (const [prop, value] of Object.entries(original)) stale.style.setProperty(prop, value, 'important');
  let candidates = [stale, valid];
  context.document.querySelectorAll = () => candidates;
  const svgs = () => body.children.filter(node => node.hasAttribute('data-mc-glass-svg'));
  const liquid = context.create();
  assert.equal(liquid.install(), true);
  try {
    assert.match(stale.style.backdropFilter, /url\(#test-/);
    assert.match(valid.style.backdropFilter, /url\(#test-/);
    assert.equal(svgs().length, 2, 'both targets initially have SVG filters');
    const [staleSvg, validSvg] = svgs();
    const validFilter = valid.style.backdropFilter;
    // Host reuses the same connected element for unrelated content: it no longer matches.
    stale.removeAttribute('data-composer-card');
    candidates = [valid];
    const failures = [];
    for (let i = 0; i < 3; i++) {
      liquid.refresh(); // Deliberately never advance the fixture clock/debounce.
      assert.equal(stale.isConnected, true, 'host still owns the reused element');
      const problems = [];
      for (const [prop, value] of Object.entries(original)) {
        if (stale.style.getPropertyValue(prop) !== value || stale.style.getPropertyPriority(prop) !== 'important') problems.push(prop + ' not restored with priority');
      }
      if (svgs().includes(staleSvg) || staleSvg.isConnected) problems.push('stale SVG remains');
      if (!svgs().includes(validSvg) || !validSvg.isConnected) problems.push('valid SVG removed');
      if (valid.style.backdropFilter !== validFilter) problems.push('valid filter changed');
      if (problems.length) failures.push('refresh ' + (i + 1) + ': ' + problems.join(', '));
    }
    assert.deepEqual(failures, [], 'each refresh reconciles targets synchronously');
  } finally { liquid.uninstall(); }
});
