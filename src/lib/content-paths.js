import { slug as githubSlug } from 'github-slugger';

/** 网址别名按路径段校验，保留中文和嵌套路径，禁止改变 URL 结构的字符。 */
export function isSafePostSlug(/** @type {string} */ value) {
  if (!value || /[\\?#%\u0000-\u001f\u007f]/u.test(value)) return false;
  if (value.split('/').some((segment) =>
    !segment || segment === '.' || segment === '..' ||
    /[<>:"|*]/u.test(segment) || /[. ]$/u.test(segment) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/iu.test(segment)
  )) {
    return false;
  }
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

/** 与 Astro 默认的文件名转 slug 规则一致，内部内容 ID 不再受自定义 slug 影响。 */
export function getPostSlug(/** @type {string} */ id, /** @type {string | undefined} */ customSlug) {
  const value = customSlug?.trim() || id.replace(/\.(md|mdx)$/i, '')
    .split('/').map((segment) => githubSlug(segment)).join('/').replace(/\/index$/, '');
  if (!isSafePostSlug(value)) {
    throw new Error(`文章 ${id} 的网址别名无效：请使用非空路径段，避免 .、..、?、#、%、反斜线或控制字符。`);
  }
  // page/<正整数> 由文章列表的分页路由使用。
  if (/^page\/[1-9]\d*$/.test(value)) {
    throw new Error(`文章 ${id} 的网址别名 ${value} 与文章列表分页路径冲突，请更换别名。`);
  }
  return value;
}

/** 同时检查自定义别名、默认文件名，以及 .md / .mdx 之间的公开路径冲突。 */
export function assertUniquePostSlugs(
  /** @type {{ id: string, data: { slug?: string } }[]} */ posts,
) {
  /** @type {Map<string, string>} */
  const paths = new Map();
  for (const post of posts) {
    const slug = getPostSlug(post.id, post.data.slug);
    const key = slug.toLowerCase();
    const previous = paths.get(key);
    if (previous !== undefined) {
      throw new Error(`文章网址冲突：${previous} 与 ${post.id} 都使用 /posts/${slug}/，请修改文件名或 slug。`);
    }
    paths.set(key, post.id);
  }
}

/** 每条动态拥有稳定且唯一的锚点，文件名相同的嵌套动态也不会相互覆盖。 */
export function noteAnchor(/** @type {string} */ id) {
  return `note-${encodeURIComponent(id)}`;
}
