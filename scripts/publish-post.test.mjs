import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseArgs, publishFilesAtomically, resolvePublishPath, validateRepository } from './publish-post.mjs';

describe('publish argument validation', () => {
  it('requires a value for branch and message options', () => {
    assert.throws(() => parseArgs(['--branch']), /缺少分支名称/);
    assert.throws(() => parseArgs(['-b', '--message', 'Release']), /缺少分支名称/);
    assert.throws(() => parseArgs(['--message']), /缺少提交信息/);
    assert.throws(() => parseArgs(['-m', '--branch', 'main']), /缺少提交信息/);
  });

  it('accepts files and explicit branch/message values', () => {
    assert.deepEqual(parseArgs(['--branch', 'main', '-m', 'Update post', 'src/content/posts/post.md']), {
      files: ['src/content/posts/post.md'],
      branch: 'main',
      message: 'Update post',
    });
  });
});

describe('publish path validation', () => {
  it('allows content files under approved directories without relying on sample content', async (t) => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'blog-publish-'));
    t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
    const relativePath = 'src/content/posts/fixture.md';
    const filePath = path.join(fixtureRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, 'test');

    const resolved = await resolvePublishPath(relativePath, fixtureRoot);
    assert.equal(resolved.repoPath, relativePath);
    assert.equal(resolved.absolute, filePath);
  });

  it('rejects paths outside approved directories and traversal attempts', async () => {
    await assert.rejects(resolvePublishPath('README.md'), /不能发布/);
    await assert.rejects(resolvePublishPath('../.env'), /不在项目目录内/);
    await assert.rejects(resolvePublishPath('src/content/.env.local'), /不能发布/);
    await assert.rejects(resolvePublishPath('src/content/posts'), /普通文件/);
  });

  it('rejects symlinks that point outside approved directories', async (t) => {
    // 在临时目录里搭一套同样的 src/content 结构，
    // 用例结束后整目录删除，不在真实内容目录留下临时文件。
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'blog-publish-link-'));
    t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

    const linkPath = path.join(fixtureRoot, 'src', 'content', 'posts', 'linked.md');
    const targetPath = path.join(fixtureRoot, 'outside.md');
    await mkdir(path.dirname(linkPath), { recursive: true });
    await writeFile(targetPath, '# 指到内容目录之外的目标');

    try {
      await symlink(targetPath, linkPath, 'file');
    } catch (error) {
      if (['EACCES', 'EPERM', 'ENOSYS'].includes(error.code)) {
        t.skip(`Symlink creation is unavailable: ${error.code}`);
        return;
      }
      throw error;
    }

    await assert.rejects(
      resolvePublishPath('src/content/posts/linked.md', fixtureRoot),
      /不能发布/,
    );
  });
});

describe('GitHub repository validation', () => {
  it('accepts owner/repository names and rejects malformed values', () => {
    assert.equal(validateRepository('fa1nes/blog'), 'fa1nes/blog');
    assert.throws(() => validateRepository('fa1nes/blog/path'), /无法确定目标仓库/);
    assert.throws(() => validateRepository('fa1nes/blog?ref=main'), /无法确定目标仓库/);
  });
});

async function publicationFixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'blog-publish-batch-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const files = ['src/content/posts/post.md', 'public/uploads/cover.png'];
  for (const file of files) {
    await mkdir(path.dirname(path.join(rootDir, file)), { recursive: true });
    await writeFile(path.join(rootDir, file), file.endsWith('.md')
      ? '---\ntitle: 发布验收\npubDate: 2026-11-14\nupdatedDate: \'\'\n---\n整批发布。\n'
      : file);
  }
  return { rootDir, files };
}

describe('atomic publication', () => {
  const parentSha = 'a'.repeat(40);
  const baseTree = 'b'.repeat(40);
  const nextTree = 'c'.repeat(40);
  const commitSha = 'd'.repeat(40);

  it('publishes all files in one commit and a single non-forced ref update', async (t) => {
    const { rootDir, files } = await publicationFixture(t);
    const responses = [
      { ref: 'refs/heads/writing/notes', object: { type: 'commit', sha: parentSha } },
      { tree: { sha: baseTree } },
      { sha: 'e'.repeat(40) }, { sha: 'f'.repeat(40) },
      { sha: nextTree }, { sha: commitSha },
      { ref: 'refs/heads/writing/notes', object: { type: 'commit', sha: commitSha } },
    ];
    const calls = [];
    const result = await publishFilesAtomically(files, {
      rootDir, repository: 'owner/blog', token: 'dummy', branch: 'writing/notes',
      request: async (url, options) => {
        calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
        return Response.json(responses.shift());
      },
    });

    assert.deepEqual(result, { changed: true, sha: commitSha, paths: files });
    assert.equal(calls.length, 7);
    assert.equal(calls[0].url.endsWith('/git/ref/heads/writing/notes'), true);
    assert.deepEqual(calls[4].body, {
      base_tree: baseTree,
      tree: files.map((file, index) => ({
        path: file, mode: '100644', type: 'blob', sha: (index ? 'f' : 'e').repeat(40),
      })),
    });
    assert.deepEqual(calls[5].body.parents, [parentSha]);
    assert.equal(calls[5].body.tree, nextTree);
    assert.equal(calls[6].method, 'PATCH');
    assert.deepEqual(calls[6].body, { sha: commitSha, force: false });
  });

  it('rejects duplicate or unreadable batches before any network request', async (t) => {
    const { rootDir, files } = await publicationFixture(t);
    let requests = 0;
    const options = {
      rootDir, repository: 'owner/blog', token: 'dummy',
      request: async () => { requests += 1; throw new Error('Unexpected network request'); },
    };
    await assert.rejects(publishFilesAtomically([files[0], files[0]], options), /重复/);
    await assert.rejects(
      publishFilesAtomically([files[0], 'src/content/posts/missing.md'], options),
      /读不到文件/,
    );
    assert.equal(requests, 0);
  });

  it('surfaces a ref conflict without force-pushing or retrying over remote changes', async (t) => {
    const { rootDir, files } = await publicationFixture(t);
    const responses = [
      { ref: 'refs/heads/main', object: { type: 'commit', sha: parentSha } },
      { tree: { sha: baseTree } }, { sha: 'e'.repeat(40) },
      { sha: nextTree }, { sha: commitSha },
    ];
    let updates = 0;
    await assert.rejects(publishFilesAtomically([files[0]], {
      rootDir, repository: 'owner/blog', token: 'dummy',
      request: async (_url, options) => {
        if (options.method === 'PATCH') {
          updates += 1;
          assert.deepEqual(JSON.parse(options.body), { sha: commitSha, force: false });
          return Response.json({ message: 'Update is not a fast forward' }, { status: 422 });
        }
        return Response.json(responses.shift());
      },
    }), /GitHub 返回 422/);
    assert.equal(updates, 1);
  });

  it('rejects invalid content schemas before making any network request', async (t) => {
    const { rootDir, files } = await publicationFixture(t);
    let requests = 0;
    for (const frontmatter of [
      'pubDate: 2026-11-14',
      'title: 缺少日期',
      'title: 日期错误\npubDate: invalid-date',
      'title: 类型错误\npubDate: 2026-11-14\ndraft: definitely',
      'title: 路径错误\npubDate: 2026-11-14\nslug: ../escape',
      'title: [broken',
    ]) {
      await writeFile(path.join(rootDir, files[0]), `---\n${frontmatter}\n---\n正文`);
      await assert.rejects(publishFilesAtomically(files, {
        rootDir, repository: 'owner/blog', token: 'dummy',
        request: async () => { requests += 1; throw new Error('Unexpected network request'); },
      }), /schema|frontmatter|校验|YAML/i);
    }
    assert.equal(requests, 0);
  });

  it('keeps the complete previous tree at every rejected publication stage', async (t) => {
    const { rootDir, files } = await publicationFixture(t);
    // 两个文件的 blob、tree、commit 都是未挂到分支的对象；只有最后一步可改变可见内容。
    for (let failureAt = 0; failureAt < 7; failureAt += 1) {
      let head = parentSha;
      let calls = 0;
      let commits = 0;
      let updates = 0;
      const responses = [
        { ref: 'refs/heads/main', object: { type: 'commit', sha: parentSha } },
        { tree: { sha: baseTree } }, { sha: 'e'.repeat(40) }, { sha: 'f'.repeat(40) },
        { sha: nextTree }, { sha: commitSha },
      ];
      await assert.rejects(publishFilesAtomically(files, {
        rootDir, repository: 'owner/blog', token: 'dummy',
        request: async (url, options) => {
          const index = calls++;
          if (options.method === 'PATCH') updates += 1;
          if (url.endsWith('/git/commits') && options.method === 'POST') commits += 1;
          if (index === failureAt) return Response.json({ message: 'Injected rejection' }, { status: 422 });
          if (options.method === 'PATCH') head = JSON.parse(options.body).sha;
          return Response.json(responses[index]);
        },
      }), /GitHub 返回 422/);
      assert.equal(head, parentSha, `failure stage ${failureAt} must retain the whole previous tree`);
      assert.equal(calls, failureAt + 1);
      assert.ok(commits <= 1);
      assert.ok(updates <= 1);
    }
  });

  it('reconciles lost update responses without repeating or rolling back a branch write', async (t) => {
    const { rootDir, files } = await publicationFixture(t);
    const newerSha = '9'.repeat(40);
    for (const scenario of ['applied', 'applied-500', 'applied-invalid-json', 'not-applied', 'not-applied-500', 'concurrent', 'unreadable']) {
      let head = parentSha;
      let updates = 0;
      const responses = [
        { ref: 'refs/heads/main', object: { type: 'commit', sha: parentSha } },
        { tree: { sha: baseTree } }, { sha: 'e'.repeat(40) }, { sha: 'f'.repeat(40) },
        { sha: nextTree }, { sha: commitSha },
      ];
      const publishing = publishFilesAtomically(files, {
        rootDir, repository: 'owner/blog', token: 'dummy',
        request: async (_url, options) => {
          if (options.method === 'PATCH') {
            updates += 1;
            assert.deepEqual(JSON.parse(options.body), { sha: commitSha, force: false });
            if (scenario.startsWith('applied')) head = commitSha;
            if (scenario === 'concurrent') head = newerSha;
            if (scenario.endsWith('-500')) return Response.json({ message: 'Injected server error' }, { status: 500 });
            if (scenario === 'applied-invalid-json') return new Response('invalid JSON');
            throw new Error('Injected lost response');
          }
          if (responses.length) return Response.json(responses.shift());
          if (scenario === 'unreadable') throw new Error('Injected read failure');
          return Response.json({ ref: 'refs/heads/main', object: { type: 'commit', sha: head } });
        },
      });
      if (scenario.startsWith('applied')) {
        assert.deepEqual(await publishing, { changed: true, sha: commitSha, paths: files, recovered: true });
      } else {
        await assert.rejects(publishing, scenario.startsWith('not-applied') ? /仍为原提交/ : scenario === 'concurrent' ? /其他提交/ : /未能确认/);
      }
      assert.equal(updates, 1);
      assert.equal(head, scenario.startsWith('applied') ? commitSha : scenario === 'concurrent' ? newerSha : parentSha);
    }
  });
});
