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
  /**
   * 是否显示。设为 false 只是隐藏，不删配置，
   * 想临时收起某个入口时不用把链接删掉再粘回来。
   */
  enabled?: boolean;
}

/* ------------------------------------------------------------------
 * 1. 站点基本信息
 * ------------------------------------------------------------------ */

export const site = {
  /**
   * 站点完整地址，用于生成 RSS、sitemap、SEO 的绝对链接。
   * 当前发布到 fa1nes.github.io/blog/，主机名与子路径分别维护。
   * 部署环境可通过 SITE_URL 覆盖主机名。
   */
  url: 'https://fa1nes.github.io',

  /**
   * 部署到子路径时使用，例如 GitHub Pages 的 https://user.github.io/blog/
   * 需要写成 '/blog'。部署在根目录则保持 '/'。
   * GitHub Actions 中会用环境变量 BASE_PATH 自动覆盖。
   */
  base: '/blog',

  /** 站点标题 */
  title: 'fa1nes 的博客',
  /** 出现在页头的短标题 */
  shortTitle: 'fa1nes',
  /** 站点副标题，展示在首页 */
  subtitle: '技术实践、工具折腾与日常记录',
  /** 站点描述，用于 SEO 与 RSS */
  description:
    'fa1nes 的个人博客，记录技术实践、开发工具、问题排查与日常思考，分享可复现的解决过程和持续更新的笔记。',

  /** 语言标签，影响 <html lang> 与 RSS */
  lang: 'zh-CN',
  /** Open Graph 语言标记 */
  locale: 'zh_CN',
  /** 时区，用于日期格式化 */
  timeZone: 'Asia/Taipei',
} as const;

/* ------------------------------------------------------------------
 * 2. 作者信息
 * ------------------------------------------------------------------ */

export const author = {
  name: 'fa1nes',
  /** 首页展示的一句话简介 */
  bio: '把问题的排查过程和解决办法写下来。',
  /** 头像，放在 public/ 目录下，或使用完整外链 */
  // 页面展示用的是 160px 的 WebP（约 9KB）；原图 public/avatar.png 只作 og 与派生源，
  // 换头像时替换 avatar.png 再跑一次 npm run og。
  avatar: '/avatar.webp',
  /** 个人主页，留空则不生成链接（不想暴露 GitHub 账号就留空） */
  url: '',
  /** 邮箱，用于 SEO 结构化数据（可留空） */
  email: '',
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

/**
 * 社交链接。每一项都有开关：
 *   - 想加一个入口：把下面注释掉的某行取消注释，改 href
 *   - 想暂时隐藏：加 `enabled: false`，链接留着但页面不显示
 * 页脚、首页、关于页都读这里，改一处三处同时生效。
 */
export const social: SocialLink[] = [
  // 默认留空。想显示社交入口，在网页后台「链接」里新建一条即可
  // （文件落在内容仓库的 src/content/social/，不进这个公开仓库）。
  //
  // 如果内容仓库里没有这个目录，才会回退到这里，格式：
  // { label: 'GitHub', href: 'https://github.com/you', icon: 'github', enabled: true },
];

/** 页面上实际渲染的社交入口（过滤掉 enabled: false 的） */
export const visibleSocial: SocialLink[] = social.filter((item) => item.enabled !== false);

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
 *  2026-11 已接通：仓库 Discussions 已开启，repoId 与 Announcements 分类 ID
 *  取自 GitHub GraphQL API。换仓库时按同样三步重取：
 *   1. 仓库设为 public，安装 giscus app：https://github.com/apps/giscus
 *   2. Settings → General → Features 勾选 Discussions，至少保留一个分类
 *   3. GraphQL 查 repository.id 与 discussionCategories 里的分类 id
 * ------------------------------------------------------------------ */

export const comments = {
  /** 总开关：false 时文章页和留言板都不渲染评论区 */
  enabled: true,
  provider: 'giscus',
  giscus: {
    repo: 'fa1nes/blog',
    repoId: 'R_kgDOTj_RAg',
    category: 'Announcements',
    categoryId: 'DIC_kwDOTj_RAs4DLHTN',
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
  startYear: 2026,
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
  twitterSite: '',
  /**
   * 移动端浏览器地址栏的颜色。
   * 必须与 src/styles/global.css 里的 --paper 保持一致，
   * 否则地址栏和页面之间会出现一条明显的色差带。
   */
  themeColor: { light: '#ffffff', dark: '#1a202c' },
  /** 是否输出 sitemap 与 robots.txt */
  sitemap: true,
} as const;

/* ------------------------------------------------------------------
 * 9. 访客统计
 *
 *  默认用 vercount（不蒜子的继任服务）：免注册、只数访问量与访客数，
 *  代价是那个脚本能看到访客 IP。想更可控可以换成下面两个：
 *   - cloudflare：Cloudflare Web Analytics，免费、无 cookie，
 *     在 Cloudflare 面板添加站点后拿 beacon token 填进来
 *   - goatcounter：GoatCounter，开源、可自建，填站点代码即可
 *  都不想要就把 provider 设成 'none'，页面不会再加载任何统计脚本。
 * ------------------------------------------------------------------ */

export const analytics = {
  provider: 'vercount' as 'vercount' | 'cloudflare' | 'goatcounter' | 'none',
  /** Cloudflare Web Analytics 的 beacon token */
  cloudflareToken: '',
  /** GoatCounter 站点代码，例如 fa1nes（对应 fa1nes.goatcounter.com） */
  goatcounterCode: '',
  /** 页脚是否显示「访客 / 浏览」计数（仅 vercount 提供） */
  showCounters: true,
} as const;
