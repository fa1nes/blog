import { comments } from '~/site.config';

const filled = (value?: string) => Boolean(value && value.trim());

// owner 只允许 GitHub 用户名字符；仓库名允许点，但必须排除路径跳转片段。
const configuredRepository = comments.giscus.repo.trim();
const repositoryPattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[a-z\d._-]{1,100}$/i;
const repositoryName = configuredRepository.split('/')[1];
export const commentsRepository =
  repositoryPattern.test(configuredRepository) && repositoryName !== '.' && repositoryName !== '..'
    ? configuredRepository
    : undefined;

// repoId 与 categoryId 必须取自 Giscus，配置不完整时保留 GitHub Issues 反馈入口。
export const commentsReady =
  comments.enabled &&
  Boolean(commentsRepository) &&
  filled(comments.giscus.repoId) &&
  filled(comments.giscus.categoryId);
