#!/usr/bin/env node
/**
 * refreeze-parts.mjs — 直接改 parts/ 后，重新冻结 manifest 与 lib/client.js。
 *
 * 与 split-client.mjs 的分工：
 *   · split-client.mjs：改的是 lib/client.js（已编译产物）→ 按行区间切回 parts；
 *   · 本脚本：改的是 parts/*.js（源）→ 拼接写回 lib/client.js，并刷新字节数/sha/行区间。
 *
 * 用法：node scripts/refreeze-parts.mjs [--dry-run]
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

function stripHeader(name, buf) {
  let off = 0;
  let n = 0;
  while (buf.length >= off + 3 && buf.toString('utf8', off, off + 3) === '//!') {
    const nl = buf.indexOf(10, off);
    if (nl < 0) throw new Error(name + ': //! 头注释没有换行结尾');
    off = nl + 1;
    n++;
  }
  if (n < 3 || n > 8) throw new Error(name + ': //! 头注释应为 3-8 行，实际 ' + n);
  return { payload: buf.subarray(off), headerLines: n };
}

const bufs = [];
let line = 1;
for (const p of man.parts) {
  const file = join(PARTS, p.file);
  if (!existsSync(file)) throw new Error('缺少 part: ' + p.file);
  const { payload, headerLines } = stripHeader(p.file, readFileSync(file));
  p.payloadBytes = payload.length;
  p.payloadSha256 = sha256(payload);
  p.header = p.header && p.header.length === headerLines ? p.header : p.header;
  p.startLine = line;
  const text = payload.toString('utf8');
  const nl = (text.match(/\n/g) || []).length;
  // payload 末尾若已有换行，最后一行不额外计数
  p.endLine = line + nl - (text.endsWith('\n') || text.length === 0 ? 1 : 0);
  line += nl;
  bufs.push(payload);
}
const assembled = Buffer.concat(bufs);
man.targetBytes = assembled.length;
man.targetSha256 = sha256(assembled);
if (!man.partsHash) man.partsHash = sha256(Buffer.from(man.parts.map((p) => p.file + ':' + p.payloadSha256).join('\n')));
else man.partsHash = sha256(Buffer.from(man.parts.map((p) => p.file + ':' + p.payloadSha256).join('\n')));
if (dryRun) { console.log('dry-run: ' + assembled.length + ' B / ' + man.targetSha256); process.exit(0); }
writeFileSync(targetPath, assembled);
writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
console.log('REFROZE ' + man.target + ' ' + assembled.length + ' B sha256=' + man.targetSha256);
