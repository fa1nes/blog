import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { site, author, content } from '~/site.config';
import { getNotes } from '~/lib/notes';
import { excerpt, formatISODate } from '~/lib/format';
import { href, notePath } from '~/lib/url';

// 动态单独一条：主 RSS 只放文章，避免短内容刷满订阅列表
export async function GET(context: APIContext) {
  const notes = (await getNotes()).slice(0, content.rssPostCount);
  const origin = context.site ?? new URL(site.url);
  const feedSite = new URL(href('/'), origin).toString();

  return rss({
    title: `${site.title} · 动态`,
    description: '一些不值得单独成篇的短想法。',
    site: feedSite,
    trailingSlash: true,
    items: notes.map((note) => ({
      title: [formatISODate(note.data.pubDate), note.data.mood]
        .filter(Boolean)
        .join(' · '),
      description: excerpt(note.body, 200),
      pubDate: note.data.pubDate,
      // 使用绝对链接，避免 RSS 规范化把尾斜线追加到 fragment 后。
      link: new URL(notePath(note.id), origin).href,
      categories: note.data.tags,
      author: author.email ? `${author.email} (${author.name})` : undefined,
    })),
    customData: `<language>${site.lang}</language>`,
  });
}
