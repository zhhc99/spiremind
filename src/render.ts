import { API_LANGUAGES, CHARACTER_ACCENTS, getUiLanguage, t } from './config';
import { buildCardDescription, getCardBorderColor, getCardCost, getCardHeaderBackground, getCardImageUrl, getCardStarCost, renderRichText, sortCards } from './cards';
import { dom, state, type ApiCard, type CharacterProjectData } from './state';
import { ensureCharacterProject, getTierColor } from './tierlist';

let snackbarTimer = 0;

function getCurrentUiLanguage() {
  return getUiLanguage(state.apiLang);
}

function fitDropdownMenu(menu: HTMLElement): void {
  menu.style.setProperty('--menu-shift-x', '0px');
  if (!menu.classList.contains('open')) return;
  const gap = 8;
  const rect = menu.getBoundingClientRect();
  let shift = 0;
  if (rect.right > window.innerWidth - gap) shift -= rect.right - (window.innerWidth - gap);
  if (rect.left + shift < gap) shift += gap - (rect.left + shift);
  menu.style.setProperty('--menu-shift-x', `${shift}px`);
}

function createCardElement(card: ApiCard, hasNote = false): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'card-item';
  item.draggable = true;
  item.dataset.id = card.id;
  item.style.setProperty('--rarity-color', getCardBorderColor(card));
  const shell = document.createElement('div');
  shell.className = 'card-shell';
  const imageUrl = getCardImageUrl(card);
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'card-img';
    image.alt = card.name;
    image.loading = 'lazy';
    image.src = imageUrl;
    image.crossOrigin = 'anonymous';
    image.addEventListener('error', () => {
      shell.querySelector('.card-top')?.remove();
      const placeholder = document.createElement('div');
      placeholder.className = 'card-placeholder card-top';
      placeholder.innerHTML = '<span class="material-icons-round">style</span>';
      shell.prepend(placeholder);
    });
    image.classList.add('card-top');
    shell.appendChild(image);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder card-top';
    placeholder.innerHTML = '<span class="material-icons-round">style</span>';
    shell.appendChild(placeholder);
  }
  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = card.name;
  shell.appendChild(name);
  item.appendChild(shell);
  if (hasNote) {
    const indicator = document.createElement('span');
    indicator.className = 'card-note-indicator material-icons-round';
    indicator.textContent = 'check_circle';
    item.appendChild(indicator);
  }
  return item;
}

function createBigCard(card: ApiCard, upgraded: boolean, editable: boolean): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'bigcard-inner';
  wrapper.style.setProperty('--rarity-color', getCardBorderColor(card));
  wrapper.style.setProperty('--rarity-bg', getCardHeaderBackground(card));
  const header = document.createElement('div');
  header.className = 'bigcard-header';
  const cost = document.createElement('div');
  cost.className = 'bigcard-cost';
  cost.style.background = CHARACTER_ACCENTS[state.currentCharacter];
  cost.textContent = getCardCost(card, upgraded);
  header.appendChild(cost);
  const starCost = getCardStarCost(card, upgraded);
  if (starCost) {
    const star = document.createElement('div');
    star.className = 'bigcard-star';
    star.textContent = starCost;
    header.appendChild(star);
  }
  const name = document.createElement('div');
  name.className = `bigcard-name${upgraded ? ' upgraded' : ''}`;
  name.textContent = upgraded ? `${card.name}+` : card.name;
  header.appendChild(name);
  if (editable) {
    const upgradeBtn = document.createElement('button');
    upgradeBtn.className = `bigcard-upgrade-btn${upgraded ? ' on' : ''}`;
    upgradeBtn.type = 'button';
    upgradeBtn.dataset.popupToggleUpgrade = 'true';
    upgradeBtn.innerHTML = '<span class="material-icons-round">auto_awesome</span>';
    header.appendChild(upgradeBtn);
  } else {
    const shiftHint = document.createElement('div');
    shiftHint.className = 'bigcard-shift-hint';
    shiftHint.innerHTML = `<span class="material-icons-round">auto_awesome</span><span>${t(getCurrentUiLanguage(), 'shift')}</span>`;
    header.appendChild(shiftHint);
  }
  const imageWrap = document.createElement('div');
  imageWrap.className = 'bigcard-img-wrap';
  const imageUrl = getCardImageUrl(card);
  if (imageUrl) {
    const image = document.createElement('img');
    image.alt = card.name;
    image.src = imageUrl;
    image.crossOrigin = 'anonymous';
    image.addEventListener('error', () => {
      imageWrap.innerHTML = '<div class="card-placeholder"><span class="material-icons-round">style</span></div>';
    });
    imageWrap.appendChild(image);
  } else {
    imageWrap.innerHTML = '<div class="card-placeholder"><span class="material-icons-round">style</span></div>';
  }
  const desc = document.createElement('div');
  desc.className = 'bigcard-desc';
  desc.innerHTML = renderRichText(buildCardDescription(card, upgraded, state.keywords, state.apiLang), state.currentCharacter);
  wrapper.append(header, imageWrap, desc);
  return wrapper;
}

function createNoteView(cardData: ApiCard, note: string, alwaysShow: boolean, editing: boolean): HTMLDivElement | null {
  if (!alwaysShow && !note.trim()) return null;
  const noteCard = document.createElement('div');
  noteCard.className = alwaysShow ? 'popup-note-card' : 'bigcard-note';
  noteCard.style.setProperty('--rarity-color', getCardBorderColor(cardData));
  if (!alwaysShow) {
    noteCard.textContent = note;
    return noteCard;
  }
  const head = document.createElement('div');
  head.className = 'popup-note-head';
  const title = document.createElement('div');
  title.className = 'popup-note-title';
  title.textContent = t(getCurrentUiLanguage(), 'note');
  head.appendChild(title);
  const action = document.createElement('button');
  action.className = 'popup-note-action';
  action.type = 'button';
  action.dataset.popupToggleEdit = 'true';
  action.innerHTML = editing
    ? `<span class="material-icons-round">check</span><span>${t(getCurrentUiLanguage(), 'done')}</span>`
    : `<span class="material-icons-round">edit</span><span>${t(getCurrentUiLanguage(), 'edit')}</span>`;
  head.appendChild(action);
  noteCard.appendChild(head);
  if (editing) {
    const field = document.createElement('label');
    field.className = 'popup-note-field';
    const label = document.createElement('span');
    label.className = 'popup-note-label';
    label.textContent = t(getCurrentUiLanguage(), 'note');
    const textarea = document.createElement('textarea');
    textarea.dataset.popupNoteInput = 'true';
    textarea.placeholder = t(getCurrentUiLanguage(), 'notePlaceholder');
    textarea.value = note;
    field.append(label, textarea);
    noteCard.appendChild(field);
  } else {
    const text = document.createElement('div');
    text.className = `popup-note-text${note.trim() ? '' : ' popup-note-empty'}`;
    text.dataset.enterNoteEdit = 'true';
    text.textContent = note.trim() || t(getCurrentUiLanguage(), 'emptyNote');
    noteCard.appendChild(text);
  }
  return noteCard;
}

function createBigCardStack(card: ApiCard, note: string, upgraded: boolean, editable: boolean): HTMLDivElement {
  const stack = document.createElement('div');
  stack.className = 'bigcard-stack';
  stack.appendChild(createBigCard(card, upgraded, editable));
  const noteView = createNoteView(card, note, editable, state.popup.editing);
  if (noteView) stack.appendChild(noteView);
  return stack;
}

function getDeleteConfirmMessage(cardCount: number): string {
  return getCurrentUiLanguage() === 'zh'
    ? `这个 Tier 中还有 ${cardCount} 张卡牌。删除后，这些卡牌会回到卡池。`
    : `This tier still has ${cardCount} card${cardCount === 1 ? '' : 's'}. Deleting it will return them to the card pool.`;
}

function getSortConfirmMessage(cardCount: number): string {
  return getCurrentUiLanguage() === 'zh'
    ? `会按卡池相同的规则，重新排列这个 Tier 中的 ${cardCount} 张卡牌。`
    : `This will reorder the ${cardCount} card${cardCount === 1 ? '' : 's'} in this tier using the same rules as the card pool.`;
}

function createDeleteConfirmDialog(cardCount: number): HTMLDivElement {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `
    <div class="confirm-dialog-icon"><span class="material-icons-round">warning</span></div>
    <div class="confirm-dialog-title">${t(getCurrentUiLanguage(), 'deleteConfirmTitle')}</div>
    <div class="confirm-dialog-text">${getDeleteConfirmMessage(cardCount)}</div>
    <div class="confirm-dialog-actions">
      <button class="confirm-btn text" type="button" data-popup-cancel-delete="true">${t(getCurrentUiLanguage(), 'cancel')}</button>
      <button class="confirm-btn filled" type="button" data-popup-confirm-delete="true">${t(getCurrentUiLanguage(), 'deleteConfirmAction')}</button>
    </div>
  `;
  return dialog;
}

function createSortConfirmDialog(cardCount: number): HTMLDivElement {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.innerHTML = `
    <div class="confirm-dialog-icon sort"><span class="material-icons-round">sort</span></div>
    <div class="confirm-dialog-title">${t(getCurrentUiLanguage(), 'sortConfirmTitle')}</div>
    <div class="confirm-dialog-text">${getSortConfirmMessage(cardCount)}</div>
    <div class="confirm-dialog-actions">
      <button class="confirm-btn text" type="button" data-popup-cancel-sort="true">${t(getCurrentUiLanguage(), 'cancel')}</button>
      <button class="confirm-btn filled" type="button" data-popup-confirm-sort="true">${t(getCurrentUiLanguage(), 'sortConfirmAction')}</button>
    </div>
  `;
  return dialog;
}

function appendCharacterIcon(target: HTMLElement, imageUrl: string | null): void {
  const createFallback = (): HTMLSpanElement => {
    const icon = document.createElement('span');
    icon.className = 'material-icons-round';
    icon.textContent = 'person';
    return icon;
  };
  if (!imageUrl) {
    target.appendChild(createFallback());
    return;
  }
  const image = document.createElement('img');
  image.alt = '';
  image.src = imageUrl;
  image.addEventListener('error', () => {
    image.replaceWith(createFallback());
  }, { once: true });
  target.appendChild(image);
}

function applyTheme(): void {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.characterTheme = state.currentCharacter;
}

export function setLoading(message: string, visible: boolean): void {
  dom.loadingText.textContent = message;
  dom.loadingOverlay.classList.toggle('hidden', !visible);
}

export function showSnackbar(message: string): void {
  dom.snackbar.textContent = message;
  dom.snackbar.classList.add('show');
  clearTimeout(snackbarTimer);
  snackbarTimer = window.setTimeout(() => dom.snackbar.classList.remove('show'), 2400);
}

export function renderMenus(): void {
  const currentCharacter = state.characters[state.currentCharacter];
  dom.characterBtn.replaceChildren();
  appendCharacterIcon(dom.characterBtn, currentCharacter?.imageUrl || null);
  dom.characterBtn.title = currentCharacter?.name || state.currentCharacter;
  dom.characterMenu.innerHTML = '';
  Object.values(state.characters).forEach(character => {
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.characterSelect = character.id;
    if (character.id === state.currentCharacter) item.className = 'selected';
    appendCharacterIcon(item, character.imageUrl);
    const label = document.createElement('span');
    label.textContent = character.name;
    item.appendChild(label);
    dom.characterMenu.appendChild(item);
  });
  dom.characterMenu.classList.toggle('open', state.openMenu === 'character');
  dom.characterBtn.setAttribute('aria-expanded', String(state.openMenu === 'character'));
  dom.apiLanguageMenu.innerHTML = '';
  API_LANGUAGES.forEach(language => {
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.apiLanguageSelect = language.code;
    item.textContent = language.name;
    if (language.code === state.apiLang) item.className = 'selected';
    dom.apiLanguageMenu.appendChild(item);
  });
  dom.apiLanguageMenu.classList.toggle('open', state.openMenu === 'api-language');
  dom.apiLanguageBtn.setAttribute('aria-expanded', String(state.openMenu === 'api-language'));
  dom.apiLanguageBtn.title = t(getCurrentUiLanguage(), 'apiLanguage');
  requestAnimationFrame(() => {
    fitDropdownMenu(dom.characterMenu);
    fitDropdownMenu(dom.apiLanguageMenu);
  });
}

function renderHeader(): void {
  const uiLanguage = getCurrentUiLanguage();
  document.documentElement.lang = uiLanguage;
  document.title = t(uiLanguage, 'title');
  dom.appTitle.textContent = t(uiLanguage, 'title');
  dom.importJsonText.textContent = t(uiLanguage, 'importJson');
  dom.exportJsonText.textContent = t(uiLanguage, 'exportJson');
  dom.exportMarkdownText.textContent = t(uiLanguage, 'exportMarkdown');
  dom.exportImageText.textContent = t(uiLanguage, 'exportImage');
  dom.addTierText.textContent = t(uiLanguage, 'addTier');
  dom.dockTitle.textContent = t(uiLanguage, 'unclassified');
  dom.searchInput.placeholder = t(uiLanguage, 'search');
  dom.noteMarkersBtn.innerHTML = `<span class="material-icons-round">task_alt</span>`;
  dom.noteMarkersBtn.classList.toggle('active', state.showNoteMarkers);
  dom.noteMarkersBtn.title = t(uiLanguage, state.showNoteMarkers ? 'hideNoteMarkers' : 'showNoteMarkers');
  dom.themeBtn.innerHTML = `<span class="material-icons-round">${state.theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
  dom.importJsonBtn.title = t(uiLanguage, 'importJson');
  dom.exportJsonBtn.title = t(uiLanguage, 'exportJson');
  dom.exportMarkdownBtn.title = t(uiLanguage, 'exportMarkdown');
  dom.exportImageBtn.title = t(uiLanguage, 'exportImage');
  dom.themeBtn.title = t(uiLanguage, 'switchTheme');
  renderMenus();
}

export function renderTierStage(): void {
  const project = ensureCharacterProject(state.project, state.currentCharacter);
  const cards = new Map((state.cards[state.currentCharacter] || []).map(card => [card.id, card]));
  dom.tierStage.innerHTML = '';
  project.tiers.forEach((tier, tierIndex) => {
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.draggable = true;
    row.dataset.tierIndex = String(tierIndex);
    row.innerHTML = `<div class="tier-drag-handle" data-tier-drag-handle="true"><span class="material-icons-round">drag_indicator</span></div><div class="tier-label-wrap" style="--tier-bg:${getTierColor(tierIndex)}"><div class="tier-label" contenteditable spellcheck="false" data-tier-label="${tierIndex}"></div></div><div class="tier-cards" data-tier-index="${tierIndex}"></div><div class="tier-actions"><button class="del-btn" type="button" title="${t(getCurrentUiLanguage(), 'sortTier')}" data-sort-tier="${tierIndex}"><span class="material-icons-round">sort</span></button><button class="del-btn" type="button" title="${t(getCurrentUiLanguage(), 'deleteTier')}" data-delete-tier="${tierIndex}"><span class="material-icons-round">delete_outline</span></button></div>`;
    row.querySelector<HTMLElement>('[data-tier-label]')!.textContent = tier.label;
    const cardZone = row.querySelector<HTMLDivElement>('.tier-cards')!;
    tier.cards.forEach(cardId => {
      const card = cards.get(cardId);
      if (card) cardZone.appendChild(createCardElement(card, state.showNoteMarkers && !!project.notes[card.id]));
    });
    dom.tierStage.appendChild(row);
  });
}

export function renderDock(): void {
  const project = ensureCharacterProject(state.project, state.currentCharacter);
  const assigned = new Set(project.tiers.flatMap(tier => tier.cards));
  const needle = state.search.trim().toLowerCase();
  const cards = sortCards((state.cards[state.currentCharacter] || []).filter(card => !assigned.has(card.id))).filter(card => {
    if (!needle) return true;
    const searchText = state.searchIndex[card.id] || `${card.name} ${card.id}`.toLowerCase().replaceAll('_', ' ');
    return searchText.includes(needle);
  });
  dom.dockPanel.classList.toggle('collapsed', state.dockCollapsed);
  dom.dockHeader.title = t(getCurrentUiLanguage(), state.dockCollapsed ? 'dockOpen' : 'dockClose');
  dom.dockCount.textContent = String(cards.length);
  dom.dockCards.innerHTML = '';
  if (!cards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-tip';
    empty.textContent = t(getCurrentUiLanguage(), 'noCards');
    dom.dockCards.appendChild(empty);
    return;
  }
  cards.forEach(card => dom.dockCards.appendChild(createCardElement(card, state.showNoteMarkers && !!project.notes[card.id])));
}

export function renderPopup(): void {
  const sortTierIndex = state.popup.sortTierIndex;
  if (sortTierIndex != null) {
    const project = ensureCharacterProject(state.project, state.currentCharacter);
    const tier = project.tiers[sortTierIndex];
    if (!tier) {
      state.popup.sortTierIndex = null;
      renderPopup();
      return;
    }
    dom.popupOverlay.classList.add('show');
    dom.popupCard.classList.add('show');
    dom.popupCard.innerHTML = '';
    dom.popupCard.appendChild(createSortConfirmDialog(tier.cards.length));
    const confirmButton = dom.popupCard.querySelector<HTMLButtonElement>('[data-popup-confirm-sort="true"]');
    if (confirmButton) requestAnimationFrame(() => confirmButton.focus());
    return;
  }
  const deleteTierIndex = state.popup.deleteTierIndex;
  if (deleteTierIndex != null) {
    const project = ensureCharacterProject(state.project, state.currentCharacter);
    const tier = project.tiers[deleteTierIndex];
    if (!tier) {
      state.popup.deleteTierIndex = null;
      renderPopup();
      return;
    }
    dom.popupOverlay.classList.add('show');
    dom.popupCard.classList.add('show');
    dom.popupCard.innerHTML = '';
    dom.popupCard.appendChild(createDeleteConfirmDialog(tier.cards.length));
    const confirmButton = dom.popupCard.querySelector<HTMLButtonElement>('[data-popup-confirm-delete="true"]');
    if (confirmButton) requestAnimationFrame(() => confirmButton.focus());
    return;
  }
  const card = state.popup.cardId ? findCardById(state.popup.cardId) : null;
  if (!card) {
    dom.popupOverlay.classList.remove('show');
    dom.popupCard.classList.remove('show');
    dom.popupCard.innerHTML = '';
    return;
  }
  const project = ensureCharacterProject(state.project, state.currentCharacter);
  dom.popupOverlay.classList.add('show');
  dom.popupCard.classList.add('show');
  dom.popupCard.innerHTML = '';
  dom.popupCard.appendChild(createBigCardStack(card, project.notes[card.id] || '', state.popup.upgraded, true));
  const textarea = dom.popupCard.querySelector<HTMLTextAreaElement>('textarea[data-popup-note-input="true"]');
  if (textarea) requestAnimationFrame(() => textarea.focus());
}

export function showHoverPreview(card: ApiCard, left: number, top: number, upgraded: boolean): void {
  const project = ensureCharacterProject(state.project, state.currentCharacter);
  dom.hoverPreview.innerHTML = '';
  dom.hoverPreview.appendChild(createBigCardStack(card, project.notes[card.id] || '', upgraded, false));
  dom.hoverPreview.classList.add('visible');
  const rect = dom.hoverPreview.getBoundingClientRect();
  let x = left + 15;
  let y = top + 15;
  if (x + rect.width > window.innerWidth - 20) x = left - rect.width - 15;
  if (y + rect.height > window.innerHeight - 20) y = top - rect.height - 15;
  if (x < 10) x = 10;
  if (y < 10) y = 10;
  dom.hoverPreview.style.left = `${x}px`;
  dom.hoverPreview.style.top = `${y}px`;
}

export function hideHoverPreview(): void {
  dom.hoverPreview.classList.remove('visible');
  dom.hoverPreview.innerHTML = '';
}

export function renderAll(): void {
  applyTheme();
  renderHeader();
  renderTierStage();
  renderDock();
  renderPopup();
}

export function findCardById(cardId: string): ApiCard | undefined {
  return (state.cards[state.currentCharacter] || []).find(card => card.id === cardId);
}

export function getProject(): CharacterProjectData {
  return ensureCharacterProject(state.project, state.currentCharacter);
}

export function getAllCards(): ApiCard[] {
  return state.cards[state.currentCharacter] || [];
}
