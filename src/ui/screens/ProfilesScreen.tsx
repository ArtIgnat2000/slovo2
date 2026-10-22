import { useState } from 'react';
import { useApp } from '../../state/store';
import { AVAILABLE_CLASSES, CLASS_META, WORDS_BY_GRADE, availableClass } from '../../content/words';
import { ConfirmDialog } from '../Bits';
import { InviteFriend } from '../InviteFriend';
import type { ClassId } from '../../types';

const AVATARS = ['🦊', '🐱', '🐼', '🦉', '🐸', '🦄', '🐨', '🐯', '🐙', '🦖'];

/**
 * Экран «Кто будет учиться?» — выбор ученика, а не форма нового ученика.
 *
 * 0.33.0: до этого форма «Новый ученик» была всегда раскрыта и заканчивалась
 * большой кнопкой «Начать учиться 🚀». Взрослый, который зашёл поменять класс
 * текущему ученику, нажимал её — и вместо уроков начинал заводить второго
 * ребёнка. Теперь экран отвечает на вопрос из заголовка:
 *
 *  • есть ученики → список карточек и ОДНА главная кнопка «Продолжить ▶»,
 *    которая запускает уроки выбранного ученика (тап по карточке — то же);
 *  • «+ Новый ученик» — вторичная кнопка, форма раскрывается по ней
 *    (progressive disclosure) и её кнопка называется «Создать ученика»;
 *  • первый запуск (учеников нет) — форма раскрыта, и там «Начать учиться 🚀»
 *    честно значит «начать учиться», потому что продолжать нечего.
 *
 * Так на экране никогда не бывает двух главных кнопок и ни одна подпись не
 * обещает «учиться», а делает «создать профиль».
 *
 * @param manage — разрешить удаление профилей. С детского пути (аватар в шапке)
 *   экран открывается без этого флага: переключить ученика можно, удалить —
 *   только из раздела «Родителям». Именно так ребёнок терял весь прогресс.
 */
export function ProfilesScreen({ onClose, manage = false }: { onClose?: () => void; manage?: boolean }) {
  const { profiles, activeId, createProfile, selectProfile, deleteProfile, renameProfile, setProfileClass } = useApp();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  // null — класс ещё не выбран: ребёнок должен выбрать программу осознанно,
  // а не получить случайную по умолчанию.
  const [classId, setClassId] = useState<ClassId | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  /** Лист «Позови друга» — с 0.32.0 вход живёт здесь, а не значком 🤝 в шапке. */
  const [inviteOpen, setInviteOpen] = useState(false);
  /** Форма нового ученика раскрыта по «+ Новый ученик» (0.33.0). */
  const [formOpen, setFormOpen] = useState(profiles.length === 0);

  // Первый запуск — форма на экране сама: продолжать нечего, кроме неё.
  const showForm = profiles.length === 0 || formOpen || editing !== null;
  /** Кого запустит «Продолжить ▶»: выбранного, а если выбор потерян — первого. */
  const current = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;

  const continueLearning = () => {
    if (!current) return;
    selectProfile(current.id);
    onClose?.();
  };

  const create = () => {
    const n = name.trim();
    if (!n || classId === null) return;
    createProfile(n, avatar, classId);
    setName('');
    setClassId(null);
    setFormOpen(false);
    onClose?.();
  };

  const startEdit = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setEditing(id);
    setName(p.name);
    setAvatar(p.avatar);
    setClassId(availableClass(p.activeClass ?? 2));
  };

  const resetForm = () => {
    setEditing(null);
    setName('');
    setClassId(null);
  };

  const cancelForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  return (
    <div className="screen">
      <h1 className="mb">Кто будет учиться? 🎒</h1>

      {profiles.length > 0 ? (
        <div className="profile-list mb">
          {profiles.map((p) => {
            const grade = availableClass(p.activeClass ?? 2);
            const selected = p.id === activeId;
            return (
              <div key={p.id} className={`profile-card${selected ? ' on' : ''}`}>
                <button
                  type="button"
                  className="profile-card-main"
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${p.name}, ${grade} класс${selected ? ', выбран' : ''}. ${
                    selected ? 'Продолжить учиться' : 'Учиться под этим именем'
                  }`}
                  onClick={() => {
                    selectProfile(p.id);
                    onClose?.();
                  }}
                >
                  <span className="avatar profile-card-avatar" aria-hidden="true">
                    {p.avatar}
                  </span>
                  <span className="profile-card-text">
                    <span className="profile-card-name">{p.name}</span>
                    <span className="profile-card-meta">
                      {grade} класс{selected ? ' · выбран' : ''}
                    </span>
                  </span>
                  <span className="profile-card-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="chip profile-card-edit"
                  aria-label={`Изменить профиль ${p.name}: имя, аватар, класс`}
                  onClick={() => startEdit(p.id)}
                >
                  ✏️
                </button>
                {manage && (
                  <button
                    type="button"
                    className="chip"
                    aria-label={`Удалить профиль ${p.name}`}
                    onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted mb">Пока нет ни одного ученика — создайте первый профиль.</p>
      )}

      {/* Одна главная кнопка на экране: пока форма закрыта — это «Продолжить»,
          и она запускает уроки выбранного ученика. Внутри формы главной
          становится «Создать ученика» / «Сохранить». */}
      {!showForm && (
        <button type="button" className="btn primary wide lg mb" onClick={continueLearning}>
          Продолжить ▶
        </button>
      )}

      {!showForm && (
        <button type="button" className="btn ghost wide mb" onClick={openCreate}>
          + Новый ученик
        </button>
      )}

      {/* 0.32.1: ссылка на приложение — выше формы нового ученика, чтобы её
          было видно без прокрутки на телефоне. */}
      <button type="button" className="btn ghost wide mb" onClick={() => setInviteOpen(true)}>
        🤝 Позови друга
      </button>

      {showForm && (
        <div className="card">
          <h3>{editing ? 'Изменить профиль' : 'Новый ученик'}</h3>
          <input
            className="input mb"
            value={name}
            maxLength={16}
            placeholder="Имя"
            aria-label="Имя ученика"
            onChange={(e) => setName(e.target.value)}
          />
          <div className="avatars mb">
            {AVATARS.map((a) => (
              <button key={a} className={`avatar-pick ${avatar === a ? 'on' : ''}`} onClick={() => setAvatar(a)}>
                {a}
              </button>
            ))}
          </div>

          {AVAILABLE_CLASSES.length > 1 && (
            <div className="mb">
              <div className="setting-title mb">Какой класс?</div>
              <div className="class-form-row">
                {AVAILABLE_CLASSES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`class-form-btn ${classId === g ? 'on' : ''}`}
                    aria-pressed={classId === g}
                    onClick={() => setClassId(g)}
                  >
                    <span aria-hidden="true">{CLASS_META[g].emoji}</span>
                    <span>{CLASS_META[g].title}</span>
                    <span className="tiny">{WORDS_BY_GRADE[g].length} слов</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {editing && <p className="setting-hint mb">Прогресс, кристаллы и покупки сохранятся.</p>}
          {editing ? (
            <div className="row">
              <button
                className="btn primary grow"
                onClick={() => {
                  if (!name.trim()) return;
                  renameProfile(editing, name.trim(), avatar);
                  if (classId !== null) setProfileClass(editing, classId);
                  cancelForm();
                }}
              >
                Сохранить
              </button>
              <button className="btn ghost" onClick={cancelForm}>
                Отмена
              </button>
            </div>
          ) : (
            <div className="row">
              <button
                className="btn primary grow"
                disabled={!name.trim() || (AVAILABLE_CLASSES.length > 1 && classId === null)}
                onClick={create}
              >
                {profiles.length === 0 ? 'Начать учиться 🚀' : 'Создать ученика'}
              </button>
              {profiles.length > 0 && (
                <button className="btn ghost" onClick={cancelForm}>
                  Отмена
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {inviteOpen && <InviteFriend onClose={() => setInviteOpen(false)} />}

      {onClose && profiles.length > 0 && (
        <button className="btn ghost wide mt" onClick={onClose}>
          Закрыть
        </button>
      )}

      {confirmDelete && (
        <ConfirmDialog
          emoji="🧸"
          title={`Удалить профиль «${confirmDelete.name}»?`}
          text="Весь прогресс, серия и кристаллы этого ученика будут удалены. 30 дней профиль можно вернуть в разделе «Родителям»."
          stayLabel="Оставить профиль"
          leaveLabel="Удалить профиль"
          onStay={() => setConfirmDelete(null)}
          onLeave={() => {
            if (editing === confirmDelete.id) cancelForm();
            deleteProfile(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}
