import { TextDecoder } from 'node:util';
import { extractFrontmatter, parseFrontmatter } from 'astro/markdown';
import { postSchema, pageSchema, noteSchema, friendSchema } from '../src/lib/content-schemas.js';
import { assertUniquePostSlugs } from '../src/lib/content-paths.js';

const MAX_FRONTMATTER_BYTES = 128 * 1024;
const schemas = new Map([
  ['posts', postSchema],
  ['pages', pageSchema],
  ['notes', noteSchema],
  ['friends', friendSchema],
]);

/** 只解析已安全读取的文件快照，不执行 Markdown、MDX 或项目配置。 */
export function validatePublishSchemas(files) {
  const posts = [];
  for (const { repoPath, content } of files) {
    if (!/^src\/content\//i.test(repoPath) || !/\.(md|mdx)$/i.test(repoPath)) continue;
    const match = /^src\/content\/([^/]+)\/(.+\.(?:md|mdx))$/.exec(repoPath);
    const schema = match && schemas.get(match[1]);
    if (!match || !schema) {
      throw new Error(`schema 校验失败：${repoPath} 不属于可发布的 Markdown 内容集合。`);
    }
    // 与集合 glob 的 [^_]* 文件名规则一致，片段不会作为文章解析。
    if (match[2].split('/').at(-1).startsWith('_')) continue;

    let data;
    try {
      const source = new TextDecoder('utf-8', { fatal: true }).decode(content);
      const raw = extractFrontmatter(source);
      if (raw === undefined) throw new Error('缺少或未闭合 frontmatter');
      if (Buffer.byteLength(raw, 'utf8') > MAX_FRONTMATTER_BYTES) {
        throw new Error('frontmatter 超过 128 KiB，请将正文移到元信息区之后');
      }
      const { frontmatter } = parseFrontmatter(source, { frontmatter: 'preserve' });
      if (frontmatter === null || Array.isArray(frontmatter) || typeof frontmatter !== 'object') {
        throw new Error('frontmatter 必须是字段映射');
      }
      const result = schema.safeParse(frontmatter);
      if (!result.success) {
        const details = result.error.issues.slice(0, 8).map((issue) =>
          `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
        ).join('；');
        throw new Error(details);
      }
      data = result.data;
    } catch (error) {
      throw new Error(`schema 校验失败：${repoPath}：${error.message}`, { cause: error });
    }
    if (match[1] === 'posts') posts.push({ id: match[2], data });
  }
  try {
    assertUniquePostSlugs(posts);
  } catch (error) {
    throw new Error(`schema 校验失败：${error.message}`, { cause: error });
  }
}
