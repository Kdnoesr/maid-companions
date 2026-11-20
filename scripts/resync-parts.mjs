#!/usr/bin/env node
/**
 * resync-parts.mjs — 用「内容锚点」而不是行号，把 lib/client.js 重新切回 src/client/parts/*。
 *
 * 为什么需要：split-client.mjs 按 manifest 的 startLine/endLine 切；一旦有人插入/删除行，
 * 行号全部漂移，切分点会落在函数中间。这里改为：每个 part 文件去掉 header 后，用它的
 * **首行**作为锚点，在目标文件里从上次结束位置开始向后查找，找到即为该段起点。
 * 段终点 = 下一段起点。最后一段到文件末尾。
 *
 * 用法：node scripts/resync-parts.mjs [--dry-run]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const PARTS = join(root, 'src/client/parts');
const manPath = join(PARTS, 'manifest.json');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

const man = JSON.parse(readFileSync(manPath, 'utf8'));
const data = readFileSync(join(root, man.target));

const segs = [];
let cursor = 0;
for (const p of man.parts) {
  const buf = readFileSync(join(PARTS, p.file));
  const payload = buf.subarray(p.headerBytes);
  const nl = payload.indexOf(10);
  const anchorLen = nl === -1 ? Math.min(payload.length, 400) : nl + 1;
  const anchor = payload.subarray(0, anchorLen);
  let idx = data.indexOf(anchor, cursor);
  if (idx === -1) {
    // 首行被改过：退回按「首 24 字节」再找一次，找不到就报错
    const short = payload.subarray(0, Math.min(24, payload.length));
    idx = data.indexOf(short, cursor);
  }
  if (idx === -1) throw new Error('找不到段起点: ' + p.file + '（首行: ' + payload.subarray(0, 60).toString('utf8') + '）');
  segs.push({ p, start: idx });
  cursor = idx + 1;
}
let total = 0;
for (let i = 0; i < segs.length; i++) {
  const start = segs[i].start;
  const end = i + 1 < segs.length ? segs[i + 1].start : data.length;
  const payload = data.subarray(start, end);
  const p = segs[i].p;
  const header = p.header && p.header.length ? p.header : [];
  if (!dryRun) writeFileSync(join(PARTS, p.file), Buffer.concat([Buffer.from(header.join('\n') + '\n', 'utf8'), payload]));
  p.startLine = 0; p.endLine = 0; p.payloadBytes = payload.length; p.payloadSha256 = sha256(payload);
  p.startByte = start; p.endByte = end;
  total += payload.length;
}
if (total !== data.length) throw new Error('未覆盖全部字节 ' + total + '/' + data.length);
man.targetBytes = data.length; man.targetSha256 = sha256(data);
if (!dryRun) writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n', 'utf8');
console.log((dryRun ? '[dry-run] ' : '') + 'resynced ' + segs.length + ' parts, ' + data.length + ' B, sha256 ' + man.targetSha256);
