import { API_LANGUAGES, CHARACTER_IDS, detectInitialApiLanguage, STORAGE_KEY, type CharacterId, type ThemeMode } from './config';

export type ApiCard = {
  id: string;
  name: string;
  description: string | null;
  description_raw: string | null;
  cost: number | null;
  is_x_cost: boolean | null;
  is_x_star_cost: boolean | null;
  star_cost: number | null;
  type: string;
  type_key: string;
  rarity: string;
  rarity_key: string | null;
  target: string | null;
  color: string | null;
  damage: number | null;
  block: number | null;
  hit_count: number | null;
  powers_applied: Array<{ power: string; power_key: string | null; amount: number }> | null;
  cards_draw: number | null;
  energy_gain: number | null;
  hp_loss: number | null;
  keywords: string[] | null;
  keywords_key: string[] | null;
  tags: string[] | null;
  spawns_cards: string[] | null;
  vars: Record<string, number | string> | null;
  upgrade: Record<string, number | string | boolean> | null;
  upgrade_description: string | null;
  image_url: string | null;
  beta_image_url: string | null;
  type_variants: string[] | null;
  compendium_order: number;
};

export type CharacterInfo = {
  id: CharacterId;
  name: string;
  imageUrl: string | null;
};

export type ProjectTier = {
  label: string;
  cards: string[];
};

export type CharacterProjectData = {
  tiers: ProjectTier[];
  notes: Record<string, string>;
};

type PersistedState = {
  apiLang?: string;
  currentCharacter?: CharacterId;
  theme?: ThemeMode;
  showNoteMarkers?: boolean;
  dockCollapsed?: boolean;
  project?: Record<string, CharacterProjectData>;
};

export type State = {
  apiLang: string;
  theme: ThemeMode;
  showNoteMarkers: boolean;
  openMenu: 'character' | 'api-language' | null;
  dockCollapsed: boolean;
  search: string;
  currentCharacter: CharacterId;
  characters: Record<string, CharacterInfo>;
  keywords: Record<string, string>;
  cards: Record<string, ApiCard[]>;
  project: Record<string, CharacterProjectData>;
  popup: {
    cardId: string | null;
    upgraded: boolean;
    editing: boolean;
  };
};

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}

function readSavedState(): PersistedState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as PersistedState;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid saved state');
  return {
    apiLang: API_LANGUAGES.some(language => language.code === parsed.apiLang) ? parsed.apiLang : undefined,
    currentCharacter: CHARACTER_IDS.includes(parsed.currentCharacter as CharacterId) ? parsed.currentCharacter : undefined,
    theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : undefined,
    showNoteMarkers: typeof parsed.showNoteMarkers === 'boolean' ? parsed.showNoteMarkers : undefined,
    dockCollapsed: typeof parsed.dockCollapsed === 'boolean' ? parsed.dockCollapsed : undefined,
    project: parsed.project && typeof parsed.project === 'object' && !Array.isArray(parsed.project) ? parsed.project : undefined,
  };
}

function getInitialTheme(savedTheme?: ThemeMode): ThemeMode {
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const saved = readSavedState();

export const state: State = {
  apiLang: saved.apiLang || detectInitialApiLanguage(),
  theme: getInitialTheme(saved.theme),
  showNoteMarkers: saved.showNoteMarkers ?? false,
  openMenu: null,
  dockCollapsed: saved.dockCollapsed ?? false,
  search: '',
  currentCharacter: saved.currentCharacter || 'ironclad',
  characters: {},
  keywords: {},
  cards: {},
  project: saved.project || {},
  popup: {
    cardId: null,
    upgraded: false,
    editing: false,
  },
};

export const dom = {
  loadingOverlay: must<HTMLDivElement>('loadingOverlay'),
  loadingText: must<HTMLDivElement>('loadingText'),
  appTitle: must<HTMLDivElement>('appTitle'),
  characterBtn: must<HTMLButtonElement>('characterBtn'),
  characterMenu: must<HTMLDivElement>('characterMenu'),
  importJsonBtn: must<HTMLButtonElement>('importJsonBtn'),
  exportJsonBtn: must<HTMLButtonElement>('exportJsonBtn'),
  exportMarkdownBtn: must<HTMLButtonElement>('exportMarkdownBtn'),
  exportImageBtn: must<HTMLButtonElement>('exportImageBtn'),
  importJsonText: must<HTMLSpanElement>('importJsonText'),
  exportJsonText: must<HTMLSpanElement>('exportJsonText'),
  exportMarkdownText: must<HTMLSpanElement>('exportMarkdownText'),
  exportImageText: must<HTMLSpanElement>('exportImageText'),
  apiLanguageBtn: must<HTMLButtonElement>('apiLanguageBtn'),
  apiLanguageMenu: must<HTMLDivElement>('apiLanguageMenu'),
  noteMarkersBtn: must<HTMLButtonElement>('noteMarkersBtn'),
  themeBtn: must<HTMLButtonElement>('themeBtn'),
  tierStage: must<HTMLDivElement>('tierRows'),
  addTierBtn: must<HTMLButtonElement>('addTierBtn'),
  addTierText: must<HTMLSpanElement>('addTierText'),
  dockPanel: must<HTMLElement>('dockPanel'),
  dockHeader: must<HTMLDivElement>('dockHeader'),
  dockTitle: must<HTMLDivElement>('dockTitle'),
  dockCount: must<HTMLDivElement>('dockCount'),
  searchInput: must<HTMLInputElement>('searchInput'),
  dockCards: must<HTMLDivElement>('dockCards'),
  hoverPreview: must<HTMLDivElement>('hoverPreview'),
  popupOverlay: must<HTMLDivElement>('popupOverlay'),
  popupCard: must<HTMLDivElement>('popupCard'),
  snackbar: must<HTMLDivElement>('snackbar'),
  fileInput: must<HTMLInputElement>('fileInput'),
};

export function saveState(): void {
  const payload: PersistedState = {
    apiLang: state.apiLang,
    currentCharacter: state.currentCharacter,
    theme: state.theme,
    showNoteMarkers: state.showNoteMarkers,
    dockCollapsed: state.dockCollapsed,
    project: state.project,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
