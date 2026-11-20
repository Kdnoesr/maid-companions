#!/usr/bin/env node
/**
 * split-client.mjs — 当 lib/client.js 发生预期内改动后，按 src/client/parts/manifest.json
 * 里已登记的行区间重建全部 parts（payload），并刷新 manifest 的字节数/sha256。
 *
 * 用法：node scripts/split-client.mjs [--dry-run]
 *
 * 注意：行区间是人工挑选的“天然段落边界”。如果目标改动改变了这些边界的位置，
 * 本脚本仍会按旧区间切分（可能切断一个函数）——此时应人工调整 manifest 的
 * startLine/endLine 后再运行。脚本会在切分点不是自然断点（空行/注释/; / }）时告警。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const PARTS = join(root, 'src/client/parts');
const manPath = join(PARTS, 'manifest.json');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const man = JSON.parse(readFileSync(manPath, 'utf8'));
const targetPath = join(root, man.target);
if (!existsSync(targetPath)) throw new Error('目标不存在: ' + targetPath);
const data = readFileSync(targetPath);

// starts[k] = 第 k+2 行的起始偏移（starts[-1] 视为第 1 行起点 0）
const starts = [];
for (let i = 0; i < data.length; i++) if (data[i] === 10) starts.push(i + 1);
const lineCount = starts.length + 1;
const startOf = (n) => (n <= 1 ? 0 : starts[n - 2]);
const lineText = (n) => {
  const from = startOf(n);
  const to = n < lineCount ? startOf(n + 1) : data.length;
  return data.toString('utf8', from, to).replace(/\n$/, '');
};

const changed = [];
let cursor = 0;
for (const p of man.parts) {
  if (p.startLine < 1 || p.endLine < p.startLine || p.endLine > lineCount) {
    throw new Error(p.file + ': manifest 行区间越界 L' + p.startLine + '-' + p.endLine + '（目标共 ' + lineCount + ' 行）');
  }
  const from = startOf(p.startLine);
  const to = p.endLine < lineCount ? startOf(p.endLine + 1) : data.length;
  if (from !== cursor) console.warn('WARN: ' + p.file + ' 起点 ' + from + ' 与上一段终点 ' + cursor + ' 不连续');
  cursor = to;
  const payload = data.subarray(from, to);
  const payloadSha = sha256(payload);
  const header = p.header && p.header.length ? p.header : [];
  if (header.length < 3 || header.length > 8) throw new Error(p.file + ': manifest.header 需 3-8 行');
  const fileBuf = Buffer.concat([Buffer.from(header.join('\n') + '\n', 'utf8'), payload]);
  if (!dryRun) writeFileSync(join(PARTS, p.file), fileBuf);
  if (p.startLine > 1) {
    const prev = lineText(p.startLine - 1).trim();
    if (prev !== '' && !prev.startsWith('//') && !prev.startsWith('*') && !prev.endsWith(';') && !prev.endsWith('}') && !prev.endsWith('{')) {
      console.warn('WARN: ' + p.file + ' 起点 L' + p.startLine + ' 前一行不是自然断点: ' + prev.slice(0, 70));
    }
  }
  if (p.payloadSha256 !== payloadSha) changed.push({ file: p.file, old: p.payloadBytes, now: payload.length });
  p.payloadBytes = payload.length;
  p.payloadSha256 = payloadSha;
  p.headerBytes = Buffer.byteLength(header.join('\n') + '\n', 'utf8');
}
if (cursor !== data.length) throw new Error('parts 未覆盖目标全部字节: ' + cursor + ' / ' + data.length);

man.targetBytes = data.length;
man.targetSha256 = sha256(data);
if (!dryRun) writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n', 'utf8');
console.log((dryRun ? '[dry-run] ' : '') + 'rebuilt ' + man.parts.length + ' parts from ' + man.target + ' (' + data.length + ' B, sha256 ' + man.targetSha256 + ')');
if (changed.length) {
  console.log('changed parts:');
  for (const c of changed) console.log('  ' + c.file + ': ' + c.old + ' -> ' + c.now + ' B');
} else {
  console.log('no payload changes');
}