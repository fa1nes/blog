import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { site, content, author } from '~/site.config';
import { getPosts, postSlug, postSummary } from '~/lib/posts';
import { postPath } from '~/lib/url';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).slice(0, content.rssPostCount);

  return rss({
    title: site.title,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: postSummary(post),
      pubDate: post.data.pubDate,
      link: postPath(postSlug(post)),
      categories: [post.data.category, ...post.data.tags],
      author: author.email ? `${author.email} (${author.name})` : author.name,
    })),
    customData: [
      `<language>${site.lang}</language>`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ].join(''),
  });
}
