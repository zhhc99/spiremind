import { DEFAULT_TIER_LABELS, TIER_COLOR_VARS, t, type CharacterId, type UiLanguage } from './config';
import { getCardImageUrl } from './cards';
import type { ApiCard, CharacterProjectData, ProjectTier } from './state';

export type ImportedProject = {
  character: CharacterId | null;
  language: string | null;
  data: CharacterProjectData;
};

export function createDefaultTiers(): ProjectTier[] {
  return DEFAULT_TIER_LABELS.map(label => ({ label, cards: [] }));
}

export function ensureCharacterProject(project: Record<string, CharacterProjectData>, characterId: CharacterId): CharacterProjectData {
  if (!project[characterId]) project[characterId] = { tiers: createDefaultTiers(), notes: {} };
  if (!Array.isArray(project[characterId].tiers) || project[characterId].tiers.length === 0) project[characterId].tiers = createDefaultTiers();
  if (!project[characterId].notes) project[characterId].notes = {};
  return project[characterId];
}

export function getTierColor(index: number): string {
  const variable = TIER_COLOR_VARS[index] || TIER_COLOR_VARS[TIER_COLOR_VARS.length - 1];
  return `var(${variable})`;
}

export function moveCard(project: CharacterProjectData, cardId: string, toTierIndex: number | null, beforeCardId: string | null = null): void {
  project.tiers.forEach(tier => {
    const found = tier.cards.indexOf(cardId);
    if (found >= 0) tier.cards.splice(found, 1);
  });
  if (toTierIndex == null) return;
  if (!project.tiers[toTierIndex]) throw new Error(`Invalid tier index: ${toTierIndex}`);
  const targetCards = project.tiers[toTierIndex].cards;
  if (beforeCardId) {
    const beforeIndex = targetCards.indexOf(beforeCardId);
    if (beforeIndex >= 0) {
      targetCards.splice(beforeIndex, 0, cardId);
      return;
    }
  }
  targetCards.push(cardId);
}

export function addTier(project: CharacterProjectData): void {
  const label = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'][project.tiers.length] || `T${project.tiers.length + 1}`;
  project.tiers.push({ label, cards: [] });
}

export function removeTier(project: CharacterProjectData, tierIndex: number): void {
  if (!project.tiers[tierIndex]) throw new Error(`Invalid tier index: ${tierIndex}`);
  project.tiers.splice(tierIndex, 1);
  if (project.tiers.length === 0) project.tiers = createDefaultTiers();
}

export function setNote(project: CharacterProjectData, cardId: string, text: string): void {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    delete project.notes[cardId];
    return;
  }
  project.notes[cardId] = normalized;
}

export function exportJson(characterId: CharacterId, apiLanguage: string, project: CharacterProjectData): string {
  return `${JSON.stringify({
    version: 1,
    character: characterId,
    language: apiLanguage,
    tiers: project.tiers,
    notes: Object.fromEntries(Object.entries(project.notes).sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2)}\n`;
}

export function importJson(text: string): ImportedProject {
  const raw = JSON.parse(text) as {
    character?: CharacterId | null;
    language?: string | null;
    tiers?: Array<{ label?: unknown; cards?: unknown }>;
    notes?: Record<string, unknown>;
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid JSON format');
  const tiers = Array.isArray(raw.tiers)
    ? raw.tiers.map(tier => ({
        label: typeof tier?.label === 'string' && tier.label.trim() ? tier.label : '?',
        cards: Array.isArray(tier?.cards) ? tier.cards.filter((cardId): cardId is string => typeof cardId === 'string') : [],
      }))
    : createDefaultTiers();
  const notes = raw.notes && typeof raw.notes === 'object'
    ? Object.fromEntries(Object.entries(raw.notes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {};
  return {
    character: raw.character ?? null,
    language: raw.language ?? null,
    data: { tiers, notes },
  };
}

export function normalizeImportedProject(project: CharacterProjectData, validCardIds: Set<string>): CharacterProjectData {
  const seen = new Set<string>();
  const tiers = (project.tiers.length ? project.tiers : createDefaultTiers()).map(tier => {
    const cards: string[] = [];
    tier.cards.forEach(cardId => {
      if (!validCardIds.has(cardId) || seen.has(cardId)) return;
      seen.add(cardId);
      cards.push(cardId);
    });
    return { label: tier.label || '?', cards };
  });
  const notes: Record<string, string> = {};
  Object.entries(project.notes).forEach(([cardId, note]) => {
    if (!validCardIds.has(cardId)) return;
    if (!note.trim()) return;
    notes[cardId] = note.replace(/\r\n/g, '\n').trim();
  });
  return { tiers, notes };
}

export function exportMarkdown(characterName: string, project: CharacterProjectData, cards: ApiCard[], uiLanguage: UiLanguage): string {
  const cardMap = new Map(cards.map(card => [card.id, card]));
  const assigned = new Set(project.tiers.flatMap(tier => tier.cards));
  const lines = [`# ${characterName}`, ''];
  project.tiers.forEach(tier => {
    lines.push(`## ${tier.label}`);
    lines.push('');
    if (tier.cards.length === 0) {
      lines.push('-');
      lines.push('');
      return;
    }
    tier.cards.forEach(cardId => {
      const card = cardMap.get(cardId);
      if (!card) return;
      const note = project.notes[cardId]?.replace(/\s*\n\s*/g, ' ').trim();
      lines.push(note ? `- ${card.name}: ${note}` : `- ${card.name}`);
    });
    lines.push('');
  });
  const unclassified = cards.filter(card => !assigned.has(card.id));
  if (unclassified.length) {
    lines.push(`## ${t(uiLanguage, 'unclassified')}`);
    lines.push('');
    unclassified.forEach(card => {
      const note = project.notes[card.id]?.replace(/\s*\n\s*/g, ' ').trim();
      lines.push(note ? `- ${card.name}: ${note}` : `- ${card.name}`);
    });
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

function resolveCssValue(variableName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

type Html2Canvas = (element: HTMLElement, options?: {
  backgroundColor?: string;
  scale?: number;
  useCORS?: boolean;
  width?: number;
  height?: number;
  foreignObjectRendering?: boolean;
  imageTimeout?: number;
}) => Promise<HTMLCanvasElement>;

export async function exportTierImage(project: CharacterProjectData, cards: ApiCard[]): Promise<Blob> {
  if (project.tiers.length === 0) throw new Error('No tiers');
  const renderer = (window as Window & { html2canvas?: Html2Canvas }).html2canvas;
  if (!renderer) throw new Error('html2canvas unavailable');
  const assigned = new Set(project.tiers.flatMap(tier => tier.cards));
  await Promise.all(cards.filter(card => assigned.has(card.id)).map(card => loadImage(getCardImageUrl(card))));
  const tierRows = Array.from(document.querySelectorAll<HTMLElement>('.tier-row'));
  if (!tierRows.length) throw new Error('No tier rows');
  const backgroundColor = resolveCssValue('--md-sys-color-background');
  const exportRowWidth = 608;
  const exportPadding = 16;
  const container = document.createElement('div');
  container.style.cssText = `width:${exportRowWidth + exportPadding * 2}px;padding:${exportPadding}px;margin:0 auto;background:${backgroundColor};display:flex;flex-direction:column;gap:12px;font-family:system-ui,sans-serif`;
  tierRows.forEach((row, tierIndex) => {
    const clone = row.cloneNode(true) as HTMLElement;
    clone.classList.remove('drag-over', 'dragging');
    clone.style.width = `${exportRowWidth}px`;
    clone.style.minHeight = '100px';
    clone.querySelector('.tier-drag-handle')?.remove();
    clone.querySelector('.tier-actions')?.remove();
    clone.querySelector('.card-drop-indicator')?.remove();
    const labelWrap = clone.querySelector<HTMLElement>('.tier-label-wrap');
    if (labelWrap) {
      labelWrap.style.width = '56px';
      labelWrap.style.setProperty('--tier-bg', getTierColor(tierIndex));
    }
    const label = clone.querySelector<HTMLElement>('.tier-label');
    if (label) {
      label.setAttribute('contenteditable', 'false');
      label.style.fontWeight = '700';
      label.style.fontSize = '1.35rem';
    }
    const cardsWrap = clone.querySelector<HTMLElement>('.tier-cards');
    if (cardsWrap) {
      cardsWrap.style.flex = '1 1 auto';
      cardsWrap.style.width = 'auto';
      cardsWrap.style.alignContent = 'center';
      cardsWrap.style.gap = '10px';
      cardsWrap.style.padding = '10px';
      cardsWrap.style.minHeight = '76px';
    }
    clone.querySelectorAll<HTMLElement>('.card-item').forEach(card => {
      card.classList.remove('dragging');
      card.draggable = false;
      card.style.width = '80px';
    });
    clone.querySelectorAll<HTMLElement>('.card-name').forEach(cardName => {
      cardName.style.fontSize = '.7rem';
    });
    container.appendChild(clone);
  });
  document.body.appendChild(container);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await renderer(container, { backgroundColor, scale: 2, useCORS: true, imageTimeout: 0 });
  } finally {
    container.remove();
  }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Canvas export failed');
  return blob;
}
