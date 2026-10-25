// ── Списки слов к контрольной: экран родителя (0.58.0) ──────────────────────
//
// Решения пользователя (docs/proposals/word-lists.md):
//  • списки создаёт родитель — здесь, в своём разделе;
//  • за тренировку — только XP, без кристаллов;
//  • свои слова (нет в банке) живут только внутри списка;
//  • ввод — текстом: «вставьте слова из чата класса».
//
// Экран из двух состояний: список существующих списков и форма нового.
// В форме сначала «Проверить» — предпросмотр разбора: что нашлось в банке,
// что добавится своим словом, что дубль. Для своих слов ударение ставится
// одним тапом по слогу: автополе — последняя гласная, и это правится здесь
// же, до сохранения.

import { useState } from 'react';
import type { PracticeList, Profile, Word } from '../../types';
import { useApp } from '../../state/store';
import {
  LIST_DRILL_SIZES,
  drillSizeOf,
  hardWords,
  listStats,
  listWords,
  parseWordList,
  runHistory,
  trendOf,
  withStress,
  type ParsedList,
} from '../../engine/word-lists';
import { plural } from '../../engine/quests';
import { GroupTitle } from './ParentBits';
import { PRESET_LISTS, presetText } from '../../content/preset-lists';

interface Props {
  profile: Profile;
  /** Открыть режим списка (уходит на экран урока): тренировка, контроль, ошибки. */
  onTrain: (listId: string, mode?: 'train' | 'check' | 'errors') => void;
}

/**
 * История заходов по списку (0.63.0): полоски результатов, динамика и
 * «трудные слова».
 *
 * Зачем: ребёнок тренируется частями, и родителю нужно видеть не только
 * последнюю контрольную, но и — становится ли лучше и что стабильно не
 * получается. Полоска = один заход, высота = доля верных слов.
 */
function ListHistory({
  list,
  customWords,
  onTrainErrors,
}: {
  list: PracticeList;
  customWords: Record<string, Word>;
  onTrainErrors: () => void;
}) {
  const runs = runHistory(list, 10);
  if (!runs.length) {
    return (
      <p className="setting-hint" style={{ margin: '2px 0 0' }}>
        Результатов пока нет: после первой тренировки здесь появится история и динамика.
      </p>
    );
  }
  const trend = trendOf(list);
  const hard = hardWords(list, 5);
  const byId = new Map(listWords(list, customWords).map((w) => [w.id, w]));
  const label = (mode: string) => (mode === 'check' ? 'контрольная' : mode === 'errors' ? 'ошибки' : 'тренировка');

  return (
    <div className="list-history" data-list-history={list.id}>
      <div className="list-history-head">
        <span className="setting-title">Результаты заходов</span>
        {trend && (
          <span className={`list-trend${trend.better ? ' up' : ' down'}`} data-list-trend={list.id}>
            {trend.better ? '↗ стало лучше' : '↘ стало хуже'}
            {' '}
            ({trend.delta > 0 ? '+' : ''}
            {Math.round(trend.delta * 100)} п.п.)
          </span>
        )}
      </div>

      <div className="list-bars" role="img" aria-label="Результаты последних заходов по списку">
        {runs.map((run, i) => (
          <span
            key={`${run.at}-${i}`}
            className={`list-bar ${run.mode}`}
            style={{ height: `${Math.max(8, Math.round(run.ratio * 100))}%` }}
            title={`${label(run.mode)}: ${run.correct} из ${run.total} · ${new Date(run.at).toLocaleDateString('ru-RU')}`}
            data-run-bar
          />
        ))}
      </div>

      <ul className="list-runs">
        {[...runs].reverse().slice(0, 4).map((run, i) => (
          <li key={`${run.at}-${i}`} data-run-row>
            <span className="tiny muted">{new Date(run.at).toLocaleDateString('ru-RU')}</span>
            <span className="tiny">{label(run.mode)}</span>
            <b>
              {run.correct} из {run.total}
            </b>
          </li>
        ))}
      </ul>

      {hard.length > 0 && (
        <div className="list-hard" data-list-hard={list.id}>
          <span className="setting-hint">Трудные слова:</span>{' '}
          {hard.map((h) => (
            <span key={h.id} className="word-chip study-error">
              {byId.get(h.id)?.text ?? h.id} · {h.errors}
            </span>
          ))}
          <button type="button" className="btn ghost sm" style={{ marginTop: 6 }} onClick={onTrainErrors}>
            🔁 Тренировать трудные · {hard.length}
          </button>
        </div>
      )}
    </div>
  );
}

export function ListsTab({ profile, onTrain }: Props) {
  const { addList, removeList, renameList, setCustomWordStress, setListDrillSize } = useApp.getState();
  const drill = drillSizeOf(profile);
  const lists = profile.lists ?? [];
  const customWords = profile.customWords ?? {};

  /** null — форма закрыта; 'new' — создаём новый; id — переименовываем. */
  const [editing, setEditing] = useState<null | 'new' | string>(null);
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  /** Предпросмотр разбора: считается один раз по кнопке «Проверить». */
  const [parsed, setParsed] = useState<ParsedList | null>(null);
  /** Правки ударения до сохранения: id слова → индекс гласной. */
  const [stressFix, setStressFix] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  /** Какой пресет только что добавили — чтобы показать «добавлен». */
  const [addedPreset, setAddedPreset] = useState<string | null>(null);
  /** Ошибка чтения буфера обмена (браузер может запретить без жеста). */
  const [clipError, setClipError] = useState('');

  const grade = profile.activeClass ?? 2;

  const close = () => {
    setEditing(null);
    setTitle('');
    setRaw('');
    setParsed(null);
    setStressFix({});
    setError('');
  };

  const preview = () => {
    const result = parseWordList(raw, customWords, grade);
    if (!result.wordIds.length) {
      setError('Не нашлось ни одного слова. Вставьте список: по одному слову в строке или через запятую.');
      setParsed(null);
      return;
    }
    setError('');
    setParsed({
      ...result,
      items: result.items.map((item) =>
        item.word ? { ...item, word: withStress(item.word, stressFix[item.word.id] ?? item.word.stress) } : item,
      ),
    });
  };

  const save = () => {
    if (!parsed) return;
    // Правки ударения применяются к своим словам прямо перед сохранением:
    // карточки уходят в профиль уже с правильным ударением.
    const fixed: Record<string, (typeof customWords)[string]> = {};
    for (const [id, word] of Object.entries(parsed.customWords)) {
      fixed[id] = stressFix[id] !== undefined ? withStress(word, stressFix[id]) : word;
    }
    const result = addList(title || 'Контрольная', raw, fixed);
    if (!result.list) {
      setError('Список пустой — проверьте слова и попробуйте снова.');
      return;
    }
    close();
  };

  const customCount = (list: PracticeList) => listStats(list, customWords);
  const whenTrained = (list: PracticeList) => {
    const trained = list.lastRunAt
      ? ` · тренировали ${new Date(list.lastRunAt).toLocaleDateString('ru-RU')}`
      : '';
    const check = list.lastCheck
      ? ` · контрольная ${list.lastCheck.correct} из ${list.lastCheck.total}`
      : '';
    return `${trained}${check}`;
  };

  return (
    <div className="parent-stack">
      <div className="card">
        <GroupTitle
          title="Списки к контрольной"
          hint="Вставьте слова, которые задали в школе, — ребёнок потренирует именно их. Списки у каждого ученика свои."
        />

        {/* 0.63.0: отдельный параметр — сколько слов брать в одну тренировку.
            Он не связан с «размером урока»: подготовка к контрольной должна
            быть легче урока, иначе ребёнок бросает её на середине. */}
        <div className="list-drill" data-list-drill>
          <div className="setting-title">Слов за одну тренировку</div>
          <div className="list-drill-options" role="group" aria-label="Сколько слов за одну тренировку">
            {LIST_DRILL_SIZES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`list-syl${drill === option.id ? ' on' : ''}`}
                aria-pressed={drill === option.id}
                data-drill-size={option.id}
                onClick={() => setListDrillSize(option.id)}
              >
                {option.title}
              </button>
            ))}
          </div>
          <div className="setting-hint">
            {LIST_DRILL_SIZES.find((o) => o.id === drill)?.hint ?? 'легко начать'}.
            {' '}Полный контроль всегда проходит все слова списка — он для проверки.
          </div>
        </div>

        {lists.length === 0 && !editing && (
          <p className="setting-hint">
            Пока пусто. Список создаётся из текста: подойдёт сообщение из чата класса, даже с лишними запятыми
            и заглавными буквами.
          </p>
        )}

        {lists.map((list) => {
          const stats = customCount(list);
          const isEditing = editing === list.id;
          return (
            <div key={list.id} className="list-row" data-list={list.id}>
              {isEditing ? (
                <div className="list-row-edit">
                  <input
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label={`Название списка ${list.title}`}
                    maxLength={80}
                  />
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => {
                      renameList(list.id, title);
                      close();
                    }}
                  >
                    Сохранить
                  </button>
                  <button type="button" className="btn ghost sm" onClick={close}>
                    Отмена
                  </button>
                </div>
              ) : (
                <>
                  <div className="list-row-main">
                    <div className="list-row-title">{list.title}</div>
                    <div className="setting-hint">
                      {stats.total} {plural(stats.total, 'слово', 'слова', 'слов')}
                      {stats.custom > 0 ? ` · своих: ${stats.custom}` : ''}
                      {whenTrained(list)}
                    </div>
                  </div>
                  <div className="list-row-actions">
                    <button
                      type="button"
                      className="btn sm primary"
                      data-train-list={list.id}
                      onClick={() => onTrain(list.id, 'train')}
                    >
                      Тренировать
                    </button>
                    {/* 0.62.0: полный контроль всех слов без подсказок и с отчётом. */}
                    <button
                      type="button"
                      className="btn ghost sm"
                      data-check-list={list.id}
                      onClick={() => onTrain(list.id, 'check')}
                    >
                      📋 Контрольная
                    </button>
                    {(list.lastCheck?.wrong.length ?? 0) > 0 && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        data-errors-list={list.id}
                        onClick={() => onTrain(list.id, 'errors')}
                      >
                        🔁 Ошибки · {list.lastCheck?.wrong.length}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Переименовать «${list.title}»`}
                      onClick={() => {
                        setEditing(list.id);
                        setTitle(list.title);
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Удалить «${list.title}»`}
                      data-remove-list={list.id}
                      onClick={() => removeList(list.id)}
                    >
                      Удалить
                    </button>
                  </div>
                  {/* 0.63.0: история заходов и динамика — прямо под списком,
                      чтобы не уходить в другой раздел за «а как раньше было». */}
                  <ListHistory
                    list={list}
                    customWords={customWords}
                    onTrainErrors={() => onTrain(list.id, 'errors')}
                  />
                </>
              )}
            </div>
          );
        })}

        {editing === 'new' ? (
          <div className="list-form">
            <label className="list-field">
              <span className="setting-title">Название</span>
              <input
                className="input"
                value={title}
                placeholder="Например: Контрольная 12 ноября"
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                data-list-title
              />
            </label>
            <label className="list-field">
              <span className="setting-title">Слова из школы</span>
              <textarea
                className="input list-textarea"
                value={raw}
                rows={7}
                placeholder={'Хорошо\nУченик\nУченица\n…'}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setParsed(null);
                  setStressFix({});
                }}
                data-list-input
              />
              <span className="setting-hint">
                По одному слову в строке или через запятую. Регистр и «ё» не важны: «Береза» найдётся как «берёза».
              </span>
              {/* Один тап вместо выделения текста: читаем буфер обмена, если браузер разрешает. */}
              <button
                type="button"
                className="btn ghost sm"
                data-list-paste
                onClick={async () => {
                  setClipError('');
                  try {
                    const text = await navigator.clipboard.readText();
                    if (!text.trim()) {
                      setClipError('В буфере обмена пусто. Скопируйте сообщение из чата класса и нажмите снова.');
                      return;
                    }
                    setRaw(text);
                    setParsed(null);
                    setStressFix({});
                  } catch {
                    setClipError('Браузер не дал прочитать буфер. Вставьте текст в поле вручную (долгое нажатие → «Вставить»).');
                  }
                }}
              >
                Вставить из буфера обмена
              </button>
              {clipError && <span className="setting-hint list-error">{clipError}</span>}
            </label>

            {error && (
              <p className="setting-hint list-error" role="alert">
                {error}
              </p>
            )}

            {!parsed && (
              <button type="button" className="btn primary" onClick={preview} data-list-preview>
                Проверить список
              </button>
            )}

            {parsed && (
              <div className="list-preview" data-list-preview-result>
                <div className="list-preview-summary">
                  <b>{parsed.wordIds.length}</b> {plural(parsed.wordIds.length, 'слово', 'слова', 'слов')} в списке
                  {' · '}
                  из банка: {parsed.items.filter((i) => i.source === 'bank').length}
                  {' · '}
                  своих: {parsed.items.filter((i) => i.source === 'custom').length}
                  {parsed.items.some((i) => i.source === 'duplicate')
                    ? ` · повторов убрано: ${parsed.items.filter((i) => i.source === 'duplicate').length}`
                    : ''}
                </div>

                <ul className="list-preview-items">
                  {parsed.items.map((item, i) => {
                    const word = item.word;
                    const key = `${item.text}-${i}`;
                    if (item.source === 'duplicate') {
                      return (
                        <li key={key} className="list-preview-item dup">
                          <span className="list-preview-badge" aria-hidden="true">↺</span>
                          <span className="list-preview-word">{item.text}</span>
                          <span className="setting-hint">повтор — убрали</span>
                        </li>
                      );
                    }
                    if (item.source === 'bank') {
                      return (
                        <li key={key} className="list-preview-item bank">
                          <span className="list-preview-badge" aria-hidden="true">✓</span>
                          <span className="list-preview-word">{item.text}</span>
                          <span className="setting-hint">из словарика</span>
                        </li>
                      );
                    }
                    // Своё слово: ударение ставится тапом по слогу.
                    const stressed = word ? withStress(word, stressFix[word.id] ?? word.stress) : null;
                    // 0.60.0: если ударение подставило автополе (слова нет в
                    // словаре), просим проверить, а не подаём догадку как факт.
                    const guessed = !!word?.stressGuessed && stressFix[word.id] === undefined;
                    return (
                      <li key={key} className="list-preview-item custom">
                        <span className="list-preview-badge" aria-hidden="true">＋</span>
                        <span className="list-preview-word">{item.text}</span>
                        <span className={guessed ? 'setting-hint list-guess' : 'setting-hint'}>
                          {guessed ? 'проверьте ударение:' : 'новое слово — выберите ударение:'}
                        </span>
                        <span className="list-syllables">
                          {stressed?.syllables.map((syl, idx) => {
                            // Индекс ударной гласной в цельном слове: сумма длин прошлых слогов.
                            const offset = stressed.syllables.slice(0, idx).reduce((n, s) => n + s.length, 0);
                            const vowelIdx = offset + [...syl].findIndex((ch) => 'аеёиоуыэюя'.includes(ch.toLowerCase()));
                            const on = stressed.stress === vowelIdx;
                            return (
                              <button
                                key={`${syl}-${idx}`}
                                type="button"
                                className={`list-syl${on ? ' on' : ''}`}
                                aria-pressed={on}
                                aria-label={`Ударение на «${syl}»`}
                                onClick={() => {
                                  if (!word) return;
                                  setStressFix((prev) => ({ ...prev, [word.id]: vowelIdx }));
                                }}
                              >
                                {on ? `${syl}´` : syl}
                              </button>
                            );
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn primary" onClick={save} data-list-save>
                    Сохранить список
                  </button>
                  <button type="button" className="btn ghost" onClick={() => { setParsed(null); setStressFix({}); }}>
                    Изменить слова
                  </button>
                  <button type="button" className="btn ghost" onClick={close}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {!parsed && (
              <button type="button" className="btn ghost sm" onClick={close}>
                Отмена
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="list-presets" data-list-presets>
            {/* 0.59.0: список из школы добавляется одной кнопкой — вставлять
                текст руками не нужно. Пресет разбирается тем же кодом, что и
                вставка из чата, поэтому свои слова создаются сами. */}
            {PRESET_LISTS.map((preset) => {
              const already = lists.some((l) => l.words.length && l.title === preset.title);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="btn ghost list-preset"
                  data-preset-add={preset.id}
                  disabled={already}
                  onClick={() => {
                    const result = addList(preset.title, presetText(preset), {});
                    if (result.list) {
                      setAddedPreset(preset.id);
                      setError('');
                    } else {
                      setError('Не удалось добавить готовый список — попробуйте ещё раз.');
                    }
                  }}
                >
                  {already ? '✓ Список уже добавлен' : `＋ Добавить: ${preset.source}`}
                </button>
              );
            })}
            {addedPreset && (
              <p className="setting-hint" data-preset-added>
                Готово: список добавлен, он уже виден ребёнку на «Уроках» в карточке «🏫 Контрольная».
              </p>
            )}
            </div>

          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 10 }}
            data-add-list
            onClick={() => {
              setEditing('new');
              setTitle('');
              setRaw('');
              setParsed(null);
              setStressFix({});
              setError('');
            }}
          >
            + Свой список (вставить текст)
          </button>
          </>
        )}
      </div>

      <div className="card">
        <GroupTitle
          title="Как это считается"
          hint="Тренировка списка — это опыт и прогресс по словам, но не урок программы."
        />
        <ul className="setting-hint" style={{ margin: 0, paddingLeft: 18 }}>
          <li>задания те же, что в уроках: подсказки, выбор буквы, сборка, письмо;</li>
          <li>XP начисляется, кристаллы — нет: иначе список выгодно перезапускать;</li>
          <li>прогресс по словам идёт в общий словарик и дневной отчёт;</li>
          <li>свои слова не попадают в программу класса — только в свой список.</li>
        </ul>
      </div>

      {customWords && Object.keys(customWords).length > 0 && (
        <div className="card">
          <GroupTitle title="Свои слова" hint="Слова из списков, которых нет в школьном словарике. Ударение можно поправить." />
          <ul className="list-custom-words">
            {Object.values(customWords).map((word) => {
              const stressLetter = word.text[word.stress]?.toUpperCase() ?? '';
              return (
                <li key={word.id} className="list-custom-word" data-custom-word={word.id}>
                  <span className="list-custom-word-text">
                    {[...word.text].map((ch, i) =>
                      i === word.stress ? <b key={i}>{ch.toUpperCase()}</b> : <span key={i}>{ch}</span>,
                    )}
                  </span>
                  <span className="setting-hint">ударная {stressLetter || '—'}</span>
                  {word.stressGuessed && (
                    <span className="list-guess-badge" title="Ударение подставлено автоматически — проверьте">
                      проверьте
                    </span>
                  )}
                  <span className="list-syllables">
                    {word.syllables.map((syl, idx) => {
                      const offset = word.syllables.slice(0, idx).reduce((n, s) => n + s.length, 0);
                      const vowelIdx = offset + [...syl].findIndex((ch) => 'аеёиоуыэюя'.includes(ch.toLowerCase()));
                      const on = word.stress === vowelIdx;
                      return (
                        <button
                          key={`${syl}-${idx}`}
                          type="button"
                          className={`list-syl${on ? ' on' : ''}`}
                          aria-pressed={on}
                          aria-label={`Ударение на «${syl}» у слова ${word.text}`}
                          onClick={() => setCustomWordStress(word.id, vowelIdx)}
                        >
                          {syl}
                        </button>
                      );
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
