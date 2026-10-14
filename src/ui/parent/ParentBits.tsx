// Мелкие детали родительского раздела: разделы-вкладки, переключатели и строки
// настроек. Вынесены отдельно, чтобы «Родителям» собирался из понятных блоков,
// а не из одной длинной простыни (см. docs/parent-section-redesign.md).
//
// Правила, общие для всего раздела:
//  • у каждой настройки есть подпись и объяснение простыми словами — родитель
//    не должен угадывать, что изменится;
//  • бинарные настройки — переключатель (вкл/выкл видно с одного взгляда), а не
//    две кнопки-чипа, где непонятно, какая из них «текущая»;
//  • выбор из 2–4 вариантов — сегменты с подписью выбранного;
//  • ничего важного не прячем за иконками без подписи.

import type { ReactNode } from 'react';

export type ParentTabId = 'overview' | 'progress' | 'settings' | 'app';

export interface ParentTabItem {
  id: ParentTabId;
  emoji: string;
  title: string;
}

/** Разделы родительского экрана: «как дела» → «сохранность» → «как заниматься» → «приложение». */
export const PARENT_TABS: ParentTabItem[] = [
  { id: 'overview', emoji: '📊', title: 'Обзор' },
  { id: 'progress', emoji: '💾', title: 'Прогресс' },
  { id: 'settings', emoji: '⚙️', title: 'Настройки' },
  { id: 'app', emoji: '📲', title: 'Приложение' },
];

interface TabsProps {
  items: ParentTabItem[];
  value: ParentTabId;
  onChange: (id: ParentTabId) => void;
}

/**
 * Переключатель разделов. Клавиатура: стрелки влево/вправо, как в браузерных
 * вкладках (WAI-ARIA APG, tabs pattern) — экран «Родителям» открывают и с
 * планшета с клавиатурой.
 */
export function ParentTabs({ items, value, onChange }: TabsProps) {
  const move = (delta: number) => {
    const index = items.findIndex((i) => i.id === value);
    const next = items[(index + delta + items.length) % items.length];
    onChange(next.id);
  };

  return (
    <div className="seg-tabs" role="tablist" aria-label="Разделы для родителей">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          id={`parent-tab-${item.id}`}
          aria-selected={value === item.id}
          aria-controls={`parent-panel-${item.id}`}
          tabIndex={value === item.id ? 0 : -1}
          className={`seg-tab ${value === item.id ? 'on' : ''}`}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              move(1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              move(-1);
            }
          }}
        >
          <span className="seg-tab-emoji" aria-hidden="true">
            {item.emoji}
          </span>
          {item.title}
        </button>
      ))}
    </div>
  );
}

/** Панель раздела: связана с вкладкой через aria-controls. */
export function ParentPanel({ id, children }: { id: ParentTabId; children: ReactNode }) {
  return (
    <section
      className="parent-panel"
      role="tabpanel"
      id={`parent-panel-${id}`}
      aria-labelledby={`parent-tab-${id}`}
      tabIndex={-1}
    >
      {children}
    </section>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Подпись для скринридера: сама настройка подписана рядом */
  label: string;
}

/** Переключатель вкл/выкл: один тап, состояние видно без чтения подписи. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" aria-hidden="true" />
      <span className="switch-text">{checked ? 'вкл' : 'выкл'}</span>
    </button>
  );
}

interface ChoiceProps<T extends string | number> {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (next: T) => void;
  /** Заголовок группы для скринридера */
  label: string;
}

/** Выбор одного варианта из нескольких: сегменты с подписями. */
export function Choice<T extends string | number>({ options, value, onChange, label }: ChoiceProps<T>) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          role="radio"
          aria-checked={value === option.value}
          title={option.hint}
          className={`choice-item ${value === option.value ? 'on' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface RowProps {
  title: string;
  hint?: string;
  /** Управляющий элемент справа (на узком экране переносится под подпись) */
  children: ReactNode;
}

/** Строка настройки: слева «что это», справа «как изменить». */
export function SettingRow({ title, hint, children }: RowProps) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <div className="setting-title">{title}</div>
        {hint && <div className="setting-hint">{hint}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

interface TileProps {
  value: string;
  label: string;
  hint?: string;
  tone?: 'plain' | 'good' | 'warn';
}

/** Крупная цифра с подписью: главное читается сразу, детали — мелким. */
export function StatTile({ value, label, hint, tone = 'plain' }: TileProps) {
  return (
    <div className={`stat-tile ${tone}`}>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
      {hint && <div className="stat-tile-hint">{hint}</div>}
    </div>
  );
}

/** Заголовок группы внутри панели: одна строка + короткое пояснение. */
export function GroupTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="group-title">
      <h3>{title}</h3>
      {hint && <div className="setting-hint">{hint}</div>}
    </div>
  );
}
