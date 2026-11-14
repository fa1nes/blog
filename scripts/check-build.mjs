import process from 'node:process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const required = [
  'index.html', '404.html', 'posts/index.html', 'notes/index.html',
  'tags/index.html', 'categories/index.html', 'archive/index.html',
  'friends/index.html', 'guestbook/index.html', 'about/index.html',
  'search/index.html', 'admin/index.html', 'admin/config.yml',
  'rss.xml', 'notes/rss.xml', 'robots.txt', 'pagefind/pagefind.js',
  'favicon.png', 'icon-64.png', 'avatar.png', 'brand-icon.png', 'apple-touch-icon.png',
  'site.webmanifest', 'icon-192.png', 'icon-512.png',
];

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), `${name}/`));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

function elements(document) {
  const result = [];
  const visit = (node) => {
    if (node.tagName) {
      result.push({ tag: node.tagName, attrs: Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])) });
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(document);
  return result;
}

const hasRel = (element, value) => element.tag === 'link' &&
  (element.attrs.rel ?? '').toLowerCase().split(/\s+/).includes(value);

const metaContent = (nodes, key) => nodes.find(({ tag, attrs }) => tag === 'meta' &&
  (attrs.name === key || attrs.property === key))?.attrs.content?.trim() ?? '';

// 仅处理 Astro 生成的 sitemap；复用 HTML 解析器解码 loc 中的 XML 字符实体，不加载外部实体。
function sitemapLocations(xml, root) {
  if (!new RegExp(`<${root}(?:\\s|>)`).test(xml)) return [];
  const locations = [];
  const visit = (node) => {
    if (node.tagName === 'loc') {
      locations.push((node.childNodes ?? []).map((child) => child.value ?? '').join('').trim());
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(xml));
  return locations;
}

async function checkBuild() {
  const files = new Set(await listFiles(dist));
  const errors = required.filter((file) => !files.has(file)).map((file) => `缺少产物：${file}`);
  if (!files.has('index.html')) throw new Error('没有首页产物，请先运行 npm run build。');

  const home = elements(parse(await readFile(join(dist, 'index.html'), 'utf8')));
  const siteRoot = new URL(home.find((element) => hasRel(element, 'canonical'))?.attrs.href ?? '');
  if (
    siteRoot.protocol !== 'https:' || siteRoot.search || siteRoot.hash ||
    siteRoot.username || siteRoot.password || !siteRoot.pathname.endsWith('/') ||
    /(^|\.)(example\.com|localhost)$/.test(siteRoot.hostname) ||
    ['127.0.0.1', '[::1]'].includes(siteRoot.hostname)
  ) throw new Error(`首页 canonical 不是有效的生产站点根地址：${siteRoot.href}`);

  const base = siteRoot.pathname;
  const baseRoot = base.slice(0, -1);
  const cmsConfig = files.has('admin/config.yml') ? await readFile(join(dist, 'admin/config.yml'), 'utf8') : '';
  const siteName = metaContent(home, 'og:site_name');
  const authorName = metaContent(home, 'author');
  if (!siteName || !authorName) errors.push('首页：站点名与作者元数据不可为空');
  const indexablePages = new Set();
  let checkedLinks = 0;

  // 只检查可静态定位的单 URL 属性；外链、片段、srcset 和运行时请求交给浏览器。
  const checkLocal = (value, pageUrl, label) => {
    if (!value || value.startsWith('#')) return;
    let url;
    try { url = new URL(value, pageUrl); }
    catch { errors.push(`${label}：无效 URL ${value}`); return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== siteRoot.origin) return;
    if (url.pathname !== baseRoot && !url.pathname.startsWith(base)) {
      if (value.startsWith('/') && !value.startsWith('//')) errors.push(`${label}：缺少部署子路径 ${value}`);
      return;
    }

    let local;
    try { local = decodeURIComponent(url.pathname === baseRoot ? '' : url.pathname.slice(base.length)); }
    catch { errors.push(`${label}：无效路径编码 ${value}`); return; }
    if (local.includes('\\') || local.includes('\0') || local.split('/').some((part) => part === '..' || part === '.')) {
      errors.push(`${label}：不安全的本地路径 ${value}`);
      return;
    }
    checkedLinks++;
    const target = local.endsWith('/') || !local ? `${local}index.html` : local;
    if (files.has(target)) return target;
    if (files.has(`${local}/index.html`)) return `${local}/index.html`;
    errors.push(`${label}：找不到 ${value}`);
  };

  const checkPng = async (file, width, height) => {
    if (!file || !files.has(file)) return;
    const png = await readFile(join(dist, file));
    if (
      png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      png.toString('ascii', 12, 16) !== 'IHDR' ||
      png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height
    ) errors.push(`${file}：必须为 ${width}×${height} 的 PNG`);
  };
  const defaultImage = checkLocal(metaContent(home, 'og:image'), siteRoot, '首页默认分享图');
  if (!defaultImage) errors.push('首页：默认分享图必须是当前站点内可访问的 PNG');
  await checkPng(defaultImage, 1200, 630);
  await checkPng('favicon.png', 32, 32);
  await checkPng('apple-touch-icon.png', 180, 180);
  // 清单里声明的安装图标必须真的存在，否则 Android 加到桌面时会退回默认图标
  await checkPng('icon-192.png', 192, 192);
  await checkPng('icon-512.png', 512, 512);

  // 首页必须声明 web manifest，且清单内容可解析
  const manifestLinks = home.filter((element) => hasRel(element, 'manifest'));
  if (manifestLinks.length !== 1) errors.push('首页：必须且只能声明一个 web manifest');
  const manifestHref = manifestLinks[0]?.attrs.href ?? '';
  if (manifestHref && !files.has('site.webmanifest')) errors.push('首页：找不到 site.webmanifest');
  if (files.has('site.webmanifest')) {
    try {
      const manifest = JSON.parse(await readFile(join(dist, 'site.webmanifest'), 'utf8'));
      if (!manifest.name || !manifest.short_name) errors.push('site.webmanifest：缺少站点名称');
      if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
        errors.push('site.webmanifest：缺少图标声明');
      }
    } catch {
      errors.push('site.webmanifest：不是合法的 JSON');
    }
  }

  const htmlFiles = [...files].filter((file) => file.endsWith('.html')).sort();
  for (const file of htmlFiles) {
    const nodes = file === 'index.html' ? home : elements(parse(await readFile(join(dist, file), 'utf8')));
    const relativeUrl = file === 'index.html' ? '' : file.endsWith('/index.html') ? file.slice(0, -10) : file;
    const pageUrl = new URL(relativeUrl, siteRoot);
    const canonicals = nodes.filter((element) => hasRel(element, 'canonical'));
    const isBlogPage = required.includes(file) || nodes.some(({ tag, attrs }) => tag === 'meta' && attrs.name === 'generator' && /^Astro\b/.test(attrs.content ?? ''));
    if (file !== 'admin/index.html' && (isBlogPage || canonicals.length)) {
      if (canonicals.length !== 1) errors.push(`${file}：应有且只有一个 canonical`);
      else {
        try {
          const canonical = new URL(canonicals[0].attrs.href);
          if (
            canonical.origin !== siteRoot.origin || canonical.search || canonical.hash ||
            !canonical.pathname.startsWith(base) ||
            (file !== '404.html' && canonical.href !== pageUrl.href)
          ) errors.push(`${file}：canonical 与本次部署地址不一致`);
          else if (file !== '404.html' && !/\bnoindex\b/.test(metaContent(nodes, 'robots'))) {
            indexablePages.add(canonical.href);
          }
        } catch { errors.push(`${file}：canonical 必须为绝对 URL`); }
      }
      if (metaContent(nodes, 'author') !== authorName || metaContent(nodes, 'og:site_name') !== siteName) {
        errors.push(`${file}：作者或站点名与首页不一致`);
      }
      const image = metaContent(nodes, 'og:image');
      if (!image || image !== metaContent(nodes, 'twitter:image')) errors.push(`${file}：分享图元数据缺失或不一致`);
      else {
        try {
          const imageUrl = new URL(image);
          if (imageUrl.protocol !== 'https:' || imageUrl.href.includes('#')) errors.push(`${file}：分享图应使用不含片段的 HTTPS 绝对地址`);
        } catch { errors.push(`${file}：分享图必须为绝对 URL`); }
        const card = checkLocal(image, pageUrl, `${file} og:image`);
        // 文章分享图是构建时按标题生成的，尺寸或格式错了等于没生成
        if (card && /(?:^|\/)og\/[^/]+\.png$/i.test(card)) await checkPng(card, 1200, 630);
      }
    }

    for (const { tag, attrs } of nodes) {
      if (tag === 'a' || (tag === 'link' && !(attrs.rel ?? '').split(/\s+/).includes('canonical'))) {
        checkLocal(attrs.href, pageUrl, `${file} ${tag}[href]`);
      }
      if (['img', 'script', 'source', 'audio', 'video', 'iframe'].includes(tag)) {
        checkLocal(attrs.src, pageUrl, `${file} ${tag}[src]`);
      }
      if (tag === 'video') checkLocal(attrs.poster, pageUrl, `${file} video[poster]`);
    }

    if (file === 'admin/index.html') {
      const body = nodes.find(({ tag }) => tag === 'body');
      if (body?.attrs['data-site-url'] !== siteRoot.href) errors.push(`${file}：CMS 站点地址与 canonical 不一致`);
      const cmsVersion = body?.attrs['data-cms-script-url']?.match(/^https:\/\/unpkg\.com\/@sveltia\/cms@(\d+\.\d+\.\d+)\/dist\/sveltia-cms\.js$/)?.[1];
      if (!cmsVersion) errors.push(`${file}：CMS 脚本必须固定到完整版本号`);
      else if (!cmsConfig.includes(`$schema=https://unpkg.com/@sveltia/cms@${cmsVersion}/schema/sveltia-cms.json`)) {
        errors.push(`${file}：CMS 脚本与配置 schema 版本不一致`);
      }
      if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(body?.attrs['data-cms-script-integrity'] ?? '')) {
        errors.push(`${file}：CMS 脚本缺少有效的 SHA-256 完整性校验`);
      }
      const config = nodes.find((element) => hasRel(element, 'cms-config-url'));
      if (!config || new URL(config.attrs.href ?? '', pageUrl).href !== new URL('admin/config.yml', siteRoot).href) {
        errors.push(`${file}：CMS 配置链接不正确`);
      }
      if (!nodes.some(({ tag, attrs }) => tag === 'meta' && attrs.name === 'robots' && /\bnoindex\b/.test(attrs.content ?? ''))) {
        errors.push(`${file}：后台缺少 noindex`);
      }
    }
  }

  const sitemapLink = home.find((element) => hasRel(element, 'sitemap'))?.attrs.href;
  const sitemapPages = new Set();
  if (sitemapLink) {
    // 文件只能来自已枚举的 dist 产物；XML 中的 URL 不会触发网络请求或越界读取。
    const sitemapFile = (value, label) => {
      try {
        const url = new URL(value);
        if (url.origin !== siteRoot.origin || url.search || url.hash || url.username || url.password || !url.pathname.startsWith(base)) {
          errors.push(`${label}：URL 与本次部署地址不一致`);
          return;
        }
        return checkLocal(url.href, siteRoot, label);
      } catch { errors.push(`${label}：必须为绝对 URL`); }
    };
    const indexUrl = new URL(sitemapLink, siteRoot).href;
    const indexFile = sitemapFile(indexUrl, 'sitemap 索引');
    if (indexFile) {
      const children = sitemapLocations(await readFile(join(dist, indexFile), 'utf8'), 'sitemapindex');
      if (!children.length) errors.push(`${indexFile}：没有子 sitemap`);
      for (const child of new Set(children)) {
        const childFile = sitemapFile(child, `${indexFile} loc`);
        if (!childFile) continue;
        const pages = sitemapLocations(await readFile(join(dist, childFile), 'utf8'), 'urlset');
        if (!pages.length) errors.push(`${childFile}：没有公开页面`);
        for (const page of pages) {
          const pageFile = sitemapFile(page, `${childFile} loc`);
          if (!pageFile) continue;
          const url = new URL(page).href;
          if (!indexablePages.has(url)) errors.push(`${childFile}：不应收录非公开 canonical 页面 ${url}`);
          sitemapPages.add(url);
        }
      }
    }
    for (const page of indexablePages) {
      if (!sitemapPages.has(page)) errors.push(`sitemap：缺少公开页面 ${page}`);
    }
  }

  for (const file of ['rss.xml', 'notes/rss.xml']) {
    if (!files.has(file)) continue;
    const xml = await readFile(join(dist, file), 'utf8');
    const channelUrl = xml.match(/<channel(?:\s[^>]*)?>[\s\S]*?<link>([^<]+)<\/link>/)?.[1]?.trim();
    if (!/<rss\b/.test(xml) || channelUrl !== siteRoot.href) errors.push(`${file}：RSS 频道地址与本次部署地址不一致`);
  }
  if (files.has('robots.txt')) {
    const robots = await readFile(join(dist, 'robots.txt'), 'utf8');
    for (const match of robots.matchAll(/^Sitemap:\s*(\S+)/gmi)) checkLocal(match[1], siteRoot, 'robots.txt Sitemap');
  }

  if (errors.length) {
    console.error(`构建产物验收失败（${errors.length} 项）：\n${errors.slice(0, 40).map((error) => `- ${error}`).join('\n')}`);
    if (errors.length > 40) console.error(`另有 ${errors.length - 40} 项未显示。`);
    process.exitCode = 1;
    return;
  }
  console.log(`构建产物验收通过：${siteRoot.href}，${htmlFiles.length} 个 HTML，${checkedLinks} 个本地链接和资源；作者、分享图、图标、${sitemapPages.size} 个 sitemap 页面、RSS、Pagefind、CMS 配置齐全。`);
}

try {
  await checkBuild();
} catch (error) {
  console.error(`构建产物验收失败：${error.message}`);
  process.exitCode = 1;
}
