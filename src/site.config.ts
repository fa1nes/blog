/**
 * ============================================================
 *  站点集中配置
 *  修改博客的绝大部分内容，只需要改这一个文件。
 * ============================================================
 */

/** 可用的图标名称（在 src/components/Icon.astro 中实现） */
export type IconName =
  | 'github'
  | 'x'
  | 'weibo'
  | 'zhihu'
  | 'bilibili'
  | 'telegram'
  | 'juejin'
  | 'mail'
  | 'rss'
  | 'link';

export interface NavItem {
  /** 导航文字 */
  label: string;
  /** 站内路径，以 / 开头、以 / 结尾 */
  href: string;
}

export interface SocialLink {
  label: string;
  href: string;
  icon: IconName;
}

/* ------------------------------------------------------------------
 * 1. 站点基本信息
 * ------------------------------------------------------------------ */

export const site = {
  /**
   * 站点完整地址，用于生成 RSS、sitemap、SEO 的绝对链接。
   * 部署到 Cloudflare Pages / 自定义域名时改成你的域名。
   * 也可以在部署环境中用环境变量 SITE_URL 覆盖。
   */
  url: 'https://example.com',

  /**
   * 部署到子路径时使用，例如 GitHub Pages 的 https://user.github.io/blog/
   * 需要写成 '/blog'。部署在根目录则保持 '/'。
   * GitHub Actions 中会用环境变量 BASE_PATH 自动覆盖。
   */
  base: '/',

  /** 站点标题 */
  title: '砚台与代码',
  /** 出现在页头的短标题 */
  shortTitle: '砚台与代码',
  /** 站点副标题，展示在首页 */
  subtitle: '记录构建、阅读与思考的地方',
  /** 站点描述，用于 SEO 与 RSS */
  description:
    '一个关注 Web 性能、工程实践与技术阅读的个人博客，分享前端架构、开发工具与长期主义的思考。',

  /** 语言标签，影响 <html lang> 与 RSS */
  lang: 'zh-CN',
  /** Open Graph 语言标记 */
  locale: 'zh_CN',
  /** 时区，用于日期格式化 */
  timeZone: 'Asia/Shanghai',
} as const;

/* ------------------------------------------------------------------
 * 2. 作者信息
 * ------------------------------------------------------------------ */

export const author = {
  name: '张三',
  /** 首页展示的一句话简介 */
  bio: '前端工程师，喜欢把复杂的东西做简单。',
  /** 头像，放在 public/ 目录下，或使用完整外链 */
  avatar: '/avatar.svg',
  /** 个人主页，留空则不生成链接 */
  url: 'https://example.com',
  /** 邮箱，用于 SEO 结构化数据（可留空） */
  email: 'hello@example.com',
} as const;

/* ------------------------------------------------------------------
 * 3. 导航与社交链接
 * ------------------------------------------------------------------ */

export const nav: NavItem[] = [
  { label: '文章', href: '/posts/' },
  { label: '动态', href: '/notes/' },
  { label: '分类', href: '/categories/' },
  { label: '归档', href: '/archive/' },
  { label: '友链', href: '/friends/' },
  { label: '留言', href: '/guestbook/' },
  { label: '关于', href: '/about/' },
];

export const social: SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/yourname', icon: 'github' },
  { label: 'X', href: 'https://x.com/yourname', icon: 'x' },
  { label: '知乎', href: 'https://www.zhihu.com/people/yourname', icon: 'zhihu' },
  { label: '邮箱', href: 'mailto:hello@example.com', icon: 'mail' },
];

/* ------------------------------------------------------------------
 * 3.5 友情链接
 *  友链数据放在 src/content/friends/ 下，每个站点一个文件，
 *  这样网页后台可以直接增删改。这里只放页面顶部的说明文字。
 * ------------------------------------------------------------------ */

/** 友链页顶部的申请说明，留空则不显示 */
export const friendsNote =
  '想交换友链的话，先把本站加到你的友链页，然后到留言板留下站名、地址和一句话介绍。';

/* ------------------------------------------------------------------
 * 4. 功能开关
 * ------------------------------------------------------------------ */

export const features = {
  /** 全站搜索（基于 Pagefind，构建时生成索引） */
  search: true,
  /** 文章目录 */
  toc: true,
  /** 阅读时长估算 */
  readingTime: true,
  /** 代码块复制按钮 */
  codeCopy: true,
  /** 深色模式切换按钮（关闭后仅跟随系统） */
  themeToggle: true,
  /** 上一篇 / 下一篇导航 */
  postNav: true,
} as const;

/* ------------------------------------------------------------------
 * 5. 内容与分页
 * ------------------------------------------------------------------ */

export const content = {
  /** 文章列表每页数量 */
  postsPerPage: 10,
  /** 首页展示的最新文章数量 */
  homePostCount: 6,
  /** 首页展示的最新动态数量，设为 0 则不显示动态区块 */
  homeNoteCount: 3,
  /** RSS 输出的文章数量 */
  rssPostCount: 30,
  /** 中文阅读速度（字 / 分钟） */
  cjkPerMinute: 400,
  /** 英文阅读速度（词 / 分钟） */
  wordsPerMinute: 220,
  /** 目录中展示的标题层级 */
  tocDepth: { min: 2, max: 3 },
} as const;

/* ------------------------------------------------------------------
 * 6. 评论（Giscus，基于 GitHub Discussions，无需后端）
 *
 *  开启步骤：
 *   1. 仓库需要是 public，并安装 giscus app：https://github.com/apps/giscus
 *   2. 在仓库 Settings → General → Features 中勾选 Discussions
 *   3. 访问 https://giscus.app/zh-CN 填入仓库，拿到 repoId 与 categoryId
 *   4. 把下面的字段填好，并把 enabled 改成 true
 * ------------------------------------------------------------------ */

export const comments = {
  enabled: false,
  provider: 'giscus',
  giscus: {
    repo: 'fa1nes/blog',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    /** pathname | url | title | og:title */
    mapping: 'pathname',
    /** 是否启用反应表情 */
    reactionsEnabled: true,
    /** 评论区加载位置：top | bottom */
    inputPosition: 'top',
    /** 界面语言 */
    lang: 'zh-CN',
    /** 懒加载：滚动到评论区才加载 iframe */
    lazy: true,
  },
} as const;

/* ------------------------------------------------------------------
 * 7. 页脚
 * ------------------------------------------------------------------ */

export const footer = {
  /** 建站年份，用于生成 “2020 - 2026” 形式的版权区间 */
  startYear: 2024,
  /** 版权所有者，留空则使用作者名 */
  copyright: '',
  /** ICP 备案号（中国大陆站点适用，留空不显示） */
  icp: '',
  /** 备案链接 */
  icpUrl: 'https://beian.miit.gov.cn/',
  /** 页脚补充说明，支持留空 */
  note: '本站内容采用 CC BY-NC-SA 4.0 协议共享',
} as const;

/* ------------------------------------------------------------------
 * 8. SEO
 * ------------------------------------------------------------------ */

export const seo = {
  /**
   * 默认社交分享图，放在 public/ 下。
   * 必须是 PNG 或 JPG —— X、Facebook、微信抓取 og:image 时都不支持 SVG。
   * 改完上面的 title / subtitle 后执行 npm run og 可以重新生成这张图。
   */
  ogImage: '/og-default.png',
  /** X / Twitter 用户名，用于 twitter:creator（可留空） */
  twitterSite: '@yourname',
  /** 是否输出 sitemap 与 robots.txt */
  sitemap: true,
} as const;
