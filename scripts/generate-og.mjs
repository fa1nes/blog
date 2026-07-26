/**
 * 生成默认社交分享图（public/og-default.png）。
 *
 * 为什么需要这个脚本：X、Facebook、微信等平台抓取 og:image 时都不支持 SVG，
 * 必须提供 PNG 或 JPG。这里从 src/site.config.ts 读取站点信息生成 SVG，
 * 再用 sharp 渲染成 1200x630 的 PNG。
 *
 * 使用：npm run og
 * 改过站点标题或副标题之后跑一次即可。
 *
 * 说明：文字由系统字体渲染，Windows 与 macOS 都自带中文字体。
 * 想换设计直接改下面的模板，或者自己做一张 1200x630 的图覆盖掉输出文件。
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Windows 下必须转成 file:// URL，直接用 C:\ 开头的路径 import 会报错
const { site } = await import(pathToFileURL(path.join(root, 'src/site.config.ts')).href);

const WIDTH = 1200;
const HEIGHT = 630;

// 与 src/styles/global.css 里的浅色令牌保持一致
const COLORS = {
  background: '#fdfcfa',
  accent: '#3057b1',
  ink: '#19120e',
  inkSoft: '#6e6863',
  inkFaint: '#96918d',
  markBg: '#1c2230',
  markDot: '#f5f6f9',
};

const SERIF = "Georgia, 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', STSong, SimSun, serif";
const SANS =
  "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

/** SVG 是 XML，文本里的特殊字符必须转义，否则整张图会渲染失败 */
function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char],
  );
}

/** 标题越长字号越小，避免超出画布 */
function titleFontSize(text) {
  if (text.length <= 8) return 78;
  if (text.length <= 12) return 64;
  if (text.length <= 18) return 50;
  return 40;
}

function buildSvg({ title, subtitle, domain }) {
  const size = titleFontSize(title);
  // 整块内容围绕画布垂直中心 315 排布
  const markTop = 196;
  const titleBaseline = markTop + 56 + 42 + Math.round(size * 0.78);
  const subtitleBaseline = titleBaseline + 76;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}" />
  <rect width="${WIDTH}" height="8" fill="${COLORS.accent}" />

  <g transform="translate(100, ${markTop})">
    <rect width="56" height="56" rx="13" fill="${COLORS.markBg}" />
    <circle cx="28" cy="19" r="9" fill="${COLORS.markDot}" />
    <rect x="10" y="34" width="36" height="5.5" rx="2.75" fill="${COLORS.accent}" />
  </g>

  <text x="100" y="${titleBaseline}" font-family="${SERIF}" font-size="${size}" font-weight="600" fill="${COLORS.ink}">${escapeXml(title)}</text>
  <text x="100" y="${subtitleBaseline}" font-family="${SANS}" font-size="31" fill="${COLORS.inkSoft}">${escapeXml(subtitle)}</text>
  <text x="100" y="562" font-family="${SANS}" font-size="23" fill="${COLORS.inkFaint}">${escapeXml(domain)}</text>
</svg>
`;
}

function domainOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

const svg = buildSvg({
  title: site.title,
  subtitle: site.subtitle,
  domain: domainOf(site.url),
});

const svgPath = path.join(root, 'public/og-default.svg');
const pngPath = path.join(root, 'public/og-default.png');

await writeFile(svgPath, svg, 'utf8');
console.log(`已写入 ${path.relative(root, svgPath)}`);

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error(
    '未找到 sharp，无法生成 PNG。它通常随 Astro 一起安装，可执行 npm install sharp 后重试。',
  );
  process.exit(1);
}

const info = await sharp(Buffer.from(svg), { density: 144 })
  .resize(WIDTH, HEIGHT, { fit: 'contain', background: COLORS.background })
  .png({ compressionLevel: 9, palette: true })
  .toFile(pngPath);

console.log(`已写入 ${path.relative(root, pngPath)}（${WIDTH}x${HEIGHT}，${info.size} 字节）`);
