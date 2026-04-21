export type UiLanguage = 'zh' | 'en';
export type ThemeMode = 'light' | 'dark';
export type CharacterId = 'ironclad' | 'silent' | 'defect' | 'necrobinder' | 'regent';

export const API_ROOT = 'https://spire-codex.com/api';
export const API_ORIGIN = 'https://spire-codex.com';
export const STORAGE_KEY = 'spiremind-v1';
export const CHARACTER_IDS: CharacterId[] = ['ironclad', 'silent', 'defect', 'necrobinder', 'regent'];
export const DEFAULT_TIER_LABELS = ['S', 'A', 'B', 'C', 'D'];
export const TIER_COLOR_VARS = ['--tier-s', '--tier-a', '--tier-b', '--tier-c', '--tier-d'];
export const CHARACTER_ACCENTS: Record<CharacterId, string> = {
  ironclad: '#8b4a3a',
  silent: '#5b6f45',
  defect: '#296f86',
  necrobinder: '#6750a4',
  regent: '#875b00',
};

export const API_LANGUAGES = [
  { code: 'zhs', name: '简体中文' },
  { code: 'eng', name: 'English' },
  { code: 'jpn', name: '日本語' },
  { code: 'kor', name: '한국어' },
  { code: 'deu', name: 'Deutsch' },
  { code: 'fra', name: 'Français' },
  { code: 'esp', name: 'Español' },
  { code: 'ita', name: 'Italiano' },
  { code: 'ptb', name: 'Português' },
  { code: 'rus', name: 'Русский' },
  { code: 'tur', name: 'Türkçe' },
  { code: 'tha', name: 'ไทย' },
  { code: 'pol', name: 'Polski' },
  { code: 'spa', name: 'Español LA' },
] as const;

export const UI_STRINGS = {
  zh: {
    title: 'Spiremind',
    importJson: '导入 JSON',
    exportJson: '导出 JSON',
    exportMarkdown: '导出 Markdown',
    exportImage: '导出图片',
    addTier: '添加 Tier',
    deleteTier: '删除 Tier',
    sortTier: '自动排序',
    unclassified: '卡池',
    search: '按 Tab 搜索卡牌...',
    note: '注释',
    edit: '编辑',
    done: '完成',
    emptyNote: '点击编辑，记录这张卡牌的简述。',
    notePlaceholder: '输入这张卡牌的简述',
    loadingData: '加载数据...',
    jsonImported: 'JSON 已导入',
    jsonExported: 'JSON 已导出',
    markdownExported: 'Markdown 已导出',
    imageGenerating: '正在生成图片...',
    imageExported: '图片已导出',
    imageFailed: '图片导出失败',
    invalidJson: 'JSON 格式无效',
    loadFailed: '加载失败',
    importFailed: '导入失败',
    tierDeleted: 'Tier 已删除',
    tierAdded: 'Tier 已添加',
    noCards: '没有可显示的卡牌',
    noTierImage: '没有可导出的内容',
    apiLanguage: '卡牌语言',
    showNoteMarkers: '显示注释标记',
    hideNoteMarkers: '隐藏注释标记',
    switchTheme: '切换主题',
    dockOpen: '展开卡牌区',
    dockClose: '收起卡牌区',
    shift: 'Shift',
    cancel: '取消',
    deleteConfirmTitle: '删除此 Tier?',
    deleteConfirmAction: '删除',
    sortConfirmTitle: '自动排序此 Tier?',
    sortConfirmAction: '排序',
  },
  en: {
    title: 'Spiremind',
    importJson: 'Import JSON',
    exportJson: 'Export JSON',
    exportMarkdown: 'Export Markdown',
    exportImage: 'Export Image',
    addTier: 'Add Tier',
    deleteTier: 'Delete Tier',
    sortTier: 'Auto sort',
    unclassified: 'Card Pool',
    search: 'Press Tab to search cards...',
    note: 'Note',
    edit: 'Edit',
    done: 'Done',
    emptyNote: 'Tap edit to write a short note for this card.',
    notePlaceholder: 'Write a short note for this card',
    loadingData: 'Loading data...',
    jsonImported: 'JSON imported',
    jsonExported: 'JSON exported',
    markdownExported: 'Markdown exported',
    imageGenerating: 'Generating image...',
    imageExported: 'Image exported',
    imageFailed: 'Image export failed',
    invalidJson: 'Invalid JSON format',
    loadFailed: 'Load failed',
    importFailed: 'Import failed',
    tierDeleted: 'Tier deleted',
    tierAdded: 'Tier added',
    noCards: 'No cards to show',
    noTierImage: 'Nothing to export',
    apiLanguage: 'Card Language',
    showNoteMarkers: 'Show note markers',
    hideNoteMarkers: 'Hide note markers',
    switchTheme: 'Switch theme',
    dockOpen: 'Open card dock',
    dockClose: 'Close card dock',
    shift: 'Shift',
    cancel: 'Cancel',
    deleteConfirmTitle: 'Delete this Tier?',
    deleteConfirmAction: 'Delete',
    sortConfirmTitle: 'Auto sort this tier?',
    sortConfirmAction: 'Sort',
  },
} as const;

export type UiKey = keyof typeof UI_STRINGS.zh;

export function detectUiLanguage(): UiLanguage {
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
  return locales.some(locale => locale.toLowerCase().startsWith('zh')) ? 'zh' : 'en';
}

export function detectInitialApiLanguage(): string {
  return detectUiLanguage() === 'zh' ? 'zhs' : 'eng';
}

export function getUiLanguage(languageCode: string): UiLanguage {
  return languageCode.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(uiLanguage: UiLanguage, key: UiKey): string {
  return UI_STRINGS[uiLanguage][key];
}
