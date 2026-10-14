// «Настройки» — решения взрослого о том, как ребёнок занимается.
//
// Разложены по трём вопросам, которые родитель задаёт на самом деле:
//  1) «сколько и как ребёнок занимается» → Занятия (цель дня, размер урока, подсказки);
//  2) «что происходит со звуком и телефоном» → Звук и отклик;
//  3) «как это выглядит» → Вид (тема, сова).
// Каждая настройка объясняет последствие своими словами, а не названием флага.

import { DEFAULT_LESSON_SIZE, LESSON_SIZE_OPTIONS } from '../../engine/scheduler';
import { useApp } from '../../state/store';
import { Choice, GroupTitle, SettingRow, Switch } from './ParentBits';
import type { Profile } from '../../types';

export function SettingsTab({ profile }: { profile: Profile }) {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setLessonSize = useApp((s) => s.setLessonSize);

  const lessonSize = profile.lessonSize ?? DEFAULT_LESSON_SIZE;

  return (
    <div className="parent-stack">
      <div className="card">
        <GroupTitle title="Занятия" hint="Что и как часто делает ребёнок" />

        <SettingRow
          title="Цель дня"
          hint="Сколько опыта (XP) считается выполненной нормой дня. Ребёнок видит прогресс в кольце на главной."
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

        <SettingRow
          title="Размер урока"
          hint="Сколько карточек в одном уроке. Отработка ошибок добавляется сверху и не пропадает. Меняется со следующего урока."
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
          hint="Что делает сова БУК, если ребёнок просит помощи или долго думает."
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

      <div className="card">
        <GroupTitle title="Звук и отклик" />
        <SettingRow title="Звук" hint="Мелодии правильных ответов, награды и сундука.">
          <Switch
            label="Звук"
            checked={settings.sound}
            onChange={(sound) => setSettings({ sound })}
          />
        </SettingRow>
        <SettingRow title="Вибрация" hint="Короткий отклик на верные и неверные ответы (если телефон это умеет).">
          <Switch
            label="Вибрация"
            checked={settings.haptics}
            onChange={(haptics) => setSettings({ haptics })}
          />
        </SettingRow>
      </div>

      <div className="card">
        <GroupTitle title="Вид" />
        <SettingRow title="Тема" hint="Светлая, тёмная или как в телефоне.">
          <Choice
            label="Тема оформления"
            value={settings.theme}
            onChange={(theme) => setSettings({ theme })}
            options={[
              { value: 'auto', label: 'как в телефоне' },
              { value: 'light', label: 'светлая' },
              { value: 'dark', label: 'тёмная' },
            ]}
          />
        </SettingRow>

        <SettingRow
          title="Сова БУК"
          hint="Плавающий помощник на экранах. Его можно оставить везде, только на главной или убрать совсем."
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

      <p className="setting-hint center">
        Все настройки применяются сразу и хранятся в этом телефоне вместе с прогрессом.
      </p>
    </div>
  );
}
