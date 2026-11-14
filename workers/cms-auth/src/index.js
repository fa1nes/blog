/**
 * GitHub OAuth 代理，给博客后台（Sveltia CMS）用。
 *
 * 为什么需要它：静态站点没有后端，OAuth 的 code 换 token 这一步没地方做。
 * 这个 Worker 只做三件事：
 *   GET /auth     把用户送去 GitHub 授权页
 *   GET /callback 拿 code 换 token，再用 postMessage 交还给后台窗口
 *   GET /         健康检查
 *
 * 需要两个密钥（在 Cloudflare 里配，不要写进代码）：
 *   GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET
 * 可选变量：
 *   ALLOWED_ORIGINS  允许发起登录的站点，逗号分隔，例如
 *                    https://fa1nes.github.io,https://blog.example.com
 *                    留空表示不限制来源（仍会校验 state 签名）
 *
 * state 用 HMAC 签名，十分钟过期，避免别人伪造回调地址把 token 送到别处。
 */

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const STATE_TTL_MS = 10 * 60 * 1000;

const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64url(new Uint8Array(signature));
}

/** state 里只放站点来源和时间戳，签名保证没被改过 */
async function createState(origin, secret) {
  const payload = `${origin}|${Date.now()}`;
  const signature = await sign(payload, secret);
  return base64url(encoder.encode(`${payload}|${signature}`));
}

async function readState(state, secret) {
  const raw = new TextDecoder().decode(fromBase64url(state));
  const parts = raw.split('|');
  if (parts.length !== 3) return null;
  const [origin, issuedAt, signature] = parts;
  const expected = await sign(`${origin}|${issuedAt}`, secret);
  if (expected !== signature) return null;
  if (!/^https?:\/\/[^/]+$/.test(origin)) return null;
  if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;
  return { origin };
}

function allowedOrigin(origin, env) {
  const list = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(origin);
}

/** 交还结果的页面：用 postMessage 告诉后台窗口结果，然后自己关掉 */
function relayPage(origin, message) {
  const payload = JSON.stringify(message);
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>登录中…</title>
<body style="font-family:system-ui,-apple-system,'PingFang SC',sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#35434f">
<p id="tip">正在把登录结果交给后台…</p>
<script>
  const payload = ${payload};
  const target = ${JSON.stringify(origin)};
  try {
    if (window.opener) {
      window.opener.postMessage(payload, target);
      window.setTimeout(() => window.close(), 300);
    } else {
      document.getElementById('tip').textContent = '请回到后台页面继续操作。';
    }
  } catch (error) {
    document.getElementById('tip').textContent = '无法回传登录结果：' + error.message;
  }
</script>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = env.GITHUB_CLIENT_SECRET;
    if (!env.GITHUB_CLIENT_ID || !secret) {
      return textResponse('缺少 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET，请先在 Worker 里配置。', 500);
    }

    if (url.pathname === '/auth') {
      // 后台会把自身 origin 作为 site_id 传过来；也接受 scope 参数（默认 repo）。
      // 注意 Sveltia 传的是不带协议的 host（fa1nes.github.io），要补成 https。
      const siteId = (url.searchParams.get('site_id') ?? '').trim();
      let origin = '';
      for (const candidate of [siteId, `https://${siteId}`]) {
        try {
          origin = new URL(candidate).origin;
          break;
        } catch {
          /* 继续尝试下一种写法 */
        }
      }
      if (!origin) return textResponse('缺少合法的 site_id（后台站点地址）。', 400);
      if (!allowedOrigin(origin, env)) return textResponse('这个站点不在 ALLOWED_ORIGINS 里。', 403);

      const state = await createState(origin, secret);
      const authorize = new URL(GITHUB_AUTHORIZE);
      authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', `${url.origin}/callback`);
      // Sveltia 用逗号分隔 scope，GitHub 要的是空格分隔
      const scope = (url.searchParams.get('scope') ?? 'repo').replace(/,/g, ' ');
      authorize.searchParams.set('scope', scope);
      authorize.searchParams.set('state', state);
      return Response.redirect(authorize.toString(), 302);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) return textResponse('缺少 code 或 state。', 400);

      const parsed = await readState(state, secret);
      if (!parsed) return textResponse('state 校验失败或已过期，请回后台重新登录。', 400);

      const tokenResponse = await fetch(GITHUB_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: secret,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      });
      const result = await tokenResponse.json().catch(() => ({}));
      if (!result.access_token) {
        return relayPage(
          parsed.origin,
          `authorization:github:error:${JSON.stringify({ message: result.error_description ?? '换取令牌失败' })}`,
        );
      }
      return relayPage(
        parsed.origin,
        `authorization:github:success:${JSON.stringify({
          token: result.access_token,
          provider: 'github',
          scope: result.scope ?? 'repo',
        })}`,
      );
    }

    return textResponse(
      'GitHub OAuth 代理运行中。后台把 base_url 指向这个地址即可。\n路径：/auth、/callback',
    );
  },
};
