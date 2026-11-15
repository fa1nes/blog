/**
 * 从站点配置、design/brand-icon.png 与 design/avatar.png 生成社交分享图与 PNG 站点图标。
 *
 * 为什么需要这个脚本：X、Facebook、微信等平台抓取 og:image 时都不支持 SVG，
 * 必须提供 PNG 或 JPG。这里从 src/site.config.ts 读取站点信息生成 SVG，
 * 再用 sharp 渲染成 1200x630 的 PNG。
 *
 * 使用：npm run og
 * 改过站点标题、副标题、地址或 design 下的两张源图之后跑一次即可。
 *
 * 说明：文字由系统字体渲染，Windows 与 macOS 都自带中文字体。
 * 想换设计直接改下面的模板，或者自己做一张 1200x630 的图覆盖掉输出文件。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Windows 下必须转成 file:// URL，直接用 C:\ 开头的路径 import 会报错
const { site } = await import(pathToFileURL(path.join(root, 'src/site.config.ts')).href);

const WIDTH = 1200;
const HEIGHT = 630;

// 分享卡片沿用标识的深墨绿底、暖白字与一条薄荷色短线，右侧放图标留出呼吸感。
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

function buildSvg({ title, subtitle, address, icon }) {
  const size = titleFontSize(title);
  // 直接内嵌头像 PNG；不请求外部图片，也不在多个地方维护图形。
  const mark = `data:image/png;base64,${icon.toString('base64')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}" />
  <rect x="96" y="126" width="44" height="5" rx="2.5" fill="${COLORS.accent}" />
  <image x="944" y="208" width="160" height="160" href="${mark}" />
  <text x="96" y="274" font-family="${SANS}" font-size="${size}" font-weight="600" fill="${COLORS.ink}">${escapeXml(title)}</text>
  <text x="96" y="350" font-family="${SANS}" font-size="29" fill="${COLORS.inkSoft}">${escapeXml(subtitle)}</text>
  <path d="M96 478H1104" stroke="${COLORS.line}" />
  <text x="96" y="536" font-family="${SANS}" font-size="23" fill="${COLORS.inkFaint}">${escapeXml(address)}</text>
  <circle cx="1099" cy="527" r="5" fill="${COLORS.accent}" />
</svg>
`;
}

// 分享图显示完整站点路径，避免子路径部署只显示 GitHub 用户主页。
const base = String(process.env.BASE_PATH ?? site.base).trim().replace(/^\/+|\/+$/g, '');
const siteRoot = new URL(base ? `/${base}/` : '/', process.env.SITE_URL || site.url);
const avatarSource = path.join(root, 'design/avatar.png');
const icon = await readFile(avatarSource);
const brandIcon = await readFile(path.join(root, 'design/brand-icon.png'));

const svg = buildSvg({
  title: site.title,
  subtitle: site.subtitle,
  address: `${siteRoot.host}${siteRoot.pathname}`,
  icon,
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

// brand-icon.png 是唯一图标源，各尺寸 PNG 从这里派生；圆角外透明，主屏幕图标垫上同色底。
for (const [name, size] of [
  ['favicon.png', 32],
  // 页头 logo 用 64px：32px 在高分屏上是放大出来的，会糊
  ['icon-64.png', 64],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  const output = path.join(root, 'public', name);
  const image = sharp(brandIcon).resize(size, size);
  // 主屏幕图标不支持透明角，垫上同色底避免出现白边
  if (size >= 180) image.flatten({ background: '#296046' });
  await image
    .png({ compressionLevel: 9, palette: true })
    .toFile(output);
  console.log(`已写入 public/${name}（${size}x${size}）`);
}

// 头像只用于页面上的小尺寸展示（48~64px），原图是 256px PNG，一张就 130KB+。
// 额外派生一版 160px 的 WebP：视觉上没差别，体积降到 1/10。
for (const [name, size] of [['avatar.webp', 160]]) {
  const output = path.join(root, 'public', name);
  const info = await sharp(avatarSource)
    .resize(size, size, { fit: 'cover' })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(output);
  console.log(`已写入 public/${name}（${size}x${size}，${info.size} 字节）`);
}
