// «Поднять сессию» — одна команда в начале нового чата (и после любого пересоздания
// песочницы). Скрипт делает три вещи и в конце печатает, что читать.
//
//   1. git: возвращает историю, если клон пересоздали на точке форка (локальный HEAD
//      откатился, а работа уехала в удалённую arena/…-ветку). Никаких --hard: только
//      fetch + reset --mixed, рабочее дерево не трогается.
//   2. зависимости: npm ci, если node_modules стерты (они стираются каждый ход), и
//      @resvg/resvg-js по флагу --promo (нужен генератору превью костюмов).
//   3. контур проверок: typecheck, content:check, test:adaptive, audit:storage
//      (+ test:smoke и test:boot, если не --fast). Стенд audit:storage сам по себе
//      всегда выходит с нулём — он описывает поведение; здесь он ещё и проверяется:
//      строка «ПОДТВЕРЖДЕНО» или меньше 10 «потеря не подтверждена» = сейф сломан.
//
// Флаги:
//   --git-only   только пункт 1 и состояние (без npm и тестов)
//   --fast       пропустить test:smoke и test:boot (~2,5 мин → ~30 с)
//   --promo      доставить @resvg/resvg-js, если его нет
//   --no-checks  ничего не запускать, только рассказать состояние
//   --handoff    напечатать черновик «Точка передачи работы в новый чат» по фактам git
//   --push       после починки истории запушить незапушенные коммиты (иначе только подсказка)
//
// Выход: 0 — можно работать; 1 — что-то из контура упало; 2 — история не почищена
// (например, впереди локальные коммиты, которых нет на удалённой ветке).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const DEEPEN = Number(process.env.PICKUP_DEEPEN ?? 100);

const run = (cmd, args, opt = {}) =>
  spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 << 20, ...opt });
const git = (args) => run('git', args).stdout?.trim() ?? '';
const ok = (r) => (r.status ?? 1) === 0;
const say = (s) => console.log(s);
const head = (s, n = 3) =>
  s.split('\n').filter(Boolean).slice(0, n).join(' · ');
/** Русское склонение: plural(2, ['строка', 'строки', 'строк']) → «2 строки». */
const plural = (n, forms) => {
  const k = Math.abs(n) % 100, m = k % 10;
  return n + ' ' + (k > 10 && k < 20 ? forms[2] : m === 1 ? forms[0] : m > 1 && m < 5 ? forms[1] : forms[2]);
};

let failed = false;
const step = (name, fn) => {
  const t = Date.now();
  const res = fn();
  const ms = ((Date.now() - t) / 1000).toFixed(1);
  const good = res === true || (res && res.ok);
  if (!good) failed = true;
  say(`${good ? '✓' : '✗'} ${name.padEnd(42)} ${String(ms).padStart(5)} c${good ? '' : '  ← ' + head(res?.out ?? '', 4)}`);
  return res;
};

// ── 1. git: чиним историю после пересоздания клона ──────────────────────────
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const sha = git(['rev-parse', '--short', 'HEAD']);
const isShallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
say(`\nветка ${branch || '(не в git)'} @ ${sha || '?'}${isShallow ? '  [shallow: история короткая]' : ''}`);

let ahead = 0;
let behind = 0;
const detached = branch === 'HEAD';
if (detached) {
  say('  ! HEAD отделён от ветки (detached) — историю не трогаю, только проверки');
} else if (branch) {
  const fetched = ok(run('git', ['fetch', 'origin', branch]));
  if (!fetched) say('  ! fetch не удалось (нет сети?) — продолжаю с тем, что есть');
  if (isShallow && fetched) run('git', ['fetch', '--deepen=' + DEEPEN, 'origin', branch]);

  const counts = git(['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`]);
  if (!counts) {
    say(`  ! origin/${branch} не виден — историю не трогаю, только проверки`);
  } else {
    [ahead, behind] = counts.split(/\s+/).map(Number);
    say(`  локально впереди: ${ahead}, отстаёт от удалённой ветки: ${behind}`);
  }

  if (behind > 0 && ahead === 0) {
    // ровно тот случай из грабель: HEAD откатился, а коммиты живут на origin
    const backup = `refs/pickup-backup/${branch}`;
    run('git', ['update-ref', backup, git(['rev-parse', 'HEAD'])]);
    step(`git reset --mixed origin/${branch} (дерево сохраняется)`, () => {
      const r = run('git', ['reset', `origin/${branch}`]);
      return { ok: ok(r), out: r.stderr || r.stdout };
    });
    say(`  страховка на случай промаха: git update-ref ${backup} <старый-sha> → git reset --mixed <sha>`);
  } else if (behind > 0 && ahead > 0) {
    say(`  ✗ история и отстаёт, и впереди: на origin ${plural(behind, ['чужой коммит', 'чужих коммита', 'чужих коммитов'])}, у вас ${plural(ahead, ['свой', 'своих', 'своих'])} своих.`);
    say('    так reset терпит незапушенное. Разобраться руками: git log --oneline HEAD..origin/' + branch);
    say('    (обычно нужно git merge origin/' + branch + ' или git rebase origin/' + branch + ')');
    process.exitCode = 2;
  }
  if (ahead > 0) {
    if (flag('push')) step(`git push origin ${branch}`, () => {
      const r = run('git', ['push', 'origin', branch]);
      return { ok: ok(r), out: r.stderr || r.stdout };
    });
    else say(`  ! ${plural(ahead, ['коммит', 'коммита', 'коммитов'])} ещё не на origin — пушните сразу: git push origin ${branch}`);
  }
  const dirty = git(['status', '--porcelain']);
  const deleted = dirty.split('\n').filter((l) => l.startsWith(' D '));
  say(`  рабочее дерево: ${dirty ? plural(dirty.split('\n').length, ['изменённый файл', 'изменённых файла', 'изменённых файлов']) : 'чистое'}`);
  // reset --mixed намеренно не трогает файлы: в песочнице на диске лежит самая свежая
  // работа, затирать её нельзя. Но если файлов из восстановленного коммита просто нет
  // (значит на диске была старая копия) — их надо достать из HEAD.
  if (deleted.length) {
    say(`    ! ${plural(deleted.length, ['файл', 'файла', 'файлов'])} из восстановленного коммита нет на диске — git checkout -- . их вернёт`);
    say('      (сначала проверьте git diff --stat: если это ваши правки, не трите)');
  }
}

if (flag('git-only')) {
  say('\n(--git-only: зависимости и проверки пропущены)');
  process.exit(failed ? 1 : 0);
}

// ── 2. зависимости ──────────────────────────────────────────────────────────
const needCi = !existsSync(path.join(root, 'node_modules/.bin/esbuild'));
if (needCi) step('npm ci (node_modules стерты)', () => {
  const r = run('npm', ['ci']);
  return { ok: ok(r), out: r.stderr || r.stdout };
});
else say('• node_modules на месте — npm ci не нужен');

if (flag('promo') && !existsSync(path.join(root, 'node_modules/@resvg'))) {
  step('npm i --no-save @resvg/resvg-js', () => {
    const r = run('npm', ['i', '--no-save', '@resvg/resvg-js']);
    return { ok: ok(r), out: r.stderr || r.stdout };
  });
}

const node = process.versions.node;
if (Number(node.split('.')[0]) < 22) say(`  ! node ${node}, а нужен >=22.22.2 (jsdom 30) — тесты могут падать странно`);

// ── 3. контур проверок ──────────────────────────────────────────────────────
say('');
const npm = (script) => () => {
  const r = run('npm', ['run', script]);
  return { ok: ok(r), out: (r.stdout || '') + (r.stderr || '') };
};
if (flag('no-checks')) {
  say('• --no-checks: контур проверок пропущен');
} else {
  step('npm run typecheck', npm('typecheck'));
  step('npm run content:check', npm('content:check'));
  step('npm run test:adaptive', npm('test:adaptive'));

  // Сейф прогресса: сам стенд выходит с нулём всегда (он описывает поведение),
  // поэтому «нет потерь» проверяем по тексту вывода.
  step('npm run audit:storage (+страж «нет потерь»)', () => {
    const r = run('npm', ['run', 'audit:storage']);
    const out = (r.stdout || '') + (r.stderr || '');
    const broken = /ПОДТВЕРЖДЕНО/.test(out);
    const kept = (out.match(/потеря не подтверждена/g) || []).length;
    return {
      ok: ok(r) && !broken && kept >= 10,
      out: broken ? 'в выводе есть «ПОДТВЕРЖДЕНО» — защита сломана' : `потеря не подтверждена в ${kept}/10`,
    };
  });

  if (!flag('fast')) {
    say('  (смоук ~1,5 мин, boot — с прод-сборкой)');
    step('npm run test:smoke', npm('test:smoke'));
    step('npm run test:boot', npm('test:boot'));
  } else say('• --fast: test:smoke и test:boot пропущены');
}

// ── 4. что читать и что показывать ──────────────────────────────────────────
const plan = readFileSync(path.join(root, 'docs/PLAN.md'), 'utf8');
const marks = [...plan.matchAll(/^### Точка передачи.*$/gm)];
if (marks.length) {
  const m = marks[marks.length - 1];
  const rest = plan.slice(m.index);
  const nl = rest.indexOf('\n'); // сам заголовок уже напечатан строкой выше
  const next = rest.slice(nl + 1).search(/^### /m);
  const text = rest.slice(nl + 1, next < 0 ? rest.length : nl + 1 + next).trimEnd();
  say('\n─ последняя точка передачи (' + m[0].replace(/^### /, '') + ') ─');
  const lines = text.split('\n');
  say(lines.slice(0, 14).map((l) => '  ' + l).join('\n'));
  if (lines.length > 14) {
    const start = plan.slice(0, m.index).split('\n').length;
    say(`  … ещё ${plural(lines.length - 14, ['строка', 'строки', 'строк'])} — docs/PLAN.md, с ${start}-й строки`);
  }
}
// самые свежие превью (самая поздняя папка в docs/promo)
const promoDirs = readdirSync(path.join(root, 'docs/promo'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const newest = promoDirs[promoDirs.length - 1];
if (newest) {
  const pngs = readdirSync(path.join(root, 'docs/promo', newest)).filter((f) => f.endsWith('.png'));
  say(`\nпревью: docs/promo/${newest}/ — ${pngs.slice(0, 5).join(', ')}${pngs.length > 5 ? `, … всего ${pngs.length}` : ''}`);
  say('перегенерить в папку за сегодня: npm run promo (нужен --promo для resvg)');
}

if (flag('handoff')) {
  const base = git(['merge-base', 'HEAD', 'origin/main']);
  const commits = git(['log', '--oneline', `${base}..HEAD`]);
  const stat = git(['diff', '--stat', base, 'HEAD']).split('\n').slice(-1)[0] ?? '';
  const today = new Date().toISOString().slice(0, 10);
  say('\n─ черновик точки передачи (вставить в конец docs/PLAN.md, дополнить прозой) ─');
  say([
    `### Точка передачи работы в новый чат — ${today}`,
    '',
    `* **Ветка:** \`${branch}\` (от \`main\` \`${git(['rev-parse', '--short', 'origin/main'])}\`).`,
    `  В ветке — ${plural(commits.split('\n').filter(Boolean).length, ['коммит', 'коммита', 'коммитов'])}: ${commits.split('\n').map((l) => l.trim()).join('; ')}.`,
    `  Итог по файлам: ${stat.trim()}.`,
    `* **PR:** ${branch} → main (\`gh pr view --json state,mergeable\`).`,
    '* **Что проверять после правок:** `npm run pickup` (он же чинит историю и',
    '  ставит зависимости после пересоздания песочницы); то же самое руками:',
    '  `typecheck`, `content:check`, `test:adaptive`, `test:smoke`, `test:boot`, `audit:storage`.',
    '* **Открытые задачи по приоритету:** …',
    '* **Грабли песочницы (по-прежнему):** клон пересоздаётся на точке форка,',
    '  `node_modules` стираются — первый шаг новой сессии `npm run pickup`.',
  ].join('\n'));
}

say('\n' + (failed ? '✗ есть падения — см. строки выше' : '✓ сессия поднята, можно работать'));
if (failed) process.exit(1);
