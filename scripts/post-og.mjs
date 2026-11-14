/**
 * 为每篇文章生成 1200×630 的分享图。
 *
 * 为什么要有这一步：默认分享图只有站名，文章被转发到聊天窗口或社交平台时
 * 看不出写的是什么。这里按标题生成独立的图，抓取到的 og:image 就能自带信息。
 *
 * 使用：npm run og:posts（npm run build 已自动包含；`npm run og` 会连带执行）
 *
 * 输出到 public/og/<slug>.png，该目录不进版本库：
 * 每次构建都会按文章正文重新生成，不需要把二进制文件提交进仓库。
 * 已经比源文件新的图会跳过，改一篇文章只重渲染那一张。
 */

import { readdir, readFile, stat, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { parseFrontmatter } from 'astro/markdown';
import { getPostSlug } from '../src/lib/content-paths.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'src/content/posts');
const outDir = path.join(root, 'public/og');
const { site } = await import(pathToFileURL(path.join(root, 'src/site.config.ts')).href);

const WIDTH = 1200;
const HEIGHT = 630;

// 与 og-default 同一套配色，两张图放在一起不会像两个站点
const COLORS = {
  background: '#10251e',
  accent: '#87b29a',
  ink: '#f2eee4',
  inkSoft: '#b4c2b7',
  inkFaint: '#8da797',
  line: '#294639',
};

const SANS =
  "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );
}

/** 粗略字符宽度：中日韩文本约 1em，拉丁字母约 0.56em。只用于折行，不需要精确。 */
function measure(text, fontSize) {
  let width = 0;
  for (const char of text) width += /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char) ? fontSize : fontSize * 0.56;
  return width;
}

/** 折行单位：拉丁词整体不拆，中日韩逐字断行；原文的空格挂在前一个单位后面 */
function units(text) {
  const result = [];
  for (const match of text.matchAll(/(\s+)|([\x20-\x7e]+)|([\s\S])/g)) {
    if (match[1]) {
      if (result.length) result[result.length - 1] += ' ';
      continue;
    }
    result.push(match[2] ?? match[3]);
  }
  return result;
}

const isLatin = (text) => /^[\x20-\x7e]/.test(text);

function wrap(text, fontSize, maxWidth, maxLines) {
  const lines = [];
  let current = '';
  for (const unit of units(text)) {
    const joiner = current && isLatin(unit) && /[\x20-\x7e]$/.test(current) ? ' ' : '';
    const candidate = current + joiner + unit;
    if (current && measure(candidate, fontSize) > maxWidth) {
      lines.push(current.trimEnd());
      if (lines.length === maxLines) break;
      current = unit;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current.trimEnd());
  // 截断时补省略号，避免出现半句话
  if (lines.length === maxLines) {
    const consumed = lines.join('').replace(/\s/g, '').length;
    if (consumed < text.replace(/\s/g, '').length) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[，。、；：\s]+$/, '')}…`;
    }
  }
  return lines;
}

function buildSvg({ title, description, category, date, address, mark }) {
  const maxWidth = 880;
  const fontSize = title.length > 34 ? 46 : title.length > 22 ? 54 : 62;
  const lines = wrap(title, fontSize, maxWidth, 3);
  const lineHeight = Math.round(fontSize * 1.42);

  // 标题块在上下的固定留白之间居中，1 行和 3 行的卡片视觉重量才一致
  const bandTop = 232;
  const bandHeight = 262;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = bandTop + (bandHeight - blockHeight) / 2 + Math.round(fontSize * 0.78);

  const titleSpans = lines
    .map(
      (line, index) =>
        `<text x="96" y="${Math.round(firstBaseline + index * lineHeight)}" font-family="${SANS}" font-size="${fontSize}" font-weight="600" fill="${COLORS.ink}">${escapeXml(line)}</text>`,
    )
    .join('\n  ');

  // 摘要贴着底部那条线往上排，最多两行；放不下就只留一行，绝不压到分隔线
  const summaryLimit = 492;
  const summaryLineHeight = 40;
  const summaryCandidates = lines.length >= 3 || !description
    ? []
    : wrap(description, 26, maxWidth, 2);
  const titleBottom = Math.round(firstBaseline + (lines.length - 1) * lineHeight);
  let summaryLines = [];
  for (const count of [summaryCandidates.length, 1]) {
    if (!count) break;
    const start = summaryLimit - (count - 1) * summaryLineHeight;
    if (start - 26 <= titleBottom + 24) continue;
    summaryLines = summaryCandidates.slice(0, count).map(
      (line, index) =>
        `<text x="96" y="${start + index * summaryLineHeight}" font-family="${SANS}" font-size="26" fill="${COLORS.inkSoft}">${escapeXml(line)}</text>`,
    );
    break;
  }

  const meta = [category, date].filter(Boolean).join(' · ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}" />
  <rect x="96" y="108" width="44" height="5" rx="2.5" fill="${COLORS.accent}" />
  <image x="1000" y="92" width="104" height="104" href="${mark}" />
  <text x="96" y="164" font-family="${SANS}" font-size="24" fill="${COLORS.inkFaint}">${escapeXml(site.title)}</text>
  ${meta ? `<text x="96" y="202" font-family="${SANS}" font-size="24" fill="${COLORS.inkSoft}">${escapeXml(meta)}</text>` : ''}
  ${titleSpans}
  ${summaryLines.join('\n  ')}
  <path d="M96 526H1104" stroke="${COLORS.line}" />
  <text x="96" y="574" font-family="${SANS}" font-size="22" fill="${COLORS.inkFaint}">${escapeXml(address)}</text>
  <circle cx="1099" cy="565" r="5" fill="${COLORS.accent}" />
</svg>
`;
}

/** frontmatter 里的日期可能是 Date 也可能是字符串，统一成 YYYY-MM-DD */
function toISODate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

const base = String(process.env.BASE_PATH ?? site.base).trim().replace(/^\/+|\/+$/g, '');
const siteRoot = new URL(base ? `/${base}/` : '/', process.env.SITE_URL || site.url);
const markPath = path.join(root, 'public/brand-icon.png');
const markSource = await readFile(markPath);
const mark = `data:image/png;base64,${markSource.toString('base64')}`;
// 换标识后所有卡片都得重画，所以缓存要同时参考图标的修改时间
const markMtime = (await stat(markPath)).mtimeMs;

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('未找到 sharp，无法生成文章分享图。可执行 npm install sharp 后重试。');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const entries = (await readdir(postsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
  // 与内容集合一致：下划线开头的片段不参与构建
  .filter((entry) => !entry.name.startsWith('_') && !entry.name.startsWith('.'));

const expected = new Set();
let generated = 0;
let skipped = 0;

for (const entry of entries) {
  const filePath = path.join(postsDir, entry.name);
  const source = await readFile(filePath, 'utf8');
  const { frontmatter } = parseFrontmatter(source, { frontmatter: 'preserve' });
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) continue;
  // 草稿不进产物，也不需要分享图
  if (frontmatter.draft === true) continue;

  const slug = getPostSlug(entry.name, frontmatter.slug);
  const fileName = `${slug.replace(/\//g, '-')}.png`;
  const output = path.join(outDir, fileName);
  expected.add(fileName);

  const [sourceInfo, outputInfo] = await Promise.all([
    stat(filePath),
    stat(output).catch(() => null),
  ]);
  if (outputInfo && outputInfo.mtimeMs >= Math.max(sourceInfo.mtimeMs, markMtime)) {
    skipped++;
    continue;
  }

  const svg = buildSvg({
    title: String(frontmatter.title ?? site.title),
    description: String(frontmatter.description ?? '').trim(),
    category: String(frontmatter.category ?? ''),
    date: toISODate(frontmatter.pubDate),
    address: `${siteRoot.host}${siteRoot.pathname}posts/${slug}/`,
    mark,
  });

  await sharp(Buffer.from(svg), { density: 144 })
    .resize(WIDTH, HEIGHT, { fit: 'contain', background: COLORS.background })
    .png({ compressionLevel: 9, palette: true })
    .toFile(output);
  generated++;
}

// 文章改名或删除后，旧图会留在 public 里被打包上线，这里顺手清掉
for (const file of await readdir(outDir)) {
  if (!file.endsWith('.png') || expected.has(file)) continue;
  await unlink(path.join(outDir, file));
}

console.log(`文章分享图：生成 ${generated} 张，复用 ${skipped} 张，共 ${expected.size} 篇。`);
