# 博客后台的 GitHub OAuth 代理

让 `/blog/admin/` 支持「用 GitHub 登录」，不用手工创建 PAT。

静态站点没有后端，OAuth 最后一步（用 code 换 token）必须由服务端完成。这个 Worker 就只做这一步，不存任何数据：token 换完立刻用 `postMessage` 交还给后台窗口，Worker 自己不落库。

## 部署

```bash
cd workers/cms-auth
npx wrangler login          # 第一次需要，会打开浏览器授权
npx wrangler deploy         # 记下输出的 https://xxx.workers.dev
```

然后在 GitHub 建一个 OAuth App：<https://github.com/settings/developers> → **New OAuth App**

| 字段 | 值 |
| --- | --- |
| Application name | `fa1nes 的博客 · 后台` |
| Homepage URL | `https://fa1nes.github.io/blog/` |
| Authorization callback URL | `https://<你的-worker>.workers.dev/callback` |

拿到 Client ID 和 Client Secret 后写进 Worker 密钥：

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

## 接到后台

改 `public/admin/config.yml`：

```yaml
backend:
  name: github
  repo: fa1nes/blog
  branch: main
  base_url: https://<你的-worker>.workers.dev
  auth_methods: [oauth, token]
```

`auth_methods` 里保留 `token` 是为了 OAuth 服务不可用时还能用令牌登录。改完推送到 `main` 即生效，后台登录页会出现「使用 GitHub 登录」。

## 安全说明

- `state` 用 Client Secret 做 HMAC 签名，十分钟过期，防止把 token 送到别人的页面。
- `ALLOWED_ORIGINS` 限制哪些站点可以发起登录，改 `wrangler.jsonc` 里的变量即可。
- Worker 不记录、不缓存 token；日志里也不会出现它。
