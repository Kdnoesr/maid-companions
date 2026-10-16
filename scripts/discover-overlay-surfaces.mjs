// Enumerate every "overlay surface" (popover / menu / dialog / floating panel)
// across all client plugin bundles, classified by the DESIGN TOKEN that paints it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = [
  'D:/DeepSeek-Harness/node_modules/@deepseek-ai',
  'D:/DeepSeek-Harness/dsh/profiles/web/node_modules',
]

/** Collect candidate bundle files (skip stale .bak-hoisted copies). */
function collect(dir, depth = 0, out = []) {
  if (depth > 4) return out
  let ents
  try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of ents) {
    if (e.isSymbolicLink()) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      // skip stale/hoisted copies: `.bak*` and `@scope.bak-pnpm-hoisted-*`
      if (e.name.includes('.bak') || e.name === 'node_modules') continue
      collect(p, depth + 1, out)
    } else if (e.name === 'client.js' && /[\\/]lib[\\/]client\.js$/.test(p)) {
      try { if (statSync(p).size < 4_000_000) out.push(p) } catch {}
    }
  }
  return out
}

const files = ROOTS.flatMap((r) => collect(r))
console.log(`client bundles: ${files.length}\n`)

/** Extract CSS-looking string literals. */
function cssFrom(src) {
  let out = ''
  for (const m of src.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    const s = m[0]
    if (s.includes('{') && s.includes('--dsw-')) out += '\n' + s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
  for (const m of src.matchAll(/`(?:[^`\\]|\\.)*`/gs)) {
    const s = m[0]
    if (s.includes('{') && s.includes('--dsw-')) out += '\n' + s.slice(1, -1)
  }
  return out
}

const byToken = new Map()
const floating = []
let totalRules = 0

for (const f of files) {
  let css
  try { css = cssFrom(readFileSync(f, 'utf8')) } catch { continue }
  if (!css) continue
  const label = f.replace(/\\/g, '/').split('/node_modules/').pop().split('/')[0]
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    const decl = m[2]
    totalRules++
    const bg = decl.match(/background(?:-color)?\s*:\s*(var\(--dsw-[a-z0-9-]+\)|#[0-9a-fA-F]{3,8}|color-mix\([^;]*\))/)
    if (bg) {
      const tok = bg[1]
      if (!byToken.has(tok)) byToken.set(tok, [])
      byToken.get(tok).push({ label, sel, decl })
    }
    if (/position:\s*(fixed|absolute)/.test(decl) && bg && /box-shadow|border|border-radius/.test(decl)) {
      floating.push({ label, sel, decl })
    }
  }
}
console.log(`parsed rules: ${totalRules};  floating-ish surfaces: ${floating.length}\n`)

console.log('=== A) 专门找"气泡/弹窗"系 token ===')
for (const [tok, list] of [...byToken.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (!/menu|dialog|popover|overlay|float|tooltip|modal|drawer|sheet/.test(tok)) continue
  const pkgs = [...new Set(list.map((x) => x.label))]
  console.log(`\n  ${tok}   (${list.length} 条 / ${pkgs.length} 包: ${pkgs.join(', ')})`)
  for (const it of list.slice(0, 8)) console.log(`      · ${it.sel.slice(0, 105)}`)
}

console.log('\n\n=== B) 真实的"浮层"规则（position:fixed/absolute + 背景 + 阴影/圆角/描边）===')
const seen = new Set()
const rows = []
for (const it of floating) {
  const key = it.sel
  if (seen.has(key)) continue
  seen.add(key)
  const tok = (it.decl.match(/background(?:-color)?\s*:\s*(var\(--dsw-[a-z0-9-]+\)|#[0-9a-fA-F]{3,8}|color-mix\([^;]*\))/) || [])[1] || '?'
  rows.push({ tok, sel: it.sel, label: it.label, fixed: /position:\s*fixed/.test(it.decl) })
}
rows.sort((a, b) => (b.fixed - a.fixed) || a.tok.localeCompare(b.tok))
console.log(`unique floating selectors: ${rows.length}\n`)
for (const r of rows.slice(0, 55)) {
  console.log(`  ${(r.fixed ? 'FIXED' : 'abs  ')}  ${r.tok.replace('var(', '').replace(')', '').padEnd(34)} ${r.sel.slice(0, 78)}`)
}
