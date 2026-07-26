import type { MarkdownHeading } from 'astro';
import { content } from '~/site.config';

// GFM 会插入一个 sr-only 的 Footnotes 标题，它不该出现在目录里
const EXCLUDED_SLUGS = new Set(['footnote-label']);

export function tocHeadings(headings: MarkdownHeading[]): MarkdownHeading[] {
  const { min, max } = content.tocDepth;
  return headings.filter(
    (heading) =>
      heading.depth >= min && heading.depth <= max && !EXCLUDED_SLUGS.has(heading.slug),
  );
}
