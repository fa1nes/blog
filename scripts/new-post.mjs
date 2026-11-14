/**
 * 新建一篇文章。
 *
 *   npm run new "文章标题"
 *   npm run new "文章标题" my-url-slug
 *
 * 第二个参数是网址别名（文件名）。省略时会尝试从标题生成；
 * 中文标题没法自动转成合适的英文别名，这时会退回到日期形式并给出提示。
 */

import { lstat, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 把标题转成 URL 友好的别名，只有纯 ASCII 标题才能得到有意义的结果 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function today(now) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function createPost(rawTitle, rawSlug, { rootDir = root, now = new Date() } = {}) {
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
  if (!title || /[\u0000-\u001f\u007f\u2028\u2029]/u.test(title)) {
    throw new Error('文章标题不能为空，也不能包含换行或控制字符。');
  }

  const date = today(now);
  let slug = rawSlug === undefined ? slugify(title) : slugify(rawSlug);
  let slugWarning = '';
  if (!slug && rawSlug !== undefined) {
    throw new Error('网址别名需要包含英文字母或数字，例如 hello-world。');
  }
  if (!slug) {
    slug = `post-${date}`;
    slugWarning = `标题里没有可用的英文字符，已使用 ${slug} 作为网址别名。\n   建议改成更有意义的英文名。`;
  }
  if (/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(slug)) {
    throw new Error('网址别名不能使用 Windows 保留的文件名，请换一个别名。');
  }

  const postsDir = path.join(rootDir, 'src/content/posts');
  const filePath = path.join(postsDir, `${slug}.md`);
  // MDX 与 Markdown 共用文章网址，即使扩展名不同也不能重名。
  for (const extension of ['.md', '.mdx']) {
    try {
      await lstat(path.join(postsDir, `${slug}${extension}`));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    throw new Error(`文章已存在：${slug}${extension}，请换一个网址别名。`);
  }

  // JSON 字符串也是合法的 YAML 字符串，冒号、引号和 # 都保持为标题文本。
  // slug 与文件名一致时不必写进 frontmatter，保持文件头干净。
  const content = `---
title: ${JSON.stringify(title)}
description: ''
pubDate: ${date}
category: 技术
tags: []
draft: true
---

在这里开始写正文。

写完后把上面的 draft 改成 false（或直接删掉这一行）就会在下次构建时发布。
`;

  await mkdir(postsDir, { recursive: true });
  try {
    // 由文件系统保证独占创建，避免并发执行时覆盖已经创建的文章。
    await writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`文章已存在：${slug}.md，请换一个网址别名。`);
    throw error;
  }
  return { filePath, slug, slugWarning };
}

async function main() {
  const [rawTitle, rawSlug, ...extra] = process.argv.slice(2);
  if (rawTitle === undefined || extra.length) {
    throw new Error('用法：npm run new "文章标题" [网址别名]');
  }
  const { filePath, slug, slugWarning } = await createPost(rawTitle, rawSlug);
  console.log(`已创建 ${path.relative(root, filePath).replace(/\\/g, '/')}`);
  console.log(`网址   /posts/${slug}/`);
  if (slugWarning) console.log(`\n提示：${slugWarning}`);
  console.log('\n运行 npm run dev 即可预览（草稿在开发模式下可见）。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
