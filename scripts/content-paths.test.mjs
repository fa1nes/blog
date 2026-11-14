import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRssString } from '@astrojs/rss';
import {
  assertUniquePostSlugs,
  getPostSlug,
  isSafePostSlug,
  noteAnchor,
} from '../src/lib/content-paths.js';

test('文章默认路径保持 Astro 的文件名和嵌套 index 规则', () => {
  assert.equal(getPostSlug('Hello World!.md', undefined), 'hello-world');
  assert.equal(getPostSlug('专题/你好 世界.mdx', ''), '专题/你好-世界');
  assert.equal(getPostSlug('guides/index.md', undefined), 'guides');
  assert.equal(getPostSlug('index.md', undefined), 'index');
  assert.equal(getPostSlug('filename.md', ' 专题/中文 别名 '), '专题/中文 别名');
});

test('文章路径拒绝 URL 结构变化、空路径段和分页保留路径', () => {
  for (const value of [
    '', '.', '..', '/start', 'end/', 'a//b', 'a/../b', 'a/./b',
    'a?b', 'a#b', 'a%2fb', 'a\\b', 'a\nb', '\u0000', '\ud800',
    'a:b', 'a*b', 'a|b', 'a<b', 'a>b', 'trailing.', 'trailing ', 'CON', 'nul.txt',
  ]) {
    assert.equal(isSafePostSlug(value), false, JSON.stringify(value));
  }
  for (const value of ['你好', 'nested/中文 别名', 'a-b.c', 'page/example']) {
    assert.equal(isSafePostSlug(value), true, value);
  }
  assert.throws(() => getPostSlug('example.md', 'page/2'), /分页路径冲突/);
});

test('重复自定义别名、默认路径和跨扩展名的冲突会明确失败', () => {
  const cases = [
    [{ id: 'one.md', data: { slug: 'same' } }, { id: 'two.md', data: { slug: 'same' } }],
    [{ id: 'one.md', data: { slug: 'Case-Slug' } }, { id: 'two.md', data: { slug: 'case-slug' } }],
    [{ id: 'same.md', data: {} }, { id: 'other.md', data: { slug: 'same' } }],
    [{ id: 'same.md', data: {} }, { id: 'same.mdx', data: {} }],
    [{ id: 'guides.md', data: {} }, { id: 'guides/index.md', data: {} }],
  ];
  for (const posts of cases) {
    assert.throws(() => assertUniquePostSlugs(posts), /文章网址冲突/);
  }
  assert.doesNotThrow(() => assertUniquePostSlugs([
    { id: 'one.md', data: { slug: '教程/入门' } },
    { id: 'two.mdx', data: { slug: '教程/进阶' } },
  ]));
});

test('动态锚点稳定唯一，RSS 保留不同 guid 和可匹配页面的 fragment', async () => {
  const ids = ['same', 'folder/same', '中文 动态'];
  const anchors = ids.map(noteAnchor);
  assert.equal(new Set(anchors).size, ids.length);
  assert.equal(noteAnchor('same'), noteAnchor('same'));
  assert.ok(anchors.every((anchor) => !/\s/.test(anchor)));

  for (const base of ['/', '/blog/']) {
    const links = anchors.map((anchor) => new URL(
      `${base}notes/#${encodeURIComponent(anchor)}`,
      'https://example.com',
    ).href);
    const feed = await getRssString({
      title: '动态', description: '动态订阅', site: `https://example.com${base}`,
      items: links.map((link) => ({ title: '近况', link })),
      trailingSlash: true,
    });
    const guids = [...feed.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((match) => match[1]);
    assert.deepEqual(guids, links);
    assert.equal(new Set(guids).size, ids.length);
    for (const [index, link] of links.entries()) {
      assert.equal(decodeURIComponent(new URL(link).hash.slice(1)), anchors[index]);
    }
  }
});
