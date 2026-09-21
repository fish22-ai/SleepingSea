
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(a) {
    return '#' + a.map(function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }).join('');
  }
  function mix(c1, c2, t) {
    var a = hex2rgb(c1), b = hex2rgb(c2);
    return rgb2hex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }
  function rgba(c, a) { var p = hex2rgb(c); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')'; }
  function shade(c, t) { return mix(c, t >= 0 ? '#ffffff' : '#000000', Math.abs(t)); }
  function grayify(c, t) { return mix(c, '#8c979b', t); }

  function fract(x) { return x - Math.floor(x); }
  function jit(seed, i) { return fract(Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453); }

  function pxEll(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.02) g.fillRect(x, y, 1, 1);
      }
  }

  function G(w, h) { this.w = w; this.h = h; this.a = []; for (var y = 0; y < h; y++) this.a.push(new Array(w).fill(null)); }
  G.prototype.p = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.a[y][x] = c; };
  G.prototype.rect = function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.p(x + i, y + j, c); };
  G.prototype.ell = function (cx, cy, rx, ry, c) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.02) this.p(x, y, c);
      }
  };
  G.prototype.tri = function (x1, y1, x2, y2, x3, y3, c) {
    var nx = Math.floor(Math.min(x1, x2, x3)), xx = Math.ceil(Math.max(x1, x2, x3));
    var ny = Math.floor(Math.min(y1, y2, y3)), xy = Math.ceil(Math.max(y1, y2, y3));
    var d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    if (!d) return;
    for (var y = ny; y <= xy; y++) for (var x = nx; x <= xx; x++) {
      var aa = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
      var bb = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
      if (aa >= -0.03 && bb >= -0.03 && 1 - aa - bb >= -0.03) this.p(x, y, c);
    }
  };
  G.prototype.ln = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx - dy;
    for (var k = 0; k < 500; k++) {
      this.p(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 > -dy) { e -= dy; x0 += sx; }
      if (e2 < dx) { e += dx; y0 += sy; }
    }
  };
  G.prototype.vband = function (cx, cy, rx, ry, x0, w, c) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      var t = (y - cy) / ry, hw = rx * Math.sqrt(Math.max(0, 1 - t * t));
      for (var x = Math.round(x0); x < Math.round(x0) + w; x++) if (Math.abs(x - cx) <= hw) this.p(x, y, c);
    }
  };
  G.prototype.hband = function (cx, cy, rx, ry, y0, h, c) {
    for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      var t = (x - cx) / rx, hh = ry * Math.sqrt(Math.max(0, 1 - t * t));
      for (var y = Math.round(y0); y < Math.round(y0) + h; y++) if (Math.abs(y - cy) <= hh) this.p(x, y, c);
    }
  };
  G.prototype.outline = function (c) {
    var add = [], W = this.w, H = this.h, a = this.a;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (a[y][x] !== null) continue;
      if ((x > 0 && a[y][x - 1]) || (x < W - 1 && a[y][x + 1]) || (y > 0 && a[y - 1][x]) || (y < H - 1 && a[y + 1][x])) add.push([x, y]);
    }
    for (var i = 0; i < add.length; i++) a[add[i][1]][add[i][0]] = c;
  };

  function eyeAt(g, x, y) { g.rect(x, y, 2, 2, '#2a1d14'); g.p(x, y, '#fff8ee'); }

  function fins(g, cx, cy, o) {
    var P = o.P, rx = o.rx, ry = o.ry, tl = o.tail, sp = o.spread, wag = o.wag || 0;
    if (tl) {
      g.tri(cx - rx * 0.8, cy - ry * 0.2, cx - rx - tl, cy - sp + wag, cx - rx - tl * 0.35, cy - sp * 0.06, P.fin);
      g.tri(cx - rx * 0.8, cy + ry * 0.2, cx - rx - tl, cy + sp + wag, cx - rx - tl * 0.35, cy + sp * 0.06, P.fin);
    }
    if (o.dorsal) g.tri(cx - rx * 0.2, cy - ry + 1, cx + rx * 0.24, cy - ry - o.dorsal, cx + rx * 0.64, cy - ry + 1.5, P.fin);
    if (o.anal) g.tri(cx - rx * 0.24, cy + ry - 1, cx + rx * 0.12, cy + ry + o.anal, cx + rx * 0.54, cy + ry - 0.5, P.fin);
    if (o.pect) g.tri(cx + rx * 0.06, cy + ry * 0.3, cx + rx * 0.44, cy + ry * 0.28 + o.pect, cx - rx * 0.06, cy + ry * 0.78, P.fin2 || P.fin);
    g.ell(cx, cy, rx, ry, P.body);
    g.ell(cx, cy - ry * 0.3, rx * 0.86, ry * 0.5, P.light);
    g.ell(cx, cy + ry * 0.56, rx * 0.72, ry * 0.34, P.shade);
    g.p(cx + rx - 1, cy + ry * 0.34, '#3b2a1f');
  }

  var VIS = {};

  VIS.clown = function (g, cx, cy, s, an) {
    var P = { body: '#ee7a2d', light: '#ffb063', shade: '#c85a1c', fin: '#f09040', fin2: '#db7a2a' };
    var rx = 8 * s, ry = 5.4 * s;
    fins(g, cx, cy, { rx: rx, ry: ry, tail: 4.4 * s, spread: 5 * s, dorsal: 3.4 * s, anal: 2.6 * s, pect: 2.6 * s, wag: an.wag * s, P: P });
    [0.62, 0.1, -0.42].forEach(function (q) { g.vband(cx, cy, rx * 1.02, ry * 1.02, cx + rx * q - 1.1 * s, Math.max(1, Math.round(2.2 * s)), '#fdf3e0'); });
    [0.62, 0.1, -0.42].forEach(function (q) { g.vband(cx, cy, rx * 1.02, ry * 1.02, cx + rx * q + 1.1 * s, 1, '#e2cdb2'); });
    eyeAt(g, cx + rx * 0.5, cy - ry * 0.44);
  };

  VIS.neon = function (g, cx, cy, s, an) {
    var P = { body: '#cfd8dd', light: '#eef6fa', shade: '#a9b6bd', fin: '#bfe0f0', fin2: '#9fc9dd' };
    var rx = 7.6 * s, ry = 3.1 * s;
    fins(g, cx, cy, { rx: rx, ry: ry, tail: 3.4 * s, spread: 3.4 * s, dorsal: 1.8 * s, anal: 1.6 * s, pect: 1.6 * s, wag: an.wag * s, P: P });
    g.hband(cx, cy, rx * 1.02, ry * 1.02, cy - ry * 1.04, Math.max(1, Math.round(1.6 * s)), '#3f8fd0');
    g.hband(cx, cy, rx * 1.02, ry * 1.02, cy + ry * 0.4, Math.max(1, Math.round(1.6 * s)), '#e2533c');
    eyeAt(g, cx + rx * 0.52, cy - ry * 0.66);
  };

  VIS.gold = function (g, cx, cy, s, an) {
    var P = { body: '#f2a03c', light: '#ffc977', shade: '#d07c1e', fin: '#f9c884', fin2: '#f0b45f' };
    var rx = 6.4 * s, ry = 6 * s, w = an.wag * s;
    g.tri(cx - rx * 0.7, cy, cx - rx - 5.4 * s, cy - 5.6 * s + w, cx - rx - 2.6 * s, cy - s, P.fin);
    g.tri(cx - rx * 0.7, cy, cx - rx - 5.4 * s, cy + 5.6 * s + w, cx - rx - 2.6 * s, cy + s, P.fin);
    g.tri(cx - rx * 0.5, cy - ry * 0.2, cx - rx - 3 * s, cy - 3.6 * s + w * 0.6, cx - rx - 1.4 * s, cy - 0.6 * s, P.fin2);
    fins(g, cx, cy, { rx: rx, ry: ry, dorsal: 5 * s, anal: 4.4 * s, pect: 3.4 * s, wag: 0, P: P });
    g.ell(cx + rx * 0.36, cy - ry * 0.44, rx * 0.4, ry * 0.2, '#ffe0a8');
    eyeAt(g, cx + rx * 0.44, cy - ry * 0.44);
  };

  VIS.angel = function (g, cx, cy, s, an) {
    var P = { body: '#e6d5ae', light: '#f7efd8', shade: '#c9b183', fin: '#dfc99a', fin2: '#cbb482' };
    var rx = 4.6 * s, ry = 7.6 * s, w = an.wag * s;
    g.tri(cx - rx * 0.1, cy - ry + 2, cx + rx * 0.3, cy - ry - 5.2 * s, cx + rx * 0.75, cy - ry + 3, P.fin);
    g.tri(cx - rx * 0.1, cy + ry - 2, cx + rx * 0.1, cy + ry + 5.2 * s, cx + rx * 0.7, cy + ry - 2, P.fin);
    fins(g, cx, cy, { rx: rx, ry: ry, tail: 3.4 * s, spread: 5 * s, dorsal: 3 * s, anal: 3 * s, pect: 3 * s, wag: w, P: P });
    [-0.45, 0.1, 0.62].forEach(function (q) { g.vband(cx, cy, rx * 1.02, ry * 1.02, cx + rx * q - 0.7 * s, Math.max(1, Math.round(1.4 * s)), '#54503f'); });
    eyeAt(g, cx + rx * 0.4, cy - ry * 0.56);
  };

  VIS.guppy = function (g, cx, cy, s, an) {
    var P = { body: '#8f9ee0', light: '#c3cbf0', shade: '#6d7ac0', fin: '#f2a0c0', fin2: '#f6c46a' };
    var rx = 4.4 * s, ry = 3.1 * s, w = an.wag * s;
    g.tri(cx - rx * 0.6, cy, cx - rx - 6.6 * s, cy - 8.2 * s + w, cx - rx - 2.6 * s, cy - 0.4 * s, '#f2a0c0');
    g.tri(cx - rx * 0.6, cy, cx - rx - 6.6 * s, cy + 8.2 * s + w, cx - rx - 2.6 * s, cy + 0.4 * s, '#f2a0c0');
    g.tri(cx - rx * 0.6, cy, cx - rx - 4.4 * s, cy - 3.4 * s + w * 0.5, cx - rx - 1.4 * s, cy + 0.6 * s, '#f6c46a');
    fins(g, cx, cy, { rx: rx, ry: ry, dorsal: 3 * s, anal: 2.4 * s, pect: 2 * s, wag: 0, P: P });
    [[-5.2, -3.4], [-4.2, 3.2], [-6, 0.4]].forEach(function (q) {
      g.rect(cx + q[0] * s, cy + q[1] * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.2 * s)), '#f8dce8');
    });
    eyeAt(g, cx + rx * 0.5, cy - ry * 0.6);
  };

  VIS.tang = function (g, cx, cy, s, an) {
    var P = { body: '#3366cc', light: '#5b93e6', shade: '#1f4794', fin: '#f2c73f', fin2: '#2b57ab' };
    var rx = 8.2 * s, ry = 5.4 * s;
    fins(g, cx, cy, { rx: rx, ry: ry, tail: 3.8 * s, spread: 4.6 * s, dorsal: 2.2 * s, anal: 2.4 * s, pect: 2.4 * s, wag: an.wag * s, P: P });
    g.ln(cx + rx * 0.15, cy - ry * 0.9, cx - rx * 0.55, cy + ry * 0.3, '#173a72');
    g.ln(cx + rx * 0.2, cy - ry * 0.9, cx - rx * 0.5, cy + ry * 0.2, '#173a72');
    g.ln(cx + rx * 0.28, cy - ry * 0.85, cx - rx * 0.42, cy + ry * 0.05, '#173a72');
    eyeAt(g, cx + rx * 0.56, cy - ry * 0.4);
  };

  VIS.rosey = function (g, cx, cy, s, an) {
    var P = { body: '#ef8fb0', light: '#ffbcd2', shade: '#cf6a8b', fin: '#f7a8c2', fin2: '#e58aa8' };
    var rx = 8 * s, ry = 5.4 * s;
    fins(g, cx, cy, { rx: rx, ry: ry, tail: 4.4 * s, spread: 5 * s, dorsal: 3.4 * s, anal: 2.6 * s, pect: 2.6 * s, wag: an.wag * s, P: P });
    [0.62, 0.1, -0.42].forEach(function (q) { g.vband(cx, cy, rx * 1.02, ry * 1.02, cx + rx * q - 1.1 * s, Math.max(1, Math.round(2.2 * s)), '#fff1f6'); });
    g.hband(cx, cy, rx * 1.02, ry * 1.02, cy - ry * 1.02, Math.max(1, Math.round(1.2 * s)), '#d4537e');
    eyeAt(g, cx + rx * 0.5, cy - ry * 0.44);
  };

  VIS.jelly = function (g, cx, cy, s, an) {
    var bell = '#b8e0f2', rim = '#8fc4e0', core = '#e8566f', tt = '#a8d4ea', glow = '#e6f6ff';
    var R = 7 * s, ph = an.ph;
    g.ell(cx, cy - 2 * s, R, R * 0.9, bell);
    for (var y = 0; y < g.h; y++) for (var x = 0; x < g.w; x++) if (g.a[y][x] === bell && y > cy + 1 * s) g.p(x, y, null);
    g.hband(cx, cy - 2 * s, R, R * 0.9, cy + 0.2 * s, Math.max(1, Math.round(1.4 * s)), rim);
    g.rect(cx - s, cy - 4 * s, Math.max(1, Math.round(2 * s)), Math.max(1, Math.round(3 * s)), core);
    g.rect(cx - 4 * s, cy - 3 * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.2 * s)), core);
    g.rect(cx + 3 * s, cy - 3 * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.2 * s)), core);
    g.rect(cx - 4 * s, cy - 6 * s, Math.max(1, Math.round(1.4 * s)), Math.max(1, Math.round(1.4 * s)), glow);
    g.rect(cx + 2 * s, cy - 7 * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.2 * s)), glow);
    for (var i = 0; i < 7; i++) {
      var t = i / 6 - 0.5;
      var x0 = cx + t * R * 1.5, len = (7 + jit(i * 3.1, 5) * 6) * s;
      for (var k = 0; k < len; k++) {
        var wob = Math.sin(k * 0.42 + i + ph) * 1.3 * s;
        g.p(x0 + wob, cy + 1 * s + k, tt);
      }
    }
  };

  VIS.squid = function (g, cx, cy, s, an) {
    var body = '#e0a3b8', lite = '#f2c2d2', dark = '#bf7f96', fin = '#f2c2d2', spot = '#a2607a', arm = '#d491a8';
    var rx = 6.6 * s, ry = 3.8 * s, ph = an.ph;
    g.tri(cx + rx * 0.55, cy, cx + rx + 2.6 * s, cy - 3.2 * s, cx + rx - 0.6 * s, cy - 0.3 * s, fin);
    g.tri(cx + rx * 0.55, cy, cx + rx + 2.6 * s, cy + 3.2 * s, cx + rx - 0.6 * s, cy + 0.3 * s, fin);
    g.ell(cx + rx * 0.55, cy, rx, ry, body);
    g.ell(cx + rx * 0.7, cy - ry * 0.35, rx * 0.7, ry * 0.42, lite);
    g.ell(cx + rx * 0.5, cy + ry * 0.5, rx * 0.6, ry * 0.3, dark);
    [[0.2, -0.1], [0.5, 0.3], [0.75, -0.25], [0.35, 0.55], [0.9, 0.15], [0.6, -0.5]].forEach(function (q) {
      g.rect(cx + rx * q[0], cy + ry * q[1], Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.2 * s)), spot);
    });
    g.ell(cx - rx * 0.5, cy, 3.4 * s, 3 * s, body);
    g.ell(cx - rx * 0.5, cy - s, 3 * s, 2.4 * s, lite);
    g.rect(cx - rx * 0.75, cy - 1.6 * s, Math.max(2, Math.round(2.2 * s)), Math.max(2, Math.round(2.2 * s)), '#241a12');
    g.p(cx - rx * 0.75, cy - 1.6 * s, '#fff8ee');
    for (var i = 0; i < 5; i++) {
      var y0 = cy - 2.4 * s + i * 1.3 * s, len = (4 + jit(i * 7.7, 3) * 2.5) * s;
      for (var k = 0; k < len; k++) g.p(cx - rx * 0.9 - k, y0 + Math.sin(k * 0.55 + i + ph) * 1.1 * s, arm);
    }
    [cy - 3.4 * s, cy + 3.6 * s].forEach(function (yy, ii) {
      var len = 11 * s;
      for (var k = 0; k < len; k++) g.p(cx - rx * 0.9 - k * 0.85, yy + Math.sin(k * 0.32 + ii * 2 + ph) * 1.1 * s, arm);
      g.rect(cx - rx * 0.9 - len * 0.85, yy - 0.4 * s, Math.max(1, Math.round(1.4 * s)), Math.max(1, Math.round(1.4 * s)), '#c07f96');
    });
  };

  VIS.seahorse = function (g, cx, cy, s, an) {
    var body = '#f0a03c', lite = '#ffc977', dark = '#cf7c1e', belly = '#f8d79a', fin = '#9fd8d0';
    g.rect(cx - 6 * s, cy - 10.4 * s, 5 * s, Math.max(1, Math.round(1.4 * s)), body);
    g.ell(cx + 0.6 * s, cy - 9.4 * s, 3.2 * s, 2.8 * s, body);
    g.ell(cx + 1.2 * s, cy - 10.2 * s, 2.2 * s, 1.8 * s, lite);
    g.rect(cx - 1.2 * s, cy - 12.6 * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.6 * s)), dark);
    g.rect(cx + 1.2 * s, cy - 13 * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.8 * s)), dark);
    g.rect(cx + 3.4 * s, cy - 12 * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.4 * s)), dark);
    g.rect(cx + 0.6 * s, cy - 10 * s, 2, 2, '#241a12'); g.p(cx + 0.6 * s, cy - 10 * s, '#fff8ee');
    g.ell(cx + 0.4 * s, cy - 5.6 * s, 2.2 * s, 2.4 * s, body);
    g.ell(cx + 1 * s, cy + 1.4 * s, 3.6 * s, 4.6 * s, body);
    g.ell(cx + 2 * s, cy + 1.8 * s, 2.4 * s, 3.6 * s, lite);
    g.ell(cx - 0.4 * s, cy + 2.2 * s, 1.6 * s, 3.4 * s, belly);
    var fw = Math.sin(an.ph) * 0.8;
    g.tri(cx + 3.4 * s, cy + 0.6 * s, cx + 5.6 * s, cy - 1.4 * s + fw, cx + 5.6 * s, cy + 3 * s + fw, fin);
    for (var i = 0; i < 5; i++) g.rect(cx + 0.2 * s, cy - 2 * s + i * 1.8 * s, Math.max(1, Math.round(1.6 * s)), 1, dark);
    var pts = [[3.4, 6.4], [3.6, 7.6], [3, 8.8], [1.8, 9.6], [0.4, 9.8], [-0.8, 9.2], [-1.4, 8], [-0.8, 7], [0.4, 6.8], [1, 7.6]];
    for (var k = 0; k < pts.length; k++) g.ell(cx + pts[k][0] * s, cy + pts[k][1] * s, 1.2 * s, 1.2 * s, body);
    for (var k2 = 0; k2 < pts.length - 1; k2++) g.ln(cx + pts[k2][0] * s, cy + pts[k2][1] * s, cx + pts[k2 + 1][0] * s, cy + pts[k2 + 1][1] * s, body);
  };

  VIS.puffer = function (g, cx, cy, s, an) {
    var body = '#f2d06a', lite = '#ffe79a', dark = '#d0a83c', spike = '#a8842c';
    var R = 6.4 * s;
    g.ell(cx, cy, R, R, body);
    g.ell(cx - R * 0.15, cy - R * 0.35, R * 0.7, R * 0.5, lite);
    g.ell(cx + R * 0.1, cy + R * 0.5, R * 0.7, R * 0.4, dark);
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * TAU + (an.wag > 0 ? 0.1 : 0);
      g.ln(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85, cx + Math.cos(a) * R * 1.24, cy + Math.sin(a) * R * 1.24, spike);
    }
    g.tri(cx + R * 0.6, cy, cx + R + 3 * s, cy - 2.6 * s + an.wag * s, cx + R + 3 * s, cy + 2.6 * s + an.wag * s, lite);
    g.tri(cx - R * 0.5, cy + R * 0.2, cx - R * 0.9, cy + R * 1.5, cx - R * 0.1, cy + R * 0.9, dark);
    eyeAt(g, cx + R * 0.3, cy - R * 0.45);
    g.rect(cx + R * 0.72, cy + R * 0.2, Math.max(1, Math.round(1.4 * s)), Math.max(1, Math.round(1.4 * s)), '#8a5a2a');
  };

  VIS.octo = function (g, cx, cy, s, an) {
    var body = '#c07ad8', lite = '#dda3ef', dark = '#8f4fa8', sucker = '#f6e2fb';
    var R = 6.4 * s, top = cy - 3 * s, ph = an.ph;
    g.ell(cx, top, R, R * 0.95, body);
    for (var y = 0; y < g.h; y++) for (var x = 0; x < g.w; x++) if (g.a[y][x] === body && y > cy - 1.2 * s) g.p(x, y, null);
    g.ell(cx - R * 0.3, top - R * 0.3, R * 0.5, R * 0.4, lite);
    g.rect(cx - 3.6 * s, top - 0.4 * s, Math.max(2, Math.round(2.2 * s)), Math.max(2, Math.round(2.2 * s)), '#241a12');
    g.p(cx - 3.6 * s, top - 0.4 * s, '#fff8ee');
    g.rect(cx + 1.6 * s, top - 0.4 * s, Math.max(2, Math.round(2.2 * s)), Math.max(2, Math.round(2.2 * s)), '#241a12');
    g.p(cx + 1.6 * s, top - 0.4 * s, '#fff8ee');
    for (var i = 0; i < 6; i++) {
      var t = i / 5 - 0.5, x0 = cx + t * R * 1.35, len = (6 + jit(i * 5.3, 7) * 4) * s;
      for (var k = 0; k < len; k++) {
        var wob = Math.sin(k * 0.4 + i * 1.4 + ph) * 1.5 * s;
        g.p(x0 + wob, cy + k, body);
        g.p(x0 + wob + s, cy + k, dark);
        if (k % 3 === 1) g.p(x0 + wob, cy + k, sucker);
      }
    }
    [[-2.6, -4.2], [2.4, -5], [0, -6], [-4, -3], [3.6, -3.4]].forEach(function (q) {
      g.rect(cx + q[0] * s, top + q[1] * s, Math.max(1, Math.round(1.2 * s)), Math.max(1, Math.round(1.2 * s)), dark);
    });
  };

  var OUTC = '#3b2a1f';
  var SPR_CW = 44, SPR_CH = 38, SPR_CX = 22, SPR_CY = 19;
  var spriteCache = {};

  function xform(c, grayQ, night, dull, dim) {
    if (dull) c = grayify(c, 0.62);
    if (grayQ > 0) c = grayify(c, grayQ * 0.72);
    if (night) c = mix(shade(c, -0.26), '#33507a', 0.10);
    if (dim > 0) c = shade(c, -0.20 * dim);
    return c;
  }

  function getSprite(id, s, frame, grayQ, night, dull, dim) {
    dim = dim || 0;
    var key = id + '|' + s + '|' + frame + '|' + grayQ + '|' + (night ? 1 : 0) + '|' + (dull ? 1 : 0) + '|' + dim;
    if (spriteCache[key]) return spriteCache[key];
    var painter = VIS[id] || VIS.clown;
    var g = new G(SPR_CW, SPR_CH);
    var wag = frame === 0 ? -0.85 : 0.85;
    painter(g, SPR_CX, SPR_CY, s, { wag: wag, ph: frame === 0 ? 0 : Math.PI * 0.55 });
    g.outline(OUTC);
    var cv = document.createElement('canvas');
    cv.width = SPR_CW; cv.height = SPR_CH;
    var x = cv.getContext('2d');
    for (var yy = 0; yy < SPR_CH; yy++) for (var xx = 0; xx < SPR_CW; xx++) {
      var c = g.a[yy][xx]; if (!c) continue;
      x.fillStyle = xform(c, grayQ, night, dull, dim);
      x.fillRect(xx, yy, 1, 1);
    }
    spriteCache[key] = cv;
    return cv;
  }

  function Aquarium(canvas, options) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.opt = options || {};
    this.fish = [];
    this.plants = [];
    this.corals = [];
    this.tank = { health: 0.55, gray: 0 };
    this.mood = 'day';
    this.lightsOut = false;
    this.time = 0;
    this.last = 0;
    this.running = false;
    this.bubbles = [];
    this.W = 0; this.H = 0; this.dpr = 1;

    this.px = 4;
    this.gw = 0; this.gh = 0;
    this.gcv = document.createElement('canvas');
    this.g = this.gcv.getContext('2d');
    this.scv = document.createElement('canvas');
    this.s = this.scv.getContext('2d');
    this._sig = '';

    this._onResize = this.resize.bind(this);
    this._loop = this.loop.bind(this);
    global.addEventListener('resize', this._onResize);
    global.addEventListener('orientationchange', this._onResize);
    this.resize();
  }

  Aquarium.prototype.setSpecies = function () {  };

  Aquarium.prototype.resize = function () {
    var cv = this.cv;
    var rect = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var oldW = this.W, oldH = this.H;
    this.W = w; this.H = h; this.dpr = dpr;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    this.px = clamp(Math.round(w / 100), 3, 7);
    this.gw = Math.ceil(w / this.px);
    this.gh = Math.ceil(h / this.px);
    this.gcv.width = this.gw; this.gcv.height = this.gh;
    this.scv.width = this.gw; this.scv.height = this.gh;
    this.sandRow = Math.floor(this.gh * 0.80);
    this.unit = clamp(h / 620, 0.62, 1.35);
    this._sig = '';

    if (oldW && oldH && this.fish.length) {
      var sx = w / oldW, sy = h / oldH;
      this.fish.forEach(function (f) { f.x *= sx; f.y *= sy; });
    }
    var self = this;
    this.fish.forEach(function (f) { self.adopt(f); });
    this.initBubbles();
  };

  Aquarium.prototype.adopt = function (f) {
    if (f.x === undefined || f.x <= 1.0001 && f.y <= 1.0001) {
      f.x = (f.x === undefined ? Math.random() : f.x) * this.W;
      f.y = (f.y === undefined ? Math.random() : f.y) * this.H;
    }
    f.x = clamp(f.x, 30, this.W - 30);
    f.y = clamp(f.y, this.H * 0.10, this.sandY0());
    if (f.angle === undefined) f.angle = Math.random() * TAU;
    if (f.phase === undefined) f.phase = Math.random() * TAU;
    if (f.tailFreq === undefined) f.tailFreq = 2.3 + Math.random() * 1.3;
    if (f.speed === undefined) f.speed = 0.45 + Math.random() * 0.35;
    if (f.size === undefined) f.size = 1;
    if (f.seed === undefined) f.seed = Math.random() * 1000;
  };
  Aquarium.prototype.sandY0 = function () { return this.gh * this.px * 0.80 - 24; };

  Aquarium.prototype.setData = function (data) {
    var self = this;
    this.fish = data.fish || [];
    this.plants = data.plants || [];
    this.corals = data.corals || [];
    this.tank = data.tank || this.tank;
    if (data.mood) this.setMood(data.mood);
    if (data.lightsOut !== undefined) this.setLightsOut(data.lightsOut);
    this.fish.forEach(function (f) { self.adopt(f); });
    this._sig = '';
    return this;
  };

  Aquarium.prototype.setMood = function (m) {
    m = (m === 'night') ? 'night' : 'day';
    if (m === this.mood) return this;
    this.mood = m;
    this._sig = '';
    return this;
  };

  Aquarium.prototype.setLightsOut = function (on) {
    var v = !!on;
    if (v === this.lightsOut) return this;
    this.lightsOut = v;
    this._sig = '';
    return this;
  };

  Aquarium.prototype.initBubbles = function () {
    this.bubbles = [];
    var n = this.W < 480 ? 8 : 12;
    for (var i = 0; i < n; i++) this.bubbles.push(this.newBubble(true));
  };
  Aquarium.prototype.newBubble = function (anywhere) {
    var ghPx = this.gh * this.px;
    return {
      x: (0.06 + Math.random() * 0.88) * this.W,
      y: anywhere ? Math.random() * ghPx * 0.82 : ghPx * 0.82 - Math.random() * 20,
      vy: 7 + Math.random() * 10,
      ph: Math.random() * TAU,
      amp: 2 + Math.random() * 5,
      big: Math.random() > 0.55
    };
  };

  Aquarium.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  };
  Aquarium.prototype.stop = function () { this.running = false; };

  Aquarium.prototype.loop = function (ts) {
    if (!this.running) return;
    var dt = Math.min(0.05, (ts - this.last) / 1000) || 0.016;
    this.last = ts;
    this.time += dt;
    this.step(dt);
    this.draw();
    requestAnimationFrame(this._loop);
  };

  Aquarium.prototype.step = function (dt) {
    var H = this.H, W = this.W;
    var top = H * 0.10, bot = this.sandY0() - 6;
    var night = this.mood === 'night';
    var base = 19 * this.unit;
    var dim = this.lightsOut ? 0.5 : 1;

    for (var i = 0; i < this.fish.length; i++) {
      var f = this.fish[i];
      f.phase += dt * f.tailFreq * 0.62 * (f.dull ? 0.7 : 1);
      f.angle += Math.sin(f.phase * 0.31 + f.seed) * 0.5 * dt;
      f.angle += Math.sin(this.time * 0.17 + f.seed * 1.7) * 0.2 * dt;

      var sp = base * f.speed * (f.dull ? 0.62 : 1) * (night ? 0.72 : 1) * dim;
      f.x += Math.cos(f.angle) * sp * dt;
      f.y += Math.sin(f.angle) * sp * dt * 0.72;

      var m = 32 * this.unit;
      var hit = false;
      if (f.x < m) { f.x = m; f.angle = Math.PI - f.angle; hit = true; }
      else if (f.x > W - m) { f.x = W - m; f.angle = Math.PI - f.angle; hit = true; }
      if (f.y < top) { f.y = top; f.angle = -f.angle; hit = true; }
      else if (f.y > bot) { f.y = bot; f.angle = -f.angle; hit = true; }
      if (hit) f.angle += (Math.random() - 0.5) * 0.34;
      while (f.angle > Math.PI) f.angle -= TAU;
      while (f.angle < -Math.PI) f.angle += TAU;
    }

    for (var b = 0; b < this.bubbles.length; b++) {
      var bb = this.bubbles[b];
      bb.y -= bb.vy * dt * (night ? 0.75 : 1) * (this.lightsOut ? 0.7 : 1);
      bb.ph += dt * 2.2;
      if (bb.y < -8) this.bubbles[b] = this.newBubble(false);
    }
  };

  var PAL_DAY = {
    water: ['#8ad8cf', '#75c6c0', '#65b6b1', '#55a3a2', '#458f95', '#2f6b7a'],
    sand: '#f0dcae', sandTop: '#fff4cc', sandDot: '#d3b478', sandMound: '#e6cd97',
    grass: '#63b544', grassHi: '#a3e06a', grassDark: '#3f8a36',
    moss: '#5fb44a', mossLite: '#93dd6e', mossDark: '#3d7a34',
    weed: '#46b761', weed2: '#86d873',
    tube: '#e0662e', tubeRim: '#f79a58', tubeHole: '#7e3413',
    coral: '#d94f3a', coralHi: '#f2765a',
    brain: '#d85a7f', fan: '#e8926f', blueCoral: '#4f8fd0',
    purple: '#9a6fc0', star: '#e8924a',
    stone: '#9aa2ae', stoneDark: '#71798a',
    bubble: '#dff6f8', line: '#eafaff',
    sun: '#fff2bd'
  };
  var PAL_NIGHT = {
    water: ['#2e5b7a', '#28506e', '#224563', '#1c3a57', '#162f48', '#0f2434'],
    sand: '#8d92a2', sandTop: '#a9afbe', sandDot: '#666c7e', sandMound: '#7f8494',
    grass: '#2f6a4a', grassHi: '#519c6b', grassDark: '#1d4433',
    moss: '#2e7350', mossLite: '#4fa06d', mossDark: '#1c4a33',
    weed: '#2f8a63', weed2: '#4fb07e',
    tube: '#8f4630', tubeRim: '#b5663f', tubeHole: '#3a1c0c',
    coral: '#a03a3a', coralHi: '#c25a52',
    brain: '#9b4a66', fan: '#a86a55', blueCoral: '#3d6aa8',
    purple: '#6f5290', star: '#a86a3a',
    stone: '#6d7484', stoneDark: '#4e5566',
    bubble: '#bfe4f2', line: '#d8f2ff',
    sun: '#8fc4e8'
  };

  function mapPal(P, fn) {
    for (var k in P) P[k] = (k === 'water') ? P[k].map(fn) : fn(P[k]);
    return P;
  }

  Aquarium.prototype.buildPal = function (gray, night, dim) {
    var health = clamp(this.tank.health || 0.5, 0, 1);
    var base = night ? PAL_NIGHT : PAL_DAY;
    var P = {};
    for (var k in base) P[k] = base[k];

    var fade = (1 - health) * 0.45;
    if (fade > 0) mapPal(P, function (c) { return grayify(c, fade); });
    if (gray > 0) mapPal(P, function (c) { return grayify(c, gray * 0.6); });
    if (dim > 0) mapPal(P, function (c) { return shade(c, -0.22 * dim); });
    return P;
  };

  Aquarium.prototype.buildStatic = function (P) {
    var gw = this.gw, gh = this.gh, g = this.s;
    var sandRow = this.sandRow;
    var self = this;
    g.clearRect(0, 0, gw, gh);

    var bands = P.water, bh = Math.ceil(gh / bands.length);
    for (var bi = 0; bi < bands.length; bi++) {
      var y0 = bi * bh, y1 = Math.min(gh, y0 + bh);
      g.fillStyle = bands[bi];
      g.fillRect(0, y0, gw, y1 - y0);
      if (bi > 0) {
        g.fillStyle = bands[bi];
        for (var dx = 0; dx < gw; dx++) {
          if (jit(91 + bi, dx) > 0.5) g.fillRect(dx, y0 - 1, 1, 1);
          if (jit(131 + bi, dx) > 0.78) g.fillRect(dx, y0 - 2, 1, 1);
        }
      }
    }

    g.fillStyle = P.sand;
    g.fillRect(0, sandRow, gw, gh - sandRow);
    g.fillStyle = P.sandTop;
    g.fillRect(0, sandRow, gw, 1);
    g.fillStyle = P.sandDot;
    for (var i = 0; i < gw * 0.4; i++) {
      var sx = Math.floor(jit(31, i) * gw);
      var sy = sandRow + 2 + Math.floor(jit(37, i) * Math.max(1, gh - sandRow - 2));
      g.fillRect(sx, sy, 1, 1);
    }

    var health = clamp(this.tank.health || 0.5, 0, 1);

    var grassMax = 1 + Math.round(health * 4);
    var gTop = [];
    for (var gx = 0; gx < gw; gx++) {
      var wv = Math.sin(gx * 0.085 + 1.3) * 0.55 + Math.sin(gx * 0.19 + 4.1) * 0.3 + Math.sin(gx * 0.041 + 2.4) * 0.5;
      var ghh = Math.max(0, Math.round((0.8 + wv) * grassMax * 0.9));
      for (var gk = 0; gk < ghh; gk++) {
        g.fillStyle = gk >= ghh - 1 ? P.grassHi : (gk > ghh * 0.5 ? P.grass : P.grassDark);
        g.fillRect(gx, sandRow - 1 - gk, 1, 1);
      }
      gTop[gx] = sandRow - 1 - ghh;
    }

    for (var wx = 0; wx < gw; wx += 2) {
      var b0 = gTop[wx];
      var sh1 = Math.round(2 + jit(301, wx) * 7 * (0.45 + health * 0.85));
      var sway0 = Math.round(jit(311, wx) * 2 - 1);
      for (var wk = 0; wk < sh1; wk++) {
        g.fillStyle = wk >= sh1 - 2 ? P.weed2 : (wk > sh1 * 0.45 ? P.weed : P.grassDark);
        g.fillRect(wx + sway0 + Math.round(wk * 0.12), b0 - wk, 1, 1);
      }
      if (jit(317, wx) > 0.72) {
        var sh2 = Math.round(3 + jit(331, wx) * 9 * (0.4 + health * 0.9));
        for (var wk2 = 0; wk2 < sh2; wk2++) {
          g.fillStyle = wk2 >= sh2 - 2 ? P.weed : P.grassDark;
          g.fillRect(wx + 1 + Math.round(wk2 * 0.16), b0 - 1 - wk2, 1, 1);
        }
      }
    }

    [[0.155, 8.5], [0.52, 10], [0.87, 7]].forEach(function (mb, mi) {
      var r = Math.max(3, Math.round(mb[1] * (0.55 + health * 0.6)));
      var bx = Math.round(gw * mb[0]);
      var cy = sandRow - 1 - Math.round(r * 0.72);
      pxEll(g, bx, cy, r, r, P.mossDark);
      pxEll(g, bx - r * 0.08, cy - r * 0.14, r * 0.9, r * 0.86, P.moss);
      pxEll(g, bx - r * 0.3, cy - r * 0.38, r * 0.46, r * 0.4, P.mossLite);
      for (var mi2 = 0; mi2 < 8; mi2++) {
        var a2 = mi2 / 8 * TAU + jit(151 + mi, mi2) * 0.5;
        g.fillStyle = jit(157 + mi, mi2) > 0.5 ? P.mossLite : P.mossDark;
        g.fillRect(Math.round(bx + Math.cos(a2) * r * 0.86), Math.round(cy + Math.sin(a2) * r * 0.86), 1, 1);
      }
    });

    [0.055, 0.955].forEach(function (ux, si) {
      var bx = Math.round(gw * ux);
      var dir = si === 0 ? 1 : -1;
      for (var mx = -4; mx <= 4; mx++) {
        var mh = Math.max(0, 2 - Math.abs(mx) * 0.5);
        for (var my = 0; my <= mh; my++) {
          g.fillStyle = my === 0 ? P.grassDark : (my >= mh ? P.grassHi : P.grass);
          g.fillRect(bx + mx * dir, sandRow - 1 - my, 1, 1);
        }
      }
      var n = 3 + Math.round(health * 2 + jit(77, si));
      for (var ti = 0; ti < n; ti++) {
        var th = Math.round((5 + jit(81 + si * 9, ti) * 8) * (0.45 + health * 0.75));
        var tx = bx + Math.round((ti - (n - 1) / 2) * 3 * dir) + (si === 0 ? 2 : -2);
        if (tx < 1 || tx > gw - 3) continue;
        for (var k = 0; k < th; k++) {
          g.fillStyle = k < 2 ? P.tubeRim : P.tube;
          g.fillRect(tx, sandRow - 2 - k, 2, 1);
        }
        g.fillStyle = P.tubeHole;
        g.fillRect(tx, sandRow - 2 - th, 2, 1);
      }
    });

    [[0.30, 0], [0.74, 1]].forEach(function (cb, ci) {
      var bx = Math.round(gw * cb[0]);
      var stemH = 4 + Math.round(jit(203 + ci, 1) * 5 * (0.5 + health * 0.7));
      for (var k2 = 0; k2 < stemH; k2++) {
        g.fillStyle = k2 % 3 === 0 ? P.coralHi : P.coral;
        g.fillRect(bx, sandRow - 1 - k2, 1, 1);
      }
      for (var i = 0; i < 4; i++) {
        var y0 = sandRow - 2 - i * 2 - Math.round(jit(211 + ci, i) * 2);
        var d = (i % 2 === 0) ? 1 : -1;
        var len = 2 + Math.round(jit(223 + ci, i) * 3);
        for (var j = 1; j <= len; j++) {
          g.fillStyle = j >= len - 1 ? P.coralHi : P.coral;
          g.fillRect(bx + d * j, y0 - Math.round(j * 0.75), 1, 1);
        }
      }
      g.fillStyle = P.coralHi;
      g.fillRect(bx - 2, sandRow - 2 - stemH, 1, 1);
      g.fillRect(bx + 2, sandRow - 3 - stemH, 1, 1);
    });

    [0.42, 0.90].forEach(function (u, i) {
      var bx3 = Math.floor(gw * u), ch2 = 2 + Math.round(health * 3);
      for (var k3 = 0; k3 < ch2; k3++) {
        g.fillStyle = P.purple;
        g.fillRect(bx3, sandRow - 2 - k3, 1, 1);
        g.fillRect(bx3 + 2, sandRow - 1 - k3, 1, 1);
      }
    });
    var stx = Math.floor(gw * 0.50);
    g.fillStyle = P.star;
    g.fillRect(stx, sandRow + 3, 3, 1);
    g.fillRect(stx + 1, sandRow + 2, 1, 3);
    g.fillRect(stx + 1, sandRow + 4, 1, 1);
  };

  Aquarium.prototype.draw = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var gray = clamp(this.tank.gray || 0, 0, 1);
    var night = this.mood === 'night';
    var dim = this.lightsOut ? 1 : 0;

    var sig = [Math.round(gray * 40), night ? 1 : 0, dim, Math.round((this.tank.health || 0.5) * 20),
               this.plants.length, this.corals.length].join('|');
    if (sig !== this._sig) {
      this._sig = sig;
      this.buildStatic(this.buildPal(gray, night, dim));
    }
    var P = this.buildPal(gray, night, dim);
    var g = this.g, gw = this.gw, gh = this.gh;
    g.clearRect(0, 0, gw, gh);
    g.drawImage(this.scv, 0, 0);

    this.drawWeeds(g, P, gray, night);
    if (night) this.drawPlankton(g, P);
    else this.drawSunlight(g, P);
    this.drawBubbles(g, P);
    this.drawFishLayer(g, gray, night);
    this.drawSurface(g, P);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.gcv, 0, 0, gw, gh, 0, 0, gw * this.px, gh * this.px);

    this.drawVeil(gray, night);
  };

  Aquarium.prototype.drawSunlight = function (g, P) {
    var gw = this.gw, gh = this.gh, t = this.time;
    var maxY = Math.floor(gh * 0.4);
    g.globalAlpha = 0.26;
    g.fillStyle = P.sun;
    for (var y = 1; y < maxY; y++) {
      var depth = 1 - y / (maxY * 1.1);
      if (depth <= 0.05) continue;
      var ph = y * 0.46;
      for (var x = 0; x < gw; x++) {
        var w = Math.sin(x * 0.13 + t * 0.9 + ph) + Math.sin(x * 0.31 - t * 0.62 + ph * 1.7);
        if (w > 1.45 && jit(401 + y, x) > 0.22 && depth > 0.4) g.fillRect(x, y, 1, 1);
        else if (w > 0.95 && jit(409 + y, x) > 0.82) g.fillRect(x, y, 1, 1);
      }
    }

    for (var i = 0; i < 3; i++) {
      var cx = (0.2 + i * 0.31) * gw + Math.sin(t * 0.12 + i * 1.9) * gw * 0.05;
      var cy = this.sandRow + 2 + i;
      pxEll(g, cx, cy, 4 + i, 1.6, P.sun);
      pxEll(g, cx + 1, cy + 2, 2 + i * 0.5, 1, P.sun);
    }
    g.globalAlpha = 1;
  };

  Aquarium.prototype.drawPlankton = function (g, P) {
    var gw = this.gw, gh = this.gh, t = this.time;
    var span = gh * 0.86;
    for (var i = 0; i < 30; i++) {
      var bx = jit(501, i) * gw;
      var by = (jit(509, i) * span + t * (1.6 + jit(517, i) * 2.6)) % span;
      var tw = Math.sin(t * (1.0 + jit(523, i) * 1.7) + i * 1.3);
      if (tw < -0.15) continue;
      var x = Math.round(bx + Math.sin(t * 0.45 + i) * 2);
      var y = Math.round(by + 4);
      g.fillStyle = (i % 3 === 0) ? P.line : P.bubble;
      g.fillRect(x, y, 1, 1);
      if (tw > 0.8 && (i % 2 === 0)) {
        g.fillStyle = 'rgba(160,235,235,.40)';
        g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1);
      }
    }
  };

  Aquarium.prototype.drawSurface = function (g, P) {
    var gw = this.gw;
    g.fillStyle = P.line;
    for (var x = 0; x < gw; x++) {
      var wob = Math.sin(x * 0.24 + this.time * 1.6) + Math.sin(x * 0.09 - this.time * 0.7);
      if (wob > -0.2) g.fillRect(x, 0, 1, 1);
      if (wob > 0.9) g.fillRect(x, 1, 1, 1);
      if (wob > 1.55) g.fillRect(x, 2, 1, 1);
    }
  };

  Aquarium.prototype.drawWeeds = function (g, P, gray, night) {
    var gw = this.gw, sandRow = this.sandRow;
    var health = clamp(this.tank.health || 0.5, 0, 1);
    var wilted = health < 0.4;
    var main = wilted ? (night ? '#5e6a4a' : '#9a8a52') : P.weed;
    var hi = wilted ? (night ? '#78855c' : '#b8a964') : P.weed2;
    if (gray > 0) { main = grayify(main, gray * 0.6); hi = grayify(hi, gray * 0.6); }
    if (this.lightsOut) { main = shade(main, -0.2); hi = shade(hi, -0.2); }
    for (var i = 0; i < this.plants.length; i++) {
      var p = this.plants[i];
      var growth = clamp(p.growth, 0.05, 1.25);
      var baseH = { kelp: 0.36, weed: 0.24, grass: 0.16, bush: 0.12 }[p.type] || 0.18;
      var h = Math.max(4, Math.round(this.gh * baseH * (0.42 + growth * 0.7) * p.scale));
      var gx = Math.round(p.x * gw);
      var wide = (p.type === 'kelp' || p.type === 'weed') ? 2 : 1;
      for (var seg = 0; seg < h; seg++) {
        var tt = seg / h;
        var sway = Math.round(Math.sin(this.time * 1.2 + p.phase + tt * 2.2) * (1.6 * tt) * (wilted ? 0.5 : 1));
        var yy = sandRow - 1 - seg;
        g.fillStyle = (seg === h - 1) ? hi : main;
        g.fillRect(gx + sway, yy, wide, 1);
        if (seg > 1 && seg < h - 1 && seg % 2 === 0) {
          g.fillStyle = hi;
          g.fillRect(gx + sway + (seg % 4 === 0 ? -1 : wide), yy, 1, 1);
        }
      }
    }
  };

  Aquarium.prototype.drawBubbles = function (g, P) {
    g.fillStyle = P.bubble;
    for (var i = 0; i < this.bubbles.length; i++) {
      var b = this.bubbles[i];
      var x = Math.round((b.x + Math.sin(b.ph) * b.amp) / this.px);
      var y = Math.round(b.y / this.px);
      if (b.big) {
        g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1);
        g.fillRect(x + 2, y + 1, 1, 1); g.fillRect(x + 1, y + 2, 1, 1);
      } else {
        g.fillRect(x, y, 1, 1);
      }
    }
  };

  Aquarium.prototype.drawFishLayer = function (g, gray, night) {
    var list = this.fish.slice().sort(function (a, b) { return (a.size || 1) - (b.size || 1); });
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var isJelly = f.species === 'jelly';
      var sRaw = 0.62 * clamp(f.size || 1, 0.55, 1.35);
      var s = Math.round(sRaw * 50) / 50;
      var frame, grayQ = Math.round(gray * 6) / 6;
      if (isJelly || f.species === 'squid' || f.species === 'octo') {
        frame = Math.floor((this.time * 1.6 + f.seed) / 0.55) % 2;
      } else {
        frame = Math.floor(f.phase * 1.7 / Math.PI) % 2;
      }
      var cv = getSprite(f.species, s, frame, grayQ, night, !!f.dull, this.lightsOut ? 1 : 0);
      var dx = Math.round(f.x / this.px - SPR_CX);
      var dy = Math.round(f.y / this.px - SPR_CY + Math.sin(f.phase * 0.9) * 0.6);
      if (isJelly) {
        var pulse = 0.5 + 0.5 * Math.sin(this.time * 1.7 + f.seed);
        g.fillStyle = night
          ? 'rgba(150,235,240,' + (0.16 + pulse * 0.18).toFixed(3) + ')'
          : 'rgba(225,248,252,.20)';
        var tw = Math.floor(this.time * 2);
        for (var hy = -9; hy <= 9; hy++) for (var hx = -8; hx <= 8; hx++) {
          if (hx * hx * 1.2 + hy * hy > 78) continue;
          if ((hx + hy * 2 + tw) % 4 !== 0) continue;
          g.fillRect(dx + SPR_CX + hx, dy + SPR_CY - 2 + hy, 1, 1);
        }
      }
      var dir = Math.cos(f.angle) >= 0 ? 1 : -1;
      if (dir === 1) {
        g.drawImage(cv, dx, dy);
      } else {
        g.save();
        g.translate(dx + SPR_CW, dy);
        g.scale(-1, 1);
        g.drawImage(cv, 0, 0);
        g.restore();
      }
    }
  };

  Aquarium.prototype.drawVeil = function (gray, night) {
    var ctx = this.ctx, W = this.W, H = this.H;
    if (gray > 0.01) {
      try {
        ctx.save();
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = Math.min(1, gray * 0.95);
        ctx.fillStyle = '#7e8a8f';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      } catch (e) { }
    }

    if (night) {
      ctx.save();
      ctx.fillStyle = this.lightsOut ? 'rgba(3,6,20,.42)' : 'rgba(5,11,28,.24)';
      ctx.fillRect(0, 0, W, H);

      var gr = ctx.createRadialGradient(W * 0.5, -H * 0.18, 0, W * 0.5, -H * 0.18, H * 0.78);
      gr.addColorStop(0, 'rgba(186,222,255,.30)');
      gr.addColorStop(0.42, 'rgba(120,175,225,.11)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);

      var vg = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.16, W / 2, H * 0.44, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, this.lightsOut ? 'rgba(0,0,8,.7)' : 'rgba(0,0,12,.44)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }

    var gd = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    gd.addColorStop(0, 'rgba(255,250,222,.14)');
    gd.addColorStop(1, 'rgba(255,250,222,0)');
    ctx.save();
    ctx.fillStyle = gd;
    ctx.fillRect(0, 0, W, H * 0.55);
    ctx.restore();
  };

  Aquarium.thumbnail = function (canvas, speciesId) {
    var cv = getSprite(speciesId, 0.62, 0, 0, false, false);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cv, 0, 0, SPR_CW, SPR_CH, 0, 0, canvas.width, canvas.height);
  };

  Aquarium.prototype.destroy = function () {
    this.stop();
    global.removeEventListener('resize', this._onResize);
    global.removeEventListener('orientationchange', this._onResize);
  };

  global.Aquarium = Aquarium;
  global.AqColor = { mix: mix, shade: shade, rgba: rgba, grayify: grayify };
})(window);
