// «Настройки» — решения взрослого о том, как ребёнок занимается.
//
// Разложены по трём вопросам, которые родитель задаёт на самом деле:
//  1) «сколько и как ребёнок занимается» → Занятия (цель дня, размер урока, подсказки);
//  2) «что происходит со звуком и телефоном» → Звук и отклик;
//  3) «как это выглядит» → Вид (цветовая схема, сова; стили — в магазине → Фоны).
// Каждая настройка объясняет последствие своими словами, а не названием флага.

import { DEFAULT_LESSON_SIZE, LESSON_SIZE_OPTIONS } from '../../engine/scheduler';
import { useApp } from '../../state/store';
import { AVAILABLE_CLASSES, CLASS_META, WORDS_BY_GRADE, availableClass } from '../../content/words';
import type { ClassId } from '../../types';
import { MusicCreditsToggle } from '../Credits';
import { ThemeHelp } from '../ThemeHelp';
import { Choice, GroupTitle, SettingRow, Switch } from './ParentBits';
import type { Profile } from '../../types';

export function SettingsTab({ profile, onOpenDiagnostics }: { profile: Profile; onOpenDiagnostics: () => void }) {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setLessonSize = useApp((s) => s.setLessonSize);
  const setActiveClass = useApp((s) => s.setActiveClass);

  const lessonSize = profile.lessonSize ?? DEFAULT_LESSON_SIZE;
  const activeClass = availableClass(profile.activeClass ?? 2);

  return (
    <div className="parent-stack">
      <div className="card">
        <GroupTitle title="Занятия" />

        {AVAILABLE_CLASSES.length > 1 && (
          <SettingRow
            title="Класс"
            hint="Меняется набор слов. Прогресс и покупки сохраняются."
          >
            <Choice
              label="Класс программы"
              value={activeClass}
              onChange={(id) => setActiveClass(id as ClassId)}
              options={AVAILABLE_CLASSES.map((g) => ({
                value: g,
                label: CLASS_META[g].title,
                hint: `${WORDS_BY_GRADE[g].length} слов из словарика ${g} класса`,
              }))}
            />
          </SettingRow>
        )}

        <SettingRow
          title="Размер урока"
          hint="Применится со следующего урока."
        >
          <Choice
            label="Размер урока"
            value={lessonSize}
            onChange={(id) => setLessonSize(id)}
            options={LESSON_SIZE_OPTIONS.map((option) => ({
              value: option.id,
              label: `${option.title} · ${option.limit}`,
              hint: option.description,
            }))}
          />
        </SettingRow>

        <SettingRow
          title="Подсказки в уроке"
          hint="Как БУК помогает в задании."
        >
          <Choice
            label="Подсказки в уроке"
            value={settings.lessonHelp}
            onChange={(lessonHelp) => setSettings({ lessonHelp })}
            options={[
              {
                value: 'socratic',
                label: 'с вопросом',
                hint: 'Сова задаёт наводящий вопрос, букву ребёнок открывает сам (рекомендуем)',
              },
              { value: 'direct', label: 'сразу буква', hint: 'Сова сразу показывает опасную букву и мнемонику' },
              { value: 'off', label: 'выключены', hint: 'Никаких подсказок от совы в уроке' },
            ]}
          />
        </SettingRow>
      </div>

      <details className="card parent-advanced-settings">
        <summary className="setting-title">Расширенные настройки</summary>
        <SettingRow
          title="Цель дня"
          hint="Дневная норма XP на главной."
        >
          <Choice
            label="Цель дня в XP"
            value={settings.dailyGoal}
            onChange={(dailyGoal) => setSettings({ dailyGoal })}
            options={[
              { value: 60, label: '60 · спокойно', hint: 'Один короткий урок' },
              { value: 120, label: '120 · обычно', hint: 'Урок и немного повторения' },
              { value: 200, label: '200 · серьёзно', hint: 'Два урока за день' },
            ]}
          />
        </SettingRow>

      <div className="card">
        <GroupTitle title="Звук и отклик" />
        <SettingRow title="Звук" hint="Эффекты ответов и наград.">
          <Switch
            label="Звук"
            checked={settings.sound}
            onChange={(sound) => setSettings({ sound })}
          />
        </SettingRow>
        <SettingRow title="Вибрация" hint="Отклик телефона на ответы.">
          <Switch
            label="Вибрация"
            checked={settings.haptics}
            onChange={(haptics) => setSettings({ haptics })}
          />
        </SettingRow>
        {/* Атрибуция музыки — из приложения, без поиска по документам */}
        <div className="credits-row">
          <MusicCreditsToggle />
        </div>
      </div>

      <div className="card">
        <GroupTitle title="Вид" />
        <SettingRow title="Цветовая схема" hint="Светлая, тёмная или как в телефоне.">
          <Choice
            label="Цветовая схема"
            value={settings.theme}
            onChange={(theme) => setSettings({ theme })}
            options={[
              { value: 'auto', label: 'как в телефоне' },
              { value: 'light', label: 'светлая' },
              { value: 'dark', label: 'тёмная' },
            ]}
          />
        </SettingRow>
        <ThemeHelp onOpenDiagnostics={onOpenDiagnostics} />

        <SettingRow
          title="Сова БУК"
          hint="Где показывать помощника."
        >
          <Choice
            label="Сова БУК"
            value={settings.mascot}
            onChange={(mascot) => setSettings({ mascot })}
            options={[
              { value: 'on', label: 'везде' },
              { value: 'home', label: 'на главной' },
              { value: 'off', label: 'не показывать' },
            ]}
          />
        </SettingRow>
      </div>

      </details>

    </div>
  );
}
