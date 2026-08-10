import { API_ORIGIN, ASSET_CDN_ORIGIN } from './config';

const LEGACY_IMAGE_PREFIX = '/static/images/';

export function resolveAssetUrl(value: string | null | undefined): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(LEGACY_IMAGE_PREFIX)) {
    return `${ASSET_CDN_ORIGIN}/${value.slice(LEGACY_IMAGE_PREFIX.length)}`;
  }
  return new URL(value, API_ORIGIN).href;
}
