#!/usr/bin/env node
/**
 * rebuild-parts.mjs — 开发用：改了 src/client/parts/ 之后，重算 manifest 并拼出 lib/client.js。
 *
 * 与 assemble-client.mjs 的分工：
 *   - assemble --check 是**只读校验**（manifest 必须已经正确），用于 CI；
 *   - 本脚本是**写侧**：按 parts 现状重算 payloadBytes/payloadSha256/startLine/endLine、
 *     targetBytes/targetSha256，然后直接写 lib/client.js（HMR 会热重载）。
 *
 * 用法：node scripts/rebuild-parts.mjs [--dry]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = join(root, 'src/client/parts');
const manifestPath = join(PARTS, 'manifest.json');
const dry = process.argv.includes('--dry');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

const man = JSON.parse(readFileSync(manifestPath, 'utf8'));
const chunks = [];
let line = 1;
let byte = 0;
for (const p of man.parts) {
  const raw = readFileSync(join(PARTS, p.file));
  let off = 0;
  let headerLines = 0;
  while (raw.length >= off + 3 && raw.toString('utf8', off, off + 3) === '//!') {
    const nl = raw.indexOf(10, off);
    if (nl < 0) throw new Error(p.file + ': //! 头注释没有换行结尾');
    off = nl + 1;
    headerLines++;
  }
  const payload = raw.subarray(off);
  const payloadLines = payload.length === 0 ? 0 : payload.toString('utf8').split('\n').length - (payload[payload.length - 1] === 10 ? 1 : 0);
  p.headerBytes = off;
  p.payloadBytes = payload.length;
  p.payloadSha256 = sha256(payload);
  p.startByte = byte;
  p.endByte = byte + payload.length;
  p.startLine = line;
  p.endLine = line + Math.max(0, payloadLines - 1);
  line = p.endLine + 1;
  byte += payload.length;
  if (!p.asset && payload.length > 60 * 1024) throw new Error(p.file + ': 超过 60 KB 预算');
  chunks.push(payload);
  if (p.header && p.header.length) { /* 头注释内容不改，行数变则提示 */ }
}
const out = Buffer.concat(chunks);
man.targetBytes = out.length;
man.targetSha256 = sha256(out);
const targetPath = join(root, man.target);
if (!dry) {
  const tmp = targetPath + '.tmp';
  writeFileSync(tmp, out);
  renameSync(tmp, targetPath);
  writeFileSync(manifestPath, JSON.stringify(man, null, 2) + '\n');
}
console.log((dry ? '[dry] ' : 'WROTE ') + man.target + ' ' + out.length + ' B sha256 ' + man.targetSha256);
