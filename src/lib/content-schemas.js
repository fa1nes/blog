import { z } from 'astro/zod';
import { isSafePostSlug } from './content-paths.js';

// CMS 会将未填写的可选日期保存为空字符串，YAML 的空值也应表示未填写。
const optionalDate = z.preprocess(
  (value) => value == null || (typeof value === 'string' && value.trim() === '') ? undefined : value,
  z.coerce.date().optional(),
);

/** 构建与发布共用 frontmatter 规则，避免发布通过后才发现字段类型不符。 */
export const postSchema = z.object({
  /** 文章标题 */
  title: z.string(),
  /** 摘要：用于列表、SEO 与 RSS。留空时自动截取正文 */
  description: z.string().optional(),
  /** 发布日期，支持 2026-01-20 或 2026-01-20 10:30 */
  pubDate: z.coerce.date(),
  updatedDate: optionalDate,
  category: z.string().default('未分类'),
  tags: z.array(z.string()).default([]),
  /** 自定义链接名，留空则使用文件名 */
  slug: z.string().trim().refine(
    (value) => value === '' || isSafePostSlug(value),
    '网址别名不能含空路径段、.、..、?、#、%、反斜线或控制字符',
  ).optional(),
  /** 发布文件中的封面为字符串路径，构建时另接入 Astro 的图片元数据。 */
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  draft: z.boolean().default(false),
  pinned: z.boolean().default(false),
  toc: z.boolean().default(true),
  comments: z.boolean().default(true),
});

/**
 * 相对路径图片交给 Astro 处理；public 路径或外链仍保留字符串。
 * @param {import('astro:content').SchemaContext['image']} image
 */
export function createPostSchema(image) {
  return postSchema.extend({
    cover: z.union([image(), postSchema.shape.cover.unwrap()]).optional(),
  });
}

export const pageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  updatedDate: optionalDate,
});

export const noteSchema = z.object({
  /** 发布时间，精确到分钟更自然：2026-07-26 14:30 */
  pubDate: z.coerce.date(),
  mood: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

export const friendSchema = z.object({
  name: z.string(),
  /** 只允许可直接访问的 HTTP / HTTPS 站点地址。 */
  href: z.url({ protocol: /^https?$/i }),
  description: z.string().optional(),
  avatar: z.string().optional(),
  order: z.number().default(0),
});
