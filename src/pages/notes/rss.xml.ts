import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { site, author, content } from '~/site.config';
import { getNotes } from '~/lib/notes';
import { excerpt } from '~/lib/format';
import { href } from '~/lib/url';

// 动态单独一条：主 RSS 只放文章，避免短内容刷满订阅列表
export async function GET(context: APIContext) {
  const notes = (await getNotes()).slice(0, content.rssPostCount);
  const origin = context.site ?? site.url;

  return rss({
    title: `${site.title} · 动态`,
    description: '一些不值得单独成篇的短想法。',
    site: origin,
    trailingSlash: true,
    items: notes.map((note) => ({
      title: [note.data.pubDate.toISOString().slice(0, 10), note.data.mood]
        .filter(Boolean)
        .join(' · '),
      description: excerpt(note.body, 200),
      pubDate: note.data.pubDate,
      link: href('/notes/'),
      categories: note.data.tags,
      author: author.email ? `${author.email} (${author.name})` : author.name,
    })),
    customData: `<language>${site.lang}</language>`,
  });
}
