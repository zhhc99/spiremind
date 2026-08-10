import { resolveAssetUrl } from './assets';
import { API_LANGUAGES, API_ROOT, BETA_DATA_VERSION_FALLBACK, CHARACTER_IDS, STABLE_DATA_VERSION, type CharacterId, type DataChannel } from './config';
import type { ApiCard, CharacterInfo } from './state';

const characterCache = new Map<string, CharacterInfo[]>();
const startingRelicImageCache = new Map<string, Promise<string | null>>();
const relicImageCache = new Map<string, Promise<string | null>>();
const keywordCache = new Map<string, Record<string, string>>();
const cardCache = new Map<string, ApiCard[]>();
let stableCardImageMapCache: Promise<Map<string, string>> | null = null;
let dataVersionsCache: Record<DataChannel, string> | null = null;
type CardColor = CharacterId | 'colorless';

function getChannelParams(dataChannel: DataChannel): Record<string, string> {
  return dataChannel === 'beta' ? { channel: 'beta' } : {};
}

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

function loadRelicImage(relicId: string): Promise<string | null> {
  const cached = relicImageCache.get(relicId);
  if (cached) return cached;
  const request = fetchOptionalJson<{ image_url: string | null }>(`/relics/${relicId}`)
    .then(relic => resolveAssetUrl(relic?.image_url) || null)
    .catch(() => null);
  relicImageCache.set(relicId, request);
  return request;
}

function loadStartingRelicImage(characterId: CharacterId, dataChannel: DataChannel): Promise<string | null> {
  const cacheKey = `${dataChannel}:${characterId}`;
  const cached = startingRelicImageCache.get(cacheKey);
  if (cached) return cached;
  const request = fetchOptionalJson<{ starting_relics: string[] | null }>(`/characters/${characterId}`, {
    lang: 'eng',
    ...getChannelParams(dataChannel),
  }).then(detail => {
    const relicName = detail?.starting_relics?.[0];
    return relicName ? loadRelicImage(toSnakeCase(relicName)) : null;
  }).catch(() => null);
  startingRelicImageCache.set(cacheKey, request);
  return request;
}

export function isSupportedApiLanguage(code: string): boolean {
  return API_LANGUAGES.some(item => item.code === code);
}

export async function loadCharacters(apiLanguage: string, dataChannel: DataChannel): Promise<CharacterInfo[]> {
  const cacheKey = `${dataChannel}:${apiLanguage}`;
  const cached = characterCache.get(cacheKey);
  if (cached) return cached;
  const items = await fetchJson<Array<{ id: string; name: string }>>('/characters', {
    lang: apiLanguage,
    ...getChannelParams(dataChannel),
  });
  const characters = await Promise.all(CHARACTER_IDS.map(async id => {
    const match = items.find(item => item.id.toLowerCase() === id);
    if (!match) throw new Error(`Missing character: ${id}`);
    return {
      id,
      name: match.name,
      imageUrl: await loadStartingRelicImage(id, dataChannel),
    } satisfies CharacterInfo;
  }));
  characterCache.set(cacheKey, characters);
  return characters;
}

export async function loadKeywords(apiLanguage: string, dataChannel: DataChannel): Promise<Record<string, string>> {
  const cacheKey = `${dataChannel}:${apiLanguage}`;
  const cached = keywordCache.get(cacheKey);
  if (cached) return cached;
  const items = await fetchJson<Array<{ id: string; name: string }>>('/keywords', {
    lang: apiLanguage,
    ...getChannelParams(dataChannel),
  });
  const keywords: Record<string, string> = {};
  items.forEach(item => {
    keywords[item.id.toUpperCase()] = item.name;
  });
  keywordCache.set(cacheKey, keywords);
  return keywords;
}

function loadStableCardImageMap(): Promise<Map<string, string>> {
  if (stableCardImageMapCache) return stableCardImageMapCache;
  stableCardImageMapCache = fetchJson<ApiCard[]>('/cards', { lang: 'eng' })
    .then(cards => new Map(cards.flatMap(card => card.image_url ? [[card.id, card.image_url] as const] : [])))
    .catch(() => new Map());
  return stableCardImageMapCache;
}

async function loadCardsByColor(color: CardColor, apiLanguage: string, dataChannel: DataChannel): Promise<ApiCard[]> {
  const cacheKey = `${dataChannel}:${apiLanguage}:${color}`;
  const cached = cardCache.get(cacheKey);
  if (cached) return cached;
  const cards = await fetchJson<ApiCard[]>('/cards', {
    color,
    lang: apiLanguage,
    ...getChannelParams(dataChannel),
  });
  if (dataChannel === 'stable') {
    cardCache.set(cacheKey, cards);
    return cards;
  }
  const stableImages = await loadStableCardImageMap();
  const cardsWithStableImageFallback = cards.map(card => card.image_url
    ? card
    : { ...card, image_url: stableImages.get(card.id) || null });
  cardCache.set(cacheKey, cardsWithStableImageFallback);
  return cardsWithStableImageFallback;
}

export async function loadCards(characterId: CharacterId, apiLanguage: string, dataChannel: DataChannel): Promise<{ characterCards: ApiCard[]; colorlessCards: ApiCard[] }> {
  const [characterCards, colorlessCards] = await Promise.all([
    loadCardsByColor(characterId, apiLanguage, dataChannel),
    loadCardsByColor('colorless', apiLanguage, dataChannel),
  ]);
  return { characterCards, colorlessCards };
}

export async function loadDefaultEnglishKeywords(dataChannel: DataChannel): Promise<Record<string, string>> {
  return loadKeywords('eng', dataChannel);
}

export async function loadDefaultEnglishCards(characterId: CharacterId, dataChannel: DataChannel): Promise<{ characterCards: ApiCard[]; colorlessCards: ApiCard[] }> {
  const [characterCards, colorlessCards] = await Promise.all([
    loadCardsByColor(characterId, 'eng', dataChannel),
    loadCardsByColor('colorless', 'eng', dataChannel),
  ]);
  return { characterCards, colorlessCards };
}

export async function loadDataVersions(): Promise<Record<DataChannel, string>> {
  if (dataVersionsCache) return dataVersionsCache;
  let betaVersion = BETA_DATA_VERSION_FALLBACK;
  try {
    const response = await fetchJson<{ beta_version?: string }>('/beta/version');
    if (response.beta_version) betaVersion = response.beta_version;
  } catch {
    // The fallback keeps version selection usable during a metadata outage.
  }
  dataVersionsCache = {
    stable: STABLE_DATA_VERSION,
    beta: betaVersion,
  };
  return dataVersionsCache;
}
