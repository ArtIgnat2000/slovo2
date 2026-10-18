// «Настройки» — решения взрослого о том, как ребёнок занимается.
//
// Разложены по трём вопросам, которые родитель задаёт на самом деле:
//  1) «сколько и как ребёнок занимается» → Занятия (цель дня, размер урока, подсказки);
//  2) «что происходит со звуком и телефоном» → Звук и отклик;
//  3) «как это выглядит» → Вид (цветовая схема, сова; стили — в магазине → Фоны).
// Каждая настройка объясняет последствие своими словами, а не названием флага.

import { DEFAULT_LESSON_SIZE, LESSON_SIZE_OPTIONS } from '../../engine/scheduler';
import { useApp } from '../../state/store';
import { MusicCreditsToggle } from '../Credits';
import { ThemeHelp } from '../ThemeHelp';
import { Choice, GroupTitle, SettingRow, Switch } from './ParentBits';
import type { Profile } from '../../types';

export function SettingsTab({ profile, onOpenDiagnostics }: { profile: Profile; onOpenDiagnostics: () => void }) {
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
        <SettingRow title="Звук" hint="Звуковые эффекты: правильный ответ, ошибка, награда и сундук. Мелодии ответа ребёнок выбирает в магазине → «Звуки».">
          <Switch
            label="Звук"
            checked={settings.sound}
            onChange={(sound) => setSettings({ sound })}
          />
        </SettingRow>
        <SettingRow title="Музыка" hint="Фоновые мелодии Kevin MacLeod. Отключается отдельно от звуковых эффектов.">
          <Switch
            label="Музыка"
            checked={settings.music}
            onChange={(music) => setSettings({ music })}
          />
        </SettingRow>
        <SettingRow title="Громкость музыки" hint="Умеренная громкость по умолчанию: музыка — фон, а не концерт.">
          <Choice
            label="Громкость музыки"
            value={settings.musicVolume}
            onChange={(musicVolume) => setSettings({ musicVolume })}
            options={[
              { value: 0.3, label: 'тихо', hint: 'Едва слышно на фоне' },
              { value: 0.5, label: 'обычно', hint: 'Рекомендуется: слышно, но не мешает' },
              { value: 0.75, label: 'погромче', hint: 'Для наушников и тихой комнаты' },
            ]}
          />
        </SettingRow>
        <SettingRow title="Вибрация" hint="Короткий отклик на верные и неверные ответы (если телефон это умеет).">
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
        <SettingRow title="Цветовая схема" hint="Светлая, тёмная или как в телефоне. Стиль оформления выбирается в магазине → Фоны.">
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
