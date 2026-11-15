/**
 * 交互式初始化：npm run setup
 *
 * 把站点信息写进 src/site.config.ts、更新后台仓库配置、
 * 可选地把示例内容换成占位内容，最后重新生成分享图。
 * 运行前请保存已有改动，完成后可以通过 git diff 检查初始化结果。
 */

import { readFile, writeFile, readdir, rm, lstat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** JSON 字符串可以直接用作 TypeScript 字符串，并会转义换行与控制字符。 */
const quote = (value) => JSON.stringify(String(value)).replace(/[\u2028\u2029]/g, (char) =>
  `\\u${char.charCodeAt(0).toString(16)}`,
);

// 同时识别模板中的单引号和向导写出的双引号，支持重复初始化。
function replaceField(source, key, value, indent = 2) {
  const literal = `(?:'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*")`;
  const pattern = new RegExp(`(^ {${indent}}${key}:)\\s*${literal}`, 'gm');
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`配置字段 ${key} 应恰好出现一次`);
  // 使用回调，避免用户输入中的 $&、$1 等被当成 replacement 模板。
  return source.replace(pattern, (_match, prefix) => `${prefix} ${quote(value)}`);
}

function replaceBlockField(source, block, key, value) {
  const pattern = new RegExp(`^export const ${block} = \\{[\\s\\S]*?^\\} as const;`, 'm');
  if (!pattern.test(source)) throw new Error(`配置里没找到 ${block}`);
  return source.replace(pattern, (section) => replaceField(section, key, value));
}

function setupValues(answers) {
  let url;
  try {
    url = new URL(answers.url);
  } catch {
    throw new Error('站点网址需要是完整的 HTTP 或 HTTPS 地址。');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('站点网址只支持 HTTP 或 HTTPS，且不能包含登录信息、查询参数或片段。');
  }
  const startYear = Number(answers.startYear);
  if (!Number.isInteger(startYear) || startYear < 1000 || startYear > 9999) {
    throw new Error('建站年份需要是四位整数。');
  }
  if (answers.githubUser && !/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(answers.githubUser)) {
    throw new Error('GitHub 用户名格式不正确。');
  }
  if (answers.githubUser && (!/^[A-Za-z0-9_.-]+$/.test(answers.repoName) || ['.', '..'].includes(answers.repoName))) {
    throw new Error('GitHub 仓库名格式不正确。');
  }
  const base = url.pathname.replace(/\/+$/, '') || '/';
  return { siteUrl: `${url.origin}${base === '/' ? '' : base}`, origin: url.origin, base, startYear };
}

export function updateSiteConfig(source, answers) {
  const { siteUrl, origin, base, startYear } = setupValues(answers);
  let config = replaceBlockField(source, 'site', 'url', origin);
  config = replaceBlockField(config, 'site', 'base', base);
  config = replaceField(config, 'title', answers.title);
  config = replaceField(config, 'shortTitle', answers.title);
  config = replaceField(config, 'subtitle', answers.subtitle);
  config = replaceField(config, 'description', answers.description);
  config = replaceField(config, 'name', answers.authorName);
  config = replaceField(config, 'bio', answers.authorBio);
  config = replaceField(config, 'email', answers.authorEmail);
  config = replaceBlockField(config, 'author', 'url', siteUrl);
  const yearPattern = /^(  startYear: )\d+/m;
  if (!yearPattern.test(config)) throw new Error('配置里没找到字段 startYear');
  config = config.replace(yearPattern, (_match, prefix) => `${prefix}${startYear}`);

  if (answers.githubUser) {
    const githubPattern = /^(  \{ label: [^,\r\n]+, href: )[^,\r\n]+(, icon: 'github' \},)$/gm;
    const githubLinks = [...config.matchAll(githubPattern)];
    if (githubLinks.length > 1) throw new Error('GitHub 社交链接只能出现一次');
    if (githubLinks.length === 1) {
      config = config.replace(githubPattern, (_match, prefix, suffix) => `${prefix}${quote(`https://github.com/${answers.githubUser}`)}${suffix}`);
    }
  }
  const socialBlock = /(^export const social: SocialLink\[\] = \[[\s\S]*?)(^\];)/m;
  if (!socialBlock.test(config)) throw new Error('配置里没找到 social');
  config = config.replace(socialBlock, (_block, entries, closing) => {
    const mailPattern = /^  \{ label: '邮箱', href: [^\r\n]*, icon: 'mail' \},?\r?\n?/gm;
    const matches = [...entries.matchAll(mailPattern)];
    if (matches.length > 1) throw new Error('邮箱社交链接只能出现一次');
    if (!answers.authorEmail) return [entries.replace(mailPattern, ''), closing].join('');

    const mailLink = `  { label: '邮箱', href: ${quote(`mailto:${answers.authorEmail}`)}, icon: 'mail' },\n`;
    if (matches.length === 1) return [entries.replace(mailPattern, () => mailLink), closing].join('');
    return [`${entries}${mailLink}`, closing].join('');
  });
  return config;
}

export function updateAdminConfig(source, answers) {
  // 站点地址仍要校验，后台不再需要写进配置（页面自己知道部署在哪）
  const { siteUrl } = setupValues(answers);
  let config = source;

  // 旧版配置里的这几个字段，存在就顺手更新，没有也不报错
  const legacy = { site_url: siteUrl, display_url: siteUrl, app_title: `${answers.title} · 内容工作台` };
  for (const [key, value] of Object.entries(legacy)) {
    const pattern = new RegExp(`^(\\s*${key}: ).*$`, 'gm');
    if ([...config.matchAll(pattern)].length === 1) {
      config = config.replace(pattern, (_match, prefix) => `${prefix}${quote(value)}`);
    }
  }

  // 仓库是后台唯一的必填项
  if (answers.githubUser) {
    const pattern = /^(\s*repo: ).*$/gm;
    if ([...config.matchAll(pattern)].length !== 1) throw new Error('后台配置字段 repo 应恰好出现一次');
    config = config.replace(pattern, (_match, prefix) => `${prefix}${quote(`${answers.githubUser}/${answers.repoName}`)}`);
  }
  return config;
}

export async function clearCollectionEntries(rootDir = root) {
  const directories = ['src/content/posts', 'src/content/notes', 'src/content/friends'];
  const contents = await Promise.all(directories.map(async (directory) => {
    const target = path.join(rootDir, directory);
    const stat = await lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`拒绝清理非普通内容目录：${directory}`);
    }
    return { target, names: await readdir(target) };
  }));

  for (const { target, names } of contents) {
    for (const name of names) {
      await rm(path.join(target, name), { recursive: true, force: true });
    }
  }
}

async function main() {

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

async function confirm(label, defaultYes = false) {
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
a.clearSamples = await confirm('把现有文章、动态、友链全部换成占位内容（会删除现有内容）');

rl?.close();
console.log('\n  正在写入…\n');

/* 1. 站点配置。先在内存里全部替换成功再落盘，
      任何一处失败就退出且不碰其他文件，避免留下改了一半的状态。 */
const configPath = path.join(root, 'src/site.config.ts');
const adminPath = path.join(root, 'public/admin/config.yml');
let config;
let admin;

try {
  config = updateSiteConfig(await readFile(configPath, 'utf8'), a);
  admin = updateAdminConfig(await readFile(adminPath, 'utf8'), a);
} catch (error) {
  console.error(`  站点配置写入失败：${error.message}`);
  console.error('  没有改动任何文件，请检查 src/site.config.ts 的格式后重试。');
  process.exit(1);
}

await writeFile(configPath, config, 'utf8');
console.log('  已更新 src/site.config.ts');

/* 2. 后台仓库与站点入口 */
await writeFile(adminPath, admin, 'utf8');
console.log('  已更新 public/admin/config.yml');

/* 3. 示例内容 */
if (a.clearSamples) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  await clearCollectionEntries(root);

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
description: ${quote(`关于${a.authorName}与这个博客。`)}
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
    · 换掉 public/brand-icon.png 与 public/avatar.png
    · LICENSE 里的版权人改成 ${a.authorName}
    · 想开评论就按 README 配置 Giscus
    · docs/ 里的预览截图属于模板说明，可以删掉

  请用 git diff 检查初始化结果，再提交你确认要保留的改动。
`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`初始化失败：${error.message}`);
    process.exitCode = 1;
  });
}
