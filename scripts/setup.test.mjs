import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { clearCollectionEntries, updateSiteConfig, updateAdminConfig } from './setup.mjs';

const sourceTemplate = await readFile(new URL('../src/site.config.ts', import.meta.url), 'utf8');
const socialPattern = /export const social: SocialLink\[\] = \[[\s\S]*?^\];/m;
const socialFixture = [
  'export const social: SocialLink[] = [',
  "  { label: 'GitHub', href: 'https://github.com/original', icon: 'github' },",
  "  { label: '邮箱', href: 'mailto:hello@example.com', icon: 'mail' },",
  '];',
].join('\n');
const source = sourceTemplate.replace(socialPattern, socialFixture);
const giscusRepoLine = source.match(/^    repo: [^\r\n]+$/m)?.[0];
assert.ok(giscusRepoLine, '站点配置应包含 Giscus 仓库设置');
const adminSource = await readFile(new URL('../public/admin/config.yml', import.meta.url), 'utf8');
const answers = {
  title: '新的博客',
  subtitle: '记录与思考',
  description: '个人博客',
  url: 'https://example.net/blog/',
  authorName: '小明',
  authorBio: '开发者',
  authorEmail: 'hello@example.net',
  githubUser: 'example-user',
  repoName: 'blog',
  startYear: '2026',
};

function configValues(config) {
  const parsed = ts.createSourceFile('site.config.ts', config, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length, 0, '生成的 TypeScript 应保持语法正确');
  const values = {};
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      let initializer = declaration.initializer;
      if (initializer && ts.isAsExpression(initializer)) initializer = initializer.expression;
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) continue;
      values[declaration.name.getText(parsed)] = Object.fromEntries(initializer.properties
        .filter(ts.isPropertyAssignment)
        .map((property) => [property.name.getText(parsed), property.initializer.text]));
    }
  }
  return values;
}

test('初始化可以重复修改域名、子路径、作者、邮箱和社交链接', () => {
  const first = updateSiteConfig(source, answers);
  const nextAnswers = { ...answers, url: 'https://new.example.org/', githubUser: 'next-user', repoName: 'notes', authorEmail: 'next@example.org' };
  const second = updateSiteConfig(first, nextAnswers);
  const values = configValues(second);
  assert.equal(values.site.url, 'https://new.example.org');
  assert.equal(values.site.base, '/');
  assert.equal(values.author.url, 'https://new.example.org');
  assert.equal(values.author.email, 'next@example.org');
  assert.ok(second.includes('https://github.com/next-user'));
  assert.ok(second.includes('mailto:next@example.org'));
  assert.ok(second.includes(giscusRepoLine), 'Giscus 仓库应由用户单独配置');
  assert.ok(!second.includes('https://github.com/example-user'));
  const firstValues = configValues(first);
  assert.equal(firstValues.site.url, 'https://example.net');
  assert.equal(firstValues.site.base, '/blog');
  assert.equal(firstValues.author.url, 'https://example.net/blog');
});

test('初始化兼容改名或移除 GitHub 社交链接', () => {
  const renamed = source.replace("label: 'GitHub'", "label: '代码仓库'");
  const renamedResult = updateSiteConfig(renamed, answers);
  assert.match(renamedResult, /label: '代码仓库', href: "https:\/\/github\.com\/example-user"/);

  const withoutGithub = source.replace(/^  \{ label: 'GitHub',[^\r\n]*\r?\n/m, '');
  assert.doesNotThrow(() => updateSiteConfig(withoutGithub, answers));
});

test('特殊字符、换行与 replacement 模板符号按原文写入配置', () => {
  const text = '$& $1 $` $\' \\ " 单引号\'\n下一行\u2028末行';
  const config = updateSiteConfig(source, { ...answers, title: text, authorName: text, authorBio: text, description: text });
  const values = configValues(config);
  assert.equal(values.site.title, text);
  assert.equal(values.site.description, text);
  assert.equal(values.author.name, text);
  assert.equal(values.author.bio, text);
});

test('后台配置只同步仓库，其余字段保持不变', () => {
  const first = updateAdminConfig(adminSource, answers);
  const next = { ...answers, title: '标题: # $& "内容"', url: 'https://next.example.org/notes/', githubUser: 'next-user' };
  const config = updateAdminConfig(first, next);
  const repo = config.match(/^\s*repo: (.*)$/m);
  assert.equal(JSON.parse(repo[1]), 'next-user/blog');
  // 后台不再依赖站点地址与标题，配置里其它行应原样保留
  assert.equal(config.replace(/^\s*repo: .*$/m, ''), adminSource.replace(/^\s*repo: .*$/m, ''));
});

test('留空邮箱时移除旧社交地址，重新填写时恢复链接', () => {
  const configured = updateSiteConfig(source, answers);
  const cleared = updateSiteConfig(configured, { ...answers, authorEmail: '' });
  assert.equal(cleared.includes('mailto:hello@example.net'), false);
  assert.equal(cleared.includes("{ label: '邮箱'"), false);

  const restored = updateSiteConfig(cleared, answers);
  assert.ok(restored.includes('mailto:hello@example.net'));
  assert.equal((restored.match(/label: '邮箱'/g) ?? []).length, 1);
});

test('无效站点地址、GitHub 仓库、年份在写入前拒绝', () => {
  const invalid = [
    { url: 'javascript:alert(1)' },
    { url: 'https://user:secret@example.org/' },
    { url: 'https://example.org/?q=1' },
    { githubUser: '../other' },
    { repoName: '../other' },
    { startYear: '2026oops' },
    { startYear: 'Infinity' },
  ];
  for (const value of invalid) {
    assert.throws(() => updateSiteConfig(source, { ...answers, ...value }));
    assert.throws(() => updateAdminConfig(adminSource, { ...answers, ...value }));
  }
});

test('配置结构缺失时抛错，避免静默漏改', () => {
  assert.throws(() => updateSiteConfig(source.replace('  title:', '  changedTitle:'), answers), /title/);
  assert.throws(() => updateAdminConfig(adminSource.replace(/^(\s*)repo:/m, '$1changedRepo:'), answers), /repo/);
});

test('明确清理会移除嵌套内容，但拒绝符号链接的集合目录', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'blog-setup-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const directories = ['src/content/posts', 'src/content/notes', 'src/content/friends'];
  for (const directory of directories) {
    const nested = path.join(rootDir, directory, 'nested');
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, 'content.md'), 'content');
  }

  await clearCollectionEntries(rootDir);
  for (const directory of directories) {
    assert.deepEqual(await readdir(path.join(rootDir, directory)), []);
  }

  const outside = await mkdtemp(path.join(os.tmpdir(), 'blog-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const posts = path.join(rootDir, directories[0]);
  await rm(posts, { recursive: true });
  await writeFile(path.join(outside, 'keep.md'), 'keep');
  try {
    await symlink(outside, posts, 'junction');
  } catch (error) {
    if (error.code === 'EPERM') {
      await mkdir(posts);
      t.diagnostic('Symlink creation is unavailable on this Windows account.');
      return;
    }
    throw error;
  }
  await assert.rejects(clearCollectionEntries(rootDir), /拒绝清理非普通内容目录/);
  assert.equal(await readFile(path.join(outside, 'keep.md'), 'utf8'), 'keep');
});
