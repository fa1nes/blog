import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 文章集合。
 * Markdown / MDX 文件放在 src/content/posts/ 下，
 * 以下划线开头的文件会被忽略，方便存放草稿片段。
 */
const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/[^_]*.{md,mdx}',
  }),
  schema: ({ image }) =>
    z.object({
      /** 文章标题 */
      title: z.string(),
      /** 摘要：用于列表、SEO 与 RSS。留空时自动截取正文 */
      description: z.string().optional(),
      /** 发布日期，支持 2026-01-20 或 2026-01-20 10:30 */
      pubDate: z.coerce.date(),
      /** 更新日期 */
      updatedDate: z.coerce.date().optional(),
      /** 分类，一篇文章只属于一个分类 */
      category: z.string().default('未分类'),
      /** 标签，可以有多个 */
      tags: z.array(z.string()).default([]),
      /** 自定义链接名，留空则使用文件名 */
      slug: z.string().optional(),
      /**
       * 封面图，支持两种写法：
       *  - 相对路径（如 ../../assets/cover.jpg）：Astro 会压缩并生成 WebP，推荐
       *  - 绝对路径（如 /uploads/cover.jpg）：指向 public 目录，后台上传的图片走这条
       */
      cover: z.union([image(), z.string()]).optional(),
      coverAlt: z.string().optional(),
      /** 草稿：开发时可见，生产构建时排除 */
      draft: z.boolean().default(false),
      /** 置顶，会排在列表最前面 */
      pinned: z.boolean().default(false),
      /** 单篇关闭目录 */
      toc: z.boolean().default(true),
      /** 单篇关闭评论 */
      comments: z.boolean().default(true),
    }),
});

/**
 * 独立页面集合，目前用于「关于」页，
 * 让这类长文本可以用 Markdown 书写而不必改组件。
 */
const pages = defineCollection({
  loader: glob({
    base: './src/content/pages',
    pattern: '**/[^_]*.{md,mdx}',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    updatedDate: z.coerce.date().optional(),
  }),
});

/**
 * 动态（说说）。适合放一两句话的短内容，
 * 不进文章列表，也不单独生成页面，只在 /notes/ 时间线里展示。
 */
const notes = defineCollection({
  loader: glob({
    base: './src/content/notes',
    pattern: '**/[^_]*.{md,mdx}',
  }),
  schema: z.object({
    /** 发布时间，精确到分钟更自然：2026-07-26 14:30 */
    pubDate: z.coerce.date(),
    /** 可选的心情或话题标记 */
    mood: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/**
 * 友情链接。每个站点一个文件，这样网页后台可以直接增删改，
 * 不用去动 TypeScript 配置。
 */
const friends = defineCollection({
  loader: glob({
    base: './src/content/friends',
    pattern: '**/[^_]*.{md,mdx}',
  }),
  schema: z.object({
    /** 站点名 */
    name: z.string(),
    /** 站点地址。Zod 4 里 URL 校验是顶层的 z.url()，链式的 .url() 已废弃 */
    href: z.url(),
    /** 一句话描述 */
    description: z.string().optional(),
    /** 头像，完整外链或 /uploads/xxx 这样的站内路径，留空则用站名首字 */
    avatar: z.string().optional(),
    /** 排序权重，数字小的排前面 */
    order: z.number().default(0),
  }),
});

export const collections = { posts, pages, notes, friends };
