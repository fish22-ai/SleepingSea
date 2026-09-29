/* 一次性校验：老数据里的「奖励条数 / 结算延迟」被清掉，且恢复成默认一条鱼、起床立刻结算 */
'use strict';
const store = new Map();
global.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
global.window = global;

const legacyNight = (key, status) => ({
  key: key, bed: '23:00', wake: '07:00', lead: 30, settleDelay: 180,
  note: '', lockedAt: '2026-09-19T14:30:00.000Z', unlocks: [], relocks: [],
  actualSleepAt: null, actualWakeAt: null, status: status, reasonText: '', fishDelta: 0, settledAt: null, manual: false
});

/* 老档里的脏数据：白送的鱼 + 图鉴送的鱼，一个都不对应达成夜 */
const strayFish = (born, note) => ({
  id: 'f' + born + (note || ''), species: 'clown', name: '小丑鱼', size: 1, hue: 0,
  born: born, note: note || '', dull: false
});

const legacy = {
  version: 1, cfgV2: true,
  config: { defaultBed: '23:00', defaultWake: '07:00', lockLead: 30, rewardPerNight: 3, settleDelay: 180 },
  tank: { health: 0.5, gray: 0.1 },
  fish: [
    strayFish('2026-09-21'), strayFish('2026-09-21'), strayFish('2026-09-21'),
    strayFish('2026-09-17', '图鉴点亮')
  ],
  plants: [], corals: [], events: [], seen: {},
  nights: {
    '2026-09-19': legacyNight('2026-09-19', 'pending'),
    '2026-09-18': legacyNight('2026-09-18', 'perfect'),
    '2026-09-17': legacyNight('2026-09-17', 'minor'),
    '2026-09-16': legacyNight('2026-09-16', 'broken')
  }
};
store.set('sleepAquarium.v1', JSON.stringify(legacy));

require('../js/store.js');
const Store = global.Store;
Store.init();

let pass = 0, fail = 0;
const ok = (c, n, e) => { c ? (pass++, console.log('  OK   ' + n)) : (fail++, console.log('  FAIL ' + n + '  -> ' + JSON.stringify(e))); };

ok(Store.db.config.rewardPerNight === undefined, 'config.rewardPerNight 已清除');
ok(Store.db.config.settleDelay === undefined, 'config.settleDelay 已清除');
ok(Store.db.cfgV2 === undefined, 'cfgV2 标记已清除');
ok(Store.db.nights['2026-09-19'].settleDelay === undefined, '夜晚残留的 settleDelay 已清除');

/* 老的三档状态合并成两档 */
ok(Store.db.nights['2026-09-18'].status === 'met', "老 perfect → met", Store.db.nights['2026-09-18'].status);
ok(Store.db.nights['2026-09-17'].status === 'missed', "老 minor → missed", Store.db.nights['2026-09-17'].status);
ok(Store.db.nights['2026-09-16'].status === 'missed', "老 broken → missed", Store.db.nights['2026-09-16'].status);
ok(Store.db.nights['2026-09-19'].status === 'pending', '未结算的夜不受影响');

/* 白送的鱼、图鉴送的鱼、对不上达成夜的鱼，迁移时全部清掉，只按达成夜重建 */
ok(Store.db.fish.length === 1, '4 条来路不明的鱼被清掉，只留达成夜对应的那条', Store.db.fish.length);
ok(Store.db.fish.every(f => f.born === '2026-09-18'),
  '留下的那条对得上唯一达成的夜', Store.db.fish.map(f => f.born));

/* 把时钟拨到「起床后 1 秒」——老逻辑要等到 +180 分钟才结算 */
const wakeMs = new Date(2026, 8, 20, 7, 0, 0).getTime();
const realNow = Date.now;
Date.now = () => wakeMs + 1000;
const settled = Store.settleAll();
Date.now = realNow;

ok(settled.length === 1, '起床后 1 秒即完成结算（不再等 3 小时）', settled.length);
ok(Store.db.nights['2026-09-19'].status === 'met', '判定为达成', Store.db.nights['2026-09-19'].status);
ok(Store.db.nights['2026-09-19'].fishDelta === 1, '奖励固定 1 条鱼（无视老数据里的 3 条）', Store.db.nights['2026-09-19'].fishDelta);

const st = Store.stats();
ok(st.met === 2 && st.missed === 2, '统计把老数据并成两档', { met: st.met, missed: st.missed });
ok(st.streak === 2, '连击只看最近连续的达成夜', st.streak);

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
