#!/usr/bin/env node
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sourcePath = process.argv[2] || "D:/dsh-src/maid-companions/lib/client.js";
const source = readFileSync(sourcePath, "utf8");
const fail = (message) => { throw new Error(message); };
try { new vm.Script(source, { filename: sourcePath }); } catch (error) { fail(`${sourcePath} does not parse: ${error.message}`); }

const scanTemplate = (name, body) => {
  body = body.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, " "));
  const lines = body.split(/\r?\n/);
  const nakedChinese = /^(?:\s*)(?:[.#\[:>+~*]|[一-龥])/;
  const errors = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\/\*/.test(line) || /^\s*\*/.test(line) || /^\s*\*\//.test(line)) continue;
    if (nakedChinese.test(line) && /[一-龥]/.test(line)) errors.push(`${name} line ${i + 1}: ${line.trim()}`);
  }
  if (errors.length) fail(`naked Chinese CSS text:\n${errors.join("\n")}`);
};
const scanTaggedTemplates = (text) => {
  const pattern = /(?:const\s+([A-Z0-9_]+)\s*=\s*)?\`([\s\S]*?)\`/g;
  let match;
  while ((match = pattern.exec(text))) scanTemplate(match[1] || "template", match[2]);
};
scanTaggedTemplates(source);
const marker = "const STAGE_CSS = `";
const start = source.indexOf(marker);
if (start < 0) fail("STAGE_CSS declaration not found");
const bodyStart = start + marker.length;
const end = source.indexOf("`", bodyStart);
if (end < 0) fail("STAGE_CSS has no closing backtick");
const css = source.slice(bodyStart, end);
const dialogSelector = "[role='presentation'] > [role='dialog'][aria-modal='true']:not([data-composer-card]):not([role='menu']):not([role='alertdialog']):not([data-testid='todo-panel']):not([data-dsh-plugin='update'])";
const dialogStart = css.indexOf(dialogSelector);
if (dialogStart < 0) fail("settings dialog selector is missing from STAGE_CSS");
const dialogRule = css.slice(dialogStart, css.indexOf("\n}", dialogStart));
if (/backdrop-filter\s*:/.test(dialogRule)) fail("settings dialog rule directly applies backdrop-filter");
if (!/box-shadow\s*:/.test(dialogRule)) fail("settings dialog rule lost its box-shadow declaration");
const inputStart = css.indexOf("body[${OWNER_ATTR}] [data-composer-card] {");
if (inputStart < 0) fail("input-card baseline selector is missing from STAGE_CSS");
const inputRule = css.slice(inputStart, css.indexOf("\n}", inputStart));
for (const declaration of ["background: transparent;", "-webkit-backdrop-filter: blur(1px) brightness(1.05);", "backdrop-filter: blur(1px) brightness(1.05);"]) { if (!inputRule.includes(declaration)) fail(`input-card baseline lost: ${declaration}`); }
console.log("PASS check-glass-css-comments");
