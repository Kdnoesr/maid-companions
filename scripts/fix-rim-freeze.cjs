#!/usr/bin/env node
/**
 * fix-maid-rim.cjs — 修复 @kdnoesr/maid-companions 打开「设置」直接卡死 / 截图超时。
 *
 * 症状：设置面板（插件列表、模型页、账号页…任何 tab）一直骨架屏或整页冻住，
 *       渲染进程无响应，DevTools 里能刷到大量 `GET .../undefined 404`。
 *
 * 根因（两处，都在 lib/client.js 的液态玻璃 rim 代码里）：
 *   ① `map.dataUrl` 拼写错误 —— buildMap 返回的是 `{ url, scale }`，
 *      于是 SVG feImage 的 xlink:href 被写成字符串 "undefined"，
 *      浏览器真的去请求 `/undefined`，每轮重建都发一次，形成请求风暴。
 *   ② 两个自激循环，把主线程彻底占满（每轮要重算 4 张 canvas 位移贴图）：
 *      a. installRim 里 60/180/420ms 三个定时器：回调先清空 rimTimers 再调
 *         applyTo → installRim → 闸门已空 → 又排 3 个 → 永不终止。
 *      b. MutationObserver 监听 body 的 childList，而本插件自己会往 DOM 插
 *         条子 / 磨砂垫层 / <svg>滤镜 → 又被自己收到 → refresh → sync →
 *         rebuildAll → installRim → 再插一遍 → 无限循环。
 *
 * 本脚本是幂等的：已修过的文件只做检查，不重复改。用法：
 *   node fix-maid-rim.cjs            # 打补丁
 *   node fix-maid-rim.cjs --check    # 只检查
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const FILE = process.env.MAID_CLIENT_JS || 'D:/dsh-src/maid-companions/lib/client.js';
const checkOnly = process.argv.includes('--check');

const MARK_1 = 'map.dataUrl';
const MARK_2 = 'onlyOwnMutations';
const MARK_3 = 'inst.rimTimers = inst.rimTimers.filter';

function read() {
  if (!fs.existsSync(FILE)) {
    console.error('找不到文件：' + FILE);
    process.exit(2);
  }
  return fs.readFileSync(FILE, 'utf8');
}

let src = read();
const before = {
  dataUrl: src.includes(MARK_1),
  observer: src.includes(MARK_2),
  timers: src.includes(MARK_3),
};
console.log('目标：' + FILE);
console.log('当前状态：map.dataUrl=' + before.dataUrl + '  observerGuard=' + before.observer + '  timerFix=' + before.timers);

if (!before.dataUrl && before.observer && before.timers) {
  console.log('✔ 三处补丁都在，无需改动。');
  process.exit(0);
}
if (checkOnly) {
  console.log('✖ 补丁不完整（--check 模式不写文件）。');
  process.exit(1);
}

// ── ① map.dataUrl → map.url ────────────────────────────────────────────
if (src.includes(MARK_1)) {
  const n = src.split(MARK_1).length - 1;
  src = src.split(MARK_1).join('map.url');
  console.log('① 修正 ' + n + ' 处 map.dataUrl → map.url');
}

// ── ② MutationObserver 只对"外来的" DOM 变动做出反应 ────────────────────
if (!src.includes(MARK_2)) {
  const anchor = /^([\t ]*)observer = new MutationObserver\(\(records\) => \{/m;
  const m = anchor.exec(src);
  if (!m) {
    console.error('② 找不到 observer 锚点，放弃（文件结构可能已变）。');
    process.exit(3);
  }
  const t = m[1];
  const guard = [
    t + '// 2026-10-26 · 本插件自己插的条子 / 垫层 / <svg>滤镜也会被这个 observer 收到，',
    t + '// 若不排除就会 refresh → sync → rebuildAll → installRim → 再插一遍，无限自激。',
    t + 'const SVG_NS_URI = "http://www.w3.org/2000/svg";',
    t + 'const OWN_ATTRS = ["data-mc-glass-rim", "data-mc-glass-rim-bar", "data-mc-glass-bed", "data-mc-glass-soft"];',
    t + 'const isOwnNode = (n) => {',
    t + '\tif (n === null || n === undefined) return true;',
    t + '\tif (n.nodeType !== 1) return true;',
    t + '\tif (n.namespaceURI === SVG_NS_URI) return true;',
    t + '\tfor (const a of OWN_ATTRS) if (n.hasAttribute(a)) return true;',
    t + '\treturn false;',
    t + '};',
    t + 'const onlyOwnMutations = (records) => {',
    t + '\tif (records.length === 0) return true;',
    t + '\tfor (const r of records) {',
    t + '\t\tif (r.type !== "childList") return false;',
    t + '\t\tlet n = 0;',
    t + '\t\tfor (const x of r.addedNodes) { n++; if (!isOwnNode(x)) return false; }',
    t + '\t\tfor (const x of r.removedNodes) { n++; if (!isOwnNode(x)) return false; }',
    t + '\t\tif (n === 0) return false;',
    t + '\t}',
    t + '\treturn true;',
    t + '};',
    '',
  ].join('\n');
  src = src.slice(0, m.index) + guard + src.slice(m.index);
  // 在回调体第一行插入早退
  const bodyAnchor = /(observer = new MutationObserver\(\(records\) => \{\r?\n)([\t ]*)if \(!enabledPref\) return;/;
  if (!bodyAnchor.test(src)) {
    console.error('② 回调体锚点缺失，放弃。');
    process.exit(3);
  }
  src = src.replace(bodyAnchor, (_all, head, t2) =>
    head + t2 + 'if (!enabledPref) return;\n' + t2 + 'if (onlyOwnMutations(records)) return;   // 自己的 DOM 变动不触发重算');
  console.log('② 已加入 MutationObserver 自激防护');
}

// ── ③ 三个重建定时器不再自我续期 ────────────────────────────────────────
if (!src.includes(MARK_3)) {
  const blockRe = /(^([\t ]*)if \(!inst\.rimTimers \|\| inst\.rimTimers\.length === 0\) \{)[\s\S]*?(\r?\n\2\})/m;
  const m3 = blockRe.exec(src);
  if (!m3) {
    console.error('③ 找不到 rimTimers 闸门块，放弃。');
    process.exit(3);
  }
  const base = m3[2];
  const t = (n) => base + '\t'.repeat(n);
  const replacement = [
    m3[1],
    t(1) + 'inst.rimTimers = [];',
    t(1) + 'for (const delay of [60, 180, 420]) {',
    t(2) + 'const id = setTimeout(() => {',
    t(3) + 'try {',
    t(4) + 'if (applyToRef && inst.el && inst.el.isConnected) applyToRef(el, inst);',
    t(3) + '} catch { /* 忽略 */ }',
    t(3) + '// 只摘掉自己；全部跑完才解除闸门 —— 重入时不会再排新定时器，链条到此为止。',
    t(3) + 'try {',
    t(4) + 'if (inst.rimTimers) {',
    t(5) + 'inst.rimTimers = inst.rimTimers.filter((x) => x !== id);',
    t(5) + 'if (inst.rimTimers.length === 0) inst.rimTimers = null;',
    t(4) + '}',
    t(3) + '} catch { /* 忽略 */ }',
    t(2) + '}, delay);',
    t(2) + 'inst.rimTimers.push(id);',
    t(1) + '}',
    m3[3],
  ].join('\n').replace(/\n/g, '\r\n');
  src = src.slice(0, m3.index) + replacement + src.slice(m3.index + m3[0].length);
  console.log('③ 已打断重建定时器的自我续期链');
}

// ── 备份 + 写回 + 语法校验 ─────────────────────────────────────────────
const bak = FILE + '.bak-fixrim-' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
fs.copyFileSync(FILE, bak);
fs.writeFileSync(FILE, src);
console.log('备份：' + path.basename(bak));

try {
  execFileSync(process.execPath, ['--check', FILE], { stdio: 'pipe' });
  console.log('✔ 语法检查通过：' + FILE);
} catch (error) {
  console.error('✖ 语法检查失败，已回滚到备份：' + (error.stderr ? error.stderr.toString() : error.message));
  fs.copyFileSync(bak, FILE);
  process.exit(4);
}
console.log('完成。让浏览器重新加载（Ctrl+R）或重启 DSH 生效。');
