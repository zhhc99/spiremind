import { isSupportedApiLanguage, loadCards, loadCharacters, loadKeywords } from './api';
import { CHARACTER_IDS, getUiLanguage, t } from './config';
import { dom, saveState, state } from './state';
import { addTier as appendTier, exportJson, exportMarkdown, exportTierImage, importJson, moveCard, normalizeImportedProject, removeTier, setNote } from './tierlist';
import { findCardById, getAllCards, getProject, hideHoverPreview, renderAll, renderDock, renderMenus, renderPopup, renderTierStage, setLoading, showHoverPreview, showSnackbar } from './render';

type DesktopDrag =
  | { kind: 'card'; cardId: string; sourceElement: HTMLElement }
  | { kind: 'tier'; sourceElement: HTMLElement };

type TouchDragBase = {
  sourceElement: HTMLElement;
  startY: number;
  dragging: boolean;
  clone: HTMLElement | null;
  width: number;
  height: number;
};

type TouchCardDrag = TouchDragBase & {
  kind: 'card';
  cardId: string;
  startX: number;
};

type TouchTierDrag = TouchDragBase & {
  kind: 'tier';
};

type TouchDrag = TouchCardDrag | TouchTierDrag;

let hoverCardId = '';
let hoverX = 0;
let hoverY = 0;
let hoverUpgraded = false;
let desktopDrag: DesktopDrag | null = null;
let dragHint: HTMLElement | null = null;
let cardDropIndicator: HTMLElement | null = null;
let touchDrag: TouchDrag | null = null;
let tierRowDragArmed = false;

function getCurrentUiLanguage() {
  return getUiLanguage(state.apiLang);
}

function flipRows(rows: HTMLElement[], apply: () => void): void {
  const tops = new Map(rows.map(row => [row, row.getBoundingClientRect().top]));
  apply();
  rows.forEach(row => {
    const before = tops.get(row);
    if (before == null) return;
    const delta = before - row.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) return;
    row.style.transition = 'none';
    row.style.transform = `translateY(${delta}px)`;
    requestAnimationFrame(() => {
      row.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)';
      row.style.transform = '';
      row.addEventListener('transitionend', function handle() {
        row.style.transition = '';
        row.removeEventListener('transitionend', handle);
      });
    });
  });
}

function flipCards(apply: () => void): void {
  const positions = new Map(
    Array.from(dom.tierStage.querySelectorAll<HTMLElement>('.card-item'))
      .map(card => [card.dataset.id || '', card.getBoundingClientRect()] as const)
      .filter(([cardId]) => !!cardId),
  );
  apply();
  dom.tierStage.querySelectorAll<HTMLElement>('.card-item').forEach(card => {
    const before = positions.get(card.dataset.id || '');
    if (!before) return;
    const after = card.getBoundingClientRect();
    const deltaX = before.left - after.left;
    const deltaY = before.top - after.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
    card.style.transition = 'none';
    card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    requestAnimationFrame(() => {
      card.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)';
      card.style.transform = '';
      card.addEventListener('transitionend', function handle() {
        card.style.transition = '';
        card.removeEventListener('transitionend', handle);
      });
    });
  });
}

function closeMenus(): void {
  if (!state.openMenu) return;
  state.openMenu = null;
  renderMenus();
}

function toggleMenu(menu: 'character' | 'api-language'): void {
  state.openMenu = state.openMenu === menu ? null : menu;
  renderMenus();
}

function resetPopupState(cardId: string | null = null): void {
  state.popup.cardId = cardId;
  state.popup.editing = false;
  state.popup.upgraded = false;
}

function resetViewState(): void {
  clearHover();
  resetPopupState();
}

function clearHover(): void {
  hoverCardId = '';
  hideHoverPreview();
}

function isPreviewBlocked(): boolean {
  return !!state.popup.cardId || !!desktopDrag || !!touchDrag?.dragging;
}

function refreshHoverPreview(): void {
  if (!hoverCardId || isPreviewBlocked()) return;
  const card = findCardById(hoverCardId);
  if (!card) {
    clearHover();
    return;
  }
  showHoverPreview(card, hoverX, hoverY, hoverUpgraded);
}

function createFloatingClone(source: HTMLElement, styles: Partial<CSSStyleDeclaration>): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.pointerEvents = 'none';
  Object.assign(clone.style, styles);
  document.body.appendChild(clone);
  return clone;
}

function removeDragHint(): void {
  dragHint?.remove();
  dragHint = null;
}

function removeCardDropIndicator(): void {
  cardDropIndicator?.remove();
  cardDropIndicator = null;
}

function createDragHint(source: HTMLElement): HTMLElement {
  removeDragHint();
  const hint = createFloatingClone(source, {
    left: '-9999px',
    top: '-9999px',
    width: `${source.getBoundingClientRect().width}px`,
    opacity: '.96',
    transform: 'scale(1.02)',
    boxShadow: '0 8px 24px rgba(0,0,0,.2)',
  });
  dragHint = hint;
  return hint;
}

function clearTierHighlights(): void {
  document.querySelectorAll('.tier-row.drag-over').forEach(row => row.classList.remove('drag-over'));
  removeCardDropIndicator();
}

function resolveCardDropTarget(element: HTMLElement | null): HTMLElement | null {
  const zone = element?.closest<HTMLElement>('.tier-cards, #dockCards');
  if (zone) return zone;
  const row = element?.closest<HTMLElement>('.tier-row');
  if (row) return row.querySelector<HTMLElement>('.tier-cards');
  if (element?.closest('#dockPanel')) return dom.dockCards;
  return null;
}

function getZoneCards(zone: HTMLElement, draggingCardId: string): HTMLElement[] {
  return Array.from(zone.querySelectorAll<HTMLElement>('.card-item')).filter(card => (card.dataset.id || '') !== draggingCardId);
}

function getTierCardRows(zone: HTMLElement, draggingCardId: string): Array<{ cards: Array<{ element: HTMLElement; rect: DOMRect }>; top: number; bottom: number }> {
  const rows: Array<{ cards: Array<{ element: HTMLElement; rect: DOMRect }>; top: number; bottom: number }> = [];
  getZoneCards(zone, draggingCardId).forEach(card => {
    const rect = card.getBoundingClientRect();
    const row = rows.find(item => Math.abs(item.top - rect.top) < 8);
    if (row) {
      row.cards.push({ element: card, rect });
      row.top = Math.min(row.top, rect.top);
      row.bottom = Math.max(row.bottom, rect.bottom);
      return;
    }
    rows.push({ cards: [{ element: card, rect }], top: rect.top, bottom: rect.bottom });
  });
  rows.sort((left, right) => left.top - right.top);
  rows.forEach(row => row.cards.sort((left, right) => left.rect.left - right.rect.left));
  return rows;
}

function getClosestTierRow(rows: Array<{ top: number; bottom: number }>, clientY: number): number {
  return rows.reduce((bestIndex, _, index) => {
    const best = rows[bestIndex];
    const current = rows[index];
    const bestCenter = (best.top + best.bottom) / 2;
    const currentCenter = (current.top + current.bottom) / 2;
    return Math.abs(clientY - currentCenter) < Math.abs(clientY - bestCenter) ? index : bestIndex;
  }, 0);
}

function ensureCardDropIndicator(zone: HTMLElement): HTMLElement {
  if (!cardDropIndicator) {
    cardDropIndicator = document.createElement('div');
    cardDropIndicator.className = 'card-drop-indicator';
  }
  zone.appendChild(cardDropIndicator);
  return cardDropIndicator;
}

function showCardDropIndicator(zone: HTMLElement, draggingCardId: string, beforeCardId: string | null): void {
  const rows = getTierCardRows(zone, draggingCardId);
  const styles = getComputedStyle(zone);
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const zoneRect = zone.getBoundingClientRect();
  let left = paddingLeft / 2;
  let top = zone.clientHeight / 2;
  if (rows.length) {
    if (beforeCardId) {
      const targetRow = rows.find(row => row.cards.some(item => (item.element.dataset.id || '') === beforeCardId)) || rows[0];
      const targetIndex = targetRow.cards.findIndex(item => (item.element.dataset.id || '') === beforeCardId);
      const target = targetRow.cards[Math.max(targetIndex, 0)];
      left = targetIndex > 0 ? target.rect.left - zoneRect.left - gap / 2 : paddingLeft / 2;
      top = target.rect.top - zoneRect.top + target.rect.height / 2;
    } else {
      const targetRow = rows.at(-1)!;
      const target = targetRow.cards.at(-1)!;
      left = target.rect.right - zoneRect.left + gap / 2;
      top = target.rect.top - zoneRect.top + target.rect.height / 2;
    }
  }
  left = Math.min(Math.max(left, 8), zone.clientWidth - 8);
  const indicator = ensureCardDropIndicator(zone);
  indicator.style.left = `${left}px`;
  indicator.style.top = `${top}px`;
}

function updateCardDropHighlight(cardId: string, targetElement: HTMLElement | null, clientX: number, clientY: number): void {
  clearTierHighlights();
  const placement = resolveCardPlacement(cardId, targetElement, clientX, clientY);
  if (!placement) return;
  const zone = resolveCardDropTarget(targetElement);
  const row = zone?.closest<HTMLElement>('.tier-row') || null;
  if (row) row.classList.add('drag-over');
  if (!zone || zone.id === 'dockCards') return;
  showCardDropIndicator(zone, cardId, placement.beforeCardId);
}

function reorderTierRows(source: HTMLElement, target: HTMLElement, clientY: number): void {
  if (source === target) return;
  const rect = target.getBoundingClientRect();
  const rows = Array.from(dom.tierStage.querySelectorAll<HTMLElement>('.tier-row'));
  flipRows(rows, () => {
    if (clientY < rect.top + rect.height / 2) dom.tierStage.insertBefore(source, target);
    else dom.tierStage.insertBefore(source, target.nextElementSibling);
  });
}

function syncTierProjectFromDom(): void {
  const rows = Array.from(dom.tierStage.querySelectorAll<HTMLElement>('.tier-row'));
  const previous = getProject().tiers.slice();
  getProject().tiers = rows.map((row, index) => {
    const tier = previous[Number(row.dataset.tierIndex)] || { label: String(index + 1), cards: [] };
    const label = (row.querySelector<HTMLElement>('[data-tier-label]')?.textContent || '').replace(/\n+/g, '').trim();
    tier.label = label || '?';
    return tier;
  });
}

function clearLoadedData(): void {
  state.characters = {};
  state.keywords = {};
  state.cards = {};
}

function renderAllAndSave(): void {
  renderAll();
  saveState();
}

function renderTierStageAndSave(): void {
  renderTierStage();
  saveState();
}

function renderTierStageDockAndSave(): void {
  renderTierStage();
  renderDock();
  saveState();
}

function resolveTierInsertion(zone: HTMLElement, cardId: string, clientX: number, clientY: number): string | null {
  const rows = getTierCardRows(zone, cardId);
  if (!rows.length) return null;
  const rowIndex = getClosestTierRow(rows, clientY);
  const row = rows[rowIndex];
  for (const item of row.cards) {
    if (clientX < item.rect.left + item.rect.width / 2) return item.element.dataset.id || null;
  }
  if (rowIndex < rows.length - 1) return rows[rowIndex + 1].cards[0]?.element.dataset.id || null;
  return null;
}

function resolveCardPlacement(cardId: string, targetElement: HTMLElement | null, clientX: number, clientY: number): { tierIndex: number | null; beforeCardId: string | null } | null {
  const zone = resolveCardDropTarget(targetElement);
  if (!zone) return null;
  if (zone.id === 'dockCards') return { tierIndex: null, beforeCardId: null };
  return {
    tierIndex: Number(zone.dataset.tierIndex),
    beforeCardId: resolveTierInsertion(zone, cardId, clientX, clientY),
  };
}

function moveCardTo(cardId: string, targetElement: HTMLElement | null, clientX: number, clientY: number): void {
  const placement = resolveCardPlacement(cardId, targetElement, clientX, clientY);
  if (!placement) return;
  flipCards(() => {
    moveCard(getProject(), cardId, placement.tierIndex, placement.beforeCardId);
    renderTierStageDockAndSave();
  });
}

function finishDesktopDrag(): void {
  if (!desktopDrag) return;
  const current = desktopDrag;
  desktopDrag = null;
  current.sourceElement.classList.remove('dragging');
  clearTierHighlights();
  removeDragHint();
  if (current.kind === 'tier') {
    syncTierProjectFromDom();
    renderTierStageAndSave();
  }
}

function beginTouchDrag(): void {
  if (!touchDrag || touchDrag.dragging) return;
  touchDrag.dragging = true;
  clearHover();
  if (touchDrag.kind === 'card') {
    touchDrag.sourceElement.classList.add('dragging');
    touchDrag.clone = createFloatingClone(touchDrag.sourceElement, {
      zIndex: '1000',
      opacity: '.9',
      transform: 'scale(1.05)',
      width: `${touchDrag.width}px`,
      height: `${touchDrag.height}px`,
    });
    return;
  }
  touchDrag.sourceElement.style.opacity = '.4';
  touchDrag.clone = createFloatingClone(touchDrag.sourceElement, {
    zIndex: '1000',
    opacity: '.9',
    width: `${touchDrag.width}px`,
    boxShadow: '0 8px 24px rgba(0,0,0,.2)',
  });
}

function finishTouchDrag(clientX: number, clientY: number, cancelled = false): void {
  if (!touchDrag) return;
  const current = touchDrag;
  touchDrag = null;
  current.clone?.remove();
  clearTierHighlights();
  if (current.kind === 'card') {
    const target = current.dragging ? document.elementFromPoint(clientX, clientY) as HTMLElement | null : null;
    current.sourceElement.classList.remove('dragging');
    if (current.dragging && !cancelled) moveCardTo(current.cardId, target, clientX, clientY);
    else if (!cancelled) openPopup(current.cardId);
    return;
  }
  current.sourceElement.style.opacity = '';
  if (current.dragging) {
    syncTierProjectFromDom();
    renderTierStageAndSave();
  }
}

async function loadCurrentData(includeLanguageData: boolean): Promise<void> {
  setLoading(t(getCurrentUiLanguage(), 'loadingData'), true);
  if (includeLanguageData) {
    const [characters, keywords] = await Promise.all([loadCharacters(state.apiLang), loadKeywords(state.apiLang)]);
    state.characters = Object.fromEntries(characters.map(character => [character.id, character]));
    state.keywords = keywords;
  }
  state.cards[state.currentCharacter] = await loadCards(state.currentCharacter, state.apiLang);
}

async function applyLoadedState(includeLanguageData: boolean, afterLoad?: () => void, persist = true): Promise<void> {
  try {
    await loadCurrentData(includeLanguageData);
    afterLoad?.();
    if (persist) renderAllAndSave();
    else renderAll();
  } finally {
    setLoading('', false);
  }
}

async function selectCharacter(characterId: string): Promise<void> {
  if (!CHARACTER_IDS.includes(characterId as typeof CHARACTER_IDS[number])) throw new Error(`Unsupported character: ${characterId}`);
  if (state.currentCharacter === characterId) {
    closeMenus();
    return;
  }
  resetViewState();
  state.currentCharacter = characterId as typeof CHARACTER_IDS[number];
  closeMenus();
  await applyLoadedState(false);
}

async function selectApiLanguage(apiLanguage: string): Promise<void> {
  if (apiLanguage === state.apiLang) {
    closeMenus();
    return;
  }
  if (!isSupportedApiLanguage(apiLanguage)) throw new Error(`Unsupported language: ${apiLanguage}`);
  resetViewState();
  state.apiLang = apiLanguage;
  clearLoadedData();
  closeMenus();
  await applyLoadedState(true);
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileSafeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

async function importProjectFile(file: File): Promise<void> {
  const text = await file.text();
  const imported = importJson(text);
  resetViewState();
  const importedLanguage = imported.language;
  const reloadLanguageData = !!(importedLanguage && isSupportedApiLanguage(importedLanguage) && importedLanguage !== state.apiLang);
  if (reloadLanguageData) {
    state.apiLang = importedLanguage;
    clearLoadedData();
  }
  if (imported.character) {
    if (!CHARACTER_IDS.includes(imported.character)) throw new Error(`Unsupported character: ${imported.character}`);
    state.currentCharacter = imported.character;
  }
  await applyLoadedState(reloadLanguageData, () => {
    const validCardIds = new Set((state.cards[state.currentCharacter] || []).map(card => card.id));
    state.project[state.currentCharacter] = normalizeImportedProject(imported.data, validCardIds);
  });
  showSnackbar(t(getCurrentUiLanguage(), 'jsonImported'));
}

function openPopup(cardId: string): void {
  clearHover();
  resetPopupState(cardId);
  renderPopup();
}

function closePopup(): void {
  resetPopupState();
  renderPopup();
}

function exportCurrentJson(): void {
  const project = getProject();
  const name = state.characters[state.currentCharacter]?.name || state.currentCharacter;
  download(`${fileSafeName(name)}.json`, new Blob([exportJson(state.currentCharacter, state.apiLang, project)], { type: 'application/json;charset=utf-8' }));
  showSnackbar(t(getCurrentUiLanguage(), 'jsonExported'));
}

function exportCurrentMarkdown(): void {
  const project = getProject();
  const cards = getAllCards();
  const name = state.characters[state.currentCharacter]?.name || state.currentCharacter;
  download(`${fileSafeName(name)}.md`, new Blob([exportMarkdown(name, project, cards, getCurrentUiLanguage())], { type: 'text/markdown;charset=utf-8' }));
  showSnackbar(t(getCurrentUiLanguage(), 'markdownExported'));
}

async function exportCurrentImage(): Promise<void> {
  if (getProject().tiers.length === 0) {
    showSnackbar(t(getCurrentUiLanguage(), 'noTierImage'));
    return;
  }
  try {
    showSnackbar(t(getCurrentUiLanguage(), 'imageGenerating'));
    const name = state.characters[state.currentCharacter]?.name || state.currentCharacter;
    const blob = await exportTierImage(getProject(), getAllCards());
    download(`${fileSafeName(name)}.png`, blob);
    showSnackbar(t(getCurrentUiLanguage(), 'imageExported'));
  } catch {
    showSnackbar(t(getCurrentUiLanguage(), 'imageFailed'));
  }
}

export function bindInteractions(): void {
  dom.characterBtn.addEventListener('click', event => {
    event.stopPropagation();
    toggleMenu('character');
  });
  dom.apiLanguageBtn.addEventListener('click', event => {
    event.stopPropagation();
    toggleMenu('api-language');
  });
  dom.noteMarkersBtn.addEventListener('click', () => {
    state.showNoteMarkers = !state.showNoteMarkers;
    renderAllAndSave();
  });
  dom.themeBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    renderAllAndSave();
  });
  dom.importJsonBtn.addEventListener('click', () => dom.fileInput.click());
  dom.exportJsonBtn.addEventListener('click', () => void exportCurrentJson());
  dom.exportMarkdownBtn.addEventListener('click', () => void exportCurrentMarkdown());
  dom.exportImageBtn.addEventListener('click', () => void exportCurrentImage());
  dom.addTierBtn.addEventListener('click', () => {
    appendTier(getProject());
    renderTierStageAndSave();
    showSnackbar(t(getCurrentUiLanguage(), 'tierAdded'));
  });
  dom.dockHeader.addEventListener('click', event => {
    if (!(event.target as HTMLElement).closest('[data-toggle-dock="true"]')) return;
    state.dockCollapsed = !state.dockCollapsed;
    renderDock();
    saveState();
  });
  dom.searchInput.addEventListener('input', event => {
    state.search = (event.target as HTMLInputElement).value;
    renderDock();
  });
  dom.fileInput.addEventListener('change', async event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await importProjectFile(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const invalidJson = error instanceof SyntaxError || /JSON/.test(message);
      showSnackbar(invalidJson ? t(getCurrentUiLanguage(), 'invalidJson') : t(getCurrentUiLanguage(), 'importFailed'));
    } finally {
      dom.fileInput.value = '';
    }
  });
  dom.characterMenu.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-character-select]');
    if (!button) return;
    void selectCharacter(button.dataset.characterSelect || '');
  });
  dom.apiLanguageMenu.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-api-language-select]');
    if (!button) return;
    void selectApiLanguage(button.dataset.apiLanguageSelect || '');
  });
  dom.tierStage.addEventListener('click', event => {
    const deleteButton = (event.target as HTMLElement).closest<HTMLElement>('[data-delete-tier]');
    if (deleteButton) {
      removeTier(getProject(), Number(deleteButton.dataset.deleteTier));
      renderTierStageDockAndSave();
      showSnackbar(t(getCurrentUiLanguage(), 'tierDeleted'));
      return;
    }
    const card = (event.target as HTMLElement).closest<HTMLElement>('.card-item');
    if (!card || touchDrag || desktopDrag) return;
    openPopup(card.dataset.id || '');
  });
  dom.dockCards.addEventListener('click', event => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('.card-item');
    if (!card || touchDrag || desktopDrag) return;
    openPopup(card.dataset.id || '');
  });
  dom.tierStage.addEventListener('focusout', event => {
    const label = (event.target as HTMLElement).closest<HTMLElement>('[data-tier-label]');
    if (!label) return;
    label.textContent = (label.textContent || '').replace(/\n+/g, '').trim() || '?';
    getProject().tiers[Number(label.dataset.tierLabel)].label = label.textContent;
    saveState();
  }, true);
  dom.tierStage.addEventListener('mousedown', event => {
    tierRowDragArmed = !!(event.target as HTMLElement).closest('[data-tier-drag-handle="true"]');
  });
  dom.tierStage.addEventListener('selectstart', event => {
    if ((event.target as HTMLElement).closest('[data-tier-drag-handle="true"]')) event.preventDefault();
  });
  document.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (!target.closest('.char-select-wrap')) closeMenus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Shift' && !hoverUpgraded) {
      hoverUpgraded = true;
      refreshHoverPreview();
    }
    if (event.key === 'Escape') {
      if (state.popup.cardId) {
        closePopup();
        return;
      }
      clearHover();
      closeMenus();
    }
    if (event.key === 'Tab' && !(event.target as HTMLElement).closest('[contenteditable],input,textarea')) {
      event.preventDefault();
      state.dockCollapsed = false;
      renderDock();
      dom.searchInput.focus();
    }
    const label = (event.target as HTMLElement).closest<HTMLElement>('[data-tier-label]');
    if (event.key === 'Enter' && label) {
      event.preventDefault();
      label.blur();
    }
  });
  document.addEventListener('keyup', event => {
    if (event.key !== 'Shift' || !hoverUpgraded) return;
    hoverUpgraded = false;
    refreshHoverPreview();
  });
  dom.popupOverlay.addEventListener('click', () => closePopup());
  dom.popupCard.addEventListener('click', event => {
    const toggleUpgrade = (event.target as HTMLElement).closest<HTMLElement>('[data-popup-toggle-upgrade]');
    if (toggleUpgrade) {
      state.popup.upgraded = !state.popup.upgraded;
      renderPopup();
      return;
    }
    const toggleEdit = (event.target as HTMLElement).closest<HTMLElement>('[data-popup-toggle-edit]');
    if (toggleEdit) {
      state.popup.editing = !state.popup.editing;
      renderPopup();
      return;
    }
    const enterEdit = (event.target as HTMLElement).closest<HTMLElement>('[data-enter-note-edit="true"]');
    if (enterEdit && !state.popup.editing) {
      state.popup.editing = true;
      renderPopup();
    }
  });
  dom.popupCard.addEventListener('input', event => {
    const input = (event.target as HTMLElement).closest<HTMLTextAreaElement>('[data-popup-note-input="true"]');
    if (!input || !state.popup.cardId) return;
    setNote(getProject(), state.popup.cardId, input.value);
    renderTierStage();
    renderDock();
    saveState();
  });
  dom.popupCard.addEventListener('keydown', event => {
    const input = (event.target as HTMLElement).closest<HTMLTextAreaElement>('[data-popup-note-input="true"]');
    if (!input) return;
    if (event.key === 'Escape') {
      state.popup.editing = false;
      renderPopup();
      event.stopPropagation();
    }
  });
  document.addEventListener('mouseover', event => {
    if (isPreviewBlocked()) return;
    const card = (event.target as HTMLElement).closest<HTMLElement>('.card-item');
    if (!card) return;
    hoverCardId = card.dataset.id || '';
    hoverX = (event as MouseEvent).clientX;
    hoverY = (event as MouseEvent).clientY;
    refreshHoverPreview();
  });
  document.addEventListener('mousemove', event => {
    if (!hoverCardId || isPreviewBlocked()) return;
    hoverX = event.clientX;
    hoverY = event.clientY;
    refreshHoverPreview();
  });
  document.addEventListener('mouseout', event => {
    const target = event.target as HTMLElement;
    if (!target.closest('.card-item')) return;
    const related = event.relatedTarget as HTMLElement | null;
    if (related?.closest('.card-item')) return;
    clearHover();
  });
  document.addEventListener('dragstart', event => {
    if (state.popup.cardId) {
      event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('.card-item');
    if (card) {
      const cardId = card.dataset.id || '';
      if (!cardId) {
        event.preventDefault();
        return;
      }
      clearHover();
      desktopDrag = { kind: 'card', cardId, sourceElement: card };
      card.classList.add('dragging');
      if (!event.dataTransfer) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData('text/plain', cardId);
      event.dataTransfer.setDragImage(createDragHint(card), 24, 24);
      event.dataTransfer.effectAllowed = 'move';
      return;
    }
    const handle = target.closest<HTMLElement>('[data-tier-drag-handle="true"]');
    const row = target.closest<HTMLElement>('.tier-row');
    if (!row) return;
    if (!handle && !tierRowDragArmed) {
      event.preventDefault();
      return;
    }
    tierRowDragArmed = false;
    clearHover();
    desktopDrag = { kind: 'tier', sourceElement: row };
    row.classList.add('dragging');
    if (!event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setDragImage(createDragHint(row), 24, Math.min(24, row.offsetHeight / 2));
    event.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', event => {
    const target = event.target as HTMLElement;
    if (desktopDrag?.kind === 'card') {
      if (!resolveCardDropTarget(target)) return;
      event.preventDefault();
      updateCardDropHighlight(desktopDrag.cardId, target, event.clientX, event.clientY);
      return;
    }
    if (desktopDrag?.kind !== 'tier') return;
    const row = target.closest<HTMLElement>('.tier-row');
    if (!row || row === desktopDrag.sourceElement) return;
    event.preventDefault();
    reorderTierRows(desktopDrag.sourceElement, row, event.clientY);
  });
  document.addEventListener('drop', event => {
    const target = event.target as HTMLElement;
    if (desktopDrag?.kind === 'card') {
      if (!resolveCardDropTarget(target)) return;
      event.preventDefault();
      const { cardId } = desktopDrag;
      finishDesktopDrag();
      moveCardTo(cardId, target, event.clientX, event.clientY);
      return;
    }
    if (desktopDrag?.kind === 'tier') event.preventDefault();
  });
  document.addEventListener('dragend', () => {
    tierRowDragArmed = false;
    finishDesktopDrag();
  });
  document.addEventListener('touchstart', event => {
    if (state.popup.cardId) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-tier-drag-handle="true"]');
    if (handle) {
      const row = handle.closest<HTMLElement>('.tier-row');
      if (!row) return;
      touchDrag = {
        kind: 'tier',
        sourceElement: row,
        startY: event.touches[0].clientY,
        dragging: false,
        clone: null,
        width: row.offsetWidth,
        height: row.offsetHeight,
      };
      return;
    }
    const card = target.closest<HTMLElement>('.card-item');
    if (!card) return;
    touchDrag = {
      kind: 'card',
      cardId: card.dataset.id || '',
      sourceElement: card,
      startX: event.touches[0].clientX,
      startY: event.touches[0].clientY,
      dragging: false,
      clone: null,
      width: card.offsetWidth,
      height: card.offsetHeight,
    };
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (touchDrag?.kind === 'card') {
      const touch = event.touches[0];
      const distance = Math.hypot(touch.clientX - touchDrag.startX, touch.clientY - touchDrag.startY);
      if (!touchDrag.dragging && distance > 10) beginTouchDrag();
      if (!touchDrag.dragging) return;
      if (event.cancelable) event.preventDefault();
      touchDrag.clone!.style.left = `${touch.clientX - touchDrag.width / 2}px`;
      touchDrag.clone!.style.top = `${touch.clientY - touchDrag.height / 2}px`;
      touchDrag.clone!.style.display = 'none';
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      touchDrag.clone!.style.display = '';
      updateCardDropHighlight(touchDrag.cardId, target, touch.clientX, touch.clientY);
      return;
    }
    if (touchDrag?.kind !== 'tier') return;
    const touch = event.touches[0];
    if (!touchDrag.dragging && Math.abs(touch.clientY - touchDrag.startY) > 8) beginTouchDrag();
    if (!touchDrag.dragging) return;
    if (event.cancelable) event.preventDefault();
    touchDrag.clone!.style.left = `${touchDrag.sourceElement.getBoundingClientRect().left}px`;
    touchDrag.clone!.style.top = `${touch.clientY - touchDrag.height / 2}px`;
    const row = (document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null)?.closest<HTMLElement>('.tier-row');
    if (row && row !== touchDrag.sourceElement) reorderTierRows(touchDrag.sourceElement, row, touch.clientY);
  }, { passive: false });
  document.addEventListener('touchend', event => {
    if (!touchDrag) return;
    const touch = event.changedTouches[0];
    finishTouchDrag(touch.clientX, touch.clientY);
  });
  document.addEventListener('touchcancel', () => {
    if (!touchDrag) return;
    finishTouchDrag(touchDrag.kind === 'card' ? touchDrag.startX : 0, touchDrag.startY, true);
  });
  document.addEventListener('mouseup', () => {
    tierRowDragArmed = false;
  });
  window.addEventListener('resize', () => {
    if (!state.openMenu) return;
    renderMenus();
  });
}

export async function initialize(): Promise<void> {
  document.documentElement.lang = getCurrentUiLanguage();
  document.title = t(getCurrentUiLanguage(), 'title');
  try {
    await applyLoadedState(true, undefined, false);
  } catch {
    showSnackbar(t(getCurrentUiLanguage(), 'loadFailed'));
  }
}
