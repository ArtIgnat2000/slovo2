import { useState } from 'react';
import { useApp } from '../../state/store';
import { ConfirmDialog } from '../Bits';

const AVATARS = ['🦊', '🐱', '🐼', '🦉', '🐸', '🦄', '🐨', '🐯', '🐙', '🦖'];

export function ProfilesScreen({ onClose }: { onClose?: () => void }) {
  const { profiles, activeId, createProfile, selectProfile, deleteProfile, renameProfile } = useApp();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const create = () => {
    const n = name.trim();
    if (!n) return;
    createProfile(n, avatar);
    setName('');
    onClose?.();
  };

  return (
    <div className="screen">
      <h1 className="mb">Кто будет учиться? 🎒</h1>

      <div className="card mb">
        {profiles.length === 0 && <p className="muted">Пока нет ни одного ученика — создайте первый профиль.</p>}
        {profiles.map((p) => (
          <div className="kv" key={p.id}>
            <button className="row" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => { selectProfile(p.id); onClose?.(); }}>
              <span className="avatar" style={{ width: 36, height: 36, fontSize: 20 }}>
                {p.avatar}
              </span>
              <b style={{ marginLeft: 8 }}>{p.name}</b>
              {p.id === activeId && <span className="tiny" style={{ marginLeft: 8 }}>· выбран</span>}
            </button>
            <span className="row">
              <button className="chip" onClick={() => { setEditing(p.id); setName(p.name); setAvatar(p.avatar); }}>
                ✏️
              </button>
              <button
                className="chip"
                aria-label={`Удалить профиль ${p.name}`}
                onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
              >
                🗑
              </button>
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
        {editing ? (
          <div className="row">
            <button
              className="btn primary grow"
              onClick={() => {
                if (!name.trim()) return;
                renameProfile(editing, name.trim(), avatar);
                setEditing(null);
                setName('');
              }}
            >
              Сохранить
            </button>
            <button className="btn ghost" onClick={() => { setEditing(null); setName(''); }}>
              Отмена
            </button>
          </div>
        ) : (
          <button className="btn primary wide lg" disabled={!name.trim()} onClick={create}>
            Начать учиться 🚀
          </button>
        )}
      </div>

      {onClose && profiles.length > 0 && (
        <button className="btn ghost wide mt" onClick={onClose}>
          Закрыть
        </button>
      )}

      {confirmDelete && (
        <ConfirmDialog
          emoji="🧸"
          title={`Удалить профиль «${confirmDelete.name}»?`}
          text="Весь прогресс, серия и кристаллы этого ученика будут удалены."
          stayLabel="Оставить профиль"
          leaveLabel="Удалить профиль"
          onStay={() => setConfirmDelete(null)}
          onLeave={() => {
            if (editing === confirmDelete.id) {
              setEditing(null);
              setName('');
            }
            deleteProfile(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}
