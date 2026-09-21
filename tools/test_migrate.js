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

const legacy = {
  version: 1, cfgV2: true,
  config: { defaultBed: '23:00', defaultWake: '07:00', lockLead: 30, rewardPerNight: 3, settleDelay: 180 },
  tank: { health: 0.5, gray: 0.1 },
  fish: [], plants: [], corals: [], events: [], seen: {},
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
