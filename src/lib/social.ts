import { getCollection } from 'astro:content';
import { visibleSocial, type IconName, type SocialLink } from '~/site.config';

/**
 * 页面上要渲染的社交入口。
 *
 * 优先读内容仓库里的 src/content/social/*.md —— 后台改的就是这些文件；
 * 目录为空时回退到 site.config.ts 里的默认列表，方便刚 fork 下来还没建目录的情况。
 */
export async function getSocialLinks(): Promise<SocialLink[]> {
  // 注意：不能先按 enabled 过滤再判断「目录是否为空」——
  // 全部关掉时会误判为空、回退到默认列表，把已经关掉的入口又放出来。
  const all = await getCollection('social');
  if (all.length === 0) return visibleSocial;

  return all
    .filter((entry) => entry.data.enabled !== false)
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
    .map((entry) => ({
      label: entry.data.label,
      href: entry.data.href,
      icon: entry.data.icon as IconName,
    }));
}
