import type { Post } from '~/lib/posts';
import type { Note } from '~/lib/notes';

export interface TagStat {
  name: string;
  postCount: number;
  noteCount: number;
  total: number;
}

// 文章和动态都能打标签，必须合并统计：否则只在动态出现的标签不会生成页面，点进去 404
export function collectAllTags(posts: Post[], notes: Note[]): TagStat[] {
  const map = new Map<string, { postCount: number; noteCount: number }>();

  const bump = (raw: string, key: 'postCount' | 'noteCount') => {
    const name = raw.trim();
    if (!name) return;
    const entry = map.get(name) ?? { postCount: 0, noteCount: 0 };
    entry[key] += 1;
    map.set(name, entry);
  };

  for (const post of posts) for (const tag of post.data.tags) bump(tag, 'postCount');
  for (const note of notes) for (const tag of note.data.tags) bump(tag, 'noteCount');

  return [...map.entries()]
    .map(([name, counts]) => ({
      name,
      ...counts,
      total: counts.postCount + counts.noteCount,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-CN'));
}
