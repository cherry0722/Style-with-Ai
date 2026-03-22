/**
 * react-native-calendars ships platform-specific arrow images
 * (previous@2x.ios.png, next@2x.ios.png) without the generic
 * previous@2x.png / next@2x.png that Metro requires as a canonical
 * fallback when grouping asset variants.  This script copies the iOS
 * files as the generic ones so Metro resolves the asset set cleanly.
 *
 * Run automatically via the "postinstall" npm script after every
 * `npm install`.
 */
const fs = require('fs');
const path = require('path');

const imgDir = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-calendars',
  'src',
  'calendar',
  'img',
);

const fixes = [
  ['previous@2x.ios.png', 'previous@2x.png'],
  ['next@2x.ios.png', 'next@2x.png'],
];

for (const [src, dst] of fixes) {
  const srcPath = path.join(imgDir, src);
  const dstPath = path.join(imgDir, dst);
  if (!fs.existsSync(srcPath)) {
    console.warn(`fix-calendar-assets: source not found — ${src}`);
    continue;
  }
  if (fs.existsSync(dstPath)) {
    console.log(`fix-calendar-assets: already present — ${dst}`);
    continue;
  }
  fs.copyFileSync(srcPath, dstPath);
  console.log(`fix-calendar-assets: created ${dst}`);
}
