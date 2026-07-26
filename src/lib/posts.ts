import { getCollection, type CollectionEntry } from 'astro:content';
import { excerpt, getYear, readingTime } from '~/lib/format';

export type Post = CollectionEntry<'posts'>;

export function postSlug(post: Post): string {
  return post.data.slug?.trim() || post.id;
}

export function postSummary(post: Post): string {
  return post.data.description?.trim() || excerpt(post.body);
}

export function postReadingTime(post: Post): number {
  return readingTime(post.body).minutes;
}

function byDateDesc(a: Post, b: Post): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

/** 全部已发布文章，按时间倒序；草稿只在开发模式可见 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort(byDateDesc);
}

export async function getListedPosts(): Promise<Post[]> {
  const posts = await getPosts();
  return [...posts].sort((a, b) => {
    if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
    return byDateDesc(a, b);
  });
}

export interface TermCount {
  name: string;
  count: number;
}

function countTerms(values: string[]): TermCount[] {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

export function collectCategories(posts: Post[]): TermCount[] {
  return countTerms(posts.map((post) => post.data.category));
}

// 标签统计不在这里：文章和动态都能打标签，需要合并统计，见 ~/lib/tags.ts

export interface YearGroup {
  year: number;
  posts: Post[];
}

export function groupByYear(posts: Post[]): YearGroup[] {
  const map = new Map<number, Post[]>();
  for (const post of posts) {
    const year = getYear(post.data.pubDate);
    const bucket = map.get(year);
    if (bucket) bucket.push(post);
    else map.set(year, [post]);
  }
  return [...map.entries()]
    .map(([year, list]) => ({ year, posts: list.sort(byDateDesc) }))
    .sort((a, b) => b.year - a.year);
}

/** 上一篇 / 下一篇，按时间顺序而不受置顶影响 */
export function getAdjacent(posts: Post[], current: Post): { prev?: Post; next?: Post } {
  const index = posts.findIndex((post) => post.id === current.id);
  if (index === -1) return {};
  return {
    // 数组是时间倒序，所以下标更小的是更新的文章
    next: index > 0 ? posts[index - 1] : undefined,
    prev: index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}

/** 相关文章：同分类计 2 分，每个相同标签计 1 分 */
export function getRelated(posts: Post[], current: Post, limit = 3): Post[] {
  const tags = new Set(current.data.tags);
  return posts
    .filter((post) => post.id !== current.id)
    .map((post) => {
      let score = post.data.category === current.data.category ? 2 : 0;
      for (const tag of post.data.tags) if (tags.has(tag)) score += 1;
      return { post, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || byDateDesc(a.post, b.post))
    .slice(0, limit)
    .map((item) => item.post);
}
