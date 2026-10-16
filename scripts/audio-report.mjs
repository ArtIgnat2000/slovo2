/**
 * Объективный разбор аудиозаписи: то, что слышно как «накачка / свист /
 * гудение / металл / шум», здесь становится числами.
 *
 * Запуск:  node scripts/audio-report.mjs <файл>   (webm/opus, wav, mp3, m4a, ogg)
 * Декодирование: ffmpeg (ищем в PATH, затем /home/user/tools/ffmpeg,
 * затем imageio-ffmpeg из python). Внутри — только Float32 PCM 44.1 кГц моно.
 *
 * Метрики:
 *  • клиппинг и пик/RMS;
 *  • огибающая RMS (окно 1024) → модуляция 0.5–16 Гц: «насос» компрессора/трима;
 *  • средний спектр (FFT 8192, Ханн): доли полос, спектральный центроид;
 *  • узкополосные пики ( prominence > 14 дБ над локальной медианой): свист/гудение;
 *  • плотность атак (spectral flux): ритмическая густота.
 * Флаги-вердикты печатаются в конце.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const SR = 44100;

function ffmpegPath() {
  const candidates = ['ffmpeg', '/home/user/tools/ffmpeg'];
  for (const c of candidates) {
    const probe = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (probe.status === 0) return c;
  }
  const py = spawnSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
  if (py.status === 0 && py.stdout.trim() && existsSync(py.stdout.trim())) return py.stdout.trim();
  throw new Error('ffmpeg не найден');
}

function decode(file) {
  const ff = ffmpegPath();
  const res = spawnSync(ff, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (res.status !== 0) throw new Error(`ffmpeg: ${res.stderr}`);
  return new Float32Array(res.stdout.buffer, res.stdout.byteOffset, res.stdout.byteLength / 4);
}

// ── FFT (radix-2, итеративный) ──────────────────────────────────────────────
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

const hann = (n) => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));

// ── Метрики ─────────────────────────────────────────────────────────────────
function report(x) {
  const dur = x.length / SR;
  let peak = 0;
  let sum = 0;
  let sq = 0;
  let clips = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    peak = Math.max(peak, a);
    sum += x[i];
    sq += x[i] * x[i];
    if (a >= 0.985) clips++;
  }
  const rms = Math.sqrt(sq / x.length);
  const dc = sum / x.length;

  // Огибающая RMS, окно 1024 (~23 мс)
  const win = 1024;
  const envLen = Math.floor(x.length / win);
  const env = new Float64Array(envLen);
  for (let w = 0; w < envLen; w++) {
    let s = 0;
    for (let i = 0; i < win; i++) {
      const v = x[w * win + i];
      s += v * v;
    }
    env[w] = Math.sqrt(s / win);
  }
  const envSorted = Float64Array.from(env).sort();
  const p50 = envSorted[Math.floor(envLen * 0.5)];
  const p95 = envSorted[Math.floor(envLen * 0.95)];
  const p10 = envSorted[Math.floor(envLen * 0.1)];

  // Модуляция огибающей (накачка): FFT огибающей, пики 0.5–16 Гц
  let modFreq = 0;
  let modDepth = 0;
  if (envLen >= 256) {
    const n = 1 << Math.floor(Math.log2(envLen));
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += env[i];
    mean /= n;
    for (let i = 0; i < n; i++) re[i] = (env[i] - mean) * hann(n)[i];
    fft(re, im);
    const envRate = SR / win; // частота дискретизации огибающей ≈ 43 Гц
    let best = 0;
    for (let k = 1; k < n / 2; k++) {
      const f = (k * envRate) / n;
      if (f < 0.5 || f > 16) continue;
      const mag = Math.hypot(re[k], im[k]) / n;
      if (mag > best) {
        best = mag;
        modFreq = f;
      }
    }
    let varSum = 0;
    for (let i = 0; i < n; i++) varSum += (env[i] - mean) ** 2;
    const std = Math.sqrt(varSum / n);
    modDepth = std > 0 ? best / (std / 2) : 0; // 0..~1: доля энергии в одной модулирующей частоте
  }

  // Средний спектр
  const N = 8192;
  const hop = N / 2;
  const w = hann(N);
  const acc = new Float64Array(N / 2);
  let frames = 0;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let start = 0; start + N <= x.length; start += hop) {
    for (let i = 0; i < N; i++) {
      re[i] = x[start + i] * w[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) acc[k] += Math.hypot(re[k], im[k]);
    frames++;
  }
  for (let k = 0; k < N / 2; k++) acc[k] /= Math.max(1, frames);
  const binHz = SR / N;

  const bands = [
    ['суб-бас 20–120', 20, 120],
    ['бас 120–400', 120, 400],
    ['низкая середина 400–1600', 400, 1600],
    ['верхняя середина 1.6–5к', 1600, 5000],
    ['верх 5–16к', 5000, 16000],
  ];
  let total = 0;
  for (let k = 1; k < N / 2; k++) total += acc[k] * acc[k];
  const bandPct = bands.map(([name, lo, hi]) => {
    let e = 0;
    for (let k = Math.max(1, Math.round(lo / binHz)); k < Math.min(N / 2, Math.round(hi / binHz)); k++) e += acc[k] * acc[k];
    return [name, (100 * e) / Math.max(total, 1e-20)];
  });
  let centroid = 0;
  let magSum = 0;
  for (let k = 1; k < N / 2; k++) {
    centroid += k * binHz * acc[k];
    magSum += acc[k];
  }
  centroid /= Math.max(magSum, 1e-12);

  // Узкополосные пики: prominence над локальной медианой (±250 бинов ≈ ±1.3 кГц)
  const peaks = [];
  const med = (from, to) => {
    const slice = Array.from(acc.subarray(from, to)).sort((a, b) => a - b);
    return slice[Math.floor(slice.length / 2)] ?? 1e-12;
  };
  for (let k = 4; k < N / 2 - 4; k++) {
    const f = k * binHz;
    if (f < 60 || f > 9000) continue;
    const m = acc[k];
    if (m <= acc[k - 1] || m < acc[k + 1]) continue;
    const local = med(Math.max(1, k - 250), Math.min(N / 2, k + 250));
    const prom = db(m) - db(local);
    if (prom > 14) peaks.push({ f: Math.round(f), prom: +prom.toFixed(1) });
  }
  peaks.sort((a, b) => b.prom - a.prom);

  // Плотность атак: скачки спектральной энергии
  let onsets = 0;
  let prevE = 0;
  const flux = [];
  for (let start = 0; start + N <= x.length; start += hop) {
    let e = 0;
    for (let i = 0; i < N; i++) e += x[start + i] * x[start + i];
    const d = e - prevE;
    flux.push(d);
    prevE = e;
  }
  const fluxSorted = Float64Array.from(flux).sort();
  const fluxThr = fluxSorted[Math.floor(flux.length * 0.9)] * 0.6;
  for (const d of flux) if (d > fluxThr && fluxThr > 0) onsets++;
  const onsetsPerSec = onsets / Math.max(dur, 0.001);

  // Шумовой пол: RMS самых тихих 10%
  const floorDb = db(p10 || 1e-9);

  return { dur, peak, rms, dc, clips, p50, p95, p10, modFreq, modDepth, bandPct, centroid, peaks, onsetsPerSec, floorDb };
}

function fmt(r) {
  const lines = [];
  lines.push(`длительность ${r.dur.toFixed(2)} с · пик ${db(r.peak).toFixed(1)} дБ · RMS ${db(r.rms).toFixed(1)} дБ · DC ${(r.dc * 1000).toFixed(2)} мВ`);
  lines.push(`клиппинг: ${((100 * r.clips) / (r.dur * SR)).toFixed(4)}% семплов ≥0.985 (${r.clips} шт)`);
  lines.push(`огибающая: p10 ${db(r.p10).toFixed(1)} дБ / p50 ${db(r.p50).toFixed(1)} дБ / p95 ${db(r.p95).toFixed(1)} дБ · шумовой пол ${r.floorDb.toFixed(1)} дБ`);
  lines.push(`модуляция огибающей: ${r.modFreq.toFixed(2)} Гц, концентрация ${(100 * r.modDepth).toFixed(0)}%`);
  lines.push(`атак в секунду: ${r.onsetsPerSec.toFixed(1)}`);
  lines.push(`центроид: ${r.centroid.toFixed(0)} Гц`);
  for (const [name, pct] of r.bandPct) lines.push(`  ${name}: ${pct.toFixed(1)}%`);
  lines.push(`узкополосные пики ( prominence >14 дБ):`);
  for (const p of r.peaks.slice(0, 12)) lines.push(`  ${p.f} Гц  +${p.prom} дБ`);
  if (!r.peaks.length) lines.push('  нет');

  // Вердикты-флаги
  const flags = [];
  if (r.clips > 0) flags.push('КЛИППИНГ: срезанные пики — «хрип/треск»');
  if (r.modDepth > 0.35 && r.modFreq >= 1) flags.push(`НАКАЧКА: огибающая качается на ${r.modFreq.toFixed(1)} Гц (компрессор/трим «насосит»)`);
  const lowPct = r.bandPct[0][1] + r.bandPct[1][1];
  if (lowPct > 55) flags.push(`ГУДЕНИЕ: ${lowPct.toFixed(0)}% энергии ниже 400 Гц — низ гудит`);
  const whistle = r.peaks.filter((p) => p.f > 900 && p.prom > 18);
  if (whistle.length >= 2) flags.push(`СВИСТ: узкие пики ${whistle.slice(0, 4).map((p) => `${p.f} Гц`).join(', ')}`);
  const hum = r.peaks.filter((p) => p.f < 200 && p.prom > 18);
  if (hum.length) flags.push(`ГУЛ: пики ${hum.map((p) => `${p.f} Гц`).join(', ')} — моды деки/сеть`);
  if (r.floorDb > -55 && r.p50 > 0.0001) flags.push(`ШУМОВОЙ ПОЛ: тишайшие участки ${r.floorDb.toFixed(0)} дБ — шум/реверб вместо пауз`);
  if (r.centroid < 600) flags.push('ГЛУХО: центроид <600 Гц');
  if (r.centroid > 5000) flags.push('ЯРКО/МЕТАЛЛ: центроид >5 кГц');
  lines.push('');
  lines.push(flags.length ? `⚑ ${flags.join('\n⚑ ')}` : '✓ выраженных артефактов не найдено');
  return lines.join('\n');
}

const file = process.argv[2];
if (!file) {
  console.error('Использование: node scripts/audio-report.mjs <файл>');
  process.exit(1);
}
console.log(`── ${file} ──`);
console.log(fmt(report(decode(file))));
