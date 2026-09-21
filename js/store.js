
(function (global) {
  'use strict';

  var DB_KEY = 'sleepAquarium.v1';
  var DAY_START_HOUR = 12;
  var LIGHT_DAY_FROM = 6.5;
  var LIGHT_DAY_TO = 18.5;
  var MAX_FISH = 24;
  var LATE_LIMIT_MIN = 40;

  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function iso(d) { return (d || new Date()).toISOString(); }
  function hhmmOfIso(s) { var d = new Date(s); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function hhmm(v, fb) {
    if (typeof v !== 'string') return fb;
    var m = v.trim().match(/^(\d{1,2})[:：.]?(\d{2})?$/);
    if (!m) return fb;
    var h = clamp(parseInt(m[1], 10) || 0, 0, 23);
    var mi = clamp(parseInt(m[2] || '0', 10) || 0, 0, 59);
    return pad(h) + ':' + pad(mi);
  }
  function hhmmToMin(s) { var p = s.split(':').map(Number); return p[0] * 60 + p[1]; }

  function atTime(baseDate, hhmmStr) {
    var p = hhmmStr.split(':').map(Number);
    var d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), p[0], p[1], 0, 0);
    return d;
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  var SPECIES = [
    { id: 'clown',  name: '小丑鱼',   body: '#ff9142', belly: '#ffd9a8', band: '#fff7ec', fin: '#ffb066', size: 1.00, banded: true,  tall: false },
    { id: 'neon',   name: '霓虹灯鱼', body: '#3fb8f5', belly: '#d3f1ff', band: '#ff5d7a', fin: '#8fdcff', size: 0.70, banded: false, tall: false },
    { id: 'gold',   name: '小金鱼',   body: '#ffb703', belly: '#ffe9a8', band: '#fff3cf', fin: '#ffd166', size: 1.16, banded: false, tall: false, fancy: true },
    { id: 'angel',  name: '神仙鱼',   body: '#bcdcff', belly: '#f2f9ff', band: '#3d5f8f', fin: '#9ec6ef', size: 1.22, banded: true,  tall: true },
    { id: 'guppy',  name: '孔雀鱼',   body: '#9b5de5', belly: '#e6cffc', band: '#ffd6f2', fin: '#c99cf7', size: 0.80, banded: false, tall: false, fancy: true },
    { id: 'tang',   name: '蓝倒吊',   body: '#1f7fd8', belly: '#a9d8f5', band: '#ffd166', fin: '#4aa3e8', size: 1.08, banded: false, tall: true },
    { id: 'rosey',  name: '粉小丑',   body: '#ff7fa8', belly: '#ffd9e6', band: '#fff2f7', fin: '#ffa8c4', size: 0.92, banded: true,  tall: false },
    { id: 'jelly',  name: '灯塔水母', body: '#b8e0f2', belly: '#e6f6ff', band: '#e8566f', fin: '#a8d4ea', size: 0.90, banded: false, tall: false, special: true },
    { id: 'squid',  name: '鱿鱼',     body: '#e0a3b8', belly: '#f2c2d2', band: '#a2607a', fin: '#f2c2d2', size: 1.00, banded: false, tall: false, special: true },
    { id: 'seahorse', name: '海马',   body: '#f0a03c', belly: '#f8d79a', band: '#cf7c1e', fin: '#9fd8d0', size: 0.80, banded: false, tall: false, special: true },
    { id: 'puffer', name: '河豚',     body: '#f2d06a', belly: '#ffe79a', band: '#a8842c', fin: '#d0a83c', size: 0.95, banded: false, tall: false, special: true },
    { id: 'octo',   name: '章鱼',     body: '#c07ad8', belly: '#dda3ef', band: '#8f4fa8', fin: '#f6e2fb', size: 1.00, banded: false, tall: false, special: true }
  ];

  function spawnPool() {
    var seen = (S.db && S.db.seen) || {};
    var pool = SPECIES.filter(function (s) {
      var c = null;
      for (var i = 0; i < COLLECTION.length; i++) if (COLLECTION[i].sp === s.id) { c = COLLECTION[i]; break; }
      if (!c) return true;
      if (!c.need.n) return true;
      return !!seen[c.id];
    });
    return pool.length ? pool : [SPECIES[0]];
  }

  function makeFish(opts) {
    opts = opts || {};
    var sp = opts.species ? (SPECIES.filter(function (s) { return s.id === opts.species; })[0] || pick(spawnPool())) : pick(spawnPool());
    return {
      id: uid(),
      species: sp.id,
      name: opts.name || sp.name,
      size: sp.size * rnd(0.88, 1.14),
      hue: rnd(-8, 8),
      born: opts.born || ymd(new Date()),
      note: opts.note || '',
      dull: false,
      x: rnd(0.15, 0.85),
      y: rnd(0.2, 0.75),
      angle: rnd(0, Math.PI * 2),
      speed: rnd(0.45, 0.8),
      phase: rnd(0, Math.PI * 2),
      tailFreq: rnd(2.3, 3.6),
      seed: rnd(0, 1000)
    };
  }

  
  var COLLECTION = [
    { id: 'clown', sp: 'clown', rar: 1, need: { type: 'total', n: 0 },    desc: '鱼缸的第一位原住民' },
    { id: 'neon',  sp: 'neon',  rar: 1, need: { type: 'total', n: 3 },    desc: '累计记录 3 夜点亮' },
    { id: 'gold',  sp: 'gold',  rar: 2, need: { type: 'streak', n: 2 },  desc: '连续 2 晚按计划睡点亮' },
    { id: 'angel', sp: 'angel', rar: 2, need: { type: 'met', n: 5 },      desc: '累计 5 晚达成点亮' },
    { id: 'guppy', sp: 'guppy', rar: 3, need: { type: 'total', n: 10 },   desc: '累计记录 10 夜点亮' },
    { id: 'tang',  sp: 'tang',  rar: 3, need: { type: 'best', n: 5 },     desc: '历史最长连续 5 晚点亮' },
    { id: 'rosey', sp: 'rosey', rar: 4, need: { type: 'met', n: 12 },     desc: '累计 12 晚达成点亮' },
    { id: 'seahorse', sp: 'seahorse', rar: 2, need: { type: 'streak', n: 4 },  desc: '连续 4 晚按计划睡点亮' },
    { id: 'jelly', sp: 'jelly', rar: 2, need: { type: 'streak', n: 6 },    desc: '连续 6 晚按计划睡点亮' },
    { id: 'squid', sp: 'squid', rar: 3, need: { type: 'total', n: 20 },   desc: '累计记录 20 夜点亮' },
    { id: 'puffer', sp: 'puffer', rar: 3, need: { type: 'met', n: 10 },   desc: '累计 10 晚达成点亮' },
    { id: 'octo', sp: 'octo', rar: 4, need: { type: 'total', n: 30 },     desc: '累计记录 30 夜点亮' }
  ];
  var RARITY = { 1: '常见', 2: '稀有', 3: '史诗', 4: '传说' };
  var COND_TEXT = { total: '累计记录', streak: '当前连续按计划睡', met: '累计达成', best: '历史最长连续' };

  function speciesName(id) {
    var s = SPECIES.filter(function (x) { return x.id === id; })[0];
    return s ? s.name : id;
  }

  function buildDecor() {
    var plants = [], corals = [], i, xs = [];
    var pt = ['kelp', 'kelp', 'weed', 'grass', 'bush'];
    for (i = 0; i < 12; i++) {
      var x = (i + rnd(0.15, 0.85)) / 12;
      xs.push(x);
      plants.push({
        id: uid(), type: pick(pt), x: x, scale: rnd(0.6, 1.35),
        phase: rnd(0, Math.PI * 2), growth: 0.55, hue: rnd(-14, 14)
      });
    }
    var ct = ['branch', 'fan', 'brain', 'tube', 'branch'];
    for (i = 0; i < 6; i++) {
      corals.push({
        id: uid(), type: pick(ct), x: [0.08, 0.24, 0.4, 0.58, 0.75, 0.92][i] + rnd(-0.03, 0.03),
        scale: rnd(0.62, 1.05), phase: rnd(0, Math.PI * 2), growth: 0.6, hue: rnd(-18, 26)
      });
    }
    return { plants: plants, corals: corals };
  }

  function defaults() {
    var dec = buildDecor();
    return {
      version: 1,
      createdAt: iso(),
      config: {
        defaultBed: '23:00',
        defaultWake: '07:00',
        lockLead: 30,
        lightMode: 'auto'
      },      tank: { health: 0.55, gray: 0.06 },
      fish: [makeFish(), makeFish(), makeFish()],
      plants: dec.plants,
      corals: dec.corals,
      nights: {},
      events: [],
      seen: {}
    };
  }

  function migrate(d) {
    var base = defaults();
    if (!d || typeof d !== 'object') return base;
    d.config = Object.assign({}, base.config, d.config || {});
    d.tank = Object.assign({}, base.tank, d.tank || {});
    delete d.config.rewardPerNight;
    delete d.config.settleDelay;
    delete d.cfgV2;
    if (!Array.isArray(d.fish)) d.fish = base.fish;
    if (!Array.isArray(d.plants) || !d.plants.length) d.plants = base.plants;
    if (!Array.isArray(d.corals) || !d.corals.length) d.corals = base.corals;
    if (!d.nights || typeof d.nights !== 'object') d.nights = {};
    Object.keys(d.nights).forEach(function (k) {
      var n = d.nights[k];
      delete n.settleDelay;
      if (n.status === 'perfect') n.status = 'met';
      else if (n.status === 'minor' || n.status === 'broken') n.status = 'missed';
    });
    if (!Array.isArray(d.events)) d.events = [];
    if (!d.seen || typeof d.seen !== 'object') d.seen = {};
    d.version = 1;
    return d;
  }

  function nightKeyOf(date) {
    var d = new Date(date || new Date());
    if (d.getHours() < DAY_START_HOUR) d = addDays(d, -1);
    return ymd(d);
  }

  
  function timingFor(n) {
    var base = parseYmd(n.key);
    var bedMin = hhmmToMin(n.bed);
    var bedDay = bedMin < DAY_START_HOUR * 60 ? addDays(base, 1) : base;
    var bed = atTime(bedDay, n.bed);
    var wake = atTime(addDays(base, 1), n.wake);
    if (wake <= bed) wake = addDays(wake, 1);
    var lock = new Date(bed.getTime() - n.lead * 60000);
    return {
      bed: bed, lock: lock, wake: wake, settle: wake,
      bedMs: bed.getTime(), lockMs: lock.getTime(),
      wakeMs: wake.getTime(), settleMs: wake.getTime()
    };
  }

  var S = {
    SPECIES: SPECIES,
    MAX_FISH: MAX_FISH,
    db: null,

    init: function () {
      var raw = null;
      try { raw = localStorage.getItem(DB_KEY); } catch (e) { raw = null; }
      var parsed = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
      S.db = migrate(parsed);
      S.save();
      return S.db;
    },

    save: function () {
      try {

        var slim = JSON.parse(JSON.stringify(S.db));
        slim.fish.forEach(function (f) {
          delete f.x; delete f.y; delete f.angle;
          delete f.phase; delete f.speed; delete f.seed; delete f.tailFreq;
        });
        localStorage.setItem(DB_KEY, JSON.stringify(slim));
      } catch (e) { }
    },

    log: function (type, text, extra) {
      S.db.events.unshift(Object.assign({ at: iso(), type: type, text: text }, extra || {}));
      if (S.db.events.length > 400) S.db.events.length = 400;
    },

    nightKeyOf: nightKeyOf,

    getNight: function (key, create) {
      if (!S.db.nights[key]) {
        if (!create) return null;
        var c = S.db.config;
        S.db.nights[key] = {
          key: key,
          bed: c.defaultBed,
          wake: c.defaultWake,
          lead: c.lockLead,
          note: '',
          lockedAt: null,
          unlocks: [],
          relocks: [],
          actualSleepAt: null,
          actualWakeAt: null,
          status: 'pending',
          reasonText: '',
          fishDelta: 0,
          settledAt: null,
          manual: false
        };
      }
      return S.db.nights[key];
    },

    activeNightKey: function () {
      var d = new Date();
      if (d.getHours() < 5) return nightKeyOf(d);
      return ymd(d);
    },

    currentNight: function (create) {
      return S.getNight(S.activeNightKey(), create !== false);
    },

    lightModeSetting: function () {
      var m = S.db.config.lightMode;
      return (m === 'day' || m === 'night') ? m : 'auto';
    },

    lightMode: function () {
      var m = S.lightModeSetting();
      if (m !== 'auto') return m;
      var d = new Date();
      var h = d.getHours() + d.getMinutes() / 60;
      return (h >= LIGHT_DAY_FROM && h < LIGHT_DAY_TO) ? 'day' : 'night';
    },

    setLightMode: function (m) {
      if (['auto', 'day', 'night'].indexOf(m) < 0) m = 'auto';
      S.db.config.lightMode = m;
      S.save();
      return S.lightMode();
    },

    lightHours: { from: LIGHT_DAY_FROM, to: LIGHT_DAY_TO },

    lightHourText: function (h) {
      var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      return pad(hh) + ':' + pad(mm);
    },

    isLockedNow: function () {
      var n = S.getNight(S.activeNightKey(), false);
      if (!n || n.status !== 'pending' || !n.lockedAt) return null;
      var t = timingFor(n);
      var now = Date.now();

      var from = t.lockMs;
      if (n.sleepStartedAt) from = Math.min(from, new Date(n.sleepStartedAt).getTime());
      if (now < from || now > t.wakeMs) return null;

      var lastUnlock = n.unlocks.length ? new Date(n.unlocks[n.unlocks.length - 1].at).getTime() : 0;
      var lastRelock = n.relocks.length ? new Date(n.relocks[n.relocks.length - 1].at).getTime() : 0;
      var armed = new Date(n.lockedAt).getTime();
      if (lastUnlock >= Math.max(armed, lastRelock)) return null;
      return n;
    },

    plan: function (opts, arm) {
      var n = S.currentNight(true);
      n.bed = hhmm(opts.bed, S.db.config.defaultBed);
      n.wake = hhmm(opts.wake, S.db.config.defaultWake);
      n.lead = clamp(parseInt(opts.lead, 10) || 0, 0, 240);
      n.note = (opts.note || '').slice(0, 120);

      if (arm) {
        if (!n.lockedAt) {
          n.lockedAt = iso();
          S.log('plan', '定下今晚计划 · ' + n.bed + ' 睡，' + n.wake + ' 起', { night: n.key });
        }
        n.manual = false;
      } else {
        n.lockedAt = null;
        n.manual = true;
        S.log('plan', '记下了今晚计划 · ' + n.bed + ' 睡', { night: n.key });
      }
      S.save();
      return n;
    },

    needsRelock: function () {
      var n = S.getNight(S.activeNightKey(), false);
      if (!n || n.status !== 'pending' || !n.lockedAt) return false;
      var armed = new Date(n.lockedAt).getTime();
      var lu = n.unlocks.length ? new Date(n.unlocks[n.unlocks.length - 1].at).getTime() : 0;
      var lr = n.relocks.length ? new Date(n.relocks[n.relocks.length - 1].at).getTime() : 0;
      return lu > 0 && lu >= Math.max(armed, lr);
    },

    sleepNow: function (opts) {
      var n = S.currentNight(true);
      n.bed = hhmm(opts.bed, S.db.config.defaultBed);
      n.wake = hhmm(opts.wake, S.db.config.defaultWake);
      n.lead = clamp(parseInt(opts.lead, 10) || 0, 0, 240);
      n.note = (opts.note || '').slice(0, 120);
      n.status = 'pending';
      n.settledAt = null;
      n.unlocks = [];
      n.relocks = [];
      n.lockedAt = iso();
      n.sleepStartedAt = iso();
      n.manual = false;
      S.log('goodnight', '晚安 🌙 立即进入睡眠模式 · ' + n.wake + ' 起', { night: n.key });
      S.save();
      return n;
    },

    unlock: function (reason) {
      var n = S.getNight(S.activeNightKey(), false);
      if (!n) return null;
      n.unlocks.push({ at: iso(), reason: reason || '未说明', id: uid() });
      S.log('unlock', '手动解锁 · ' + (reason || '未说明'), { night: n.key });
      S.save();
      return n;
    },

    relock: function () {
      var n = S.getNight(S.activeNightKey(), false);
      if (!n) return null;
      n.relocks.push({ at: iso() });
      S.log('relock', '放下手机，重新熄灯', { night: n.key });
      S.save();
      return n;
    },

    evaluate: function (n) {
      var t = timingFor(n);
      var unlocks = n.unlocks || [];
      var reason = [], met = unlocks.length === 0;

      if (unlocks.length) reason.push('解锁 ' + unlocks.length + ' 次');
      if (n.actualSleepAt) {
        var late = (new Date(n.actualSleepAt).getTime() - t.bedMs) / 60000;
        if (late > LATE_LIMIT_MIN) {
          met = false;
          reason.push('晚了 ' + Math.round(late) + ' 分钟才睡');
        } else {
          reason.push(hhmmOfIso(n.actualSleepAt) + ' 入睡');
        }
      }

      var text = met
        ? ('整夜没解锁' + (reason.length ? ' · ' + reason.join(' · ') : ''))
        : reason.join(' · ');

      return { level: met ? 'met' : 'missed', text: text, unlocks: unlocks.length };
    },

    applyResult: function (n, res) {
      var d = S.db;
      n.status = res.level;
      n.reasonText = res.text;
      n.fishDelta = 0;
      n.settledAt = iso();

      if (res.level === 'met') {
        var add = 1;
        var added = 0;
        for (var i = 0; i < add; i++) {
          if (d.fish.length >= MAX_FISH) break;
          d.fish.push(makeFish({ born: n.key }));
          added++;
        }
        n.fishDelta = added;
        d.tank.health = clamp(d.tank.health + 0.055, 0.05, 1);
        d.tank.gray = clamp(d.tank.gray - 0.09, 0, 1);
        d.plants.forEach(function (p) { p.growth = clamp(p.growth + 0.075, 0.05, 1.25); });
        d.corals.forEach(function (c) { c.growth = clamp(c.growth + 0.06, 0.05, 1.25); });
        d.fish.forEach(function (f) { f.dull = false; });
        S.log('result', '达成了这一夜 · 鱼 +' + added, { night: n.key, level: res.level });

      } else {
        d.tank.health = clamp(d.tank.health - 0.045, 0.05, 1);
        d.tank.gray = clamp(d.tank.gray + 0.12, 0, 1);
        d.plants.forEach(function (p, i) {
          p.growth = clamp(p.growth - (i % 2 ? 0.03 : 0.05), 0.05, 1.25);
        });
        d.corals.forEach(function (c) { c.growth = clamp(c.growth - 0.045, 0.05, 1.25); });
        S.dullSome(1);
        S.log('result', '这一夜没达成 · 鱼缸暗了一点', { night: n.key, level: res.level });
      }
      S.save();
      return n;
    },

    dullSome: function (n) {
      var alive = S.db.fish.filter(function (f) { return !f.dull; });
      for (var i = 0; i < n && alive.length; i++) {
        var k = (Math.random() * alive.length) | 0;
        alive[k].dull = true;
        alive.splice(k, 1);
      }
    },

    settleAll: function () {
      var now = Date.now(), out = [];
      Object.keys(S.db.nights).forEach(function (k) {
        var n = S.db.nights[k];
        if (n.status !== 'pending') return;
        if (!n.lockedAt && !n.actualSleepAt) return;
        var t = timingFor(n);
        if (now < t.settleMs) return;
        out.push(S.applyResult(n, S.evaluate(n)));
      });
      if (out.length) S.save();
      return out;
    },

    stats: function () {
      var keys = Object.keys(S.db.nights).sort();
      var done = keys.map(function (k) { return S.db.nights[k]; })
        .filter(function (n) { return n.status !== 'pending'; });
      var met = done.filter(function (n) { return n.status === 'met'; }).length;
      var missed = done.filter(function (n) { return n.status === 'missed'; }).length;

      var streak = 0, sorted = keys.slice().sort().reverse();
      for (var i = 0; i < sorted.length; i++) {
        var n = S.db.nights[sorted[i]];
        if (n.status === 'pending') continue;
        if (n.status === 'met') streak++;
        else break;
      }

      var best = 0, run = 0;
      keys.forEach(function (k) {
        var n = S.db.nights[k];
        if (n.status === 'met') { run++; best = Math.max(best, run); }
        else if (n.status !== 'pending') { run = 0; }
      });
      var avgSleep = 0, cnt = 0;
      done.forEach(function (n) {
        if (n.actualSleepAt && n.actualWakeAt) {
          var m = (new Date(n.actualWakeAt) - new Date(n.actualSleepAt)) / 60000;
          if (m > 0 && m < 1440) { avgSleep += m; cnt++; }
        }
      });
      return {
        total: done.length, met: met, missed: missed,
        streak: streak, best: best,
        avgSleepMin: cnt ? Math.round(avgSleep / cnt) : 0,
        fish: S.db.fish.length,
        dullCount: S.db.fish.filter(function (f) { return f.dull; }).length
      };
    },

    COLLECTION: COLLECTION,
    RARITY: RARITY,

    collection: function () {
      var st = S.stats();
      var keyOf = { total: st.total, streak: st.streak, met: st.met, best: st.best };
      return COLLECTION.map(function (c) {
        var cur = keyOf[c.need.type] || 0;
        return {
          id: c.id, sp: c.sp, rar: c.rar, desc: c.desc,
          name: speciesName(c.sp),
          unlocked: !!S.db.seen[c.id],
          cur: Math.min(cur, c.need.n),
          need: c.need.n,
          condText: COND_TEXT[c.need.type]
        };
      });
    },

    refreshCollection: function () {
      var st = S.stats();
      var keyOf = { total: st.total, streak: st.streak, met: st.met, best: st.best };
      var newly = [];
      COLLECTION.forEach(function (c) {
        if (S.db.seen[c.id]) return;
        if ((keyOf[c.need.type] || 0) >= c.need.n) {
          S.db.seen[c.id] = { at: iso() };
          if (S.db.fish.length < MAX_FISH) {
            S.db.fish.push(makeFish({ species: c.sp, note: '图鉴点亮' }));
          }
          S.log('dex', '图鉴点亮 · ' + speciesName(c.sp) + ' 游进了鱼缸', { dex: c.id });
          newly.push(c);
        }
      });
      if (newly.length) S.save();
      return newly;
    },

    
    importRows: function (rows) {
      var added = 0, updated = 0, skipped = 0;
      rows.forEach(function (r) {
        if (!r || !r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { skipped++; return; }
        var existed = !!S.db.nights[r.date];
        var n = S.getNight(r.date, true);
        if (r.bed) n.bed = hhmm(r.bed, n.bed);
        if (r.wake) n.wake = hhmm(r.wake, n.wake);
        if (r.sleepAt) n.actualSleepAt = toISOinNight(n.key, r.sleepAt);
        if (r.wakeAt) n.actualWakeAt = toISOinNight(n.key, r.wakeAt, true);
        if (r.note) n.note = String(r.note).slice(0, 120);
        n.manual = true;

        if (n.status !== 'pending') {
          S.applyResult(n, S.evaluate(n));
        } else {
          var t = timingFor(n);
          if (Date.now() >= t.settleMs && (n.lockedAt || n.actualSleepAt)) {
            S.applyResult(n, S.evaluate(n));
          }
        }
        if (existed) updated++; else added++;
      });
      S.log('import', '导入 ' + rows.length + ' 条 · 新增 ' + added + ' / 更新 ' + updated + (skipped ? ' / 跳过 ' + skipped : ''));
      S.save();
      return { added: added, updated: updated, skipped: skipped };
    },

    exportJSON: function () {
      return JSON.stringify({
        app: 'sleep-aquarium', exportedAt: iso(), data: S.db
      }, null, 2);
    },

    restore: function (obj) {
      var d = obj && obj.data ? obj.data : obj;
      if (!d || !d.nights) throw new Error('文件格式不对');
      S.db = migrate(d);
      S.save();
    },

    reset: function () {
      S.db = defaults();
      S.save();
    },

    revive: function () {
      S.db.tank.health = clamp(S.db.tank.health + 0.18, 0.05, 1);
      S.db.tank.gray = clamp(S.db.tank.gray - 0.3, 0, 1);
      S.db.fish.forEach(function (f) { f.dull = false; });
      S.db.plants.forEach(function (p) { p.growth = clamp(p.growth + 0.12, 0.05, 1.25); });
      S.db.corals.forEach(function (c) { c.growth = clamp(c.growth + 0.1, 0.05, 1.25); });
      S.log('revive', '手动修复了鱼缸');
      S.save();
    }
  };

  function toISOinNight(nightKey, hhmmStr, isWake) {
    var base = parseYmd(nightKey);
    var hm = hhmm(hhmmStr, '00:00').split(':').map(Number);
    var day;
    if (isWake) {
      day = addDays(base, 1);
      if (hm[0] >= DAY_START_HOUR) day = base;
    } else {
      day = hm[0] < DAY_START_HOUR ? addDays(base, 1) : base;
    }
    return atTime(day, hhmm(hhmmStr, '00:00')).toISOString();
  }

  S.util = { pad: pad, ymd: ymd, parseYmd: parseYmd, hhmm: hhmm, atTime: atTime, addDays: addDays, toISOinNight: toISOinNight, clamp: clamp, uid: uid };
  global.Store = S;
})(window);
