import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPost } from './new-post.mjs';

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'blog-new-post-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  return { rootDir, now: new Date(2026, 10, 13, 12) };
}

test('新建文章把 YAML 特殊字符保留为标题文本', async (t) => {
  const options = await fixture(t);
  const title = '发布: "新版" #1 \\ 配置';
  const result = await createPost(title, 'release-notes', options);
  const text = await readFile(result.filePath, 'utf8');
  assert.equal(JSON.parse(text.split('\n')[1].slice('title: '.length)), title);
  assert.match(text, /pubDate: 2026-11-13\n/);
  assert.match(text, /draft: true\n/);
  assert.equal(result.slug, 'release-notes');
});

test('无效标题和显式别名不创建文件', async (t) => {
  const options = await fixture(t);
  for (const title of ['', '   ', '标题\ndraft: false', '标题\u0000内容']) {
    await assert.rejects(createPost(title, 'test', options), /标题/);
  }
  for (const slug of ['', '中文', '../../', 'CON']) {
    await assert.rejects(createPost('标题', slug, options), /别名/);
  }
  assert.deepEqual(await readdir(options.rootDir), []);
});

test('中文标题使用明确的日期别名并返回提示', async (t) => {
  const options = await fixture(t);
  const result = await createPost('中文标题', undefined, options);
  assert.equal(result.slug, 'post-2026-11-13');
  assert.match(result.slugWarning, /post-2026-11-13/);
});

test('拒绝覆盖同名 Markdown 或 MDX', async (t) => {
  const options = await fixture(t);
  const dir = path.join(options.rootDir, 'src/content/posts');
  await mkdir(dir, { recursive: true });
  for (const extension of ['md', 'mdx']) {
    const target = path.join(dir, `exists-${extension}.${extension}`);
    await writeFile(target, '已有文章');
    await assert.rejects(createPost('新文章', `exists-${extension}`, options), /文章已存在/);
    assert.equal(await readFile(target, 'utf8'), '已有文章');
  }
});

test('并发创建相同网址时只有一个成功，正文不会被覆盖', async (t) => {
  const options = await fixture(t);
  const results = await Promise.allSettled([
    createPost('第一篇', 'same-slug', options),
    createPost('第二篇', 'same-slug', options),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const failed = results.find((result) => result.status === 'rejected');
  assert.match(failed.reason.message, /文章已存在/);
  const dir = path.join(options.rootDir, 'src/content/posts');
  assert.deepEqual(await readdir(dir), ['same-slug.md']);
  const text = await readFile(path.join(dir, 'same-slug.md'), 'utf8');
  assert.ok(text.includes('第一篇') || text.includes('第二篇'));
});
