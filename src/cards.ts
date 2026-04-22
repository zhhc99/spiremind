import { API_ORIGIN, CHARACTER_ACCENTS, type CharacterId } from './config';
import type { ApiCard } from './state';

const RARITY_ORDER: Record<string, number> = { Basic: 0, Common: 1, Uncommon: 2, Rare: 3, Ancient: 4, Status: 5 };
const TYPE_ORDER: Record<string, number> = { Attack: 1, Skill: 2, Power: 3 };
const KEYWORDS_BEFORE = ['UNPLAYABLE', 'INNATE', 'ETHEREAL', 'RETAIN', 'SLY'];
const KEYWORDS_AFTER = ['EXHAUST', 'ETERNAL'];
export function getCardImageUrl(card: ApiCard): string {
  if (!card.image_url) return '';
  return card.image_url.startsWith('http') ? card.image_url : `${API_ORIGIN}${card.image_url}`;
}

export function getCardBorderColor(card: ApiCard): string {
  const rarity = card.rarity_key || 'Common';
  if (rarity === 'Basic') return 'var(--rarity-basic)';
  if (rarity === 'Common') return 'var(--rarity-common)';
  if (rarity === 'Uncommon') return 'var(--rarity-uncommon)';
  if (rarity === 'Rare') return 'var(--rarity-rare)';
  if (rarity === 'Ancient') return 'var(--rarity-ancient)';
  return 'var(--rarity-status)';
}

export function getCardHeaderBackground(card: ApiCard): string {
  const rarity = card.rarity_key || 'Common';
  if (rarity === 'Uncommon') return 'rgba(37,99,235,.12)';
  if (rarity === 'Rare') return 'rgba(217,119,6,.12)';
  if (rarity === 'Ancient') return 'rgba(124,58,237,.12)';
  if (rarity === 'Status') return 'rgba(100,116,139,.14)';
  return 'rgba(107,114,128,.14)';
}

export function sortCards(cards: ApiCard[]): ApiCard[] {
  return cards.slice().sort((left, right) => {
    const colorDiff = Number(left.color === 'colorless') - Number(right.color === 'colorless');
    if (colorDiff) return colorDiff;
    const rarityDiff = (RARITY_ORDER[left.rarity_key || 'Status'] ?? 99) - (RARITY_ORDER[right.rarity_key || 'Status'] ?? 99);
    if (rarityDiff) return rarityDiff;
    const costLeft = left.is_x_cost ? 99 : left.cost ?? 999;
    const costRight = right.is_x_cost ? 99 : right.cost ?? 999;
    if (costLeft !== costRight) return costLeft - costRight;
    const starLeft = left.is_x_star_cost ? 99 : left.star_cost ?? 999;
    const starRight = right.is_x_star_cost ? 99 : right.star_cost ?? 999;
    if (starLeft !== starRight) return starLeft - starRight;
    const typeDiff = (TYPE_ORDER[left.type_key] ?? 99) - (TYPE_ORDER[right.type_key] ?? 99);
    if (typeDiff) return typeDiff;
    return left.id.localeCompare(right.id);
  });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanDescription(text: string): string {
  return text.replace(/\[(?!\/?(gold|red|blue|green|purple|orange|energy|star|upgrade)\b)[^\]]+\]/gi, '');
}

function normalizeSearchText(text: string): string {
  return cleanDescription(text)
    .replace(/\[\/?(gold|red|blue|green|purple|orange|upgrade)\]/gi, ' ')
    .replace(/\[energy:\d+\]/gi, ' energy ')
    .replace(/\[star:\d+\]/gi, ' star ')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getResolvedValue(baseValue: number | string | null, upgradeValue: number | string | boolean | undefined): string {
  if (baseValue == null) return '';
  if (upgradeValue === undefined || upgradeValue === false) return String(baseValue);
  if (typeof upgradeValue === 'number') return String(upgradeValue);
  if (typeof upgradeValue === 'string' && /^[+-]?\d+$/.test(upgradeValue) && typeof baseValue === 'number' && /^[+-]?\d+$/.test(String(baseValue))) {
    return String(Number(baseValue) + Number(upgradeValue));
  }
  return String(upgradeValue);
}

function normalizeVariableValue(value: number | string | null | undefined): number | string | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (/^[+-]?\d+$/.test(value)) return Number(value);
  return value;
}

function getUpgradeField(card: ApiCard, variableName: string): number | string | boolean | undefined {
  const upgrade = card.upgrade || {};
  const direct = variableName.toLowerCase();
  if (upgrade[direct] !== undefined) return upgrade[direct];
  if (direct.endsWith('power') && upgrade[direct.replace(/power$/, '')] !== undefined) return upgrade[direct.replace(/power$/, '')];
  return undefined;
}

function getResolvedVariableValue(card: ApiCard, variableName: string, upgraded: boolean): string {
  const variableValue = card.vars?.[variableName] ?? card.vars?.[variableName.toLowerCase()];
  if (variableValue == null) return '';
  if (!upgraded) return String(variableValue);
  return getResolvedValue(normalizeVariableValue(variableValue), getUpgradeField(card, variableName));
}

function getUpgradedCost(card: ApiCard): string {
  if (card.is_x_cost) return 'X';
  if (!card.upgrade) return card.cost == null ? '-' : String(card.cost);
  if (typeof card.upgrade.cost === 'number') return String(card.upgrade.cost);
  if (card.upgrade.cost_minus_2 && card.cost != null) return String(Math.max(0, card.cost - 2));
  if (card.upgrade.cost_minus_1 && card.cost != null) return String(Math.max(0, card.cost - 1));
  return card.cost == null ? '-' : String(card.cost);
}

export function getCardCost(card: ApiCard, upgraded: boolean): string {
  if (card.is_x_cost) return 'X';
  if (!upgraded) return card.cost == null ? '-' : String(card.cost);
  return getUpgradedCost(card);
}

export function getCardStarCost(card: ApiCard, upgraded: boolean): string | null {
  if (card.is_x_star_cost) return 'X';
  if (!upgraded) return card.star_cost && card.star_cost > 0 ? String(card.star_cost) : null;
  if (card.upgrade?.star_cost !== undefined) return String(card.upgrade.star_cost);
  if (card.upgrade?.star_cost_minus_1 && card.star_cost != null) return String(Math.max(0, card.star_cost - 1));
  return card.star_cost && card.star_cost > 0 ? String(card.star_cost) : null;
}

function formatUpgradeText(card: ApiCard, upgraded: boolean): string {
  const fallback = upgraded ? card.upgrade_description || card.description || '' : card.description || '';
  if (!card.description_raw) return fallback;
  let text = card.description_raw;
  text = text.replaceAll('{singleStarIcon}', '[star:1]').replaceAll('{singleEnergyIcon}', '[energy:1]');
  text = text.replace(/\{(\w+):(\w+)(?:\((\d*)\))?\}/g, (_, rawName: string, rawFunction: string, rawParam: string) => {
    const variableName = rawName;
    const variableValue = getResolvedVariableValue(card, variableName, upgraded);
    const baseValue = card.vars?.[variableName] ?? card.vars?.[variableName.toLowerCase()];
    const functionName = rawFunction.toLowerCase();
    if (functionName === 'energyicons') return `[energy:${rawParam || variableValue || 0}]`;
    if (functionName === 'staricons') return `[star:${rawParam || variableValue || 0}]`;
    if (functionName !== 'diff') return variableValue == null ? '' : String(variableValue);
    if (!upgraded) return variableValue == null ? '' : String(variableValue);
    const nextValue = getResolvedValue(normalizeVariableValue(baseValue == null ? null : baseValue), getUpgradeField(card, variableName));
    if (String(baseValue ?? '') === nextValue) return nextValue;
    return `[upgrade]${nextValue}[/upgrade]`;
  });
  text = text.replace(/\{(\w+)\}/g, (_, rawName: string) => {
    const value = card.vars?.[rawName] ?? card.vars?.[rawName.toLowerCase()];
    return value == null ? `{${rawName}}` : String(value);
  });
  text = text.replace(/\{(\w+):([^{}]+)\}/g, (full, rawCondition: string, rawContent: string) => {
    const condition = rawCondition.toLowerCase();
    if (condition === 'incombat') return '';
    if (condition !== 'ifupgraded') return full;
    const splitIndex = rawContent.indexOf('|');
    const trueBranch = splitIndex >= 0 ? rawContent.slice(0, splitIndex) : rawContent;
    const falseBranch = splitIndex >= 0 ? rawContent.slice(splitIndex + 1) : '';
    if (!upgraded) return falseBranch;
    const cleaned = trueBranch.startsWith('show:') ? trueBranch.slice(5) : trueBranch;
    if (!cleaned) return '';
    return cleaned.trimStart().startsWith('[') ? cleaned : `[upgrade]${cleaned}[/upgrade]`;
  });
  if (/[{}]/.test(text)) return fallback;
  return text;
}

export function buildCardDescription(card: ApiCard, upgraded: boolean, keywords: Record<string, string>, apiLanguage: string): string {
  const list = (card.keywords_key || []).map(keyword => keyword.toUpperCase());
  if (upgraded && card.upgrade) {
    if (card.upgrade.add_innate && !list.includes('INNATE')) list.push('INNATE');
    if (card.upgrade.add_ethereal && !list.includes('ETHEREAL')) list.push('ETHEREAL');
    if (card.upgrade.add_exhaust && !list.includes('EXHAUST')) list.push('EXHAUST');
    if (card.upgrade.add_retain && !list.includes('RETAIN')) list.push('RETAIN');
    if (card.upgrade.add_sly && !list.includes('SLY')) list.push('SLY');
    if (card.upgrade.remove_exhaust) for (let index = list.indexOf('EXHAUST'); index >= 0; index = list.indexOf('EXHAUST')) list.splice(index, 1);
    if (card.upgrade.remove_ethereal) for (let index = list.indexOf('ETHEREAL'); index >= 0; index = list.indexOf('ETHEREAL')) list.splice(index, 1);
    if (card.upgrade.remove_innate) for (let index = list.indexOf('INNATE'); index >= 0; index = list.indexOf('INNATE')) list.splice(index, 1);
    if (card.upgrade.remove_retain) for (let index = list.indexOf('RETAIN'); index >= 0; index = list.indexOf('RETAIN')) list.splice(index, 1);
    if (card.upgrade.remove_unplayable) for (let index = list.indexOf('UNPLAYABLE'); index >= 0; index = list.indexOf('UNPLAYABLE')) list.splice(index, 1);
    if (card.upgrade.remove_sly) for (let index = list.indexOf('SLY'); index >= 0; index = list.indexOf('SLY')) list.splice(index, 1);
    if (card.upgrade.remove_eternal) for (let index = list.indexOf('ETERNAL'); index >= 0; index = list.indexOf('ETERNAL')) list.splice(index, 1);
  }
  const period = apiLanguage === 'zhs' || apiLanguage === 'jpn' ? '。' : '.';
  const headerLines = KEYWORDS_BEFORE.filter(keyword => list.includes(keyword)).map(keyword => `[gold]${keywords[keyword] || keyword}[/gold]${period}`);
  const footerLines = KEYWORDS_AFTER.filter(keyword => list.includes(keyword)).map(keyword => `[gold]${keywords[keyword] || keyword}[/gold]${period}`);
  const middle = formatUpgradeText(card, upgraded);
  return [...headerLines, middle, ...footerLines].filter(Boolean).join('\n');
}

function getSingleCardSearchText(card: ApiCard, keywords: Record<string, string>, apiLanguage: string): string {
  const keywordNames = (card.keywords_key || []).map(keyword => keywords[keyword.toUpperCase()] || keyword);
  return normalizeSearchText([
    card.name,
    card.id,
    buildCardDescription(card, false, keywords, apiLanguage),
    buildCardDescription(card, true, keywords, apiLanguage),
    ...keywordNames,
  ].join('\n'));
}

export function buildCardSearchIndex(cards: ApiCard[], keywords: Record<string, string>, apiLanguage: string, englishCards: ApiCard[] = [], englishKeywords: Record<string, string> = {}): Record<string, string> {
  const englishMap = new Map(englishCards.map(card => [card.id, card]));
  return Object.fromEntries(cards.map(card => {
    const searchParts = [getSingleCardSearchText(card, keywords, apiLanguage)];
    const englishCard = englishMap.get(card.id);
    if (englishCard) searchParts.push(getSingleCardSearchText(englishCard, englishKeywords, ''));
    return [card.id, normalizeSearchText(searchParts.join('\n'))];
  }));
}

export function renderRichText(text: string, characterId: CharacterId): string {
  const safe = escapeHtml(cleanDescription(text));
  const energyColor = CHARACTER_ACCENTS[characterId];
  return safe
    .replace(/\[upgrade\](.*?)\[\/upgrade\]/g, '<span class="upv">$1</span>')
    .replace(/\[gold\](.*?)\[\/gold\]/g, '<span class="gold">$1</span>')
    .replace(/\[red\](.*?)\[\/red\]/g, '<span class="red">$1</span>')
    .replace(/\[blue\](.*?)\[\/blue\]/g, '<span class="blue">$1</span>')
    .replace(/\[green\](.*?)\[\/green\]/g, '<span class="green">$1</span>')
    .replace(/\[purple\](.*?)\[\/purple\]/g, '<span class="purple">$1</span>')
    .replace(/\[orange\](.*?)\[\/orange\]/g, '<span class="orange">$1</span>')
    .replace(/\[energy:(\d+)\]/g, (_, rawCount: string) => {
      const count = Number(rawCount);
      return count >= 4 ? `${count}<span style="color:${energyColor}">●</span>` : `<span style="color:${energyColor}">${'●'.repeat(count)}</span>`;
    })
    .replace(/\[star:(\d+)\]/g, (_, rawCount: string) => {
      const count = Number(rawCount);
      return count >= 4 ? `${count}🔷` : '🔷'.repeat(count);
    });
}
