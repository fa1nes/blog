<div align="center">

# fa1nes 的博客

**技术实践、工具折腾与日常记录**

无数据库、无常驻后端，构建产物就是一堆静态文件。带网页后台、全文搜索和自动部署。

[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-42b983.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522.12-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy_to_Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages)
[![Fork](https://img.shields.io/badge/Fork-%E5%A4%8D%E5%88%B6%E5%88%B0%E6%88%91%E7%9A%84%E4%BB%93%E5%BA%93-181717?logo=github&logoColor=white)](https://github.com/fa1nes/blog/fork)
[![Use this template](https://img.shields.io/badge/Use_this_template-2ea44f?logo=github&logoColor=white)](https://github.com/fa1nes/blog/generate)

</div>

两个线上地址，内容一致：

| 地址 | 托管 |
| --- | --- |
| [fa1nes.github.io/blog](https://fa1nes.github.io/blog/) | GitHub Pages，部署在 `/blog/` 子路径 |
| [fa1nes-blog.pages.dev](https://fa1nes-blog.pages.dev/) | Cloudflare Pages，部署在根路径 |

后台在站点地址后加 `/admin/`，已支持 GitHub 账号一键登录。评论用 Giscus，访问统计走 vercount。

**文章不在这个仓库里**：主题代码是公开的，文章、动态、图片在私有仓库 `fa1nes/blog-content`，构建时拉取。fork 这个仓库得到的是空壳，详见 [内容与代码分离](#内容与代码分离)。

## 目录

- [一键部署](#一键部署)
- [本地开始](#本地开始)
- [写作](#写作)
- [配置](#配置)
- [评论与统计](#评论与统计)
- [内容与代码分离](#内容与代码分离)
- [部署](#部署)
- [隐私与 fork 须知](#隐私与-fork-须知)
- [目录结构](#目录结构)
- [设计说明](#设计说明)
- [常见问题与说明](#常见问题与说明)

## 一键部署

顶部三枚徽章就是三个入口，都不需要本地环境。Cloudflare 官方那个一键按钮只支持 Workers（静态请求按次计费），所以这里换成了直接打开 Pages 创建页。

| 按钮 | 会发生什么 |
| --- | --- |
| **Deploy to Cloudflare Pages** | 打开 Cloudflare 的 Pages 创建页 → 选「连接到 Git」→ 选仓库，构建命令 `npm run build`、输出 `dist`，两分钟上线 |
| **Fork** | 只复制主题代码（**不含文章**），之后自己接 Pages / GitHub Pages |
| **Use this template** | 同上，但保留干净的提交历史；拿到后把文章放回 `src/content/` 或自建私有内容仓库 |

换成自己的仓库后，改这三处就够了：

1. `src/site.config.ts` —— `url`、`base`、站点标题、作者
2. `public/admin/config.yml` —— `repo`
3. `src/content/pages/about.md` —— 个人信息

### 选 Cloudflare Pages 还是 GitHub Pages

| | Cloudflare Pages | GitHub Pages |
| --- | --- | --- |
| 部署路径 | 域名根目录 | `/仓库名/` 子路径 |
| 静态请求 | **不限量、不计费** | 每月 100 GB 流量、1 GB 空间 |
| 构建位置 | Cloudflare 侧，Push 即发布 | GitHub Actions |
| `robots.txt` | 在根目录，正常生效 | 落在子路径，搜索引擎不读 |
| 自定义域名 | 支持 | 支持 |

功能上两者完全一致：评论、后台、访问统计都在浏览器里跑，跟托管方无关，详见 [评论与统计](#评论与统计)。

> **为什么不用 Workers**：静态站点放在 Pages 上是零成本的（静态请求不计费），Workers 免费额度只有每天 10 万次请求，博客被转发几轮就可能触顶。本项目默认走 Pages。

### 一键部署之后

按钮只负责把仓库和项目建起来，发布前还有一步：

- **Cloudflare**：项目 → Settings → 环境变量加 `SITE_URL=https://<项目>.pages.dev`（或你的域名），重新部署一次，canonical 与分享图才会指向新站
- **GitHub Pages**：仓库 Settings → Pages → Source 选 **GitHub Actions**，推一次 `main` 即可

## 本地开始

需要 Node.js 22.18 或更高版本（低于这个版本无法直接 import `.ts` 配置，构建脚本会报 `ERR_UNKNOWN_FILE_EXTENSION`）。

```bash
git clone https://github.com/fa1nes/blog.git my-blog
cd my-blog
npm install
npm run dev        # http://localhost:4321/blog/
```

> 本地开发默认带 `/blog` 子路径，和线上 GitHub Pages 一致。想用根路径：`BASE_PATH=/ npm run dev`。

**如果你拿它当自己的博客**，先跑一次初始化向导：

```bash
npm run setup
```

它会问站点标题、作者、网址、GitHub 用户名，然后改 `src/site.config.ts`、`public/admin/config.yml` 里的仓库、社交链接，并重新生成分享图。默认保留现有内容，只有明确选择清空时才替换文章、动态和友链；可以反复运行。运行前建议先提交，跑完用 `git diff` 检查。

本站（`fa1nes/blog`）已经配置好，日常维护不需要再运行向导。

### 常用命令

```bash
npm run dev         # 开发服务器
npm run build       # 生产构建并验收，产物在 dist/
npm run check:build # 只验收已有产物：页面、链接、资源、RSS、搜索与后台配置
npm run preview     # 本地预览构建产物
npm test            # 内容、搜索、写作与发布工具的回归测试
npm run check       # 先跑测试，再做 TypeScript 类型检查

npm run setup       # 交互式初始化（第一次用，或想重新配置时）
npm run content:pull # 从私有内容仓库拉文章与图片（需要 CONTENT_REPO_TOKEN）
npm run og          # 重新生成默认分享图、站点图标和各篇文章的分享图
npm run og:posts    # 只重渲染文章的分享图（构建时也会自动跑一遍）
```

> **文章分享图**：`npm run build` 会先按每篇文章的标题、分类、日期渲染一张 1200×630 的图，写到 `public/og/<slug>.png`，文章页的 `og:image` 指向它。目录不进版本库；比源文件和 `brand-icon.png` 新的图会复用，改一篇文章只重画那一张，删文章时旧图自动清掉。

> **本地搜索**：搜索索引在 `npm run build` 时生成。开发模式下如果从没构建过，搜索页会提示索引不存在，先跑一次 `npm run build` 即可。

## 写作

### 两种方式

#### 一、网页后台

后台是站点自带的一个页面：**不加载任何 CMS 框架，不走 CDN，也没有第二套降级页**。
整页约 40KB，打开就有，iOS 12 / Android 5 / 微信内置浏览器都能用。

地址是**站点地址后面加 `/admin/`**：

| 环境 | 地址 |
| --- | --- |
| 本地 | http://localhost:4321/blog/admin/ |
| 部署在根路径 | `https://你的域名/admin/` |
| 部署在子路径 | `https://用户名.github.io/仓库名/admin/` ← **别漏掉仓库名那一段** |

子路径部署时漏掉仓库名会直接 404 —— 后台是站点的一个页面，不在域名根目录。

> 入口做成 Astro 路由而不是 `public/` 下的静态 HTML，是因为开发服务器不会把 `public/admin/` 解析成目录索引 —— 放 `public/` 时本地访问 `/admin/` 会 404，只能访问 `/admin/index.html`。现在开发和生产的路径一致。

**登录方式**：

| 方式 | 说明 |
| --- | --- |
| 使用 GitHub 登录 | 一次点击，弹窗授权后自动回到后台。需要先部署 `workers/cms-auth`，把地址填进 `config.yml` 的 `base_url` |
| 访问令牌 | 不需要任何服务，粘一次令牌即可。适合自己一个人用，或 OAuth 服务不可用时兜底 |

用令牌的步骤：

1. 打开 [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) 建一个细粒度令牌
2. **Repository access** 选 `Only select repositories`，勾上内容仓库
3. **Permissions → Contents** 设为 `Read and write`，其余不用动
4. 生成后复制令牌，回后台点「用访问令牌」，粘贴进入

令牌只存在你浏览器的本地存储里，不会提交到仓库；想撤销随时回 GitHub 删掉。

**能管理的内容**：

| 集合 | 对应目录 | 能做什么 |
| --- | --- | --- |
| 文章 | `src/content/posts/` | 新建、编辑、删除；草稿、置顶开关；正文里插入图片 |
| 动态 | `src/content/notes/` | 新建、编辑、删除短内容 |
| 友情链接 | `src/content/friends/` | 增删改友链，填头像地址 |
| 页面 | `src/content/pages/` | 编辑「关于」页等独立页面 |

保存会直接提交到内容仓库，两个站点在推送后自动重新构建。图片上传到 `public/uploads/`，正文用 `/uploads/名字` 引用。

> 后台字段和 `src/content.config.ts` 的 schema 一一对应。给 schema 加字段时，同时改 `src/pages/admin/index.astro` 里的 `COLLECTIONS`，
> 否则新字段在后台不可见（已有内容不会丢，后台会原样保留它不认识的 frontmatter）。

站点标题、导航、社交链接这类配置在 `src/site.config.ts` 里，属于代码不走后台，改完提交一次即可。

#### 二、直接改文件

文章在内容仓库 `fa1nes/blog-content`（私有）：改 `src/content/posts/` 下的 Markdown，push 即可，两个站点会自动重建。

不想开编辑器的话，打开 [github.dev/fa1nes/blog-content](https://github.dev/fa1nes/blog-content)，浏览器里就是一个 VS Code，用 GitHub 账号登录即可编辑、传图、提交。

### 文件与 frontmatter

在 `src/content/posts/` 下新建 `.md` 或 `.mdx` 文件，**文件名就是网址**。例如 `my-post.md` 对应 `/posts/my-post/`。

```markdown
---
title: 文章标题
description: 一句话摘要，用于列表、搜索结果和分享卡片
pubDate: 2026-07-20
category: 技术
tags: [性能, 前端]
---

正文从这里开始。
```

### 可用字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | :---: | --- | --- |
| `title` | 字符串 | 是 | —— | 文章标题 |
| `pubDate` | 日期 | 是 | —— | 发布日期，如 `2026-07-20` |
| `description` | 字符串 | 否 | 自动截取正文 | 摘要 |
| `updatedDate` | 日期 | 否 | —— | 更新日期，会显示在文末 |
| `category` | 字符串 | 否 | `未分类` | 一篇文章只能有一个分类 |
| `tags` | 字符串数组 | 否 | `[]` | 可以有多个标签 |
| `slug` | 字符串 | 否 | 文件名 | 自定义网址 |
| `cover` | 图片路径 | 否 | —— | 封面图，会被自动优化 |
| `coverAlt` | 字符串 | 否 | 文章标题 | 封面图替代文字 |
| `draft` | 布尔 | 否 | `false` | 草稿：本地可见，不参与生产构建 |
| `pinned` | 布尔 | 否 | `false` | 置顶到列表最前 |
| `toc` | 布尔 | 否 | `true` | 单篇关闭目录 |
| `comments` | 布尔 | 否 | `true` | 单篇关闭评论 |

字段写错会在构建时直接报错并指出问题所在，不会静默生成一个坏页面。

自定义 `slug` 可以使用中文和多级路径，例如 `技术/静态博客`。请勿使用空路径段、`.`、`..`、查询参数或片段、Windows 文件名保留字符及设备名；`page/数字` 留给文章分页。已发布文章不能使用相同或仅大小写不同的网址，发生冲突时构建会明确报错，避免内容被覆盖。

### 封面图

有封面的文章会在列表页显示缩略图，在详情页显示大图；没有封面的条目保持纯文字排版，两者混排不会错位。

封面支持两种写法：

**放 `src/assets/`（推荐，会被优化）**

```yaml
cover: ../../assets/my-cover.jpg
coverAlt: 图片说明
```

路径相对于文章文件。构建时自动生成多个尺寸的 WebP 并写入 `srcset` 与宽高 —— 示例里那张 16 KB 的 JPG，最小变体只有 2 KB。参考 `src/content/posts/markdown-typography.md`。

**放 `public/uploads/`（后台上传走这条）**

```yaml
cover: /uploads/my-cover.jpg
```

绝对路径，不会被压缩，但随传随用。子路径部署时模板会自动补上 base 前缀。

> 为什么分两种：Astro 的图片优化要求相对路径，而网页后台的 `public_folder` 必须是绝对路径，两个约束无法同时满足。所以手写文章走优化路线，后台上传走简单路线。在意体积的话，把后台传的图挪到 `src/assets/` 再改成相对路径即可。

### 草稿

`draft: true` 的文章在 `npm run dev` 下可以正常预览，但 `npm run build` 会把它完全排除，不生成页面、不进列表、归档、RSS 和搜索索引。另外文件名以 `_` 开头的文件会被内容集合直接忽略，连开发时也不加载，适合放素材片段。示例见 `src/content/posts/draft-example.md`。

### 写一条动态

有些想法不够撑起一篇文章。在 `src/content/notes/` 下建 Markdown 文件，只有 `pubDate` 一个必填字段：

```yaml
---
pubDate: 2026-07-24 21:40
mood: 随手记      # 可选，显示在时间旁
tags: [写作]      # 可选
draft: false      # 可选，true 时只在本地可见
---

正文，支持全部 Markdown 语法。
```

动态展示在 `/notes/` 的时间线上，不生成独立页面，也不进文章列表。另外：

- **标签是打通的**。给动态打的标签会和文章的标签合并统计，标签页里文章和动态分区展示 —— 所以给动态用一个文章里没有的新标签也不会 404。
- **单独一条 RSS**：`/notes/rss.xml`。每条动态有稳定的页面锚点和订阅标识，订阅链接可以直接定位到对应动态；主 RSS 只放文章，避免短内容把订阅列表刷满。
- **能被搜到**，但因为动态没有独立页面，Pagefind 按页建索引，所以整条时间线是一条记录 —— 搜到后会跳到 `/notes/`，需要自己在页面里定位。

### 在文章里用选项卡和终端窗口

这两个组件需要 `.mdx` 后缀。完整示例见 `src/content/posts/writing-with-mdx.mdx`。

```mdx
import Tabs from '../../components/Tabs.astro';
import TabItem from '../../components/TabItem.astro';
import Terminal from '../../components/Terminal.astro';

<Tabs>
  <TabItem label="npm">
    ```bash
    npm install
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```bash
    pnpm install
    ```
  </TabItem>
</Tabs>

<Terminal title="npm run build" code={`$ npm run build
✓ Complete!`} />
```

选项卡的标签栏由脚本生成，支持左右方向键切换；没有 JavaScript 时会退化成依次列出的几段内容，各带一个小标题，信息不丢。终端窗口在浅色模式下也保持深色背景。

### 友链与留言板

友链是一个内容集合，每个站点一个文件放在 `src/content/friends/` 下，这样**网页后台也能直接增删改**：

```yaml
---
name: Astro
href: https://astro.build/
description: 本站使用的静态站点框架
avatar: ''                    # 可选，留空则显示站名首字
order: 1                      # 数字小的排前面
---
```

页面顶部那段友链申请说明在 `src/site.config.ts` 的 `friendsNote` 里，留空则不显示。

留言板是 `/guestbook/`，直接复用文章的评论区，开启评论后即可使用。

### 几个注意点

- **文件名建议用英文或拼音**，中文文件名会让网址变成一长串百分号编码。想要中文标题配英文网址，用英文文件名即可，`title` 可以是中文。
- **以下划线或点号开头的文件不会被构建**：下划线留给草稿片段，点号留给编辑器/脚本的临时文件（例如同步工具写入的 `.xxx.md`）。这条规则写在 `src/content.config.ts` 的 `CONTENT_PATTERN` 里，四个内容集合共用。
- **文章内的站内链接请使用相对路径**，例如从 `/posts/a/` 链接到 `/posts/b/` 写作 `../b/`。Markdown 里的绝对路径 `/posts/b/` 在部署到子目录时会失效。
- **在文章里引用 `public/` 下的图片**同理，从文章页指向根目录的图片写作 `../../图片名`。
- **想用组件就把后缀改成 `.mdx`**，两种格式可以在同一目录混用。示例见 `src/content/posts/writing-with-mdx.mdx`。

## 配置

打开 `src/site.config.ts`，所有配置分成九块，都有中文注释：

```ts
export const site = { url, base, title, subtitle, description, lang, timeZone };
export const author = { name, bio, avatar, url, email };
export const nav = [ /* 导航菜单 */ ];
export const social = [ /* 社交链接 */ ];
export const features = { search, toc, readingTime, codeCopy, themeToggle, postNav };
export const content = { postsPerPage, homePostCount, rssPostCount, tocDepth /* ... */ };
export const comments = { enabled, giscus: { /* ... */ } };
export const footer = { startYear, copyright, icp, note };
export const seo = { ogImage, twitterSite, themeColor, sitemap };
export const analytics = { provider, cloudflareToken, goatcounterCode, showCounters };
```

本站使用 `site.url = 'https://fa1nes.github.io'` 与 `site.base = '/blog'`，组合后的生产地址为 `https://fa1nes.github.io/blog/`。canonical、RSS、sitemap 和分享图链接均跟随本次构建的主机名与部署路径。

### 换配色

配色定义在 `src/styles/global.css` 顶部，浅色与深色各一组语义变量：

```css
:root {
  --paper: #ffffff;   /* 背景 */
  --ink: #50616d;     /* 正文，故意不用纯黑 */
  --accent: #42b983;  /* 强调色 */
  /* ... */
}
.dark { /* 深色模式的同名变量 */ }
```

只想换主题色的话，改 `--accent` 那几个值就够了，站名、标题、链接、标签、进度条会一起跟着变，不需要动任何组件。

**几个刻意的选择**：

- 正文用蓝灰 `#50616d` 而不是纯黑，边框用极淡的 `#eef1f5`，整体没有硬边，长时间阅读不容易累。
- 强调色分成两支：`--accent` 用于**文字**（标题、链接），`--accent-vivid` 用于**图形**（站名徽标、进度条、圆点）。原因是清新的亮绿在白底上做文字只有 2.5:1 的对比度，远低于无障碍要求的 4.5:1，但作为色块完全合格。换主题色时记得同样区分这两个用途。
- `--ink-faint` 只用于图标和装饰，不要用在文字上（它只有 3.1:1，够图形不够正文）。元信息文字请用 `--ink-soft`。
- `--brand-amber` 是品牌色的第三支，只出现在页头字标末尾的句点（`.brand-dot`）。它不参与正文配色，所以不跟随主题色更换。

浅色模式各色的实测对比度都写在 `global.css` 的注释里，改配色时可以对照。

### 关于字体

英文和数字用自托管的 Nunito（`src/assets/fonts/`，39 KB 可变字体，覆盖 400–900 全部字重），中文回落到系统黑体。不想要这个字体的话，删掉 `global.css` 里的 `@font-face` 块，再把 `--font-sans` 开头的 `'Nunito'` 去掉即可。

字体放在 `src/` 而不是 `public/`，这样 Vite 会打包并重写 URL，部署到子路径时不会 404。

### 社交链接与开关

页脚、首页、关于页的社交入口都来自 `src/site.config.ts` 的 `social` 数组，**一条配置三处生效**：

```ts
export const social: SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/fa1nes', icon: 'github', enabled: true },

  // 需要哪个就取消注释并改地址
  // { label: 'X', href: 'https://x.com/yourname', icon: 'x', enabled: true },
  // { label: '微博', href: 'https://weibo.com/u/0000000000', icon: 'weibo', enabled: true },
  // { label: '邮箱', href: 'mailto:you@example.com', icon: 'mail', enabled: true },
];

/** 页面上真正渲染的列表：enabled 为 false 的会被过滤掉 */
export const visibleSocial: SocialLink[] = social.filter((item) => item.enabled !== false);
```

- **加一个入口**：取消注释对应行，改 `href`，`icon` 用 `IconName` 里的名字
- **临时隐藏**：`enabled: false`，链接留在配置里，想恢复改回来就行
- **全部关掉**：把数组清空，页脚那一行社交图标就不显示了

想要新的平台图标，见下一节。

### 换分享图

`public/og-default.png` 为 1200×630 的默认分享图，内容与 `src/site.config.ts` 中的站名、副标题及完整站点路径一致。`npm run og` 会重新生成这张图及 `og-default.svg`，同时从 `brand-icon.png` 生成 32×32 的 `favicon.png`、180×180 的 `apple-touch-icon.png` 和 192/512 的 `icon-192.png`、`icon-512.png`；默认分享图右侧用 `avatar.png`。改过图标、头像或站名后跑一次即可。

社交平台抓取 `og:image` 时**都不支持 SVG**，所以这里必须是 PNG 或 JPG。脚本用的是 Astro 自带的 sharp，不需要额外安装东西，文字由系统字体渲染。想改设计就直接改 `scripts/generate-og.mjs` 里的模板，或者自己做一张 1200×630 的图覆盖掉输出文件。

### 换社交平台图标

`src/components/Icon.astro` 内置了 GitHub、X、微博、知乎、B 站、掘金、Telegram、邮箱、RSS 等图标。要加新的，从 [Simple Icons](https://simpleicons.org) 复制 path 数据加进 `ICONS` 对象，再到 `site.config.ts` 的 `IconName` 里补上名字即可。

## 评论与统计

评论用 Giscus，数据存在仓库自己的 GitHub Discussions 里，不需要任何后端。当前仓库**已启用**：Discussions 打开、giscus app 已装到 `fa1nes/blog`、`repoId` 与 `Announcements` 分类 ID 都写在 `src/site.config.ts` 里。

评论区默认懒加载：滚动到接近评论区时才请求 iframe，不影响首屏。深浅色切换时评论主题会跟着变。第一次留言时，giscus 会自动为这一页建一条 Discussion；在此之前显示的是空评论区（`Discussion not found` 是正常状态，不是故障）。

脚本对真正的故障做了降级：giscus 报 `not installed`、分类 ID 失效之类的错误时，会撤掉 iframe、在状态行说明原因，并把 GitHub Issues 入口露出来，访客不会看到一片报错。

换仓库时按这几步重配：

1. 仓库必须是 **public**，`Settings → General → Features` 勾选 **Discussions**
2. 给仓库安装 [giscus app](https://github.com/apps/giscus)，只需勾选这一个仓库
3. GraphQL 取两个 ID：`repository.id` 与 `discussionCategories` 里目标分类的 `id`
4. 填进 `src/site.config.ts`，`enabled` 保持 `true`

```ts
export const comments = {
  enabled: true,
  giscus: {
    repo: 'fa1nes/blog',
    repoId: 'R_kgDO...',
    category: 'Announcements',
    categoryId: 'DIC_kwDO...',
  },
};
```

### 访客统计

`analytics` 默认用 [vercount](https://vercount.one)（不蒜子的继任服务）：免注册，页脚直接显示「N 位访客 · 共 N 次浏览」。代价是那个脚本能看到访客 IP，介意的话换成下面两种，只改 `provider`：

- `cloudflare`：Cloudflare Web Analytics，免费、无 cookie，把面板里拿到的 beacon token 填进 `cloudflareToken`
- `goatcounter`：开源、可自建，填 `goatcounterCode`
- `none`：不加载任何统计脚本

数字按 hostname 分开统计，`localhost` 下看到的是公共计数，属正常。

### 在 Cloudflare Pages 上还能用吗

能，这三样都不依赖托管方：

| 能力 | 依赖什么 | 换到 CF Pages 后 |
| --- | --- | --- |
| 评论 Giscus | 浏览器直连 giscus.app，数据在 GitHub Discussions | 照常工作 |
| 后台 | 自带的一个轻量页面（无第三方依赖），调 GitHub API；OAuth 走 `workers/cms-auth` | 照常工作，地址变成 `https://<项目>.pages.dev/admin/` |
| 访问统计 vercount | 浏览器直连统计脚本 | 照常工作，计数按 hostname 分开，两个域名各算一份 |

有两处要跟着改：

- `SITE_URL` 换成 CF 的域名，否则 canonical、分享图、后台预览地址还指着旧站
- `workers/cms-auth` 的 `ALLOWED_ORIGINS` 里加上新域名，否则后台登录会被 Worker 拒绝

## 内容与代码分离

文章不在这个仓库里。

- **本仓库（公开）**：主题、组件、脚本、构建配置。fork 出去是空壳，没有任何文章
- **`fa1nes/blog-content`（私有）**：文章、动态、友链、关于页、上传的图片

构建时由 `scripts/fetch-content.mjs` 把私有仓库拉进来：

```bash
# 本地开发（需要只读令牌）
CONTENT_REPO_TOKEN=ghp_xxx npm run content:pull
npm run dev
```

`npm run build` 会自动执行这一步。没有令牌时，如果本地已经有内容文件就直接用；如果本地也没有，构建出的是一套空站点（结构完整、没有文章），CI 里跑到来自 fork 的 PR 就是这种情况。

### 两边的令牌

| 位置 | 名称 | 用途 |
| --- | --- | --- |
| 公开仓库 Secrets | `CONTENT_REPO_TOKEN` | 构建时读私有内容仓库 |
| Cloudflare 项目环境变量 | `CONTENT_REPO_TOKEN` | 同上 |
| 内容仓库 Secrets | `CF_DEPLOY_HOOK` | 内容更新后触发 Cloudflare 重建 |
| 内容仓库 Secrets | `PUBLIC_REPO_TOKEN` | 内容更新后触发 GitHub Pages 重建 |

令牌只需要对**私有内容仓库**的只读权限（`Contents: Read`）。`PUBLIC_REPO_TOKEN` 需要公开仓库的 `Contents: Write`，仅用于发 `repository_dispatch`。

### 发布流程

```
后台保存 / 手动 push 内容仓库
        ↓
内容仓库的 notify.yml
        ├─ POST Cloudflare Deploy Hook → CF 重新构建（拉最新内容）
        └─ repository_dispatch → GitHub Actions 构建（拉最新内容）
```

也就是说：**只改内容，不用碰公开仓库**，两个站点都会自动更新。

### 换内容仓库

改两个环境变量即可：`CONTENT_REPO`（默认 `fa1nes/blog-content`）和 `CONTENT_REPO_REF`（默认 `main`）。

## 部署

产物是纯静态文件（`dist/`），两个平台都在免费额度内。构建时会自己判断部署路径：

- 在 Cloudflare 的构建环境里，`base` 自动变成 `/`
- 在 GitHub Pages 上，工作流通过 `actions/configure-pages` 注入 `SITE_URL` 与 `BASE_PATH`
- 两边都不需要手改配置

### Cloudflare Pages（推荐）

**方式一：控制台连仓库**（最省事，不需要 Actions）

1. Cloudflare 控制台 → **Workers 和 Pages** → **创建** → **Pages** → **连接到 Git**
2. 选仓库，构建配置填：

   | 项目 | 值 |
   | --- | --- |
   | 框架预设 | Astro |
   | 构建命令 | `npm run build` |
   | 构建输出目录 | `dist` |
   | 环境变量 | `SITE_URL=https://<项目>.pages.dev`（或你的域名） |

   Node 版本不用手动配 —— 仓库里的 `.node-version` 会被读取。若构建日志里 Node 低于 22，再加一个 `NODE_VERSION=22`。

3. 保存后会自动跑第一次构建；之后每次推 `main` 都会重新发布。

**方式二：GitHub Actions 推送**

保留 `.github/workflows/deploy-cloudflare.yml`，在仓库里配置：

- 变量（Variables）：`CLOUDFLARE_PROJECT_NAME`、`SITE_URL`
- 密钥（Secrets）：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`

没配 `CLOUDFLARE_PROJECT_NAME` 时这个工作流会自动跳过，不会让 CI 变红。

**手动推一次**（本地验证过的方式）：

```bash
CF_PAGES=1 SITE_URL=https://<项目>.pages.dev npm run build
npx wrangler pages deploy dist --project-name=<项目>
```

`CF_PAGES=1` 是根路径构建的关键：没有它，`base` 会沿用配置里的 `/blog`，线上链接会全部 404。用控制台连仓库时 Cloudflare 会自动带上这个变量，不需要管。

### GitHub Pages（自动处理子路径）

1. 把代码推送到 GitHub
2. 仓库 `Settings → Pages`，把 **Source** 设为 **GitHub Actions**
3. 推送到 `main` 分支即可

`.github/workflows/deploy-github-pages.yml` 会自动处理子路径问题：它从 `actions/configure-pages` 读取实际的部署地址，把 `SITE_URL` 和 `BASE_PATH` 注入构建。

- 部署到 `user.github.io/blog/` 时，`BASE_PATH` 自动为 `/blog`
- 绑定了自定义域名时，`BASE_PATH` 自动为空

`BASE_PATH=''` 明确表示根路径，会覆盖配置文件中的 `/blog`。正文 Markdown 的根路径链接与上传图片也会在构建时补齐部署子路径：内容里使用 `/posts/文章别名/`、`/uploads/图片.png` 等站点内路径，不要写入 `/blog` 部署前缀。后台的站点与预览地址从本次构建读取；CMS 脚本自托管、版本与哈希在 `scripts/fetch-cms.mjs` 里锁定，加载失败会显示恢复入口。

`npm run build` 在生成页面和搜索索引后，自动验收产物中的主路由、站内链接和资源、canonical、两个 RSS、Pagefind 与后台配置。现有部署工作流调用同一命令，任一环节失败都不会上传发布。回滚时通过 GitHub revert 对应提交并推送，重新走同一条构建链路。

所以你不需要手改任何配置。

> **子路径部署的一个限制**：`robots.txt` 只在站点根目录生效。部署在 `user.github.io/blog/` 时它会落在 `/blog/robots.txt`，搜索引擎不会读取。如果在意这点，用自定义域名或 Cloudflare Pages 部署到根路径。sitemap 不受影响，因为它的地址写在页面的 `<link>` 里。

### 本地验证子路径部署

```bash
BASE_PATH=blog SITE_URL=https://user.github.io npm run build
npm run preview
```

Windows 的 Git Bash 会把以 `/` 开头的值当成路径改写（`/blog` 会变成 `C:/Program Files/Git/blog`），所以这里写不带斜杠的 `blog`。配置代码会自动补全成 `/blog/`。

### 部署到其他平台

产物在 `dist/`，任何静态托管都能用：Vercel、Netlify、Nginx、对象存储 + CDN。只需要保证：

- 构建命令 `npm run build`，输出目录 `dist`
- 404 页面指向 `404.html`
- 如果部署在子路径，构建时设置 `BASE_PATH`

## 隐私与 fork 须知

### 仓库公开时，这些都会被看到

- 全部文章、动态、友链的源文件，**包括已经删掉但仍留在 Git 历史里的版本**
- `src/site.config.ts` 的站点信息、`public/admin/config.yml` 里的 GitHub 仓库名
- **每次提交的作者邮箱**（最容易被忽略的一项）
- 后台的 `repoId` / `categoryId` 是公开信息，不算敏感；OAuth 的 client secret 只存在 Cloudflare Worker 的密钥里，不在仓库

提交邮箱不想暴露的话：GitHub → Settings → Emails 勾选 **Keep my email addresses private**，本地把 `git config user.email` 设成 `<ID>+<用户名>@users.noreply.github.com`。注意这只影响之后的提交，历史里的旧邮箱依然可见——真要清掉得重写历史（`git filter-repo`），会改变所有提交 SHA。

### 把仓库改成私有会怎样

| 能力 | 私有之后 |
| --- | --- |
| Cloudflare Pages | ✅ 照常构建，**站点本身仍然公开** |
| GitHub Pages | ❌ Free 计划不支持从私有仓库发布（需 Pro / Team / Enterprise），而且即便发出来站点也是公开的 |
| Giscus 评论 | ❌ 失效。它要求仓库公开，匿名访客才读得到 Discussions |
| 网页后台 | ✅ 令牌或 OAuth 有仓库权限就能用 |
| Actions 分钟数 | ⚠️ 私有仓库计费（免费 2000 分钟/月），公开仓库不限量 |
| 别人 fork | ❌ 私有仓库不能被公开 fork |

所以「源码私有 + 站点公开」只有 **Cloudflare Pages** 这条路能完整成立；选它的话评论要另想办法（关掉，或换自建评论）。已经发布出去的网址不会因为仓库转私有而消失，搜索引擎里的快照也一样。

### 别人 fork 会怎样

- **文章不会被带走**：内容在私有仓库，本仓库里只有 `.gitkeep`，fork 出来是空壳。别人要看得自己写
- **不会自动同步**：你之后写的文章不会出现在别人的 fork 里，除非对方点 Sync fork；对方改的内容也不会回到你这里，除非开 PR
- fork 之后要改的地方：`src/site.config.ts` 的 url/base/标题、`public/admin/config.yml` 的 `repo`、`src/content/pages/about.md`，再加一份自己的内容仓库（见上一节）
- **两个容易踩的坑**：
  - `config.yml` 里的 `repoId` / `categoryId` 指向本仓库，不改的话别人站点的评论会全部写进这里
  - `base_url` 指向本项目的 OAuth Worker，而它只放行本站域名；fork 后后台登录会被 403，需要自己部署一份 `workers/cms-auth`
- 想要干净的副本、不带本仓库历史，用 **Use this template** 比 Fork 更合适

## 目录结构

```
.
├── .github/workflows/       # CI 与部署工作流
├── design/                  # 设计源图（不进站点）：brand-icon.png、avatar.png
├── public/                  # 原样复制到产物根目录的静态文件
│   ├── admin/config.yml     # ★ 网页后台配置：改里面的 repo 即可启用
│   ├── uploads/             # 后台上传的图片
│   ├── brand-icon.png       # 图标源文件：猫耳少女，圆角方形
│   ├── avatar.png           # 作者头像：同角色的圆形裁切
│   ├── favicon.png          # 32×32 浏览器标签页图标
│   ├── og/                  # 每篇文章的分享图，构建时生成，不进版本库
│   ├── icon-192.png         # Android 桌面图标（npm run og 生成）
│   ├── icon-512.png
│   ├── site.webmanifest     # 安装到桌面的清单，图标与主题色在这里声明
│   ├── og-default.png       # 默认分享图（由 npm run og 生成）
│   ├── og-default.svg       # 分享图的可编辑源文件
│   ├── _headers             # Cloudflare Pages 缓存策略
│   └── .nojekyll            # 让 GitHub Pages 不要用 Jekyll 处理
├── scripts/
│   ├── setup.mjs            # npm run setup，交互式初始化
│   ├── generate-og.mjs      # 默认分享图与 PNG 图标
│   ├── post-og.mjs          # 每篇文章的分享图（构建时自动执行）
│   └── fetch-content.mjs    # 构建前拉取私有内容仓库
├── workers/
│   └── cms-auth/            # 可选：后台 GitHub OAuth 代理（Cloudflare Worker）
├── src/
│   ├── site.config.ts       # ★ 站点集中配置，绝大多数改动只需要动这个文件
│   ├── content.config.ts    # 各内容集合的字段定义与校验
│   ├── assets/              # 会被优化的图片（手写文章的封面放这里）
│   │   └── fonts/           # 自托管的 Nunito 字体
│   ├── content/
│   │   ├── posts/           # 文章，.md 或 .mdx
│   │   ├── notes/           # 动态（说说）
│   │   ├── friends/         # 友情链接，每个站点一个文件
│   │   └── pages/about.md   # 「关于」页的正文
│   ├── components/          # 组件
│   ├── layouts/             # 页面骨架与文章骨架
│   ├── lib/                 # 日期格式化、内容查询、链接处理
│   ├── pages/               # 路由，文件路径即网址
│   │   └── admin/           # 网页后台入口
│   └── styles/global.css    # 设计令牌与文章排版
├── docs/                    # README 用的预览截图，可以删
├── astro.config.ts
├── LICENSE
└── package.json
```

## 设计说明

### 为什么是这一套

- **静态 HTML 与按需加载**，搜索索引和在线评论在需要时加载，构建产物可直接交给 CDN
- **零框架运行时**，页面就是 HTML 加 CSS；深色模式、目录高亮、代码复制各自几十行，且都能单独关掉
- **阅读进度条与移动端菜单不用 JavaScript** —— 前者是 CSS 滚动驱动动画，后者是原生 `<details>`
- **排版为中文调过**：17px 字号、1.8 行高、一行约 37 个汉字，阅读时长按中英文分别计速
- **配色通过无障碍对比度校验**，各色实测值就写在 CSS 注释里
- **写作方式有三种**：网页后台、命令行、直接改文件，随便选

### 特性

| 能力 | 实现方式 |
| --- | --- |
| Markdown / MDX 写作 | Astro 内容集合 + Zod 校验 frontmatter，字段写错构建时就报错 |
| 动态（说说） | 独立内容集合，时间线展示，适合放短想法 |
| 友链 / 留言板 | 友链是内容集合，可在后台增删改；留言板复用评论区 |
| 选项卡 / 终端窗口 | MDX 组件，选项卡支持键盘操作，无 JS 时优雅降级 |
| 分类 / 标签 / 归档 | 构建时统计生成；标签横跨文章与动态 |
| 全文搜索 | Pagefind，构建时生成分块索引，支持中文分词 |
| 网页后台 | 自带的轻量页面（约 40KB），写作、传图、四个集合，无需数据库与任何外部服务 |
| 命令行 | 新建文章、通过 GitHub API 直接发布 |
| RSS / SEO | 文章 `/rss.xml`、动态 `/notes/rss.xml`、canonical、Open Graph、JSON-LD（含面包屑与站内搜索入口）、sitemap、robots.txt |
| 站点图标 | 一个 SVG 源派生 favicon、Apple Touch Icon、Android 192/512 与 web manifest，地址栏颜色跟随主题 |
| 深色模式 | class 策略 + 内联脚本，首屏无闪白 |
| 代码高亮 | Shiki 双主题，跟随深浅色切换，带语言标签与复制按钮 |
| 文章目录 | 桌面端浮动固定，移动端折叠，滚动自动高亮 |
| 评论 | Giscus（GitHub Discussions），滚动到可视区才加载，出错自动降级到 GitHub 入口 |
| 阅读进度条 | CSS 滚动驱动动画，零 JavaScript |
| 封面图 | 列表页缩略图 + 详情页大图，自动生成多尺寸 WebP |
| 分享图 | 默认图 1200×630；每篇文章再按标题生成自己的分享图，改标题即自动重画 |
| 响应式 | 320px 到 1920px 实测无横向溢出 |

### 技术栈

- **[Astro 7](https://astro.build)** —— 静态站点生成，默认不向浏览器发送框架代码
- **[Tailwind CSS 4](https://tailwindcss.com)** —— CSS-first 配置，语义化颜色令牌
- **[Pagefind](https://pagefind.app)** —— 构建时生成的静态搜索索引
- **[Shiki](https://shiki.style)** —— 与 VS Code 同源的语法高亮
- **[Giscus](https://giscus.app)** —— 基于 GitHub Discussions 的评论

有意没有引入的东西：`@tailwindcss/typography`（文章排版是针对中文手写的）、任何 remark / rehype 插件（Astro 7 内置的 Sätteri 处理器已提供 GFM、智能标点和标题锚点）、任何前端框架。

## 常见问题与说明

### 后台在旧 iPad / 老 Android 上打不开

后台是一个自包含页面，只用 ES5 语法与 XMLHttpRequest，不依赖 fetch / Promise / 箭头函数 / 正则 lookbehind，
也没有任何第三方脚本。iOS 12、Android 5、微信内置浏览器都能打开。
真遇到打不开的情况，可以改用 [github.dev](https://github.dev/fa1nes/blog-content) 直接编辑文件。

**搜索没有结果？**
索引在构建时生成。本地开发前先跑一次 `npm run build`。部署后如果搜索报错，检查 `dist/pagefind/` 是否被正确上传。

**深色模式切换时闪白？**
主题初始化脚本必须是内联且阻塞的，它在 `src/components/BaseHead.astro` 末尾。不要把它改成外部脚本或加 `defer`。

**改了文章但页面没更新？**
`npm run dev` 支持热更新。如果卡住，删掉 `.astro/` 目录再启动。

**分类页的网址是一串百分号编码？**
这是中文路径的正常编码，浏览器地址栏会显示成中文，可以正常访问和分享。如果想要英文网址，把 `category` 和 `tags` 改成英文即可。

**想加访问统计？**
优先选择不需要在页面里插脚本的方案（Cloudflare Web Analytics、服务端日志分析）。如果一定要插脚本，加在 `src/layouts/BaseLayout.astro` 的 `</body>` 前，并注意它会影响性能预算。

**想改文章正文的排版？**
所有 `.prose` 开头的规则都在 `src/styles/global.css` 里，按元素分组，可以直接改。

**后台保存后网站没变？**
后台是把改动提交到 Git 仓库，需要等 CI 构建完成，通常一到两分钟。可以到仓库的 Actions 页面看进度。

**能不要那个绿色吗？**
改 `src/styles/global.css` 里的 `--accent` 系列即可。注意区分 `--accent`（文字用，需要 4.5:1 对比度）和 `--accent-vivid`（图形用），详见「换配色」一节。

## 站点身份与发布验收

站名为「fa1nes 的博客」，作者与社交入口对应 [fa1nes](https://github.com/fa1nes)。未公开的邮箱及 X 账号保持为空，不生成虚构联系方式。

标识是一位**猫耳少女**：薄荷绿短发、琥珀色眼睛，和站内的墨绿/暖白配色同源。头像与图标由 AI 生成后统一裁切去水印，圆形用于头像、圆角方形用于图标。

- `public/avatar.png`：圆形头像，用在首页、关于页和默认分享图。
- `public/brand-icon.png`：圆角方形图标源文件，所有尺寸的 favicon 与主屏幕图标都从它派生。
- `public/favicon.png`：32×32 的浏览器标签页图标。
- 页头字标「fa1nes」末尾的句点用 `--brand-amber`，让琥珀色落在文字旁边。

`brand-icon.png` 是唯一图标源，`npm run og` 从它派生出全部 PNG 图标、默认分享图与各篇文章的分享图，不重复维护路径。`site.webmanifest` 声明同一套图标，Android 加到桌面时不会退回默认图标；`seo.themeColor` 与 `global.css` 的 `--paper` 必须一致，手动切换主题时页脚本会再同步一次。

`npm run build` 包含产物验收：逐页检查 canonical、作者、站名、分享图与本地资源，核对 PNG 图标及默认 OG 图尺寸，再验证 sitemap 覆盖公开页面并排除后台、搜索与 404，同时检查 CMS 固定版本、配置 schema 版本及完整性校验格式。任一项失败会阻止发布。

部署后可检查首页源代码中的 canonical、OG 和图标链接，访问 `/blog/sitemap-index.xml` 与其子地图。验收用的临时文章与动态在流程结束后已删除，历史留在 Git 提交里，需要时可以从历次提交取回。`docs/preview-*.png` 是历史界面说明图，线上页面不引用。评论由 Giscus 承接，数据落在仓库的 Discussions；统计走 vercount，都可在 `site.config.ts` 里关掉或换服务。

## 致谢

- 视觉风格参考了 [NIE-Higan-Blog](https://github.com/3257085208/NIE-Higan-Blog) 的清爽配色思路（代码为本项目独立实现）
- 拉丁字体是 [Nunito](https://fonts.google.com/specimen/Nunito)，采用 SIL Open Font License 1.1
- 搜索、评论分别由 [Pagefind](https://pagefind.app)、[Giscus](https://giscus.app) 提供；后台是本项目自己的一个页面

## 许可证

代码采用 [MIT](LICENSE) 授权，版权所有者为 fa1nes；使用、修改与再分发时请保留许可证。

字体文件单独采用 SIL Open Font License 1.1（见 `src/assets/fonts/OFL.txt`）。

站内文章采用页脚声明的 CC BY-NC-SA 4.0 协议分享，站点图标与分享图由仓库维护。历史排版演示用于记录组件效果；具体内容以各篇文章为准。
