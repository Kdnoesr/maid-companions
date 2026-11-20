#!/usr/bin/env node
/**
 * assemble-client.mjs — 把 src/client/parts/ 按 manifest 顺序拼回 lib/client.js。
 *
 * 用法：
 *   node scripts/assemble-client.mjs --check   只校验：拼接结果与 lib/client.js 逐字节相同则 exit 0
 *   node scripts/assemble-client.mjs           写入：先写 lib/client.js.tmp，校验后 rename 覆盖
 *   node scripts/assemble-client.mjs --quiet   少打印（配合 --check 用于 CI）
 *
 * 规则：
 *  - 每个 part 顶部的 //! 头注释在拼接前剥除，不进入产物；
 *  - 每个 part 的 payload 必须与 manifest 记录的字节数/sha256 完全一致（防手改）；
 *  - 目标文件 sha256 必须与 manifest.targetSha256 一致，否则说明 lib/client.js 已漂移，
 *    先用 scripts/split-client.mjs 重建 parts（或 git checkout 回滚目标）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const quiet = args.has('--quiet');
const PARTS = join(root, 'src/client/parts');
const manifestPath = join(PARTS, 'manifest.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const hex = (n) => '0x' + n.toString(16).padStart(4, '0');

function stripHeader(name, buf, expected) {
  let off = 0;
  const got = [];
  while (buf.length >= off + 3 && buf.toString('utf8', off, off + 3) === '//!') {
    const nl = buf.indexOf(10, off);
    if (nl < 0) throw new Error(name + ': //! 头注释没有换行结尾');
    got.push(buf.toString('utf8', off, nl).replace(/\r$/, ''));
    off = nl + 1;
  }
  if (got.length < 3 || got.length > 8) throw new Error(name + ': //! 头注释应为 3-8 行，实际 ' + got.length);
  if (expected && expected.length) {
    if (got.length !== expected.length) throw new Error(name + ': 头注释行数与 manifest 不符');
    for (let i = 0; i < got.length; i++) {
      if (got[i] !== expected[i]) throw new Error(name + ': 第 ' + (i + 1) + ' 行头注释与 manifest 不符（parts 被手改？）');
    }
  }
  return { payload: buf.subarray(off), headerLines: got.length };
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

function lineOf(buf, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (buf[i] === 10) line++;
  return line;
}

function snippet(buf, offset) {
  const from = Math.max(0, offset - 40);
  const to = Math.min(buf.length, offset + 40);
  return JSON.stringify(buf.toString('utf8', from, to));
}

const man = JSON.parse(readFileSync(manifestPath, 'utf8'));
const targetPath = join(root, man.target);
const target = existsSync(targetPath) ? readFileSync(targetPath) : null;
const assembledParts = [];
const rows = [];

for (const p of man.parts) {
  const filePath = join(PARTS, p.file);
  if (!existsSync(filePath)) throw new Error('缺少 part: ' + p.file);
  const raw = readFileSync(filePath);
  const { payload, headerLines } = stripHeader(p.file, raw, p.header);
  if (payload.length !== p.payloadBytes) {
    throw new Error(p.file + ': payload ' + payload.length + ' B != manifest ' + p.payloadBytes + ' B');
  }
  const gotSha = sha256(payload);
  if (gotSha !== p.payloadSha256) {
    throw new Error(p.file + ': payload sha256 ' + gotSha + ' != manifest ' + p.payloadSha256);
  }
  if (payload.length > 60 * 1024 && !p.asset) {
    throw new Error(p.file + ': 超过 60 KB 预算且未标记 asset');
  }
  rows.push({ file: p.file, lines: 'L' + p.startLine + '-' + p.endLine, bytes: payload.length, header: headerLines, asset: !!p.asset });
  assembledParts.push(payload);
}

const assembled = Buffer.concat(assembledParts);
const aSha = sha256(assembled);
const liveSha = target ? sha256(target) : null;
const same = target !== null && target.length === assembled.length && target.equals(assembled);

if (!quiet) {
  console.log('target : ' + man.target);
  console.log('parts  : ' + man.parts.length + ' files, assembled ' + assembled.length + ' B, sha256 ' + aSha);
  console.log('live   : ' + (target ? target.length + ' B, sha256 ' + liveSha : 'MISSING'));
  console.log('');
  console.log('  #  file                          lines          payload   hdr  kind');
  rows.forEach((r, i) => {
    console.log('  ' + String(i + 1).padStart(2) + '  ' + r.file.padEnd(30) + ' ' + r.lines.padEnd(14) + ' ' + String(r.bytes).padStart(8) + '  ' + String(r.header).padStart(3) + '  ' + (r.asset ? 'asset' : 'code'));
  });
  console.log('');
}

if (man.targetBytes !== assembled.length || man.targetSha256 !== aSha) {
  console.error('ERROR: manifest.targetBytes/targetSha256 与拼接结果不一致：');
  console.error('  manifest ' + man.targetBytes + ' B / ' + man.targetSha256);
  console.error('  assembled ' + assembled.length + ' B / ' + aSha);
  process.exit(2);
}

if (!same) {
  if (!target) {
    console.error('ERROR: ' + targetPath + ' 不存在');
    process.exit(2);
  }
  const at = firstDiff(target, assembled);
  console.error('ERROR: 拼接结果与 ' + man.target + ' 不一致（目标已漂移或 parts 被改）');
  console.error('  首个差异字节: 偏移 ' + at + ' (' + hex(at) + ')，目标第 ' + lineOf(target, at) + ' 行');
  console.error('  live   : ' + snippet(target, at));
  console.error('  parts  : ' + snippet(assembled, at));
  console.error('  处理: 确认 lib/client.js 的改动是预期的，然后 node scripts/split-client.mjs 重建 parts；否则 git checkout -- ' + man.target);
  process.exit(2);
}

if (checkOnly) {
  console.log('RESULT: byte-identical — ' + assembled.length + ' B, sha256 ' + aSha);
  process.exit(0);
}

const tmpPath = targetPath + '.tmp';
writeFileSync(tmpPath, assembled);
const back = readFileSync(tmpPath);
if (!back.equals(assembled)) {
  console.error('ERROR: 写入 ' + tmpPath + ' 后回读不一致，已中止');
  process.exit(2);
}
renameSync(tmpPath, targetPath);
console.log('WROTE ' + man.target + ' (' + assembled.length + ' B, sha256 ' + aSha + ') OK');