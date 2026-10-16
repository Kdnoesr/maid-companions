import { readFileSync, writeFileSync } from 'node:fs'

const assets = 'D:/dsh-src/maid-atelier/assets/'
const left = readFileSync(assets + 'maid-atelier-maid-left-v5.webp').toString('base64')
const right = readFileSync(assets + 'maid-atelier-maid-right-v7.webp').toString('base64')

const file = 'D:/dsh-src/maid-companions/lib/client.js'
let src = readFileSync(file, 'utf8')

const missing = []
if (!src.includes('__MAID_LEFT_DATA__')) missing.push('left')
if (!src.includes('__MAID_RIGHT_DATA__')) missing.push('right')
if (missing.length) {
  console.error('placeholders missing:', missing.join(', '))
  process.exit(1)
}

src = src.replace('__MAID_LEFT_DATA__', 'data:image/webp;base64,' + left)
src = src.replace('__MAID_RIGHT_DATA__', 'data:image/webp;base64,' + right)

writeFileSync(file, src)
console.log('injected images OK: left b64=' + left.length + ' chars, right b64=' + right.length + ' chars')
