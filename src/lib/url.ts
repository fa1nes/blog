// 部署到子路径时所有站内链接都要带 base 前缀，模板一律用 href() 生成
import { noteAnchor } from '~/lib/content-paths';

function normalizeBase(value: string | undefined): string {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export const BASE = normalizeBase(import.meta.env.BASE_URL);

const EXTERNAL = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i;

export function href(path = '/'): string {
  if (!path || path === '#') return path || '#';
  if (EXTERNAL.test(path) || path.startsWith('#')) return path;
  return `${BASE}${path.replace(/^\/+/, '')}`.replace(/([^:]\/)\/+/g, '$1');
}

function stripBase(pathname: string): string {
  if (BASE !== '/' && (pathname === BASE.slice(0, -1) || pathname.startsWith(BASE))) {
    const rest = pathname.slice(BASE.length - 1);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return pathname;
}

export function isActive(pathname: string, target: string): boolean {
  const current = stripBase(pathname).replace(/\/+$/, '') || '/';
  const to = target.replace(/\/+$/, '') || '/';
  if (to === '/') return current === '/';
  return current === to || current.startsWith(`${to}/`);
}

export function postPath(slug: string): string {
  return href(`/posts/${slug.split('/').map((segment) => encodeURIComponent(segment)).join('/')}/`);
}

export function notePath(id: string): string {
  return `${href('/notes/')}#${encodeURIComponent(noteAnchor(id))}`;
}

export function categoryPath(name: string): string {
  return href(`/categories/${encodeURIComponent(name)}/`);
}

export function tagPath(name: string): string {
  return href(`/tags/${encodeURIComponent(name)}/`);
}
