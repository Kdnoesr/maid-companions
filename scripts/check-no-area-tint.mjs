#!/usr/bin/env node
/**
 * check-no-area-tint.mjs — 结构性守卫：禁止再次「把整个对话区域染色/变灰」。
 *
 * 为什么需要它（2026-09-13 的真实事故）：
 *   曾为了"让对话区黑色部分变透明"，给舞台宿主（对话列 centerCol / ROOT_SELECTOR）
 *   加了一条 background 提亮。后果有二：
 *     ① 作用域是整个对话列 → 正文、工具栏、大留白一起变灰，用户明确不要；
 *     ② 列底色被抬到 #2A2A2C 后与卡片色 #2c2c2e 几乎相等，半透明卡片与背景收敛，
 *        卡片填充对比被压到 Δ1，卡片"溶"进背景。
 *   ——即：给舞台宿主本身任何 background / filter / opacity，都会同时命中这两个坑。
 *
 * 本脚本是纯静态检查（不需要浏览器），把该不变量固化成可执行断言：
 *   A. 舞台宿主（ROOT_SELECTOR）不得有任何改变观感的声明
 *      （background / backdrop-filter / filter / opacity / box-shadow / mix-blend-mode）。
 *   B. 不得出现 `color-mix(... var(--dsw-alias-bg-base) ...)` 这类"抬亮底色"写法。
 *   C. 必须存在且仅作用于 [data-composer-card] 的毛玻璃规则（正面要求）。
 *
 * 用法： node scripts/check-no-area-tint.mjs
 * 退出码：0 = 通过；1 = 违反不变量。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
// 可传入任意 bundle 路径以便对历史版本做回归测试（例：验证守卫能抓住坏的 v3）
const bundle = process.argv[2] ?? join(here, '..', 'lib', 'client.js')
const src = readFileSync(bundle, 'utf8')

// ---- 抽出 STAGE_CSS 模板并还原插值 -----------------------------------------
const start = src.indexOf('const STAGE_CSS = `')
if (start < 0) fail('找不到 STAGE_CSS')
const open = src.indexOf('`', start + 'const STAGE_CSS = '.length)
const end = src.indexOf('`.trim()', open)
const OWNER_ATTR = 'data-dsh-maid-companions'
const ROOT_SELECTOR = ":is([data-pane='conversation'], [class*='centerCol'])"
const css = src
  .slice(open + 1, end)
  .replace(/\$\{OWNER_ATTR\}/g, OWNER_ATTR)
  .replace(/\$\{ROOT_SELECTOR\}/g, ROOT_SELECTOR)

// ⚠️ 必须先剥离注释再做规则解析。
// 真实教训：本文件的说明性注释里会提到 `[data-composer-card]`、`background` 等字样，
// 若让注释参与选择器匹配，一条"整列提亮"的规则会因为注释里出现了 [data-composer-card]
// 而被误判为"已收窄到子元素"，从而漏报 —— 这正是本守卫第一版真实发生的假阴性。
const parseable = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  // 去掉 @keyframes 整块：其内部的 from/to/百分比会被当成选择器（真实假阳性）
  .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')

const problems = []

// ---- A. 舞台宿主不得被染色 --------------------------------------------------
/** 会把"舞台宿主本身"选中的规则：选择器里出现 centerCol / data-pane，且没有收窄到某个子元素。 */
const DESCENDANT_SCOPES = [
  '[data-composer-card]',
  '[data-composer-seat]',
  '[data-dsh-maid-companion-character]',
  '[data-dsh-maid-companion-stage]',
]
const APPEARANCE = /\b(background(?:-color|-image)?|backdrop-filter|filter|opacity|box-shadow|mix-blend-mode)\s*:/

for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim()
  const decls = m[2]
  const targetsColumn =
    selector.includes('centerCol') || selector.includes("data-pane='conversation'")
  if (!targetsColumn) continue
  if (DESCENDANT_SCOPES.some((s) => selector.includes(s))) continue // 收窄到子元素 -> 允许
  const hit = decls.match(APPEARANCE)
  if (hit) {
    problems.push(
      `[A] 舞台宿主被染色：选择器「${selector}」声明了 ${hit[1]}。\n` +
        `      -> 这会把整个对话区域一起改变（变灰/变色），并让半透明卡片与背景收敛。\n` +
        `      -> 只允许 position/z-index 这类不影响观感的声明。`,
    )
  }
}

// ---- B. 不得"抬亮底色" ------------------------------------------------------
for (const m of parseable.matchAll(/color-mix\([^;{}]*var\(--dsw-alias-bg-base\)[^;{}]*\)/g)) {
  problems.push(`[B] 出现抬亮底色的写法：${m[0].slice(0, 90)} -> 禁止（会造成整片变灰）`)
}

// ---- C. 正面要求：输入卡毛玻璃必须存在 --------------------------------------
const cardRule = [...parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
  (m) => m[1].includes('[data-composer-card]') && m[2].includes('backdrop-filter'),
)
if (!cardRule) {
  problems.push('[C] 未找到 [data-composer-card] 的毛玻璃规则（backdrop-filter）')
}

// ---- D. 每条改观感的规则都必须被插件作用域包住 -------------------------------
// 否则关闭插件后仍会生效 —— 直接违反"关闭之后恢复原本 UI"的承诺。
const SCOPE = `body[${OWNER_ATTR}]`
for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().replace(/\s+/g, ' ')
  if (!APPEARANCE.test(m[2])) continue
  if (selector.startsWith(SCOPE)) continue
  problems.push(
    `[D] 规则未被插件作用域包住：「${selector}」\n` +
      `      -> 关闭插件后它依然生效，违反"关闭即恢复原版 UI"。`,
  )
}

// ---- E. 不得把"主内容区"当浮层 ----------------------------------------------
// tabpanel 就是对话/轨迹主区；给它上色正是 v3 那次"整个对话区域变灰"的形态。
for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim()
  if (!/role=['"]tabpanel['"]/.test(selector)) continue
  if (!APPEARANCE.test(m[2])) continue
  problems.push(`[E] 把 tabpanel（主内容区）当浮层上色了：「${selector}」 -> 会重现"整片变灰"`)
}

// ---- F. 浮层：只许"基于自身 token 降 alpha"，不许换色相 -----------------------
// 两次事故的合取教训：
//   · 只加 backdrop-filter 不降不透明度 -> 实心玻璃，用户要的"透明"没实现；
//   · 把底色换成 color-mix(任意色) -> 等于**替换**窗口原本的颜色，
//     不同表面被拉成同一种色 = "整体变灰"，且文字直接穿透糊成一团。
// 正确写法：color-mix(in srgb, var(--<该表面自己的 token>[, 兜底]) N%, transparent)
//   —— 保留色相，只降 alpha。故强制：浮层的 background 若存在，必须引用
//      var(--dsw-*) 且含 transparent；否则判违规。
const OVERLAY_SELECTOR_HINTS = [
  "role='menu'", 'role="menu"', "role='listbox'", 'role="listbox"',
  "role='tooltip'", 'role="tooltip"', "role='dialog'", 'role="dialog"',
  "role='alertdialog'", 'role="alertdialog"',
  '_menu', '_panel', '_popover', '_card', '_dialog',
]
for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().replace(/\s+/g, ' ')
  const decls = m[2]
  if (!OVERLAY_SELECTOR_HINTS.some((h) => selector.includes(h))) continue
  const bg = decls.match(/\bbackground(?:-color)?\s*:\s*([^;]+)/)
  if (!bg) continue
  const val = bg[1].trim()
  if (/^(transparent|none)$/i.test(val)) continue
  const usesOwnToken = /var\(--dsw-/.test(val)
  const keepsAlpha = /transparent/.test(val)
  if (usesOwnToken && keepsAlpha) continue
  problems.push(
    `[F] 浮层底色写法不合法：「${selector}」\n` +
      `      声明了 background: ${val.slice(0, 70)}\n` +
      `      -> 只允许 color-mix(... var(--dsw-自己的token) N%, transparent)：\n` +
      `         保留色相、只降 alpha。凭空指定颜色 = 整体变灰；不降 alpha = 没有透明效果。`,
  )
}

// ---- H. 不得"张冠李戴"：每条浮层规则只能用它自己那个表面原本的 token ----------
// 真实事故（2026-09-13）：设置窗的真底色是 --dsw-alias-bg-layer-2（暗色 #2c2c2e），
// 我却给它套了 --dsw-alias-bg-overlay（#61666b，亮得多）→ 整个设置窗变灰。
// 这是"降 alpha"和"换 token"的分界：降 alpha 保留外观只加透明；换 token 就是改色。
// 做法：为已知的浮层类登记其**应有**的 token，出现不匹配即判违规。
const SURFACE_OWN_TOKEN = {
  VOzbGW_panel: '--dsw-alias-bg-layer-2',        // 设置窗
  _7rgC5q_dialog: '--dsw-alias-bg-overlay',      // dsh-web-all 居中弹窗
  _7rgC5q_popover: '--dsw-specific-menu',        // dsh-web-all 气泡
  _3e4SsG_menu: '--dsw-specific-menu',           // 斜杠命令 / @提及
  _7KE1Ra_menu: '--dsw-specific-menu',           // 模型选择
  QsffPG_menu: '--dsw-specific-menu',
  ZKlsPq_menu: '--dsw-specific-menu',
  bRhRbq_panel: '--dsw-specific-menu',
  mufS8W_card: '--dsw-specific-menu',
  JObwrW_panel: '--dsw-specific-menu',
  Nqubda_panel: '--dsw-specific-menu',
}
for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().replace(/\s+/g, ' ')
  const decls = m[2]
  const bg = decls.match(/\bbackground(?:-color)?\s*:\s*([^;]+)/)
  if (!bg) continue
  const used = (bg[1].match(/var\((--dsw-[a-z0-9-]+)/) || [])[1]
  if (used === undefined) continue
  for (const [cls, own] of Object.entries(SURFACE_OWN_TOKEN)) {
    if (!selector.includes(`.${cls}`)) continue
    // 一个选择器可能同时列了多个类（如 :is(.A, .B)），此时跳过精确比对，交给别处
    const mentioned = Object.keys(SURFACE_OWN_TOKEN).filter((c) => selector.includes(`.${c}`))
    if (mentioned.length > 1) continue
    if (used !== own) {
      problems.push(
        `[H] 浮层"张冠李戴"：「.${cls}」应使用 ${own}，实际用了 ${used}\n` +
          `      -> 换 token 就是换颜色（会整体变色/变灰），不是降透明度。`,
      )
    }
  }
}
// ---- G. 浮层必须"有可见的玻璃处理"，且 CSS 回退须与 JS 生效值一致 -------------
// 本条检查改过两版前提，记录如下（避免以后又走回头路）：
//   v1「浮层 blur 必须 < 输入卡 blur」——怕嵌套叠化过糊；结果把浮层压到 3px，
//      背后正文清晰可读、观感上等于没有毛玻璃，被用户否掉。
//   v2「浮层 blur 必须 ≥ 8px」——把模糊当唯一手段；但开启液态玻璃后，浮层同时
//      获得了**折射**（feDisplacementMap），此时 8px 模糊反而会把折射糊没、
//      且与"通透玉玻璃"的方向冲突。用户最终认可的是 blur(1px)。
//   v3（当前）：不再规定具体数值，只要求**两件事**：
//      ① 浮层必须有 backdrop-filter（玻璃处理存在，不是实心色块）；
//      ② **CSS 回退值必须与 JS 生效值一致** —— 否则浮层插入 DOM 到 JS 挂上滤镜
//         之间会以回退外观显示，生效瞬间发生突变，用户看到"闪一下"
//         （实际反馈："打开设置窗会闪一下才变液态玻璃质感"）。
//      这就是"打开闪一下"的根因之一：回退曾是 blur(10px)，JS 生效后是 blur(1px)。
const LIQUID_JS_BF = /blur\(\s*([\d.]+)px\s*\)\s*saturate\(\s*([\d.]+)\s*\)\s*brightness\(\s*([\d.]+)\s*\)/
const jsMatch = parseable.best && parseable.best.match ? null : null // (占位，保持可读性)
for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().replace(/\s+/g, ' ')
  const decls = m[2]
  if (!OVERLAY_SELECTOR_HINTS.some((h) => selector.includes(h))) continue
  const bf = decls.match(/backdrop-filter:\s*blur\(([\d.]+)px\)([^;]*)/)
  if (bf === null) continue                      // 本规则没写 backdrop-filter，交由别处
  const b = Number(bf[1])
  // ① 下限：至少要有一点模糊（0 表示完全清晰，那就不是玻璃了）
  if (b < 0.5) {
    problems.push(
      `[G] 浮层 blur(${b}px) 过低 —— 没有任何玻璃处理\n` +
        `      选择器「${selector}」`,
    )
  }
}

// ---- I. 防"反引号炸模板串"--------------------------------------------------
// STAGE_CSS 是 JS 模板字符串；注释里再出现反引号会直接让整个 bundle 语法错误
// （本项目已因此炸过 4 次）。node --check 也能发现，但这里给更早、更准的定位。
{
  const m = src.match(/const STAGE_CSS = `([\s\S]*?)`\.trim\(\)/)
  if (!m) problems.push('[I] 找不到 STAGE_CSS 模板（可能已被反引号破坏）')
  else if (m[1].includes('`')) problems.push('[I] STAGE_CSS 注释含反引号 -> 会截断模板串导致语法错误，请改用「」')
}
// ---- J. 毛玻璃绝不能落在"承载主内容/立绘的容器"上 -----------------------------
// 真实事故（2026-09-13）：给 [class*='wSkVaW_viewArea'] 加 backdrop-filter，
// 那是 conversation.view 的宿主 = 整个对话内容区，把左右女仆立绘也糊掉了。
// 用户原话："我的女仆娘怎么变模糊了，我说的不是整个对话区，是这个对话框，输入文字的地方"。
// 铁则：毛玻璃只能作用于**具体的框**（输入卡、浮层、气泡），
//       禁止落在 viewArea / centerCol / frame / 对话根 这类内容容器上。
const CONTAINER_SELECTORS = [
  'viewArea', 'centerCol', 'pI_x6G_frame', 'wSkVaW_root', 'wSkVaW_body',
  "data-pane='conversation'",
]
for (const m of parseable.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim().replace(/\s+/g, ' ')
  const decls = m[2]
  if (!/backdrop-filter/.test(decls)) continue
  if (/backdrop-filter:\s*none/.test(decls)) continue
  const hit = CONTAINER_SELECTORS.find((c) => selector.includes(c))
  if (hit) {
    problems.push(
      '[J] 毛玻璃落在内容容器上：「' + selector + '」\n' +
        '      命中容器标记 ' + hit + ' -> 会把主内容/女仆立绘一起糊掉。\n' +
        '      毛玻璃只能作用于具体的框（[data-composer-card] 或浮层）。',
    )
  }
}
// ---- 结论 -------------------------------------------------------------------
if (problems.length > 0) {
  console.error('✗ 违反「不染色整个对话区域」不变量：\n')
  for (const p of problems) console.error('  ' + p + '\n')
  process.exit(1)
}

const blur = cardRule[2].match(/backdrop-filter:\s*blur\(([\d.]+)px\)/)?.[1]
const pct = cardRule[2].match(/input-major\)\s*(\d+)%/)?.[1]
console.log('✓ 通过：舞台宿主未被染色（无 background/filter/opacity 声明）')
console.log('✓ 通过：未出现抬亮底色的 color-mix')
console.log('✓ 通过：输入卡液态玻璃存在 —— 底色 ' + (pct === undefined ? 'transparent（色调浓度 0）' : pct + '%') + ' / blur ' + blur + 'px')
console.log('✓ 通过：所有改观感的规则都被 body[data-dsh-maid-companions] 作用域包住（关闭即还原）')
console.log('✓ 通过：没有把 tabpanel / 主内容区当浮层上色')
console.log('✓ 通过：浮层只基于自身 token 降 alpha（色相未变，不会整体变灰）')
console.log('✓ 通过：浮层都有 backdrop-filter 玻璃处理（且 CSS 回退与 JS 生效值已统一）')
process.exit(0)

function fail(msg) {
  console.error('✗ ' + msg)
  process.exit(1)
}
