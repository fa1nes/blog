import { site, content } from '~/site.config';

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let cached = dateFormatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(site.lang, { timeZone: site.timeZone, ...options });
    dateFormatters.set(key, cached);
  }
  return cached;
}

export function formatDate(date: Date): string {
  return formatter({ year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function formatMonthDay(date: Date): string {
  return formatter({ month: '2-digit', day: '2-digit' }).format(date);
}

export function formatDateTime(date: Date): string {
  return formatter({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatISODate(date: Date): string {
  const parts = formatter({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// 必须用 formatToParts：中文 locale 下 format() 返回「2026年」，Number() 会得到 NaN
export function getYear(date: Date): number {
  const parts = formatter({ year: 'numeric' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  return Number(year) || date.getFullYear();
}

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/g;

// 粗略转纯文本，用于摘要与字数统计，不追求完全准确
function toPlainText(markdown = ''): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '') // frontmatter 兜底
    .replace(/```[\s\S]*?```/g, ' ') // 围栏代码块
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`([^`\n]*)`/g, '$1') // 行内代码保留文字，只去掉反引号
    .replace(/^import\s.+$/gm, ' ') // MDX 的 import 语句
    .replace(/<[^>]+>/g, ' ') // HTML / JSX 标签
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/^\s{0,3}>\s?/gm, '') // 引用
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // 标题
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '') // 列表符号
    .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, ' ') // 分隔线
    .replace(/[*_~]{1,3}/g, '') // 强调符号
    .replace(/\s+/g, ' ')
    .trim();
}

export function readingTime(markdown = ''): { minutes: number; words: number } {
  const text = toPlainText(markdown);
  const cjkCount = text.match(CJK)?.length ?? 0;
  const latinCount = text.replace(CJK, ' ').match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const minutes = Math.max(
    1,
    Math.round(cjkCount / content.cjkPerMinute + latinCount / content.wordsPerMinute),
  );
  return { minutes, words: cjkCount + latinCount };
}

export function excerpt(markdown = '', limit = 110): string {
  const text = toPlainText(markdown);
  if (text.length <= limit) return text;
  const sliced = text.slice(0, limit);
  const lastBreak = Math.max(
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('；'),
    sliced.lastIndexOf('！'),
    sliced.lastIndexOf('？'),
    sliced.lastIndexOf('. '),
  );
  return `${lastBreak > limit * 0.6 ? sliced.slice(0, lastBreak + 1) : sliced.trimEnd()}…`;
}
