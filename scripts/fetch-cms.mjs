/**
 * 构建前把 Sveltia CMS 的脚本下载到本地，避免运行时依赖 unpkg。
 *
 * 为什么不直接用 CDN：
 *   - 国内网络下 unpkg 经常慢或连不通，后台会停在「资源未加载」
 *   - 老版 Safari（iPadOS 16 等）上，跨域脚本 + SRI 校验失败的报错很难看懂
 * 自托管后是同源请求，没有 SRI、没有跨域，失败原因也更直接。
 *
 * 版本与哈希都写死在这里：下载内容与预期不一致时直接失败，避免供应链问题。
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const VERSION = '0.265.2';
const EXPECTED_SHA256 = 'GuQH7PO73MpnWIBlcZr96FRthbW6Ej+DCRwp5za0fUY=';
const CDN = `https://unpkg.com/@sveltia/cms@${VERSION}/dist/sveltia-cms.js`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'public', 'admin', 'vendor', 'sveltia-cms.js');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('base64');

async function existingFileMatches() {
  try {
    const current = await readFile(target);
    return sha256(current) === EXPECTED_SHA256;
  } catch {
    return false;
  }
}

if (await existingFileMatches()) {
  console.log(`Sveltia CMS ${VERSION} 已就绪（本地缓存）。`);
} else {
  console.log(`正在下载 Sveltia CMS ${VERSION} …`);
  const response = await fetch(CDN);
  if (!response.ok) {
    throw new Error(`下载 Sveltia CMS 失败：HTTP ${response.status}。可稍后重试，或手动放到 ${path.relative(root, target)}。`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = sha256(buffer);
  if (actual !== EXPECTED_SHA256) {
    throw new Error(`Sveltia CMS 校验失败：期望 ${EXPECTED_SHA256}，实际 ${actual}。已中止，不写入文件。`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  console.log(`已写入 ${path.relative(root, target)}（${(buffer.length / 1024).toFixed(0)} KB）。`);
}
