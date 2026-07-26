import { comments } from '~/site.config';

const filled = (value?: string) => Boolean(value && value.trim());

// repoId 与 categoryId 必须去 giscus.app 取，没有默认值；
// 少填任何一个 Giscus 都会静默加载失败，所以在这里先挡住
export const commentsReady =
  comments.enabled &&
  filled(comments.giscus.repo) &&
  filled(comments.giscus.repoId) &&
  filled(comments.giscus.categoryId);

/** 开关打开了但配置没填全，用来给出明确提示而不是静默失败 */
export const commentsIncomplete = comments.enabled && !commentsReady;
