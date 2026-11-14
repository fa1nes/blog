import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { site, content, author } from '~/site.config';
import { getPosts, postSlug, postSummary } from '~/lib/posts';
import { href, postPath } from '~/lib/url';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).slice(0, content.rssPostCount);
  const origin = context.site ?? new URL(site.url);
  const feedSite = new URL(href('/'), origin).toString();

  return rss({
    title: site.title,
    description: site.description,
    site: feedSite,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: postSummary(post),
      pubDate: post.data.pubDate,
      link: postPath(postSlug(post)),
      categories: [post.data.category, ...post.data.tags],
      author: author.email ? `${author.email} (${author.name})` : undefined,
    })),
    customData: [
      `<language>${site.lang}</language>`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ].join(''),
  });
}
