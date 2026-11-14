/**
 * 通过 GitHub Git Data API 把一批文件合并为一次提交，提交后 CI 会自动构建并部署。
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

import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { validatePublishSchemas } from './publish-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_FILES = 50;
const ALLOWED_PATH_PREFIXES = ['src/content/', 'src/assets/', 'public/uploads/'];
const BLOCKED_PATH_SEGMENTS = new Set(['.git', '.astro', 'dist', 'node_modules']);
const BLOCKED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'credentials.json',
  'secrets.json',
]);

function encodeRepositoryPath(repoPath) {
  return repoPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

async function fetchWithTimeout(url, options = {}) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new PublishError(
        '请求 GitHub 超时。',
        '检查网络连接后重试；网络较慢时可以稍后再次运行。',
      );
    }
    throw error;
  }
}

export async function resolvePublishPath(localPath, rootDir = root) {
  const absolute = path.resolve(rootDir, localPath);
  const repoPath = path.relative(rootDir, absolute).split(path.sep).join('/');
  const segments = repoPath.split('/');
  const fileName = segments.at(-1)?.toLowerCase() ?? '';
  const isAllowed = ALLOWED_PATH_PREFIXES.some((prefix) =>
    repoPath.toLowerCase().startsWith(prefix),
  );
  const containsBlockedSegment = segments.some((segment) =>
    BLOCKED_PATH_SEGMENTS.has(segment.toLowerCase()),
  );
  const isBlockedFile =
    BLOCKED_FILE_NAMES.has(fileName) ||
    /^\.env(?:\.|$)/i.test(fileName) ||
    /\.(?:key|pem|p12|pfx|sqlite|db)$/i.test(fileName);

  if (!repoPath || repoPath.startsWith('../') || path.isAbsolute(repoPath)) {
    throw new PublishError(`${localPath} 不在项目目录内。`);
  }
  if (!isAllowed || containsBlockedSegment || isBlockedFile) {
    throw new PublishError(
      `出于安全原因，不能发布 ${localPath}。`,
      '只允许发布 src/content、src/assets、public/uploads 下的文件，敏感文件和构建产物会被拒绝。',
    );
  }

  let fileInfo;
  let realRoot;
  let realAbsolute;
  try {
    [fileInfo, realRoot, realAbsolute] = await Promise.all([
      lstat(absolute),
      realpath(rootDir),
      realpath(absolute),
    ]);
  } catch {
    throw new PublishError(`读不到文件 ${localPath}。`, '确认路径拼写正确。');
  }

  if (fileInfo.isSymbolicLink()) {
    throw new PublishError(
      `出于安全原因，不能发布符号链接：${localPath}。`,
      '发布路径不能通过符号链接指向其他位置。',
    );
  }
  if (!fileInfo.isFile()) {
    throw new PublishError(`只能发布普通文件：${localPath}。`);
  }

  const realRepoPath = path.relative(realRoot, realAbsolute).split(path.sep).join('/');
  const normalizedRepoPath =
    process.platform === 'win32' ? realRepoPath.toLowerCase() : realRepoPath;
  const normalizedExpectedPath =
    process.platform === 'win32' ? repoPath.toLowerCase() : repoPath;
  const realSegments = realRepoPath.split('/');
  const realFileName = realSegments.at(-1)?.toLowerCase() ?? '';
  const realPathAllowed = ALLOWED_PATH_PREFIXES.some((prefix) =>
    normalizedRepoPath.startsWith(prefix),
  );
  const realPathBlocked =
    realRepoPath === '..' ||
    realRepoPath.startsWith('../') ||
    path.isAbsolute(realRepoPath) ||
    realSegments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment.toLowerCase())) ||
    BLOCKED_FILE_NAMES.has(realFileName) ||
    /^\.env(?:\.|$)/i.test(realFileName) ||
    /\.(?:key|pem|p12|pfx|sqlite|db)$/i.test(realFileName);

  if (realPathBlocked || !realPathAllowed || normalizedRepoPath !== normalizedExpectedPath) {
    throw new PublishError(
      `出于安全原因，不能发布 ${localPath}。`,
      '发布路径不能通过符号链接指向其他位置。',
    );
  }

  return { absolute: realAbsolute, repoPath };
}

/** 带排查建议的错误，交给最外层统一打印 */
class PublishError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

export function parseArgs(argv) {
  const files = [];
  let branch = '';
  let message = '';

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--branch' || argv[i] === '-b') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        throw new PublishError('--branch 缺少分支名称。');
      }
      branch = value;
    } else if (argv[i] === '--message' || argv[i] === '-m') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        throw new PublishError('--message 缺少提交信息。');
      }
      message = value;
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

export function validateRepository(repository) {
  const parts = repository.split('/');
  if (
    parts.length !== 2 ||
    parts.some(
      (part) =>
        !/^[A-Za-z0-9_.-]+$/.test(part) ||
        part === '.' ||
        part === '..',
    )
  ) {
    throw new PublishError(
      '无法确定目标仓库。',
      '设置 GITHUB_REPOSITORY=owner/repo，且仓库名称只能包含英文字母、数字、点、下划线和连字符。',
    );
  }

  return repository;
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
    409: '目标分支已变化，本次不会强制覆盖。请同步远端修改后重试。',
    422: '请求被拒绝。目标分支可能已有新提交或受分支保护，请同步远端并检查仓库规则后重试。',
  };

  const error = new PublishError(
    `GitHub 返回 ${status}${detail ? `：${detail}` : ''}`,
    hints[status] ?? '可以带上 --branch 指定分支，或检查网络连接后重试。',
  );
  error.status = status;
  return error;
}

/** 所有文件在首次远端写入前完成校验和读取，避免发布到一半才发现本地文件不可用。 */
export async function preparePublishFiles(localPaths, rootDir = root) {
  if (localPaths.length === 0 || localPaths.length > MAX_BATCH_FILES) {
    throw new PublishError(`一次需要指定 1 到 ${MAX_BATCH_FILES} 个文件。`);
  }

  const seen = new Set();
  const files = [];
  let totalBytes = 0;

  for (const localPath of localPaths) {
    const file = await resolvePublishPath(localPath, rootDir);
    // 一并拒绝大小写别名，避免 Windows 与 Linux 对同批路径的解释不同。
    const key = file.repoPath.toLowerCase();
    if (seen.has(key)) {
      throw new PublishError(`重复的发布路径：${file.repoPath}。`);
    }
    seen.add(key);

    let handle;
    try {
      handle = await open(file.absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const [info, namedInfo, currentPath] = await Promise.all([
        handle.stat(),
        lstat(file.absolute),
        realpath(file.absolute),
      ]);
      const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
      if (
        !info.isFile() ||
        namedInfo.isSymbolicLink() ||
        info.dev !== namedInfo.dev ||
        info.ino !== namedInfo.ino ||
        normalize(currentPath) !== normalize(file.absolute)
      ) {
        throw new PublishError(`发布路径在读取前发生变化：${file.repoPath}。`);
      }
      if (info.size > MAX_FILE_BYTES || totalBytes + info.size > MAX_BATCH_BYTES) {
        throw new PublishError(
          `发布文件过大：${file.repoPath}。`,
          '单个文件最多 20 MiB，一批文件合计最多 50 MiB；请压缩图片或拆分发布。',
        );
      }

      // 多留一个字节来发现读取期间的增长；不让并发写入突破内存上限。
      const buffer = Buffer.alloc(info.size + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      const after = await handle.stat();
      if (length !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs) {
        throw new PublishError(`文件在读取期间发生变化：${file.repoPath}。`, '请先保存文件，再重新发布。');
      }

      totalBytes += length;
      files.push({ repoPath: file.repoPath, content: buffer.subarray(0, length) });
    } catch (error) {
      if (error instanceof PublishError) throw error;
      throw new PublishError(`读不到文件 ${file.repoPath}。`, '确认文件存在、路径未被替换且具有读取权限。');
    } finally {
      await handle?.close();
    }
  }

  return files;
}

/** 使用同一父提交构造整批内容，最后只进行一次非强制分支更新。 */
export async function publishFilesAtomically(localPaths, {
  repository,
  token,
  branch = 'main',
  message = '',
  rootDir = root,
  request = fetchWithTimeout,
}) {
  validateRepository(repository);
  if (!branch || branch === '@' || /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) ||
      branch.startsWith('/') || branch.endsWith('/') || branch.endsWith('.') ||
      branch.includes('..') || branch.includes('@{') || branch.includes('//') ||
      branch.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock'))) {
    throw new PublishError('目标分支名称不合法。');
  }
  if (!token) {
    throw new PublishError(
      '缺少环境变量 GITHUB_TOKEN。',
      '令牌需要对目标仓库具有 Contents 的 Read and write 权限。',
    );
  }

  const files = await preparePublishFiles(localPaths, rootDir);
  validatePublishSchemas(files);
  const api = `https://api.github.com/repos/${repository}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'astro-blog-publish-script',
  };
  const refPath = encodeRepositoryPath(branch);

  async function requestJson(endpoint, method = 'GET', body) {
    const response = await request(`${api}${endpoint}`, {
      method,
      headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw describeFailure(response.status, await response.text(), { repository, branch });
    }
    return response.json();
  }

  function requireSha(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) {
      throw new PublishError('GitHub 返回了无效的提交或文件标识。');
    }
    return value;
  }

  function readRefSha(ref) {
    if (ref?.ref !== `refs/heads/${branch}` || ref.object?.type !== 'commit') {
      throw new PublishError('GitHub 返回的分支与目标分支不一致。');
    }
    return requireSha(ref.object.sha);
  }

  const parentSha = readRefSha(await requestJson(`/git/ref/heads/${refPath}`));
  const parent = await requestJson(`/git/commits/${parentSha}`);
  const baseTree = requireSha(parent.tree?.sha);
  const tree = [];

  for (const file of files) {
    const blob = await requestJson('/git/blobs', 'POST', {
      content: file.content.toString('base64'),
      encoding: 'base64',
    });
    tree.push({ path: file.repoPath, mode: '100644', type: 'blob', sha: requireSha(blob.sha) });
  }

  const nextTree = await requestJson('/git/trees', 'POST', { base_tree: baseTree, tree });
  const treeSha = requireSha(nextTree.sha);
  if (treeSha === baseTree) {
    return { changed: false, sha: parentSha, paths: files.map((file) => file.repoPath) };
  }
  const commit = await requestJson('/git/commits', 'POST', {
    message: message || (files.length === 1
      ? `内容：发布 ${files[0].repoPath}`
      : `内容：批量发布 ${files.length} 个文件`),
    tree: treeSha,
    parents: [parentSha],
  });
  const commitSha = requireSha(commit.sha);

  try {
    // force:false 拒绝覆盖读取分支以后产生的新提交；失败前不会出现半批内容。
    const updated = await requestJson(`/git/refs/heads/${refPath}`, 'PATCH', { sha: commitSha, force: false });
    if (readRefSha(updated) !== commitSha) {
      throw new PublishError('GitHub 返回的分支更新结果与本次提交不一致。');
    }
  } catch (error) {
    if ([400, 401, 403, 404, 409, 422, 429].includes(error?.status)) {
      error.hint = [error.hint, `本次提交标识为 ${commitSha}。分支更新被拒绝，本批内容未发布。`]
        .filter(Boolean).join('\n');
      throw error;
    }

    // 超时、5xx 或无效响应不代表更新失败：只回读，不再次写入或强制回滚。
    let observedSha;
    try {
      observedSha = readRefSha(await requestJson(`/git/ref/heads/${refPath}`));
    } catch {
      throw new PublishError(
        '未能确认分支更新结果。',
        `本次提交 ${commitSha}，原分支 ${parentSha}。回读也失败，请核对远端后再操作；不要直接重复发布。`,
      );
    }
    if (observedSha === commitSha) {
      return { changed: true, sha: commitSha, paths: files.map((file) => file.repoPath), recovered: true };
    }
    if (observedSha === parentSha) {
      throw new PublishError(
        '回读时分支仍为原提交，更新请求的最终结果尚未确认。',
        `本次提交 ${commitSha}，回读分支 ${parentSha}。超时请求可能仍在处理，请稍后核对远端后再操作；不要直接重复发布。`,
      );
    }
    throw new PublishError(
      '目标分支已出现其他提交，无法确认本次发布是否已被后续提交包含。',
      `本次提交 ${commitSha}，远端当前 ${observedSha}。请检查两者关系后再操作；为保护并发修改，没有强制回滚或重试。`,
    );
  }

  return { changed: true, sha: commitSha, paths: files.map((file) => file.repoPath) };
}

async function main() {
  const { files, branch: branchArg, message } = parseArgs(process.argv.slice(2));
  if (files.length === 0) {
    throw new PublishError('没有指定要发布的文件。', '用法：npm run publish <文件路径> [更多文件…]');
  }
  const repository = validateRepository(process.env.GITHUB_REPOSITORY || detectRepository());
  const branch = branchArg || process.env.GITHUB_BRANCH || 'main';
  console.log(`目标仓库 ${repository}（分支 ${branch}）`);
  const result = await publishFilesAtomically(files, {
    repository,
    branch,
    message,
    token: process.env.GITHUB_TOKEN,
  });
  for (const repoPath of result.paths) console.log(`  ${repoPath}`);
  if (!result.changed) {
    console.log('\n远端内容没有变化，无需创建提交。');
    return;
  }
  console.log(`\n已合并为一次提交：${result.sha}`);
  if (result.recovered) console.log('更新响应异常，但已回读确认整批内容提交成功。');
  console.log('GitHub Actions 会自动构建并部署，可在仓库 Actions 中查看进度。');
}

// 不用 process.exit()：Windows 下如果还有未收尾的网络句柄，
// 强制退出会触发 libuv 的断言崩溃，盖住真正的错误信息。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
}
