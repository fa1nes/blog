/**
 * 构建前把私有内容仓库拉进来。
 *
 * 公开仓库（这个）只放主题代码，文章、动态、友链、图片都在私有仓库
 * fa1nes/blog-content 里。构建时用 CONTENT_REPO_TOKEN 下载它的 tarball，
 * 解到 src/content 与 public/uploads，Astro 再按原来的路径读取。
 *
 * 为什么用 tarball 而不是 git clone：
 *   - 不用在构建机装 git、处理凭据助手，一次 HTTPS 请求就够
 *   - token 只出现在请求头里，不会写进任何 URL 或日志
 *
 * 三种运行环境：
 *   1. CI（GitHub Actions / Cloudflare Pages）：有 CONTENT_REPO_TOKEN，正常拉取
 *   2. 本地开发且填了 token：手动 `npm run content:pull`
 *   3. 本地开发且没有 token：如果 src/content 里已有内容（自己 clone 过内容仓库），
 *      直接跳过，不覆盖
 */

import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = process.env.CONTENT_REPO ?? 'fa1nes/blog-content';
const ref = process.env.CONTENT_REPO_REF ?? 'main';
const token = process.env.CONTENT_REPO_TOKEN?.trim();

const contentDirs = ['posts', 'notes', 'friends', 'pages'];
const targets = [
  ...contentDirs.map((dir) => path.join(root, 'src', 'content', dir)),
  path.join(root, 'public', 'uploads'),
];

async function hasLocalContent() {
  try {
    const entries = await readdir(path.join(root, 'src', 'content', 'posts'));
    return entries.some((name) => /\.mdx?$/i.test(name));
  } catch {
    return false;
  }
}

/** 清空目录里的内容文件，保留 .gitkeep，避免删文章后旧文件残留 */
async function clearTargets() {
  for (const dir of targets) {
    await mkdir(dir, { recursive: true });
    for (const name of await readdir(dir)) {
      if (name === '.gitkeep') continue;
      await rm(path.join(dir, name), { recursive: true, force: true });
    }
  }
}

async function download() {
  const url = `https://api.github.com/repos/${repo}/tarball/${ref}`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'fa1nes-blog-build',
    },
  });
  if (!response.ok) {
    throw new Error(`拉取 ${repo}@${ref} 失败：HTTP ${response.status}。请检查 CONTENT_REPO_TOKEN 是否有该私有仓库的读取权限。`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  if (!token) {
    if (await hasLocalContent()) {
      console.log('未设置 CONTENT_REPO_TOKEN，沿用本地已有的 src/content。');
      return;
    }
    console.warn('未设置 CONTENT_REPO_TOKEN，且本地没有内容文件：构建出来的站点会是空的。');
    return;
  }

  console.log(`正在拉取 ${repo}@${ref} …`);
  const archive = await download();
  const workDir = await mkdtemp(path.join(tmpdir(), 'blog-content-'));
  const archivePath = path.join(workDir, 'content.tar.gz');
  await writeFile(archivePath, archive);

  const unpackDir = path.join(workDir, 'unpack');
  await mkdir(unpackDir, { recursive: true });
  // GitHub 的 tarball 是 gzip 压缩包，用系统自带 tar 解开（Windows 10+ 也有）。
  // 这里必须用相对路径 + cwd：GNU tar 会把 "C:\..." 当成远程主机名。
  execFileSync('tar', ['-xzf', 'content.tar.gz', '-C', 'unpack'], {
    cwd: workDir,
    stdio: 'inherit',
  });

  const [topLevel] = (await readdir(unpackDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (!topLevel) throw new Error('内容仓库的 tarball 结构异常：找不到根目录。');
  const sourceRoot = path.join(unpackDir, topLevel);

  await clearTargets();
  for (const dir of contentDirs) {
    await cp(path.join(sourceRoot, 'src', 'content', dir), path.join(root, 'src', 'content', dir), {
      recursive: true,
      force: true,
    });
  }
  await cp(path.join(sourceRoot, 'public', 'uploads'), path.join(root, 'public', 'uploads'), {
    recursive: true,
    force: true,
  });

  const posts = (await readdir(path.join(root, 'src', 'content', 'posts')))
    .filter((name) => /\.mdx?$/i.test(name)).length;
  console.log(`内容已就绪：${posts} 篇文章。`);

  await rm(workDir, { recursive: true, force: true });
}

await main();

// 保证 .gitkeep 还在，公开仓库的目录结构不会因为拉取而变形
for (const dir of targets) {
  const keep = path.join(dir, '.gitkeep');
  try {
    await readFile(keep);
  } catch {
    await writeFile(keep, '');
  }
}
