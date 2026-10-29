import { useEffect, useState } from 'react';
import { ITEM_BY_ID } from '../engine/shop';
import { AirplaneArt, airplaneArtUrl } from './AirplaneArt';
import { ELECTRONICS_ART, ElectronicsArt } from './ElectronicsArt';
import { ProductPhoto, productPhotoUrl } from './ProductPhoto';
import { ShipArt, hasShipArt, shipArtUrl } from './ShipArt';
import { ToyArt } from './ToyArt';

/**
 * Три «окна» в товар для телефонов, кораблей и самолётов:
 * предмет в студии → другой визуальный ракурс → собственная сцена-мечта.
 * Это не три похожих каталожных снимка: ребёнок видит форму, детали и вещь
 * в действии. Переход по тапу намеренно без кнопок поверх рисунка.
 */
const FRAMES = [
  { title: 'На витрине', next: 'Повернуть и рассмотреть' },
  { title: 'Другой ракурс', next: 'Запустить приключение' },
  { title: 'В приключении', next: 'Вернуться к витрине' },
] as const;

const PHONE_COLORS: Record<string, string> = {
  'phone-smart': '#cad6dc', 'phone-flip': '#b6a3d9', 'phone-retro': '#e98245',
  'phone-pro': '#335a9a', 'phone-18': '#9d394f', 'phone-18-air': '#c76d7b',
  'phone-18-pro': '#8a243f', 'phone-18-max': '#691a36',
};

export function isTechTourItem(id: string): boolean {
  const item = ITEM_BY_ID[id];
  return item?.kind === 'toy' && ((item.toy === 'phone' && id.startsWith('phone-')) || item.toy === 'ship' || item.toy === 'plane');
}

/** Подгружаем все кадры по тапу на товар, а не после открытия листа. */
export function warmTechTour(id: string): void {
  if (!isTechTourItem(id)) return;
  const item = ITEM_BY_ID[id];
  const urls = [productPhotoUrl(id)];
  if (item.toy === 'phone') {
    const file = ELECTRONICS_ART[id];
    if (file) urls.push(`${import.meta.env.BASE_URL}electronics/${file}.webp`);
  } else if (item.toy === 'plane') {
    const art = airplaneArtUrl(id);
    if (art) urls.push(art);
  } else if (item.toy === 'ship' && hasShipArt(id)) {
    const art = shipArtUrl(id);
    if (art) urls.push(art);
  }
  if (typeof document === 'undefined') return;
  for (const url of urls) {
    const image = document.createElement('img');
    image.decoding = 'async';
    image.src = url;
  }
}

export function TechTour({ id, alt }: { id: string; alt: string }) {
  const item = ITEM_BY_ID[id];
  const [frame, setFrame] = useState(0);
  useEffect(() => setFrame(0), [id]);
  if (!item || !isTechTourItem(id)) return <ToyArt id={id} alt={alt} />;

  const current = FRAMES[frame];
  const frameName = item.toy === 'phone'
    ? ['Задняя панель', 'Студийный ракурс', 'Экран мечты'][frame]
    : item.toy === 'plane'
      ? ['Самолёт крупно', 'Иллюстрация самолёта', 'Полёт над облаками'][frame]
      : ['Корабль крупно', 'Иллюстрация корабля', 'Морское приключение'][frame];

  return (
    <div className={`tech-tour tech-tour-${item.toy}`} data-tech-tour={id}>
      <button
        type="button"
        className="tech-tour-stage"
        onClick={() => setFrame((value) => (value + 1) % FRAMES.length)}
        aria-label={`${frameName}. Нажми, чтобы ${current.next.toLowerCase()}`}
      >
        {frame === 0 ? (
          <ProductPhoto key={`${id}-photo`} id={id} alt={alt} className="tech-tour-photo" />
        ) : frame === 1 ? (
          item.toy === 'phone' ? (
            <ElectronicsArt key={`${id}-detail`} id={id} alt={`${alt}: задняя панель крупным планом`} className="tech-tour-electronics" />
          ) : item.toy === 'plane' ? (
            <span key={`${id}-detail`} className="tech-tour-cutout"><AirplaneArt id={id} size={280} alt={`${alt}: рисунок самолёта`} /></span>
          ) : hasShipArt(id) ? (
            <span key={`${id}-detail`} className="tech-tour-cutout"><ShipArt id={id} alt={`${alt}: рисунок корабля`} /></span>
          ) : (
            <TitanicIllustration key={`${id}-detail`} />
          )
        ) : item.toy === 'phone' ? (
          <PhoneDreamScreen key={`${id}-dream`} id={id} title={item.title} />
        ) : (
          <AdventureScene key={`${id}-scene`} kind={item.toy === 'plane' ? 'plane' : 'ship'} id={id} />
        )}
      </button>
      <div className="tech-tour-caption" aria-live="polite">
        <span>{frameName}</span>
        <span className="tech-tour-count">{frame + 1} / {FRAMES.length}</span>
      </div>
      <div className="tech-tour-progress" aria-hidden="true"><i style={{ width: `${((frame + 1) / FRAMES.length) * 100}%` }} /></div>
    </div>
  );
}

function PhoneDreamScreen({ id, title }: { id: string; title: string }) {
  const color = PHONE_COLORS[id] ?? '#617cae';
  return (
    <div className="phone-dream" role="img" aria-label={`${title}: яркий экран блокировки с созвездиями и приложениями`}>
      <div className="phone-dream-glow" />
      <div className="phone-dream-device">
        <svg viewBox="0 0 260 480" role="presentation" aria-hidden="true">
          <defs>
            <linearGradient id={`wallpaper-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={color} /><stop offset=".55" stopColor="#7555c7" /><stop offset="1" stopColor="#182e66" />
            </linearGradient>
            <clipPath id={`screen-${id}`}><rect x="12" y="12" width="236" height="456" rx="32" /></clipPath>
          </defs>
          <g clipPath={`url(#screen-${id})`}>
            <rect x="12" y="12" width="236" height="456" fill={`url(#wallpaper-${id})`} />
            <circle cx="182" cy="126" r="90" fill="#ffdb91" opacity=".42" />
            <path d="M0 322 Q55 265 108 327 T220 302 T290 314 V490 H0Z" fill="#283b79" opacity=".9" />
            <path d="M0 374 Q58 320 117 377 T234 351 T290 365 V490 H0Z" fill="#172959" />
            <g fill="#fff6d7" opacity=".9"><circle cx="54" cy="84" r="2.5"/><circle cx="203" cy="67" r="2"/><circle cx="82" cy="164" r="1.8"/><circle cx="218" cy="208" r="2.4"/><circle cx="47" cy="245" r="1.6"/><circle cx="154" cy="196" r="1.8"/></g>
            <path d="M54 84 82 164 154 196 203 67 218 208" fill="none" stroke="#fff6d7" strokeWidth="1.4" opacity=".36" />
            <text x="130" y="117" textAnchor="middle" fill="white" fontSize="15" fontFamily="system-ui" opacity=".9">МОЯ ГАЛАКТИКА</text>
            <text x="130" y="205" textAnchor="middle" fill="white" fontSize="68" fontWeight="300" fontFamily="system-ui">09:41</text>
            <text x="130" y="232" textAnchor="middle" fill="white" fontSize="15" fontFamily="system-ui" opacity=".9">Звёздное утро ✨</text>
            {['#73e4f4', '#ffd66e', '#ff8aaf', '#b9ff9a'].map((fill, index) => (
              <g key={fill} transform={`translate(${43 + index * 58},394)`}>
                <rect width="40" height="40" rx="13" fill={fill} opacity=".96" />
                <circle cx="20" cy="20" r="8" fill="white" opacity=".9" />
              </g>
            ))}
            <rect x="82" y="455" width="96" height="4" rx="2" fill="white" opacity=".85" />
          </g>
          <rect x="12" y="12" width="236" height="456" rx="32" fill="none" stroke="#fff" strokeWidth="4" opacity=".7" />
          <rect x="102" y="20" width="56" height="16" rx="8" fill="#111827" />
        </svg>
      </div>
      <span className="phone-dream-spark phone-dream-spark-a">✦</span>
      <span className="phone-dream-spark phone-dream-spark-b">✧</span>
      <span className="phone-dream-spark phone-dream-spark-c">✦</span>
    </div>
  );
}

function AdventureScene({ kind, id }: { kind: 'plane' | 'ship'; id: string }) {
  const palette = id.includes('moon') ? ['#201454', '#5547aa', '#ffd982']
    : id.includes('arctic') ? ['#9bdcf4', '#e6fbff', '#317baa']
      : id.includes('steam') ? ['#492a2b', '#c4774e', '#ffc36d']
        : id.includes('electron') ? ['#123e57', '#2fbcae', '#9dffdd']
          : id.includes('atomic') ? ['#142c53', '#3d83ca', '#97f4ff']
            : ['#276fba', '#85d8f4', '#fff0a7'];
  return (
    <svg className={`adventure-scene adventure-scene-${kind}`} viewBox="0 0 960 560" role="img" aria-label={kind === 'plane' ? 'Самолёт летит над облаками к горизонту' : 'Корабль идёт по сияющему морю'}>
      <defs>
        <linearGradient id={`adventure-bg-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={palette[0]} /><stop offset="1" stopColor={palette[1]} /></linearGradient>
        <linearGradient id={`adventure-glow-${id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={palette[2]} /><stop offset="1" stopColor={palette[1]} /></linearGradient>
        <filter id={`adventure-blur-${id}`}><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <rect width="960" height="560" fill={`url(#adventure-bg-${id})`} />
      <circle cx="728" cy="145" r="92" fill={palette[2]} opacity=".32" filter={`url(#adventure-blur-${id})`} />
      {kind === 'plane' ? <>
        <circle cx="732" cy="146" r="43" fill={palette[2]} opacity=".9" />
        <g className="adventure-cloud adventure-cloud-one" fill="#fff" opacity=".75"><ellipse cx="196" cy="330" rx="155" ry="31"/><ellipse cx="243" cy="311" rx="71" ry="43"/><ellipse cx="119" cy="315" rx="63" ry="32"/></g>
        <g className="adventure-cloud adventure-cloud-two" fill="#fff" opacity=".55"><ellipse cx="780" cy="364" rx="173" ry="28"/><ellipse cx="831" cy="347" rx="74" ry="43"/><ellipse cx="694" cy="351" rx="67" ry="31"/></g>
        <path d="M68 444 Q480 383 930 431" fill="none" stroke="#fff" strokeWidth="3" opacity=".35" />
        <g className="adventure-vehicle adventure-vehicle-plane" fill={`url(#adventure-glow-${id})`} stroke="#fff" strokeWidth="3" strokeLinejoin="round">
          <path d="M214 276 L437 254 L515 173 Q531 158 545 165 L536 245 L692 229 Q718 228 731 243 Q739 253 717 263 L537 296 L525 367 L497 376 L455 309 L263 347 Q244 350 236 337 L356 290 L218 301Z" />
          <path d="M445 256 473 212 486 211 479 253Z" fill="#fff" opacity=".82" />
        </g>
        <path d="M153 285 Q420 197 734 235" fill="none" stroke={palette[2]} strokeWidth="2" strokeDasharray="7 11" opacity=".7" />
        <text x="54" y="74" fill="white" fontSize="17" fontFamily="system-ui" letterSpacing="4" opacity=".8">МИССИЯ: ВЫШЕ ОБЛАКОВ</text>
      </> : <>
        <path d="M0 301 Q175 277 342 304 T678 295 T960 298 V560 H0Z" fill="#123f76" opacity=".68" />
        <path className="adventure-wave adventure-wave-one" d="M0 354 Q102 333 208 355 T414 355 T620 355 T826 355 T1032 355" fill="none" stroke="#baf8ff" strokeWidth="7" opacity=".62" />
        <path className="adventure-wave adventure-wave-two" d="M-120 425 Q-10 400 100 425 T320 425 T540 425 T760 425 T980 425 T1200 425" fill="none" stroke="#fff" strokeWidth="3" opacity=".35" />
        <path d="M0 465 Q120 440 240 465 T480 465 T720 465 T960 465 V560 H0Z" fill="#0b315b" opacity=".6" />
        <g className="adventure-vehicle adventure-vehicle-ship">
          <path d="M177 314 H748 L698 386 Q681 410 637 410 H272 Q225 402 207 368Z" fill="#182f58" stroke="#fff" strokeWidth="3" />
          <path d="M249 311 V243 H545 V311 M550 311 V270 H668 V311" fill={`url(#adventure-glow-${id})`} stroke="#fff" strokeWidth="3" />
          <path d="M324 243 V189 H451 V243 M468 243 V210 H515 V243" fill="#fff2ce" stroke="#fff" strokeWidth="3" />
          <path d="M337 205h22v22h-22zm42 0h22v22h-22zm42 0h22v22h-22z" fill="#50c4ed" />
          <path d="M260 282 H537" stroke="#fff" strokeWidth="7" opacity=".66" />
          {[294, 352, 410, 468, 585, 632].map((x) => <circle key={x} cx={x} cy="337" r="7" fill={palette[2]} />)}
          <path d="M478 189 V136 L531 189Z" fill={palette[2]} opacity=".85" />
        </g>
        <path d="M110 125 Q350 61 600 119 T1000 110" fill="none" stroke={palette[2]} strokeWidth="2" strokeDasharray="4 12" opacity=".52" />
        <text x="54" y="74" fill="white" fontSize="17" fontFamily="system-ui" letterSpacing="4" opacity=".8">МИССИЯ: К ГОРИЗОНТУ</text>
      </>}
      <g fill="#fff" opacity=".7"><circle cx="117" cy="162" r="3"/><circle cx="358" cy="113" r="2"/><circle cx="857" cy="210" r="3"/><circle cx="818" cy="75" r="2"/></g>
    </svg>
  );
}

function TitanicIllustration() {
  return (
    <svg className="tech-tour-titanic" viewBox="0 0 960 560" role="img" aria-label="Схема большого океанского лайнера с четырьмя трубами">
      <defs><linearGradient id="titanic-sea" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d9f5ff"/><stop offset="1" stopColor="#528db4"/></linearGradient><linearGradient id="titanic-hull" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#27384c"/><stop offset="1" stopColor="#131d2c"/></linearGradient></defs>
      <rect width="960" height="560" rx="24" fill="#d9eef4"/><circle cx="770" cy="110" r="62" fill="#ffe8ab" opacity=".8"/><rect y="330" width="960" height="230" fill="url(#titanic-sea)"/>
      <path d="M78 338 H847 L787 423 Q766 450 718 450 H220 Q165 443 136 407Z" fill="url(#titanic-hull)" stroke="#fff" strokeWidth="4"/>
      <path d="M197 337 V268 H714 V337 M248 268 V227 H664 V268 M300 227 V197 H611 V227" fill="#f4ead6" stroke="#29384a" strokeWidth="4"/>
      <path d="M302 197 V130 H363 V197 M411 197 V130 H472 V197 M520 197 V130 H581 V197 M626 197 V130 H687 V197" fill="#b9633f" stroke="#803f2d" strokeWidth="4"/>
      <path d="M307 130h51l-8-20h-40zm51 0h51l-8-20h-40zm51 0h51l-8-20h-40zm51 0h51l-8-20h-40z" fill="#27384c"/>
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={225 + i * 30} y="292" width="16" height="15" rx="6" fill="#70c9e7" />)}
      <path d="M30 477 Q140 457 250 477 T470 477 T690 477 T910 477" fill="none" stroke="#fff" strokeWidth="7" opacity=".7"/>
      <text x="50" y="70" fill="#18344d" fontSize="19" fontFamily="system-ui" fontWeight="700" letterSpacing="4">ОКЕАНСКИЙ ЛАЙНЕР · 1912</text>
    </svg>
  );
}
