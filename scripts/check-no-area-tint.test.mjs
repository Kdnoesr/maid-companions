import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const checker = join(dirname(fileURLToPath(import.meta.url)), 'check-no-area-tint.mjs')
const host = "body[data-dsh-maid-companions] :is([data-pane='conversation'], [class*='centerCol'])"
const skill = '[data-dsh-skill-explorer-view]'
const cases = [
  [host + ' > [data-slot] > ' + skill, false],
  [host + ', ' + host + ' > ' + skill, true],
  [host + ' > ' + skill + ', ' + host, true],
  [host + ':is(.x,' + skill + ')', true],
  [host + ':has(> ' + skill + ')', true],
  [':is(' + host + ', ' + host + ' > ' + skill + ')', true],
  [host + ' > [data-slot="a,b"] > ' + skill, false],
  [host + ' + ' + skill, true],
  [host + ' [data-composer-card] + [data-pane=\'conversation\']', true],
  [host + ' [data-composer-card] ' + host, true],
  [host + ' > ' + skill + ', ' + host + ' > [data-composer-card]', false],
]
test('each selector branch must have the owner scope', () => {
  const dir = mkdtempSync(join(tmpdir(), 'area-tint-'))
  try {
    const fixture = join(dir, 'fixture.js')
    const tick = String.fromCharCode(96)
    writeFileSync(fixture, 'const STAGE_CSS = ' + tick + 'body[data-dsh-maid-companions] .safe, .global { background: red; }\nbody[data-dsh-maid-companions] [data-composer-card] { backdrop-filter: blur(1px); }' + tick + '.trim()')
    const result = spawnSync(process.execPath, [checker, fixture], { encoding: 'utf8' })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stderr, /\[D\]/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
for (const [selector, unsafe] of cases) {
  test(selector, () => {
    const dir = mkdtempSync(join(tmpdir(), 'area-tint-'))
    try {
      const fixture = join(dir, 'fixture.js')
      const tick = String.fromCharCode(96)
      writeFileSync(fixture, 'const STAGE_CSS = ' + tick + selector + ' { background: red; }\nbody[data-dsh-maid-companions] [data-composer-card] { backdrop-filter: blur(1px); }' + tick + '.trim()')
      const result = spawnSync(process.execPath, [checker, fixture], { encoding: 'utf8' })
      assert.equal(result.stderr.includes('[A]'), unsafe, result.stdout + result.stderr)
      assert.equal(result.status, unsafe ? 1 : 0, result.stdout + result.stderr)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
}
