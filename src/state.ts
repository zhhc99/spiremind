import { API_LANGUAGES, BETA_DATA_VERSION_FALLBACK, CHARACTER_IDS, detectInitialApiLanguage, STABLE_DATA_VERSION, STORAGE_KEY, type CharacterId, type DataChannel, type ThemeMode } from './config';

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
  multiplayer_only: boolean | null;
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
  title: string;
  tiers: ProjectTier[];
  notes: Record<string, string>;
};

type PersistedState = {
  apiLang?: string;
  dataChannel?: DataChannel;
  currentCharacter?: CharacterId;
  theme?: ThemeMode;
  includeColorless?: boolean;
  includeMultiplayer?: boolean;
  showColorless?: boolean;
  showNoteMarkers?: boolean;
  dockCollapsed?: boolean;
  project?: Record<string, CharacterProjectData>;
};

export type State = {
  apiLang: string;
  dataChannel: DataChannel;
  dataVersions: Record<DataChannel, string>;
  theme: ThemeMode;
  includeColorless: boolean;
  includeMultiplayer: boolean;
  showNoteMarkers: boolean;
  openMenu: 'character' | 'api-language' | 'data-version' | 'card-filter' | null;
  dockCollapsed: boolean;
  search: string;
  currentCharacter: CharacterId;
  characters: Record<string, CharacterInfo>;
  keywords: Record<string, string>;
  cards: Record<string, ApiCard[]>;
  colorlessCards: ApiCard[];
  searchIndex: Record<string, string>;
  project: Record<string, CharacterProjectData>;
  popup: {
    cardId: string | null;
    upgraded: boolean;
    editing: boolean;
    deleteTierIndex: number | null;
    sortTierIndex: number | null;
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
    dataChannel: parsed.dataChannel === 'stable' || parsed.dataChannel === 'beta' ? parsed.dataChannel : undefined,
    currentCharacter: CHARACTER_IDS.includes(parsed.currentCharacter as CharacterId) ? parsed.currentCharacter : undefined,
    theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : undefined,
    includeColorless: typeof parsed.includeColorless === 'boolean'
      ? parsed.includeColorless
      : typeof parsed.showColorless === 'boolean'
        ? parsed.showColorless
        : undefined,
    includeMultiplayer: typeof parsed.includeMultiplayer === 'boolean' ? parsed.includeMultiplayer : undefined,
    showNoteMarkers: typeof parsed.showNoteMarkers === 'boolean' ? parsed.showNoteMarkers : undefined,
    dockCollapsed: typeof parsed.dockCollapsed === 'boolean' ? parsed.dockCollapsed : undefined,
    project: normalizeSavedProjects(parsed.project),
  };
}

function normalizeSavedProjects(project: PersistedState['project']): Record<string, CharacterProjectData> | undefined {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return undefined;
  const normalized: Record<string, CharacterProjectData> = {};
  Object.entries(project).forEach(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const normalizedValue: CharacterProjectData = {
      title: typeof value.title === 'string' ? value.title.replace(/\s*\r?\n\s*/g, ' ').trim() : '',
      tiers: Array.isArray(value.tiers) ? value.tiers : [],
      notes: value.notes && typeof value.notes === 'object' && !Array.isArray(value.notes) ? value.notes : {},
    };
    if (CHARACTER_IDS.includes(key as CharacterId)) {
      normalized[`stable:${key}`] = normalizedValue;
      return;
    }
    if (/^(stable|beta):(ironclad|silent|defect|necrobinder|regent)$/.test(key)) normalized[key] = normalizedValue;
  });
  return normalized;
}

function getInitialTheme(savedTheme?: ThemeMode): ThemeMode {
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const saved = readSavedState();

export const state: State = {
  apiLang: saved.apiLang || detectInitialApiLanguage(),
  dataChannel: saved.dataChannel || 'stable',
  dataVersions: {
    stable: STABLE_DATA_VERSION,
    beta: BETA_DATA_VERSION_FALLBACK,
  },
  theme: getInitialTheme(saved.theme),
  includeColorless: saved.includeColorless ?? false,
  includeMultiplayer: saved.includeMultiplayer ?? false,
  showNoteMarkers: saved.showNoteMarkers ?? false,
  openMenu: null,
  dockCollapsed: saved.dockCollapsed ?? false,
  search: '',
  currentCharacter: saved.currentCharacter || 'ironclad',
  characters: {},
  keywords: {},
  cards: {},
  colorlessCards: [],
  searchIndex: {},
  project: saved.project || {},
  popup: {
    cardId: null,
    upgraded: false,
    editing: false,
    deleteTierIndex: null,
    sortTierIndex: null,
  },
};

export const dom = {
  loadingOverlay: must<HTMLDivElement>('loadingOverlay'),
  loadingText: must<HTMLDivElement>('loadingText'),
  appTitle: must<HTMLDivElement>('appTitle'),
  toolbarRight: must<HTMLDivElement>('toolbarRight'),
  toolbarScroll: must<HTMLDivElement>('toolbarScroll'),
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
  dataVersionBtn: must<HTMLButtonElement>('dataVersionBtn'),
  dataVersionText: must<HTMLSpanElement>('dataVersionText'),
  dataVersionMenu: must<HTMLDivElement>('dataVersionMenu'),
  noteMarkersBtn: must<HTMLButtonElement>('noteMarkersBtn'),
  themeBtn: must<HTMLButtonElement>('themeBtn'),
  tierTitleInput: must<HTMLInputElement>('tierTitleInput'),
  tierStage: must<HTMLDivElement>('tierRows'),
  addTierBtn: must<HTMLButtonElement>('addTierBtn'),
  addTierText: must<HTMLSpanElement>('addTierText'),
  dockPanel: must<HTMLElement>('dockPanel'),
  dockHeader: must<HTMLDivElement>('dockHeader'),
  dockTitle: must<HTMLDivElement>('dockTitle'),
  dockCount: must<HTMLDivElement>('dockCount'),
  cardFilterBtn: must<HTMLButtonElement>('cardFilterBtn'),
  cardFilterCount: must<HTMLSpanElement>('cardFilterCount'),
  cardFilterMenu: must<HTMLDivElement>('cardFilterMenu'),
  searchInput: must<HTMLInputElement>('searchInput'),
  searchCompactHint: must<HTMLSpanElement>('searchCompactHint'),
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
    dataChannel: state.dataChannel,
    currentCharacter: state.currentCharacter,
    theme: state.theme,
    includeColorless: state.includeColorless,
    includeMultiplayer: state.includeMultiplayer,
    showNoteMarkers: state.showNoteMarkers,
    dockCollapsed: state.dockCollapsed,
    project: state.project,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
