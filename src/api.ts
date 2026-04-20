import { API_LANGUAGES, API_ORIGIN, API_ROOT, CHARACTER_IDS, type CharacterId } from './config';
import type { ApiCard, CharacterInfo } from './state';

const characterCache = new Map<string, CharacterInfo[]>();
const keywordCache = new Map<string, Record<string, string>>();
const cardCache = new Map<string, ApiCard[]>();

async function fetchJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API_ROOT + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchOptionalJson<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(API_ROOT + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

function toSnakeCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

export function isSupportedApiLanguage(code: string): boolean {
  return API_LANGUAGES.some(item => item.code === code);
}

export async function loadCharacters(apiLanguage: string): Promise<CharacterInfo[]> {
  const cached = characterCache.get(apiLanguage);
  if (cached) return cached;
  const items = await fetchJson<Array<{ id: string; name: string }>>('/characters', { lang: apiLanguage });
  const characters = await Promise.all(CHARACTER_IDS.map(async id => {
    const match = items.find(item => item.id.toLowerCase() === id);
    if (!match) throw new Error(`Missing character: ${id}`);
    let imageUrl: string | null = null;
    const detail = await fetchOptionalJson<{ starting_relics: string[] | null }>(`/characters/${id}`, { lang: apiLanguage });
    const relicName = detail?.starting_relics?.[0] || '';
    if (relicName) {
      const relic = await fetchOptionalJson<{ image_url: string | null }>(`/relics/${toSnakeCase(relicName)}`);
      if (relic?.image_url) imageUrl = API_ORIGIN + relic.image_url;
    }
    return {
      id,
      name: match.name,
      imageUrl,
    } satisfies CharacterInfo;
  }));
  characterCache.set(apiLanguage, characters);
  return characters;
}

export async function loadKeywords(apiLanguage: string): Promise<Record<string, string>> {
  const cached = keywordCache.get(apiLanguage);
  if (cached) return cached;
  const items = await fetchJson<Array<{ id: string; name: string }>>('/keywords', { lang: apiLanguage });
  const keywords: Record<string, string> = {};
  items.forEach(item => {
    keywords[item.id.toUpperCase()] = item.name;
  });
  keywordCache.set(apiLanguage, keywords);
  return keywords;
}

export async function loadCards(characterId: CharacterId, apiLanguage: string): Promise<ApiCard[]> {
  const cacheKey = `${apiLanguage}:${characterId}`;
  const cached = cardCache.get(cacheKey);
  if (cached) return cached;
  const cards = await fetchJson<ApiCard[]>('/cards', { color: characterId, lang: apiLanguage });
  cardCache.set(cacheKey, cards);
  return cards;
}
