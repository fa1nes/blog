import process from 'node:process';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
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

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || site.base);

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
            // 后台与 404 不该出现在站点地图里
            filter: (page) => !page.includes('/404') && !page.includes('/admin'),
          }),
        ]
      : []),
    // 构建结束后对 dist 目录生成静态搜索索引，开发时代理 /pagefind
    pagefind(),
  ],

  markdown: {
    // Astro 7 默认使用内置的 Sätteri 处理器：
    // 自带 GFM、SmartyPants，并自动为标题注入 github-slugger 风格的 id
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
