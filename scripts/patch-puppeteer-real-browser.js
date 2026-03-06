const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'puppeteer-real-browser',
  'lib',
  'cjs',
  'index.js'
);

if (!fs.existsSync(filePath)) {
  console.log('[patch] puppeteer-real-browser not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const needle = 'let [page] = await browser.pages();\n\n  let pageControllerConfig';
const replacement = 'let [page] = await browser.pages();\n\n  if (!page) {\n    page = await browser.newPage();\n  }\n\n  let pageControllerConfig';

if (content.includes('if (!page) {\n    page = await browser.newPage();\n  }')) {
  console.log('[patch] puppeteer-real-browser already patched.');
  process.exit(0);
}

if (!content.includes(needle)) {
  console.log('[patch] Could not find target code, skipping.');
  process.exit(0);
}

content = content.replace(needle, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('[patch] puppeteer-real-browser patched successfully!');
