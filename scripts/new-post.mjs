/**
 * 新建一篇文章。
 *
 *   npm run new "文章标题"
 *   npm run new "文章标题" my-url-slug
 *
 * 第二个参数是网址别名（文件名）。省略时会尝试从标题生成；
 * 中文标题没法自动转成合适的英文别名，这时会退回到日期形式并给出提示。
 */

import { access, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(root, 'src/content/posts');

const [rawTitle, rawSlug] = process.argv.slice(2);

if (!rawTitle) {
  console.error('用法：npm run new "文章标题" [网址别名]');
  process.exit(1);
}

const title = rawTitle.trim();

/** 把标题转成 URL 友好的别名，只有纯 ASCII 标题才能得到有意义的结果 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const date = today();
let slug = rawSlug ? slugify(rawSlug) : slugify(title);
let slugWarning = '';

if (!slug) {
  slug = `post-${date}`;
  slugWarning = `标题里没有可用的英文字符，已使用 ${slug} 作为网址别名。\n   建议改成更有意义的英文名：npm run new "${title}" your-slug`;
}

const filePath = path.join(POSTS_DIR, `${slug}.md`);

try {
  await access(filePath);
  console.error(`文件已存在：${path.relative(root, filePath)}`);
  console.error('换一个网址别名，或者先删除原文件。');
  process.exit(1);
} catch {
  // 不存在才继续，这是预期路径
}

// slug 与文件名一致时不必写进 frontmatter，保持文件头干净
const content = `---
title: ${title}
description: ''
pubDate: ${date}
category: 技术
tags: []
draft: true
---

在这里开始写正文。

写完后把上面的 draft 改成 false（或直接删掉这一行）就会在下次构建时发布。
`;

await mkdir(POSTS_DIR, { recursive: true });
await writeFile(filePath, content, 'utf8');

console.log(`已创建 ${path.relative(root, filePath).replace(/\\/g, '/')}`);
console.log(`网址   /posts/${slug}/`);
if (slugWarning) console.log(`\n提示：${slugWarning}`);
console.log('\n运行 npm run dev 即可预览（草稿在开发模式下可见）。');
