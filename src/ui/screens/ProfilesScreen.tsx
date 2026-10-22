import { useState } from 'react';
import { useApp } from '../../state/store';
import { AVAILABLE_CLASSES, CLASS_META, WORDS_BY_GRADE, availableClass } from '../../content/words';
import { ConfirmDialog } from '../Bits';
import { InviteFriend } from '../InviteFriend';
import type { ClassId } from '../../types';

const AVATARS = ['🦊', '🐱', '🐼', '🦉', '🐸', '🦄', '🐨', '🐯', '🐙', '🦖'];

/**
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

  const create = () => {
    const n = name.trim();
    if (!n || classId === null) return;
    createProfile(n, avatar, classId);
    setName('');
    setClassId(null);
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

  return (
    <div className="screen">
      <h1 className="mb">Кто будет учиться? 🎒</h1>

      {/* 0.32.1: ссылка на приложение — первой строкой, до формы нового ученика.
          Раньше кнопка стояла под формой (имя, аватары, класс) и на телефоне
          оказывалась на втором экране: «не найти». */}
      <button type="button" className="btn ghost wide mb" onClick={() => setInviteOpen(true)}>
        🤝 Позови друга
      </button>

      <div className="card mb">
        {profiles.length === 0 && <p className="muted">Пока нет ни одного ученика — создайте первый профиль.</p>}
        {profiles.map((p) => (
          <div className="kv" key={p.id}>
            <button className="row" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => { selectProfile(p.id); onClose?.(); }}>
              <span className="avatar" style={{ width: 36, height: 36, fontSize: 20 }}>
                {p.avatar}
              </span>
              <b style={{ marginLeft: 8 }}>{p.name}</b>
              <span className="class-badge" style={{ marginLeft: 8 }}>
                {availableClass(p.activeClass ?? 2)} класс
              </span>
              {p.id === activeId && <span className="tiny" style={{ marginLeft: 8 }}>· выбран</span>}
            </button>
            <span className="row">
              <button className="chip" onClick={() => startEdit(p.id)} aria-label={`Изменить профиль ${p.name}`}>
                ✏️
              </button>
              {manage && (
                <button
                  className="chip"
                  aria-label={`Удалить профиль ${p.name}`}
                  onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                >
                  🗑
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>{editing ? 'Изменить профиль' : 'Новый ученик'}</h3>
        <input
          className="input mb"
          value={name}
          maxLength={16}
          placeholder="Имя"
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
                resetForm();
              }}
            >
              Сохранить
            </button>
            <button className="btn ghost" onClick={resetForm}>
              Отмена
            </button>
          </div>
        ) : (
          <button
            className="btn primary wide lg"
            disabled={!name.trim() || (AVAILABLE_CLASSES.length > 1 && classId === null)}
            onClick={create}
          >
            Начать учиться 🚀
          </button>
        )}
      </div>

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
            if (editing === confirmDelete.id) resetForm();
            deleteProfile(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}
