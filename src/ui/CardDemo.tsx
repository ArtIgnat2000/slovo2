import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/app.css';
import { WORD_BY_ID } from '../content/words';
import { WordCard, WordClue, Sentence, type PhotoSize, type WordCardVariant } from './WordView';

/**
 * Страница сравнения вариантов карточки слова — витрина дизайн-ревью.
 *
 * Собирается вместе с приложением (см. rollupOptions.input в vite.config.ts),
 * поэтому открывается по обычной ссылке без параметров:
 *   /docs/word-cards/cards-demo.html
 *
 * Свой вариант можно посмотреть в приложении через хеш (переживает любые
 * прокси, в отличие от параметра ?cards=):
 *   /#cards=plate   |   /#cards=photo   (картинка всегда сверху, текст снизу)
 */

const WORDS = ['класс', 'здравствуйте', 'до свидания', 'рисунок', 'картина', 'Москва', 'ворона', 'молоко', 'алфавит']
  .map((text) => Object.values(WORD_BY_ID).find((w) => w.text === text))
  .filter((w): w is NonNullable<typeof w> => Boolean(w));

const VARIANTS: { id: WordCardVariant; title: string; note: string; pros: string; cons: string }[] = [
  {
    id: 'plate',
    title: 'A · Плита',
    note: 'картинка на подложке, слово под ней, подпись в самом низу',
    pros: 'привычно читается сверху вниз, подпись не спорит с картинкой',
    cons: 'самая высокая карточка',
  },
  {
    id: 'photo',
    title: 'B · Фотокарточка — выбрана',
    note: 'снимок во всю ширину паспарту, слово под разделительной линией',
    pros: 'самая сильная связка «образ ↔ слово»; паспарту отделяет пёстрые фоны картинок',
    cons: 'в тёмной теме паспарту должно остаться светлым',
  },
];

/** Размеры снимка в «фотокарточке» — те же два шага, что и в /?art=… */
const PHOTO_SIZES: { id: PhotoSize; title: string; css: number | string }[] = [
  { id: 'base', title: 'Снимок во всю карточку', css: 'var(--art-photo)' },
  { id: 'compact', title: 'Снимок как плита A', css: 'var(--art-photo-compact)' },
];

function Demo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [size, setSize] = useState(390);
  const [picked, setPicked] = useState<WordCardVariant>('photo');
  const [photoSize, setPhotoSize] = useState<PhotoSize>('base');
  const [word, setWord] = useState(WORDS[0]);
  const photoCss = PHOTO_SIZES.find((s) => s.id === photoSize)!.css;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="screen" style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 80 }}>
      <h1>Карточка слова — варианты</h1>
      <p className="muted">
        Живые компоненты приложения на настоящих токенах. Пять слов подряд в каждом варианте — ниже.
        В приложении основным выбран <b>B · Фотокарточка</b>; свои вариант и размер снимка можно
        посмотреть по ссылке: <code>/#cards=photo</code>, <code>/#cards=plate</code>,{' '}
        <code>/#art=base|compact</code>. Порядок у всех вариантов один: картинка сверху,
        текст снизу, по центру.
      </p>

      <div className="card mb">
        <h3 style={{ marginTop: 0 }}>Одна карточка — переключите вариант</h3>
        <div className="row mb" style={{ flexWrap: 'wrap' }}>
          {VARIANTS.map((v) => (
            <button key={v.id} className={`chip ${picked === v.id ? 'on' : ''}`} onClick={() => setPicked(v.id)}>
              {v.title}
            </button>
          ))}
        </div>
        <div className="row mb" style={{ flexWrap: 'wrap' }}>
          <button className={`chip ${theme === 'light' ? 'on' : ''}`} onClick={() => setTheme('light')}>
            Светлая тема
          </button>
          <button className={`chip ${theme === 'dark' ? 'on' : ''}`} onClick={() => setTheme('dark')}>
            Тёмная тема
          </button>
          <button className={`chip ${size === 390 ? 'on' : ''}`} onClick={() => setSize(390)}>
            Экран 390
          </button>
          <button className={`chip ${size === 320 ? 'on' : ''}`} onClick={() => setSize(320)}>
            Экран 320
          </button>
        </div>
        <div className="row mb" style={{ flexWrap: 'wrap' }}>
          {WORDS.slice(0, 5).map((w) => (
            <button key={w.id} className={`chip ${word.id === w.id ? 'on' : ''}`} onClick={() => setWord(w)}>
              {w.text}
            </button>
          ))}
        </div>
        {picked === 'photo' && (
          <div className="row mb" style={{ flexWrap: 'wrap' }}>
            {PHOTO_SIZES.map((s) => (
              <button
                key={s.id}
                className={`chip ${photoSize === s.id ? 'on' : ''}`}
                onClick={() => setPhotoSize(s.id)}
              >
                {s.title}
              </button>
            ))}
            <span className="tiny" style={{ alignSelf: 'center' }}>
              в приложении: <code>/#art={photoSize}</code>
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: size, maxWidth: '100%', flex: 'none' }}>
            <WordCard
              word={word}
              variant={picked}
              artSize={picked === 'photo' ? photoCss : undefined}
            >
              <span className="tiny">Слоги: {word.syllables.join(' · ')}</span>
              <Sentence word={word} hidden={false} />
            </WordCard>
          </div>
          <div className="grow" style={{ minWidth: 220 }}>
            <p className="tiny" style={{ marginTop: 0 }}>
              {VARIANTS.find((v) => v.id === picked)!.note}
            </p>
            <p className="tiny">
              <b>Плюс:</b> {VARIANTS.find((v) => v.id === picked)!.pros}
            </p>
            <p className="tiny">
              <b>Минус:</b> {VARIANTS.find((v) => v.id === picked)!.cons}
            </p>
          </div>
        </div>
      </div>

      <h2>Оба варианта рядом</h2>
      <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        {VARIANTS.map((v) => (
          <div key={v.id} style={{ width: size, maxWidth: '100%', flex: 'none' }}>
            <h3 style={{ marginBottom: 4 }}>{v.title}</h3>
            <p className="tiny" style={{ marginBottom: 12 }}>
              {v.note}
            </p>
            <div className="col">
              {WORDS.slice(0, 5).map((w) => (
                <WordCard
                  key={w.id}
                  word={w}
                  variant={v.id}
                  artSize={v.id === 'photo' ? photoCss : undefined}
                >
                  <Sentence word={w} hidden={false} />
                </WordCard>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt">Подсказка к заданию (WordClue)</h2>
      <div style={{ width: size, maxWidth: '100%' }}>
        {WORDS.slice(0, 3).map((w) => (
          <div className="mb" key={w.id}>
            <WordClue word={w} />
          </div>
        ))}
      </div>

      <p className="mt">
        <a href="/">← Вернуться в приложение</a>
      </p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Demo />);
