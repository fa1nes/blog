import type { APIRoute } from 'astro';
import { seo, site } from '~/site.config';
import { href } from '~/lib/url';

export const GET: APIRoute = (context) => {
  const origin = context.site ?? new URL(site.url);
  const lines = ['User-agent: *', 'Allow: /'];

  if (seo.sitemap) {
    lines.push('', `Sitemap: ${new URL(href('/sitemap-index.xml'), origin).href}`);
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
