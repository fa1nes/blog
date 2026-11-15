import process from 'node:process';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';
import tailwindcss from '@tailwindcss/vite';

import { site, seo } from './src/site.config';

/**
 * 部署地址与子路径都允许被环境变量覆盖，
 * 这样同一份代码既能部署到根路径（Cloudflare Pages / 自定义域名），
 * 也能部署到子路径（GitHub Pages 的 user.github.io/repo/）。
 */
const SITE_URL = process.env.SITE_URL || site.url;

/**
 * 统一成 '/xxx/' 的形式，'blog'、'/blog'、'/blog/' 三种写法都能接受。
 * Windows 的 Git Bash 会把以 / 开头的值当成路径改写，
 * 所以在本地传这个变量时用不带斜杠的 BASE_PATH=blog 最省事。
 */
function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/**
 * 部署根路径的判定顺序：
 *   1. 显式传了 BASE_PATH，就完全听它的（GitHub Pages 工作流会传 /repo）
 *   2. 在 Cloudflare（Pages 或 Workers 静态资源）上构建时，站点在域名根目录
 *   3. 都没有就用 site.config.ts 里的 site.base
 *
 * 第 2 条是必要的：CF 的构建环境不会传 BASE_PATH，如果直接回落到
 * site.base（'/blog'），CF 上所有链接都会多一层 /blog 而 404。
 */
const isCloudflareBuild = Boolean(process.env.CF_PAGES || process.env.CF_WORKERS_CI);

const BASE_PATH = normalizeBasePath(
  process.env.BASE_PATH ?? (isCloudflareBuild ? '/' : site.base),
);

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,

  // 统一使用带尾斜杠的目录形式，两个托管平台行为一致，避免多余的重定向
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },

  integrations: [
    mdx(),
    ...(seo.sitemap
      ? [
          sitemap({
            // 后台、站内搜索与 404 不该出现在站点地图里（后台整段排除）
            filter: (page) => {
              const pathname = new URL(page).pathname;
              if (pathname.startsWith(`${BASE_PATH}admin/`)) return false;
              return ![
                `${BASE_PATH}404/`, `${BASE_PATH}404.html`, `${BASE_PATH}search/`,
              ].includes(pathname);
            },
          }),
        ]
      : []),
    // 构建结束后对 dist 目录生成静态搜索索引，开发时代理 /pagefind
    pagefind(),
  ],

  markdown: {
    // CMS 正文中的根路径链接跟随部署 base，相对图片仍交给 Astro 处理。
    processor: satteri({
      hastPlugins: [{
        // 给表格标注列数：窄屏下只让「列多」的表横向滚动，
        // 两列的长文本表仍然正常换行，不会被迫左右滑。
        name: 'table-columns',
        element: {
          filter: ['table'],
          visit(node, ctx) {
            const sections = Array.isArray(node.children) ? node.children : [];
            const head = sections.find((child) => child.tagName === 'thead') ?? sections[0];
            const row = (head?.children ?? []).find((child) => child.tagName === 'tr');
            const columns = (row?.children ?? []).filter(
              (cell) => cell.tagName === 'th' || cell.tagName === 'td',
            ).length;
            if (columns) ctx.setProperty(node, 'data-cols', String(columns));
          },
        },
      }, {
        name: 'content-base-path',
        element: {
          filter: ['a', 'img', 'video', 'audio', 'source'],
          visit(node, ctx) {
            const prefix = BASE_PATH.slice(0, -1);
            if (!prefix) return;
            const keys = node.tagName === 'a'
              ? ['href']
              : node.tagName === 'video' ? ['src', 'poster'] : ['src'];
            for (const key of keys) {
              const value = node.properties?.[key];
              if (
                typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
              ) continue;
              ctx.setProperty(node, key, `${prefix}${value}`);
            }
          },
        },
      }],
    }),
    shikiConfig: {
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark',
      },
      wrap: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: 'lightningcss',
    },
  },

  devToolbar: {
    enabled: false,
  },
});
