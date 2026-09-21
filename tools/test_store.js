/* 结算引擎的端到端测试：node tools/test_store.js */
'use strict';

/* ---- 浏览器环境 shim ---- */
const store = new Map();
global.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
global.window = global;
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;

require('../js/store.js');
const Store = global.Store;

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }

/* ================= 测试 ================= */
section('1) 初始化');
Store.init();
ok(Store.db.fish.length === 3, '初始 3 条鱼', Store.db.fish.length);
ok(Store.db.plants.length === 12 && Store.db.corals.length === 6, '初始布景 12 株水草 / 6 块珊瑚');
ok(Store.db.tank.health === 0.55, '初始水色 0.55');

section('2) 夜的归属');
const now = new Date();
const key = Store.nightKeyOf(now);
ok(/^\d{4}-\d{2}-\d{2}$/.test(key), 'nightKeyOf 格式', key);
const h = now.getHours();
const expectKeyDate = h < 12 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
ok(key === `${expectKeyDate.getFullYear()}-${String(expectKeyDate.getMonth() + 1).padStart(2, '0')}-${String(expectKeyDate.getDate()).padStart(2, '0')}`,
  '中午 12 点前归属昨天', { now: now.toString(), key });

section('3) 时间窗口');
{
  const T = Store.util;
  const n = { key: '2026-09-19', bed: '23:00', wake: '07:00', lead: 30 };
  const t = {
    bed: T.atTime(T.parseYmd('2026-09-19'), '23:00'),
    wake: T.atTime(T.addDays(T.parseYmd('2026-09-19'), 1), '07:00'),
    lock: new Date(T.atTime(T.parseYmd('2026-09-19'), '23:00').getTime() - 30 * 60000)
  };
  ok(t.bed.getHours() === 23, '23:00 不跨天');
  ok(t.lock.getHours() === 22 && t.lock.getMinutes() === 30, '提前 30 分钟熄灯 = 22:30', t.lock.toString());

  const n2 = { key: '2026-09-19', bed: '00:40', wake: '07:00', lead: 30 };
  const bed2 = T.atTime(T.addDays(T.parseYmd('2026-09-19'), 1), '00:40');
  ok(bed2.getDate() === 20, '00:40 跨零点归到次日', bed2.toString());
}

section('4) 达成 → 加鱼、水色回升');
{
  const before = { fish: Store.db.fish.length, health: Store.db.tank.health, gray: Store.db.tank.gray };
  const n = Store.getNight('2026-08-01', true);
  n.bed = '23:00'; n.wake = '07:00'; n.lead = 30;
  n.lockedAt = new Date('2026-08-01T22:30:00').toISOString();
  n.unlocks = []; n.relocks = []; n.status = 'pending'; n.settledAt = null;
  Store.applyResult(n, Store.evaluate(n));
  ok(n.status === 'met', '判定为达成', n.status);
  ok(n.reasonText.indexOf('整夜没解锁') === 0, '结算说明写清原因', n.reasonText);
  ok(Store.db.fish.length === before.fish + 1, '鱼 +1', { before: before.fish, after: Store.db.fish.length });
  ok(Store.db.tank.health > before.health, '水色上升');
  ok(n.fishDelta === 1, 'fishDelta 记录', n.fishDelta);
}

section('5) 未达成（1 次解锁）→ 不加鱼、发灰、一条鱼变灰');
{
  const before = { fish: Store.db.fish.length, gray: Store.db.tank.gray, dull: Store.db.fish.filter(f => f.dull).length };
  const n = Store.getNight('2026-08-02', true);
  n.bed = '23:00'; n.wake = '07:00'; n.lead = 30;
  n.lockedAt = new Date('2026-08-02T22:30:00').toISOString();
  n.unlocks = [{ at: new Date('2026-08-02T23:10:00').toISOString(), reason: '就看一眼时间', id: 'a' }];
  n.relocks = [{ at: new Date('2026-08-02T23:12:00').toISOString() }];
  n.status = 'pending'; n.settledAt = null;
  Store.applyResult(n, Store.evaluate(n));
  ok(n.status === 'missed', '判定为未达成', n.status);
  ok(Store.db.fish.length === before.fish, '鱼不增加');
  ok(Store.db.tank.gray > before.gray, '灰暗度上升');
  ok(Store.db.fish.filter(f => f.dull).length === before.dull + 1, '一条鱼变灰');
}

section('6) 未达成（2 次解锁）→ 和 1 次同一个档');
{
  const before = { health: Store.db.tank.health, gray: Store.db.tank.gray, dull: Store.db.fish.filter(f => f.dull).length };
  const n = Store.getNight('2026-08-03', true);
  n.bed = '23:00'; n.wake = '07:00'; n.lead = 30;
  n.lockedAt = new Date('2026-08-03T22:30:00').toISOString();
  n.unlocks = [
    { at: new Date('2026-08-03T23:10:00').toISOString(), reason: 'a', id: 'a' },
    { at: new Date('2026-08-04T00:30:00').toISOString(), reason: 'b', id: 'b' }
  ];
  n.relocks = []; n.status = 'pending'; n.settledAt = null;
  Store.applyResult(n, Store.evaluate(n));
  ok(n.status === 'missed', '一样判未达成', n.status);
  ok(Store.db.tank.health < before.health, '水色下降');
  ok(Store.db.tank.gray > before.gray, '灰暗上升');
  ok(Store.db.fish.filter(f => f.dull).length >= before.dull, '有鱼变灰');
}

section('7) 补记真实入睡时间会影响判定');
{
  const n = Store.getNight('2026-08-05', true);
  n.bed = '23:00'; n.wake = '07:00'; n.lead = 30;
  n.lockedAt = new Date('2026-08-05T22:30:00').toISOString();
  n.unlocks = []; n.relocks = []; n.status = 'pending'; n.settledAt = null;
  // 实际 01:30 才睡着 → 晚了 150 分钟
  n.actualSleepAt = new Date('2026-08-06T01:30:00').toISOString();
  const res = Store.evaluate(n);
  ok(res.level === 'missed', '晚睡 150 分钟判未达成', res);

  const n2 = Store.getNight('2026-08-06', true);
  n2.bed = '23:00'; n2.wake = '07:00'; n2.lead = 30;
  n2.lockedAt = new Date('2026-08-06T22:30:00').toISOString();
  n2.unlocks = []; n2.relocks = []; n2.status = 'pending'; n2.settledAt = null;
  n2.actualSleepAt = new Date('2026-08-06T23:20:00').toISOString();  // 晚 20 分钟
  const res2 = Store.evaluate(n2);
  ok(res2.level === 'met', '晚睡 20 分钟仍是达成', res2);

  const n3 = Store.getNight('2026-08-07', true);
  n3.bed = '23:00'; n3.wake = '07:00'; n3.lead = 30;
  n3.lockedAt = new Date('2026-08-07T22:30:00').toISOString();
  n3.unlocks = []; n3.relocks = []; n3.status = 'pending'; n3.settledAt = null;
  n3.actualSleepAt = new Date('2026-08-08T00:20').toISOString();
  const res3 = Store.evaluate(n3);
  ok(res3.level === 'missed', '晚睡 80 分钟判未达成', res3);
}

section('8) CSV / JSON 导入');
{
  const csv = [
    '日期,入睡时间,起床时间,备注',
    '2026-08-10,23:40,07:10,',
    '2026-08-11,00:20,07:30,刷了会儿视频',
    '2026-08-12,23:05,06:55,不错'
  ].join('\n');

  // 复用 app.js 的解析逻辑不好抽，这里直接测 Store.importRows
  const r = Store.importRows([
    { date: '2026-08-10', sleepAt: '23:40', wakeAt: '07:10' },
    { date: '2026-08-11', sleepAt: '00:20', wakeAt: '07:30', note: '刷了会儿视频' },
    { date: '2026-08-12', sleepAt: '23:05', wakeAt: '06:55', note: '不错' },
    { date: 'bad-date', sleepAt: '23:00', wakeAt: '07:00' }
  ]);
  ok(r.added === 3 && r.skipped === 1, '新增 3 条、跳过 1 条', r);
  const n = Store.db.nights['2026-08-11'];
  ok(!!n, '2026-08-11 记录存在');
  ok(n && new Date(n.actualSleepAt).toISOString().slice(5, 16) === '08-12T00:20' || n && new Date(n.actualSleepAt).getHours() === 0,
    '00:20 归到正确那夜', n && n.actualSleepAt);
  ok(n && n.note === '刷了会儿视频', '备注导入', n && n.note);
  ok(n && n.status !== 'pending', '过去的数据已自动结算', n && n.status);
}

section('9) 导出 / 恢复');
{
  const json = Store.exportJSON();
  const obj = JSON.parse(json);
  ok(obj.app === 'sleep-aquarium' && obj.data && obj.data.nights, '导出结构正确');
  const snapshot = JSON.stringify(obj.data.nights);
  Store.reset();
  ok(Store.db.fish.length === 3 && Object.keys(Store.db.nights).length === 0, '重置后回到初始');
  Store.restore(obj);
  ok(JSON.stringify(Store.db.nights) === snapshot, '恢复后记录一致');
}

section('10) 游动状态不落盘');
{
  const raw = JSON.parse(global.localStorage.getItem('sleepAquarium.v1'));
  const leaked = raw.fish.filter(f => 'x' in f || 'y' in f || 'angle' in f);
  ok(leaked.length === 0, 'fish 里没有持久化坐标', leaked[0]);
}

section('11) 统计');
{
  const st = Store.stats();
  ok(typeof st.streak === 'number' && st.total > 0, '统计字段正常', st);
  console.log('   stats =', JSON.stringify(st));
}

section('12) 自动保存的今晚计划');
{
  const key = Store.activeNightKey();
  Store.plan({ bed: '23:00', wake: '07:00', lead: 30, note: 'a' }, true);
  const n = Store.getNight(key, false);
  ok(!!n.lockedAt && n.note === 'a', 'arm=true 生效并写入锁定时刻');
  const armedAt = n.lockedAt;

  Store.plan({ bed: '23:30', wake: '07:10', lead: 15, note: 'b' }, true);
  ok(n.bed === '23:30' && n.lead === 15 && n.note === 'b', '改时间即时生效');
  ok(n.lockedAt === armedAt, '已生效的夜不重置锁定时刻');
  ok(Store.needsRelock() === false, '没有解锁时不需要重新熄灯');

  // 模拟：一分钟前就已生效，之后半夜解锁过一次
  n.lockedAt = new Date(Date.now() - 60000).toISOString();
  n.unlocks.push({ at: new Date(Date.now() - 1000).toISOString(), reason: 'test' });
  ok(Store.needsRelock() === true, '解锁之后需要重新熄灯');

  Store.plan({ bed: '23:40', wake: '07:00', lead: 30, note: 'b' }, true);
  ok(n.unlocks.length === 1, '再改时间也不抹掉解锁记录', n.unlocks.length);
  ok(Store.needsRelock() === true, '解锁记录还在，仍旧需要重新熄灯');

  Store.relock();
  ok(Store.needsRelock() === false, '重新熄灯后不再需要');

  Store.plan({ bed: '22:00', wake: '06:30', lead: 0, note: '' }, false);
  ok(n.lockedAt === null && n.manual === true, 'arm=false 只记一笔、不锁屏');
}

section('13) 达成 / 未达成的边界');
{
  const mk = (key, sleepAtMin, unlocks) => {
    const n = Store.getNight(key, true);
    n.bed = '23:00'; n.wake = '07:00'; n.lead = 30;
    n.lockedAt = new Date(key + 'T22:30:00').toISOString();
    n.unlocks = Array.from({ length: unlocks || 0 }, (_, i) => ({
      at: new Date(key + 'T23:20:00').toISOString(), reason: 'x' + i, id: 'u' + i
    }));
    n.relocks = []; n.status = 'pending'; n.settledAt = null;
    n.actualSleepAt = sleepAtMin == null ? null : new Date(new Date(key + 'T23:00:00').getTime() + sleepAtMin * 60000).toISOString();
    return n;
  };

  ok(Store.evaluate(mk('2026-09-01', null, 0)).level === 'met', '0 解锁 + 没记入睡时间 → 达成');
  ok(Store.evaluate(mk('2026-09-02', 40, 0)).level === 'met', '正好晚 40 分钟 → 达成');
  ok(Store.evaluate(mk('2026-09-03', 41, 0)).level === 'missed', '晚 41 分钟 → 未达成');
  ok(Store.evaluate(mk('2026-09-04', 5, 1)).level === 'missed', '按时睡但解锁 1 次 → 未达成');
  ok(Store.evaluate(mk('2026-09-05', 0, 3)).level === 'missed', '解锁 3 次 → 未达成');

  const txt = Store.evaluate(mk('2026-09-06', 90, 2)).text;
  ok(txt.indexOf('解锁 2 次') >= 0 && txt.indexOf('90 分钟') >= 0, '未达成会写清两条原因', txt);

  const st = Store.stats();
  ok(st.met + st.missed === st.total, '达成 + 未达成 = 已结算的夜', st);
}

console.log('\n========================');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
console.log('========================');
process.exit(fail ? 1 : 0);
