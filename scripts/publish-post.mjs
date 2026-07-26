/**
 * 通过 GitHub Contents API 直接把文件提交到仓库，提交后 CI 会自动构建并部署。
 * 适合在没有 git 环境的地方发布，比如手机上的自动化流程。
 *
 *   npm run publish src/content/posts/hello.md
 *   npm run publish src/content/posts/hello.md src/assets/cover.jpg
 *   npm run publish -- --branch dev src/content/posts/hello.md
 *
 * 需要的环境变量：
 *   GITHUB_TOKEN        有仓库写权限的令牌（必填）
 *   GITHUB_REPOSITORY   owner/repo 形式，省略时从 git remote 推断
 *   GITHUB_BRANCH       目标分支，默认 main，也可以用 --branch 覆盖
 */

import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 带排查建议的错误，交给最外层统一打印 */
class PublishError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

function parseArgs(argv) {
  const files = [];
  let branch = '';
  let message = '';

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--branch' || argv[i] === '-b') {
      branch = argv[++i] ?? '';
    } else if (argv[i] === '--message' || argv[i] === '-m') {
      message = argv[++i] ?? '';
    } else {
      files.push(argv[i]);
    }
  }

  return { files, branch, message };
}

/** 没给出仓库时，从 git remote 推断 owner/repo */
function detectRepository() {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
    return match ? `${match[1]}/${match[2]}` : '';
  } catch {
    return '';
  }
}

/** 把 GitHub 的响应翻译成能直接照做的提示 */
function describeFailure(status, body, { repository, branch }) {
  const detail = (() => {
    try {
      return JSON.parse(body).message ?? '';
    } catch {
      return body.slice(0, 200);
    }
  })();

  const hints = {
    401: '令牌无效或已过期，请重新生成 GITHUB_TOKEN。',
    403: `令牌没有 ${repository} 的写入权限，或者触发了接口频率限制。\n细粒度令牌需要勾选 Contents 的 Read and write 权限。`,
    404: `找不到仓库 ${repository} 或分支 ${branch}。\n确认仓库名拼写正确，且令牌对私有仓库有访问权限。`,
    409: '仓库上的文件在本次操作期间被改动过，请重新运行一次。',
    422: '请求被拒绝，通常是分支不存在或文件路径不合法。',
  };

  return new PublishError(
    `GitHub 返回 ${status}${detail ? `：${detail}` : ''}`,
    hints[status] ?? '可以带上 --branch 指定分支，或检查网络连接后重试。',
  );
}

async function main() {
  const { files, branch: branchArg, message } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    throw new PublishError(
      '没有指定要发布的文件。',
      '用法：npm run publish <文件路径> [更多文件…]',
    );
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new PublishError(
      '缺少环境变量 GITHUB_TOKEN。',
      '到 GitHub → Settings → Developer settings → Personal access tokens 创建一个\n' +
        '对当前仓库有 Contents 写权限的令牌，设置到环境变量后重试。',
    );
  }

  const repository = process.env.GITHUB_REPOSITORY || detectRepository();
  if (!repository.includes('/')) {
    throw new PublishError(
      '无法确定目标仓库。',
      '设置环境变量 GITHUB_REPOSITORY=owner/repo，或者为本项目配置 git 的 origin 远端。',
    );
  }

  const branch = branchArg || process.env.GITHUB_BRANCH || 'main';
  const api = `https://api.github.com/repos/${repository}/contents`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'astro-blog-publish-script',
  };

  /** 已存在的文件必须带上它的 sha 才能更新，所以先查一次 */
  async function fetchSha(repoPath) {
    const response = await fetch(`${api}/${encodeURI(repoPath)}?ref=${encodeURIComponent(branch)}`, {
      headers,
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw describeFailure(response.status, await response.text(), { repository, branch });
    }
    return (await response.json()).sha ?? null;
  }

  async function putFile(localPath) {
    const absolute = path.resolve(root, localPath);
    const repoPath = path.relative(root, absolute).split(path.sep).join('/');

    if (repoPath.startsWith('..')) {
      throw new PublishError(`${localPath} 不在项目目录内。`);
    }

    let buffer;
    try {
      buffer = await readFile(absolute);
    } catch {
      throw new PublishError(`读不到文件 ${localPath}。`, '确认路径拼写正确。');
    }

    const sha = await fetchSha(repoPath);
    const action = sha ? '更新' : '新增';

    const response = await fetch(`${api}/${encodeURI(repoPath)}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message || `内容：${action} ${repoPath}`,
        content: buffer.toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!response.ok) {
      throw describeFailure(response.status, await response.text(), { repository, branch });
    }

    console.log(`  ${action} ${repoPath}`);
  }

  console.log(`目标仓库 ${repository}（分支 ${branch}）`);
  for (const file of files) {
    await putFile(file);
  }
  console.log('\n提交完成，GitHub Actions 会自动构建并部署，通常一到两分钟后生效。');
}

// 不用 process.exit()：Windows 下如果还有未收尾的网络句柄，
// 强制退出会触发 libuv 的断言崩溃，盖住真正的错误信息。
try {
  await main();
} catch (error) {
  if (error instanceof PublishError) {
    console.error(`发布失败：${error.message}`);
    if (error.hint) console.error(error.hint);
  } else {
    console.error('发布失败：', error);
  }
  process.exitCode = 1;
}
