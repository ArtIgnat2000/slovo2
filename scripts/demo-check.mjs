/**
 * Headless-прогон аудио-лаборатории: engine.js (тот же движок, что в приложении)
 * крутится с заглушкой Web Audio и обязан расписать звук на каждом лупе:
 * ни одного молчаливого трека, в «уроке» не плотнее, чем на награде.
 * Запуск: npm run test:demo (сам пересобирает engine.js).
 */
import fs from 'node:fs';
import vm from 'node:vm';

let scheduled = 0;
class P { value=0; setValueAtTime(){return this} linearRampToValueAtTime(){return this} exponentialRampToValueAtTime(v){ if(!(v>0)) throw new Error('exp to '+v); return this } setTargetAtTime(){return this} cancelScheduledValues(){return this} }
class N {
  type='sine'; detune=new P(); frequency=new P(); gain=new P(); delayTime=new P(); pan=new P(); playbackRate=new P(); Q=new P();
  threshold=new P(); knee=new P(); ratio=new P(); attack=new P(); release=new P();
  curve=null; oversample='none'; buffer=null; loop=false;
  connect(t){ if(!t) throw new Error('connect в никуда'); return this }
  start(t){ if(!Number.isFinite(t)||t<0) throw new Error('bad t '+t); scheduled++ }
  stop(t){ if(!Number.isFinite(t)||t<0) throw new Error('bad stop '+t) }
}
class Buf { constructor(c,l,r){this.c=c;this.l=l;this.sampleRate=r} getChannelData(i){ if(i>=this.c) throw new Error('ch'); return new Float32Array(this.l) } }
class Ctx {
  state='running'; currentTime=0; sampleRate=44100; destination=new N();
  createOscillator(){return new N()} createGain(){return new N()} createBiquadFilter(){return new N()}
  createStereoPanner(){return new N()} createWaveShaper(){return new N()} createConvolver(){return new N()}
  createDynamicsCompressor(){return new N()} createDelay(){return new N()} createBufferSource(){return new N()}
  createBuffer(c,l,r){return new Buf(c,l,r)} resume(){return Promise.resolve()}
}
let ctx=null; let tick=null;
const sandbox = {
  console,
  window: { AudioContext: class extends Ctx { constructor(){ super(); ctx=this; } } },
  setInterval: (fn)=>{ tick=fn; return 1 },
  clearInterval: ()=>{ tick=null },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../docs/music-demo/engine.js', import.meta.url), 'utf8'), sandbox);
const DEMO = sandbox.window.DEMO || vm.runInContext('SLOVO_DEMO.demo', sandbox);
if (!DEMO) throw new Error('DEMO не экспортирован');

const runFor = (seconds) => { const before=scheduled; const until=ctx.currentTime+seconds; while(ctx.currentTime<until){ ctx.currentTime+=0.045; tick(); } return scheduled-before; };

const all = DEMO.sections.flatMap(s=>s.items);
console.log(`лупов: ${all.length}, грувов: ${DEMO.grooveCount()}`);
for (const entry of all) {
  scheduled=0; DEMO.play(entry.track); const reward=runFor(8);
  if (reward<=20) throw new Error(`${entry.track.id}: тихо на награде (${reward})`);
  scheduled=0; DEMO.setFocus(true); const lesson=runFor(8);
  if (lesson>reward) throw new Error(`${entry.track.id}: урок плотнее награды (${lesson}>${reward})`);
  DEMO.setFocus(false); DEMO.stop();
  console.log(`  ✓ ${entry.track.id.padEnd(18)} reward ${String(reward).padStart(4)} · урок ${String(lesson).padStart(4)}`);
}
for (const s of ['sixseven','cowbell','mogu','golden','bell']) { scheduled=0; DEMO.stinger(s); if (scheduled<2) throw new Error('стингер '+s+' молчит'); }
console.log('✓ стингеры: sixseven, cowbell, mogu, golden, bell');
console.log('✓ лаборатория: все лупы звучат, в уроке не плотнее');
