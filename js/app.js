
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PAD = function (n) { return String(n).padStart(2, '0'); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function fmtClock(ms) {
    ms = Math.max(0, ms);
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return PAD(h) + ':' + PAD(m) + ':' + PAD(ss);
  }
  function fmtDur(ms) {
    var min = Math.max(0, Math.round(ms / 60000));
    var h = Math.floor(min / 60), m = min % 60;
    if (h <= 0) return m + ' 分钟';
    return h + ' 小时 ' + (m ? m + ' 分' : '');
  }
  function hhmmOf(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr);
    return PAD(d.getHours()) + ':' + PAD(d.getMinutes());
  }
  function weekdayOf(key) {
    var p = key.split('-').map(Number);
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(p[0], p[1] - 1, p[2]).getDay()];
  }
  function niceDate(key) {
    var p = key.split('-').map(Number);
    return (p[1]) + '月' + p[2] + '日 ' + weekdayOf(key);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function openModal(html, onMount) {
    var m = $('#modal'), box = $('#modalBox');
    box.innerHTML = html;
    m.hidden = false;
    if (onMount) onMount(box);
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }

  var aq = null;
  var lockTimer = null;

  function boot() {
    Store.init();

    aq = new Aquarium($('#tankCanvas'));
    aq.setSpecies(Store.SPECIES);
    renderTank(true);

    var results = Store.settleAll();
    if (results.length) {
      var last = results[results.length - 1];
      var map = { met: '昨晚做到了，鱼缸里游来新伙伴 🐟', missed: '昨晚没做到，鱼缸暗了一点' };
      flash(map[last.status] || '昨夜已结算');
    }
    announceDex(Store.refreshCollection());
    refreshLockState();
    renderHud();
    applyLightMode();

    aq.start();

    setInterval(function () {
      var r = Store.settleAll();
      if (r.length) { renderTank(); renderHud(); toast('昨夜已结算'); }
      announceDex(Store.refreshCollection());
      refreshLockState();
      applyLightMode();
    }, 30000);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        var r = Store.settleAll();
        if (r.length) { renderTank(); renderHud(); }
        announceDex(Store.refreshCollection());
        refreshLockState();
        applyLightMode();
      }
    });
  }

  var LIGHT_LABEL = { auto: '跟随时间', day: '固定日间', night: '固定夜间' };

  function applyLightMode() {
    var locked = !!Store.isLockedNow();
    var mode = locked ? 'night' : Store.lightMode();
    if (aq && aq.setMood) aq.setMood(mode);
    if (aq && aq.setLightsOut) aq.setLightsOut(locked);
    document.body.classList.toggle('is-night', mode === 'night');
    updateLightChip(mode, locked);
  }

  function updateLightChip(mode, locked) {
    var b = $('#btnLight');
    if (!b) return;
    var setting = Store.lightModeSetting();
    $('#lightIco').textContent = mode === 'night' ? '🌙' : '☀️';
    $('#lightTxt').textContent = (mode === 'night' ? '夜间' : '日间') + (locked ? ' · 熄灯' : '');
    b.dataset.setting = setting;
    b.title = setting === 'auto'
      ? '跟随时间自动切换（06:30 起日间 / 18:30 起夜间）· 点一下改成手动'
      : '手动模式 · 点一下换一种';
  }

  function cycleLightMode() {
    var order = ['auto', 'day', 'night'];
    var cur = Store.lightModeSetting();
    var next = order[(order.indexOf(cur) + 1) % order.length];
    Store.setLightMode(next);
    applyLightMode();
    var mode = Store.lightMode();
    toast('光照 · ' + LIGHT_LABEL[next] +
      (next === 'auto' ? '（现在是' + (mode === 'night' ? '夜间' : '日间') + '）' : ''));
  }

  function announceDex(newly) {
    if (!newly || !newly.length) return;
    renderTank();
    var names = newly.map(function (c) { return Store.SPECIES.filter(function (s) { return s.id === c.sp; })[0].name; });
    flash('📖 图鉴点亮 · ' + names.join('、') + ' 游进了鱼缸！');
  }

  function flash(msg) {
    var el = $('#tankFlash');
    el.textContent = msg;
    el.hidden = false;
    setTimeout(function () { el.hidden = true; }, 5200);
  }

  function showView(id) {
    if (id === 'lock') {
      $$('.view').forEach(function (v) { v.classList.remove('is-active'); });
      $('#view-lock').classList.add('is-active');
      aq.stop();
      startLockUI();
      return;
    }
    stopLockUI();
    $$('.view').forEach(function (v) { v.classList.remove('is-active'); });
    var el = $('#view-' + id);
    if (el) el.classList.add('is-active');
    if (id === 'tank') { aq.resize(); aq.start(); renderTank(); renderHud(); applyLightMode(); }
    else { aq.stop(); }
    if (id === 'bedtime') fillBedtime();
    if (id === 'dex') renderDex();
    if (id === 'log') renderLog();
  }

  function renderTank(reset) {
    var d = Store.db;
    if (reset || !aq.fish.length) aq.setData({ fish: d.fish, plants: d.plants, corals: d.corals, tank: d.tank });
    else aq.setData({ fish: d.fish, plants: d.plants, corals: d.corals, tank: d.tank });
    renderHud();
  }

  function renderHud() {
    var d = Store.db;
    var st = Store.stats();
    $('#statFish').textContent = d.fish.length;
    $('#statStreak').textContent = st.streak;
    $('#statHealth').textContent = Math.round(d.tank.health * 100) + '%';

    var sub = '';
    var nowKey = Store.activeNightKey();
    var n = Store.getNight(nowKey, false);
    var t = new Date();
    var hour = t.getHours();

    if (hour >= 20 || hour < 3) {
      if (n && n.lockedAt) {
        var un = n.unlocks.length;
        var T = window.Store.util;
        var tt = timingForNight(n, T);
        var msLeft = tt.lockMs - Date.now();
        if (msLeft > 0) {
          sub = '计划已生效 · ' + fmtDur(msLeft) + ' 后（' +
            PAD(new Date(tt.lockMs).getHours()) + ':' + PAD(new Date(tt.lockMs).getMinutes()) + '）自动熄灯';
        } else if (un === 0) {
          sub = '今晚的灯还亮着——很好，保持住 🌙';
        } else {
          sub = '已经解锁过 <b>' + un + '</b> 次了，明天鱼缸会记得。';
        }
      } else if (n && n.manual) {
        sub = '今晚记了 ' + n.bed + ' 睡（没锁屏）· 去「设置」可以重新安排';
      } else {
        sub = '今晚还没定时间 · 直接点「晚安 🌙」开睡';
      }
    } else {
      var last = lastSettled();
      if (last) {
        var m = { met: '昨晚做到了 ✨', missed: '昨晚没做到' };
        sub = niceDate(last.key) + ' · ' + (m[last.status] || '') + ' · ' + last.reasonText;
      } else {
        sub = '鱼缸里有 ' + d.fish.length + ' 条鱼，好好睡，明天会更多';
      }
    }
    if (d.tank.gray > 0.4) sub += '<br>⚠️ 水已经有点浑了，按计划睡几晚就能清回来。';
    $('#hudSub').innerHTML = sub;
  }

  function lastSettled() {
    var keys = Object.keys(Store.db.nights).sort();
    for (var i = keys.length - 1; i >= 0; i--) {
      var n = Store.db.nights[keys[i]];
      if (n.status !== 'pending') return n;
    }
    return null;
  }

  var BED_PRESETS = ['22:00', '22:30', '23:00', '23:30', '00:00', '00:30'];
  var WAKE_PRESETS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30'];

  function fillBedtime() {
    var cfg = Store.db.config;
    var n = Store.getNight(Store.activeNightKey(), false);
    var bed = (n && n.bed) || cfg.defaultBed;
    var wake = (n && n.wake) || cfg.defaultWake;
    var lead = (n && n.lead != null) ? n.lead : cfg.lockLead;

    $('#inpBed').value = bed;
    $('#inpWake').value = wake;
    $('#inpLead').value = lead;
    $('#lblLead').textContent = lead;
    $('#inpNote').value = (n && n.note) || '';

    buildChips('#chipsBed', BED_PRESETS, bed, function (v) { $('#inpBed').value = v; commitPlan(); });
    buildChips('#chipsWake', WAKE_PRESETS, wake, function (v) { $('#inpWake').value = v; commitPlan(); });

    commitPlan();
  }

  function buildChips(sel, list, active, onPick) {
    var box = $(sel);
    box.innerHTML = '';
    list.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'chip' + (v === active ? ' on' : '');
      b.textContent = v;
      b.onclick = function () {
        $$('.chip', box).forEach(function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        onPick(v);
      };
      box.appendChild(b);
    });
  }

  function planForm() {
    return {
      bed: $('#inpBed').value || Store.db.config.defaultBed,
      wake: $('#inpWake').value || Store.db.config.defaultWake,
      lead: parseInt($('#inpLead').value, 10) || 0,
      note: $('#inpNote').value
    };
  }

  function commitPlan() {
    var f = planForm();
    var T = window.Store.util;
    var key = Store.activeNightKey();
    var tt = timingForNight({ key: key, bed: f.bed, wake: f.wake, lead: f.lead }, T);

    $('#lblLead').textContent = f.lead;
    $('#leadHint').textContent = f.lead > 0
      ? '入睡前 ' + f.lead + ' 分钟自动熄灯，之后页面就锁住了'
      : '不提前熄灯，到入睡时间直接锁住';

    $('#planGrid').innerHTML =
      '<div><span>熄灯</span><b>' + hhmmStr(tt.lockD) + '</b></div>' +
      '<div><span>入睡</span><b>' + f.bed + '</b></div>' +
      '<div><span>起床</span><b>' + f.wake + '</b></div>';

    var n = Store.getNight(key, false);
    var armed = !!(n && n.lockedAt && n.status === 'pending');
    var cfg = Store.db.config;
    cfg.defaultBed = f.bed;
    cfg.defaultWake = f.wake;
    cfg.lockLead = f.lead;
    Store.plan(f, armed || tt.lockMs > Date.now());

    renderPlanStatus(tt, f);
  }

  function renderPlanStatus(tt, f) {
    var n = Store.getNight(Store.activeNightKey(), false);
    var el = $('#planStatus');
    var left = tt.lockMs - Date.now();
    var durH = (tt.wakeMs - tt.bedMs) / 3600000;
    var cls = 'is-on', html;

    if (Store.isLockedNow()) {
      html = '锁屏中 · 今晚已经开始了，' + hhmmStr(tt.wakeD) + ' 起床。';
    } else if (n && n.lockedAt && n.unlocks.length) {
      cls = 'is-warn';
      html = '已解锁 <b>' + n.unlocks.length + '</b> 次 · 想接着睡，回首页点一下「晚安 🌙」就行。';
    } else if (n && n.lockedAt) {
      html = '已生效 ✓ 今晚 <b>' + hhmmStr(tt.lockD) + '</b> 自动熄灯' +
        (left > 0 ? '（还有 ' + fmtDur(left) + '）' : '') + ' · 改时间自动保存。';
    } else {
      cls = 'is-off';
      html = '今天已经过了熄灯时间 · 现在躺下就直接回首页点「晚安 🌙」，或者把入睡时间改到之后。';
    }
    el.className = 'plan-status ' + cls;
    el.innerHTML = html + '<br>这一觉大概 <b>' + durH.toFixed(1) + '</b> 小时。';
  }
  function toMin(s) { var p = String(s || '23:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); }

  function timingForNight(n, T) {
    var base = T.parseYmd(n.key);
    var bedD = T.atTime(toMin(n.bed) < 720 ? T.addDays(base, 1) : base, n.bed);
    var wakeD = T.atTime(T.addDays(base, 1), n.wake);
    if (wakeD <= bedD) wakeD = T.addDays(wakeD, 1);
    var lead = n.lead == null ? Store.db.config.lockLead : n.lead;
    var lockD = new Date(bedD.getTime() - lead * 60000);
    var settleD = wakeD;
    return {
      bedD: bedD, lockD: lockD, wakeD: wakeD, settleD: settleD,
      bedMs: bedD.getTime(), lockMs: lockD.getTime(),
      wakeMs: wakeD.getTime(), settleMs: settleD.getTime()
    };
  }

  function goodnight() {
    if (Store.isLockedNow()) { showView('lock'); return; }
    var h = new Date().getHours();
    var go = function () {
      if (Store.needsRelock()) {
        Store.relock();
      } else {
        var n = Store.getNight(Store.activeNightKey(), false);
        var cfg = Store.db.config;
        Store.sleepNow({
          bed: (n && n.bed) || cfg.defaultBed,
          wake: (n && n.wake) || cfg.defaultWake,
          lead: (n && n.lead != null) ? n.lead : cfg.lockLead,
          note: (n && n.note) || ''
        });
      }
      closeModal();
      refreshLockState();
      renderHud();
      toast('晚安 🌙 好梦');
    };

    if (h >= 6 && h < 19) {
      openModal(
        '<h2>现在就开始睡吗？</h2>' +
        '<div class="msub">按下后页面会立刻锁住，直到明早的起床时间。中途解锁点一下就行，但会被记进档案。</div>' +
        '<button class="btn btn-primary btn-block" id="gnGo">晚安 🌙 开始潜水</button>' +
        '<button class="btn btn-ghost btn-block" data-modal-close>再玩一会儿</button>',
        function (box) { $('#gnGo', box).onclick = go; }
      );
    } else {
      go();
    }
  }

  function currentLockNight() { return Store.isLockedNow(); }

  function refreshLockState() {
    if (currentLockNight()) {
      if (!$('#view-lock').classList.contains('is-active')) showView('lock');
    } else {
      if ($('#view-lock').classList.contains('is-active')) showView('tank');
    }
  }

  function startLockUI() {
    if (lockTimer) clearInterval(lockTimer);
    tickLock();
    lockTimer = setInterval(tickLock, 1000);
    aq.setData({ fish: Store.db.fish, plants: Store.db.plants, corals: Store.db.corals, tank: Store.db.tank, mood: 'night', lightsOut: true });
    applyLightMode();
  }
  function stopLockUI() {
    if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
    applyLightMode();
  }

  function tickLock() {
    var n = currentLockNight();
    if (!n) { refreshLockState(); return; }
    var tt = timingForNight(n, window.Store.util);

    var left = tt.wakeMs - Date.now();
    $('#lockTimer').textContent = fmtClock(left);
    $('#lockSub').textContent = '距离起床 ' + hhmmStr(tt.wakeD) + ' · 还剩 ' + fmtDur(left);
    $('#lockLabel').textContent = n.unlocks.length ? '已解锁 ' + n.unlocks.length + ' 次' : '灯已熄';
    $('#lockTank').innerHTML =
      '鱼缸里有 <b style="color:#8fd4e0">' + Store.db.fish.length + '</b> 条鱼<br>' +
      '水色 ' + Math.round(Store.db.tank.health * 100) + '% · 灰暗 ' + Math.round(Store.db.tank.gray * 100) + '%<br>' +
      '今晚打算 ' + n.bed + ' 睡 · 熄灯于 ' + hhmmOf(n.lockedAt);
  }
  function hhmmStr(d) { return PAD(d.getHours()) + ':' + PAD(d.getMinutes()); }

  function bindUnlock() {
    $('#btnTapUnlock').onclick = function () {
      var n = Store.unlock('夜间急用 · 一键解锁');
      if (!n) { refreshLockState(); return; }
      showView('tank');
      renderHud();
      flash('已解锁 · 已如实记入今晚档案。用完了想继续睡，就再点一次「晚安 🌙」。');
    };
  }

  function renderDex() {
    var list = Store.collection();
    var unlocked = list.filter(function (c) { return c.unlocked; }).length;
    $('#dexCount').textContent = unlocked + ' / ' + list.length;

    $('#dexGrid').innerHTML = list.map(function (c) {
      var tag = '<span class="dtag rar-' + c.rar + '">' + Store.RARITY[c.rar] + '</span>';
      if (c.unlocked) {
        return '<div class="dcard" data-sp="' + c.sp + '">' + tag +
          '<canvas class="dthumb" width="128" height="104"></canvas>' +
          '<div class="dname">' + c.name + '</div>' +
          '<div class="ddesc">' + c.desc + '</div>' +
          '<div class="dbadge">已在你的鱼缸里 🐟</div>' +
          '</div>';
      }
      var pct = c.need ? Math.round((c.cur / c.need) * 100) : 100;
      return '<div class="dcard locked">' + tag +
        '<div class="dthumb-box"><span class="lockico">🔒</span></div>' +
        '<div class="dname">' + c.name + '</div>' +
        '<div class="ddesc">' + c.desc + '</div>' +
        '<div class="dprogress"><div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<small>' + c.condText + ' ' + c.cur + ' / ' + c.need + '</small></div>' +
        '</div>';
    }).join('');

    $$('#dexGrid .dcard:not(.locked)').forEach(function (el) {
      var cv = el.querySelector('canvas');
      if (cv) Aquarium.thumbnail(cv, el.dataset.sp);
    });
  }

  var WD_CH = ['日', '一', '二', '三', '四', '五', '六'];

  function durMin(bed, wake) {
    var b = toMin(bed), w = toMin(wake);
    return w > b ? w - b : (1440 - b) + w;
  }

  function renderLog() {
    var st = Store.stats();
    var util = Store.util;
    var nights = Store.db.nights;

    $('#logStats').innerHTML =
      '<div><b>' + st.streak + '</b><span>连续按计划睡觉</span></div>' +
      '<div><b>' + (st.avgSleepMin ? (st.avgSleepMin / 60).toFixed(1) : '—') + '</b><span>平均睡眠·小时</span></div>' +
      '<div><b>' + st.met + '</b><span>达成夜</span></div>' +
      '<div><b>' + st.fish + '</b><span>条鱼</span></div>';

    var last = lastSettled();
    var sum = '';
    if (last) {
      sum = '最近一次 ' + niceDate(last.key) + '：' +
        ({ met: '做到了 ✨', missed: '没做到' }[last.status] || '') +
        (last.reasonText ? '（' + last.reasonText + '）' : '') + '。';
      if (st.streak >= 2) sum += '已经连续 ' + st.streak + ' 晚按计划睡了。';
      else if (!st.streak) sum += '今晚按计划睡，就能重新开始。';
    }
    var sumEl = $('#logSum');
    sumEl.textContent = sum;
    sumEl.hidden = !sum;

    var days = [], today = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today); d.setDate(d.getDate() - i);
      days.push(util.ymd(d));
    }
    var MAXH = 10;
    var bars = days.map(function (k) {
      var n = nights[k];
      var dd = util.parseYmd(k);
      var lab = '<div class="wk-d">' + WD_CH[dd.getDay()] + '<i>' + dd.getDate() + '</i></div>';
      var has = n && (n.lockedAt || n.actualSleepAt || n.manual || n.status !== 'pending');
      if (!has) {
        return '<div class="wk-col is-empty"><div class="wk-h">—</div>' +
          '<div class="wk-track"><span class="ph"></span></div>' + lab + '</div>';
      }
      var sleepT = n.actualSleepAt ? hhmmOf(n.actualSleepAt) : n.bed;
      var wakeT = n.actualWakeAt ? hhmmOf(n.actualWakeAt) : n.wake;
      var hrs = durMin(sleepT, wakeT) / 60;
      var pct = clamp(Math.round((hrs / MAXH) * 100), 8, 100);
      var cls = { met: 'is-ok', missed: 'is-bad' }[n.status] || 'is-pend';
      return '<div class="wk-col ' + cls + '">' +
        '<div class="wk-h">' + hrs.toFixed(1) + 'h</div>' +
        '<div class="wk-track"><span style="height:' + pct + '%"></span></div>' + lab + '</div>';
    }).join('');
    $('#wkChart').innerHTML = '<div class="wk-line"><span>8h</span></div>' + bars;

    var activeKey = Store.activeNightKey();
    var allKeys = Object.keys(nights).sort().reverse();
    var list = $('#nightList');
    if (!allKeys.length) {
      list.innerHTML = '<div class="empty">还没有记录</div>';
    } else {
      list.innerHTML = allKeys.map(function (k) {
        var n = nights[k];
        var sleepT = n.actualSleepAt ? hhmmOf(n.actualSleepAt) : n.bed;
        var wakeT = n.actualWakeAt ? hhmmOf(n.actualWakeAt) : n.wake;
        var hrs = durMin(sleepT, wakeT) / 60;
        var tag = { met: '达成', missed: '未达成', pending: '进行中' }[n.status] || '进行中';

        var extra = '';
        if (n.status === 'met' && n.fishDelta > 0) {
          extra += '<div class="ri-extra">🐟 鱼 +' + n.fishDelta + '</div>';
        } else if (n.status === 'missed') {
          extra += '<div class="ri-extra is-bad">鱼缸发灰了，水草蔫了一些</div>';
        }
        if (n.unlocks.length) {
          extra += '<div class="ri-extra is-warn">半夜解锁 ' + n.unlocks.length + ' 次（' +
            n.unlocks.map(function (u) { return hhmmOf(u.at); }).join('、') + '）</div>';
        }
        if (n.lockedAt && n.actualSleepAt && hhmmOf(n.actualSleepAt) !== n.bed) {
          extra += '<div class="ri-extra is-dim">原计划 ' + n.bed + ' 睡，实际 ' + hhmmOf(n.actualSleepAt) + '</div>';
        }
        if (n.status === 'pending') {
          extra += n.lockedAt
            ? '<div class="ri-extra is-dim">还没结算，' + n.wake + ' 起床后自动统计</div>'
            : '<div class="ri-extra is-dim">只是记了一笔，没有锁屏</div>';
        }

        return '<div class="row-item" data-key="' + k + '">' +
          '<div class="ri-top"><span class="ri-date">' + niceDate(k) +
          (k === activeKey ? '<em>今晚</em>' : '') + '</span>' +
          '<span class="ri-tag tag-' + n.status + '">' + tag + '</span></div>' +
          '<div class="ri-mid"><b>' + sleepT + '</b> 睡 · <b>' + wakeT + '</b> 起 · <b>' +
          hrs.toFixed(1) + '</b> 小时</div>' +
          extra +
          (n.note ? '<div class="ri-note">「' + esc(n.note) + '」</div>' : '') +
          '</div>';
      }).join('');
      $$('.row-item', list).forEach(function (el) {
        el.onclick = function () { editNight(el.dataset.key); };
      });
    }

    var ev = Store.db.events.slice(0, 120);
    $('#eventList').innerHTML = ev.length ? ev.map(function (e) {
      var t = new Date(e.at);
      return '<div class="row-item">' +
        '<div class="ri-top"><span class="ri-date">' + (t.getMonth() + 1) + '月' + t.getDate() + '日 ' +
        PAD(t.getHours()) + ':' + PAD(t.getMinutes()) + '</span></div>' +
        '<div class="ri-mid">' + esc(e.text) + '</div></div>';
    }).join('') : '<div class="empty">还没有任何变动记录</div>';
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function editNight(key) {
    var n = Store.db.nights[key];
    var T = window.Store.util;
    var html = '<h2>' + niceDate(key) + ' 这一夜</h2>' +
      '<div class="msub">补上真实入睡/起床时间，档案会据此重新判定。</div>' +
      '<div class="mfield"><label>计划入睡</label><input type="time" id="mBed" class="time-big" value="' + n.bed + '"></div>' +
      '<div class="mfield"><label>真正入睡</label><input type="time" id="mSleep" class="time-big" value="' + (n.actualSleepAt ? hhmmOf(n.actualSleepAt) : '') + '"></div>' +
      '<div class="mfield"><label>真正起床</label><input type="time" id="mWake2" class="time-big" value="' + (n.actualWakeAt ? hhmmOf(n.actualWakeAt) : '') + '"></div>' +
      '<div class="mfield"><label>备注</label><textarea id="mNote" class="ta" rows="2">' + esc(n.note || '') + '</textarea></div>' +
      '<button class="btn btn-primary btn-block" id="mSave">保存并重算</button>' +
      '<button class="btn btn-ghost btn-block" data-modal-close>取消</button>';
    openModal(html, function (box) {
      $('#mSave', box).onclick = function () {
        n.bed = $('#mBed', box).value || n.bed;
        var s = $('#mSleep', box).value, w = $('#mWake2', box).value;
        n.actualSleepAt = s ? T.toISOinNight(key, s) : null;
        n.actualWakeAt = w ? T.toISOinNight(key, w, true) : null;
        n.note = $('#mNote', box).value.slice(0, 120);
        if (n.status !== 'pending') Store.applyResult(n, Store.evaluate(n));
        else Store.save();
        closeModal(); renderLog(); renderTank();
        toast('已更新');
      };
    });
  }

  function addNightModal() {
    var today = new Date();
    var key = Store.nightKeyOf(today);
    if (today.getHours() >= 12) {

      var d = new Date(today); d.setDate(d.getDate() - 1);
      key = Store.nightKeyOf(d);
    }
    var html = '<h2>手动补记</h2>' +
      '<div class="msub">只填时间就够了，日期用归属的「那一夜」。</div>' +
      '<div class="mfield"><label>日期（这一夜属于哪一天）</label><input type="date" id="aDate" class="time-big" style="font-size:20px" value="' + key + '"></div>' +
      '<div class="mfield"><label>真正入睡</label><input type="time" id="aSleep" class="time-big" value="23:30"></div>' +
      '<div class="mfield"><label>真正起床</label><input type="time" id="aWake" class="time-big" value="07:00"></div>' +
      '<div class="mfield"><label>备注</label><textarea id="aNote" class="ta" rows="2" placeholder="比如：加班到很晚 / 半夜醒了两次"></textarea></div>' +
      '<button class="btn btn-primary btn-block" id="aSave">保存</button>' +
      '<button class="btn btn-ghost btn-block" data-modal-close>取消</button>';
    openModal(html, function (box) {
      $('#aSave', box).onclick = function () {
        var date = $('#aDate', box).value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('日期格式不对'); return; }
        Store.importRows([{
          date: date,
          sleepAt: $('#aSleep', box).value,
          wakeAt: $('#aWake', box).value,
          note: $('#aNote', box).value
        }]);
        closeModal(); renderLog(); renderTank();
        toast('已补记');
      };
    });
  }

  function bind() {
    $('#btnDex').onclick = function () { showView('dex'); };
    $('#btnGoodnight').onclick = goodnight;
    $('#btnLog').onclick = function () { showView('log'); };
    $('#btnSettings').onclick = function () { showView('bedtime'); };
    $('#btnLight').onclick = cycleLightMode;
    $$('[data-close]').forEach(function (b) {
      b.onclick = function () { refreshLockState(); if (!$('#view-lock').classList.contains('is-active')) showView('tank'); };
    });

    $('#inpBed').oninput = commitPlan;
    $('#inpWake').oninput = commitPlan;
    $('#inpLead').oninput = commitPlan;
    $('#inpNote').oninput = commitPlan;

    bindUnlock();

    $('#logSeg').onclick = function (e) {
      var b = e.target.closest('.seg-btn');
      if (!b) return;
      $$('.seg-btn', $('#logSeg')).forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      $('#tabNights').hidden = b.dataset.tab !== 'nights';
      $('#tabEvents').hidden = b.dataset.tab !== 'events';
    };

    $('#btnAddNight').onclick = addNightModal;

    $('#modal').addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-modal-close')) closeModal();
    });

    window.addEventListener('beforeunload', function () { Store.save(); });
  }

  function applyDeepLink() {
    try {
      var v = new URLSearchParams(location.search).get('view');
      if (v === 'settings') v = 'bedtime';
      if (v && ['bedtime', 'dex', 'log', 'tank'].indexOf(v) >= 0) showView(v);
      if (new URLSearchParams(location.search).get('debug')) {
        setTimeout(function () {
          var app = $('#app'), sc = $('#view-bedtime .scroll') || $('.scroll'),
              card = sc ? sc.querySelector('.card') : null, b = document.body;
          var d = document.createElement('pre');
          d.id = 'debugbox';
          d.style.cssText = 'position:fixed;top:0;left:0;z-index:999;background:#000;color:#0f0;font-size:11px;padding:4px;white-space:pre';
          d.textContent = [
            'innerW=' + window.innerWidth, 'dpr=' + window.devicePixelRatio,
            'body.scrollW=' + b.scrollWidth,
            'app.offsetW=' + (app ? app.offsetWidth : '-'),
            'app.rectW=' + (app ? Math.round(app.getBoundingClientRect().width) : '-'),
            'scroll.rectW=' + (sc ? Math.round(sc.getBoundingClientRect().width) : '-'),
            'card.rectW=' + (card ? Math.round(card.getBoundingClientRect().width) : '-'),
            'card.scrollW=' + (card ? card.scrollWidth : '-')
          ].join('\n');
          document.body.appendChild(d);
        }, 900);
      }
    } catch (e) { }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); bind(); applyDeepLink(); });
  else { boot(); bind(); applyDeepLink(); }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    });
  }
})();
