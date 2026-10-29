/**
 * Чат «Спроси БУКа» (0.87.0; итерация 2, docs/buk-companion-3d.md §5, идея 2).
 *
 * Полноэкранный оверлей: реплики БУКа слева, ответы ребёнка справа. Отвечать
 * можно чипами, печать — по желанию (спека). Логика разговора — движок
 * engine/buk-chat: здесь только сессия, список сообщений и отрисовка.
 *
 * Правила серии в интерфейсе:
 *  • никаких наград за чат — компонент не трогает ни xp, ни кристаллы;
 *  • «Потренироваться» и «Полетели?» уводят в урок через колбэк App —
 *    чат закрывается сам, экран урока начинается с чистого листа;
 *  • плавающий БУК на время чата скрыт (App), конфликт слоёв исключён;
 *  • сова в шапке — вторая отрисовка `.mascot`, прямым ребёнком `.app`
 *    она не становится: контракт mascot-ui (ровно одна сова) не задет.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChatAction, ChatChip, ChatReply, ChatSession } from '../engine/buk-chat';
import { chatRespond, openChat, sessionStart } from '../engine/buk-chat';
import { useApp } from '../state/store';
import { Mascot } from './Mascot';

interface ChatMsg {
  id: number;
  from: 'buk' | 'me';
  text: string;
  /** Чипы и действие вешаются на последнюю реплику БУКа. */
  chips?: ChatChip[];
  action?: ChatAction;
}

export function BukChat({ onClose, onAction }: { onClose: () => void; onAction: (a: ChatAction) => void }) {
  const profile = useApp((s) => s.profiles.find((p) => p.id === s.activeId));
  const dailyGoal = useApp((s) => s.settings.dailyGoal);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [session, setSession] = useState<ChatSession>(sessionStart());
  const [draft, setDraft] = useState('');
  const seq = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const push = (m: Omit<ChatMsg, 'id'>) =>
    setMsgs((v) => [...v, { id: (seq.current += 1), ...m }]);

  const pushReply = (reply: ChatReply, next: ChatSession) => {
    setSession(next);
    reply.lines.forEach((text, i) => {
      const last = i === reply.lines.length - 1;
      push({ from: 'buk', text, chips: last ? reply.chips : undefined, action: last ? reply.action : undefined });
    });
    // Факт уходит в профиль сразу: следующая реплика уже знает имя питомца.
    if (reply.facts) useApp.getState().setBukFacts(reply.facts);
  };

  const ctx = () => {
    const app = useApp.getState();
    const p = app.profiles.find((pp) => pp.id === app.activeId);
    if (!p) return null;
    return { profile: p, hour: new Date().getHours(), goal: dailyGoal };
  };

  // Первая реплика — при открытии (приветствие по времени + память).
  useEffect(() => {
    const c = ctx();
    if (!c) {
      onClose();
      return;
    }
    const { reply, session: s } = openChat(c);
    pushReply(reply, s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape закрывает чат — как у других полноэкранных оверлеев.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Новое сообщение всегда внизу.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [msgs.length]);

  const respond = (input: { chipId?: string; text?: string }) => {
    const c = ctx();
    if (!c) return;
    const { reply, session: next } = chatRespond(input, c, session);
    pushReply(reply, next);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    push({ from: 'me', text: t });
    respond({ text: t });
  };

  const handleChip = (chip: ChatChip) => {
    push({ from: 'me', text: chip.label });
    respond({ chipId: chip.id });
  };

  if (!profile) return null;

  // Чипы и действие висят на последней реплике БУКа — пока ребёнок не ответил.
  const last = msgs[msgs.length - 1];
  const pending = last && last.from === 'buk' ? last : undefined;

  return (
    <div className="buk-chat" role="dialog" aria-label="Спроси БУКа">
      <header className="buk-chat-head">
        <Mascot className="buk-chat-owl" size={46} mood="happy" alive />
        <h2 className="buk-chat-title">Спроси БУКа</h2>
        <button type="button" className="buk-chat-close" aria-label="Закрыть чат" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="buk-chat-log">
        {msgs.map((m) => (
          <div key={m.id} className={`chat-msg chat-${m.from}`}>
            <p className="chat-text">{m.text}</p>
            {m.action && (
              <button type="button" className="chat-action" onClick={() => onAction(m.action!)}>
                {m.action.label}
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {pending?.chips && (
        <div className="buk-chat-chips" role="group" aria-label="Вопросы к БУКу">
          {pending.chips.map((chip) => (
            <button key={chip.id} type="button" className="chat-chip" onClick={() => handleChip(chip)}>
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <form className="buk-chat-form" onSubmit={handleSend}>
        <input
          className="buk-chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Напиши БУКу…"
          aria-label="Сообщение БУКу"
        />
        <button type="submit" className="buk-chat-send" aria-label="Отправить">
          ➤
        </button>
      </form>
    </div>
  );
}
