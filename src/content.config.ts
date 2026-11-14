import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { createPostSchema, pageSchema, noteSchema, friendSchema } from './lib/content-schemas.js';

/**
 * 内容文件名的统一规则：以下划线或点号开头的文件不参与构建。
 *
 * 下划线留给草稿片段；点号是给编辑器和脚本用的临时文件留的位置
 * （例如发布脚本、同步工具写出的 .xxx.md）。只写 [^_] 不够：
 * 那个字符类同样会匹配点号，一个残留的临时文件就会让构建因
 * frontmatter 校验失败而中断，所以两个前缀都要排除。
 */
const CONTENT_PATTERN = '**/[^_.]*.{md,mdx}';

/**
 * 文章集合。
 * Markdown / MDX 文件放在 src/content/posts/ 下。
 */
const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: CONTENT_PATTERN,
    // 使用文件路径作为内部 ID，避免重复 slug 在校验前就覆盖另一篇文章。
    generateId: ({ entry }) => entry,
  }),
  schema: ({ image }) => createPostSchema(image),
});

/**
 * 独立页面集合，目前用于「关于」页，
 * 让这类长文本可以用 Markdown 书写而不必改组件。
 */
const pages = defineCollection({
  loader: glob({
    base: './src/content/pages',
    pattern: CONTENT_PATTERN,
  }),
  schema: pageSchema,
});

/**
 * 动态（说说）。适合放一两句话的短内容，
 * 不进文章列表，也不单独生成页面，只在 /notes/ 时间线里展示。
 */
const notes = defineCollection({
  loader: glob({
    base: './src/content/notes',
    pattern: CONTENT_PATTERN,
  }),
  schema: noteSchema,
});

/**
 * 友情链接。每个站点一个文件，这样网页后台可以直接增删改，
 * 不用去动 TypeScript 配置。
 */
const friends = defineCollection({
  loader: glob({
    base: './src/content/friends',
    pattern: CONTENT_PATTERN,
  }),
  schema: friendSchema,
});

export const collections = { posts, pages, notes, friends };
