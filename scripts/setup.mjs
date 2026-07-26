/**
 * 交互式初始化：npm run setup
 *
 * 把站点信息写进 src/site.config.ts、更新后台仓库配置、
 * 可选地把示例内容换成占位内容，最后重新生成分享图。
 * 所有改动都在 Git 里可回滚，填错了执行 git checkout . 即可。
 */

import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 生成 TypeScript 单引号字符串字面量 */
const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// readline 在非 TTY（管道、CI）下读完第一行就拿不到后续输入，
// 所以这种情况改成一次性读完 stdin 再按行分配，两种模式都能用。
const interactive = Boolean(stdin.isTTY);
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;
let piped = [];
let pipedIndex = 0;

if (!interactive) {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  piped = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
}

async function ask(label, fallback) {
  if (!interactive) {
    const value = (piped[pipedIndex++] ?? '').trim() || fallback || '';
    console.log(`  ${label}：${value}`);
    return value;
  }
  const hint = fallback ? `（回车用 ${fallback}）` : '';
  const answer = (await rl.question(`  ${label}${hint}：`)).trim();
  return answer || fallback || '';
}

async function confirm(label, defaultYes = true) {
  const raw = (
    !interactive
      ? (piped[pipedIndex++] ?? '')
      : await rl.question(`  ${label}${defaultYes ? '（Y/n）' : '（y/N）'}：`)
  )
    .trim()
    .toLowerCase();
  if (!interactive) console.log(`  ${label}：${raw || (defaultYes ? 'y' : 'n')}`);
  if (!raw) return defaultYes;
  return raw === 'y' || raw === 'yes';
}

// 精确替换 `key: '旧值'`，匹配不到就抛错，避免静默跳过导致配置只改一半。
// 允许值写在下一行：长字符串会被格式化工具折行。
function replaceField(source, key, value, indent = 2) {
  const pattern = new RegExp(`(^\\s{${indent}}${key}:)\\s*'(?:[^'\\\\]|\\\\.)*'`, 'm');
  if (!pattern.test(source)) throw new Error(`配置里没找到字段 ${key}`);
  return source.replace(pattern, `$1 ${quote(value)}`);
}

function replaceNumber(source, key, value, indent = 2) {
  const pattern = new RegExp(`^(\\s{${indent}}${key}: )\\d+`, 'm');
  if (!pattern.test(source)) throw new Error(`配置里没找到字段 ${key}`);
  return source.replace(pattern, `$1${value}`);
}

console.log('\n  这个向导会把模板里的占位信息换成你自己的。');
console.log('  直接回车表示使用括号里的默认值。\n');

const a = {};
a.title = await ask('站点标题', '我的博客');
a.subtitle = await ask('副标题（显示在首页标题下方）', '记录与思考');
a.description = await ask('站点描述（用于 SEO 与 RSS）', `${a.title}的个人博客`);
a.url = await ask('站点网址（部署后的最终地址）', 'https://example.com');
a.authorName = await ask('你的名字', '匿名');
a.authorBio = await ask('一句话简介', '');
a.authorEmail = await ask('邮箱（留空则不显示）', '');
a.githubUser = await ask('GitHub 用户名（留空跳过后台与社交链接）', '');
a.repoName = a.githubUser ? await ask('博客仓库名', 'blog') : '';
a.startYear = await ask('建站年份', String(new Date().getFullYear()));
a.clearSamples = await confirm('把示例文章、动态、友链换成占位内容', true);

rl?.close();
console.log('\n  正在写入…\n');

/* 1. 站点配置。先在内存里全部替换成功再落盘，
      任何一处失败就退出且不碰其他文件，避免留下改了一半的状态。 */
const configPath = path.join(root, 'src/site.config.ts');
let config = await readFile(configPath, 'utf8');

try {
  const siteUrl = a.url.replace(/\/+$/, '');

  // site 与 author 里都有 url 字段，用 replaceAll 一次处理掉两处占位地址
  config = config.replaceAll("'https://example.com'", quote(siteUrl));
  config = replaceField(config, 'title', a.title);
  config = replaceField(config, 'shortTitle', a.title);
  config = replaceField(config, 'subtitle', a.subtitle);
  config = replaceField(config, 'description', a.description);
  config = replaceField(config, 'name', a.authorName);
  config = replaceField(config, 'bio', a.authorBio);
  config = replaceField(config, 'email', a.authorEmail);
  config = replaceNumber(config, 'startYear', Number(a.startYear) || new Date().getFullYear());

  if (a.githubUser) {
    config = config.replaceAll('yourname', a.githubUser);
    if (a.repoName) config = config.replaceAll('yourrepo', a.repoName);
  }
  if (a.authorEmail) config = config.replaceAll('hello@example.com', a.authorEmail);
} catch (error) {
  console.error(`  站点配置写入失败：${error.message}`);
  console.error('  没有改动任何文件，请检查 src/site.config.ts 的格式后重试。');
  process.exit(1);
}

await writeFile(configPath, config, 'utf8');
console.log('  已更新 src/site.config.ts');

/* 2. 后台仓库 */
if (a.githubUser && a.repoName) {
  const adminPath = path.join(root, 'public/admin/config.yml');
  const admin = await readFile(adminPath, 'utf8');
  await writeFile(
    adminPath,
    admin.replace(/^(\s*repo: ).*$/m, `$1${a.githubUser}/${a.repoName}`),
    'utf8',
  );
  console.log('  已更新 public/admin/config.yml');
}

/* 3. 示例内容 */
if (a.clearSamples) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  for (const dir of ['src/content/posts', 'src/content/notes', 'src/content/friends']) {
    const target = path.join(root, dir);
    for (const name of await readdir(target)) {
      await rm(path.join(target, name), { force: true });
    }
  }

  // 每个集合都留一条：集合为空时 Astro 构建会发出警告
  await writeFile(
    path.join(root, 'src/content/posts/hello.md'),
    `---
title: 第一篇文章
description: ''
pubDate: ${today}
category: 未分类
tags: []
---

在 \`src/content/posts/\` 下新建 Markdown 文件即可开始写作，也可以执行 \`npm run new "标题"\`。

可用字段见 README。
`,
    'utf8',
  );

  await writeFile(
    path.join(root, 'src/content/notes/first.md'),
    `---
pubDate: ${now}
---

动态适合放一两句话的短想法，只需要 pubDate 一个字段。
`,
    'utf8',
  );

  await writeFile(
    path.join(root, 'src/content/friends/astro.md'),
    `---
name: Astro
href: https://astro.build
description: 驱动这个博客的静态站点框架
order: 1
---
`,
    'utf8',
  );

  await writeFile(
    path.join(root, 'src/content/pages/about.md'),
    `---
title: 关于
description: 关于${a.authorName}与这个博客。
updatedDate: ${today}
---

你好，我是 **${a.authorName}**。${a.authorBio}

这个页面的内容在 \`src/content/pages/about.md\`，随时可以改写。
`,
    'utf8',
  );

  console.log('  已把示例内容换成占位内容');
}

/* 4. 分享图 */
try {
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-og.mjs')], {
    cwd: root,
    stdio: 'ignore',
  });
  console.log('  已重新生成分享图');
} catch {
  console.log('  分享图生成失败，可稍后手动执行 npm run og');
}

console.log(`
  初始化完成，接下来：

    npm run dev      本地预览
    npm run build    生产构建

  还需要手动处理：
    · 换掉 public/favicon.svg 与 public/avatar.svg
    · LICENSE 里的版权人改成 ${a.authorName}
    · 想开评论就按 README 配置 Giscus
    · docs/ 里的预览截图属于模板说明，可以删掉

  填错了执行 git checkout . 即可全部还原。
`);
