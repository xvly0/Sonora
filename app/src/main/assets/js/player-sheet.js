const _hasLetterSpacing = typeof sc !== 'undefined' && sc && ('letterSpacing' in sc);
let SHITS = [], OV_SHITS = [];
const shY = () => (1 - SH.t) * H + SH.drag;
function shit(x, y, w, h, fn, tag, extra) { const o = { x, y: y + shY(), w, h, fn, tag }; if (extra) Object.assign(o, extra); SHITS.push(o); return o; }
function ovShit(x, y, w, h, fn, tag, extra) { const o = { x, y: y + shY(), w, h, fn, tag }; if (extra) Object.assign(o, extra); OV_SHITS.push(o); return o; }
function shLay() {
  const bcy = H - (FRAME ? 58 : 48), vy = bcy - 48, tcy = vy - 94, sy = tcy - 96;
  const alRaw = (SH.mode === 'lyrics' && !SRCUI.open) ? clamp(SH.aloneT || 0, 0, 1) : 0;
  const al = alRaw * alRaw * (3 - 2 * alRaw);
  const L = { bcy, vy, tcy, sy, top: TOP, btnD: 34, alone: al };
  const ty0_art = sy - 62, artMax = ty0_art - 44 - (TOP + 34), as_art = clamp(Math.min(W - 56, artMax), 180, 360), ay_art = TOP + 34 + Math.max(0, (artMax - as_art) / 2);
  const p = SH.modeP != null ? SH.modeP : (SH.mode === 'art' ? 0 : 1);
  const pt = SH.textP != null ? SH.textP : p;
  L.p = p; L.pt = pt; L.as_art = as_art; L.ay_art = ay_art; L.ty0_art = ty0_art;
  L.as = mix(as_art, 56, p);
  L.ax = mix((W - as_art) / 2, 24, p);
  L.ay = mix(ay_art, TOP + 30, p);
  L.ty0 = pt < .5 ? ty0_art : (TOP + 56);
  L.btnY = pt < .5 ? (ty0_art + 8) : (TOP + 54);
  L.btnX = [W - 28 - 17 - 48, W - 28 - 17];
  L.regTop = TOP + 106; L.regBot = Math.round(mix(sy - 30, H - 36, al));
  return L;
}
const _hasLiveOrOffLy = t => Boolean(t && (LIVE.on || (typeof hasOfflineLyrics === 'function' && hasOfflineLyrics(t))));
const lyObjs = t => (_hasLiveOrOffLy(t) && typeof liveLy === 'function') ? liveLy(t).lines : (LYOBJ[t.id] || (LYOBJ[t.id] = LYRICS[h32(t.id) % 3].map(x => ({ text: x }))));
const LYOBJ = {};
const lyricsOf = t => lyObjs(t).map(l => l.text || '♪');
function lyricTimes(t) { if (_hasLiveOrOffLy(t) && typeof liveLy === 'function') { const L = liveLy(t); if (L && L.synced) return L.lines.map(l => l.start); } const n = lyricsOf(t).length, a = 6, b = Math.max(a + 1, t.dur - 10); return lyricsOf(t).map((_, i) => a + i * (b - a) / n); }

function slider(c, x, y, w, f, dragging, col, trackCol) {
  const h = 7; rrPath(c, x, y - h / 2, w, h, h / 2); c.fillStyle = trackCol || 'rgba(255,255,255,.26)'; c.fill();
  if (f > 0) { c.save(); rrPath(c, x, y - h / 2, w, h, h / 2); c.clip(); c.fillStyle = col || 'rgba(255,255,255,.88)'; c.fillRect(x, y - h / 2, w * f, h); c.restore(); }
}

const _SH_INK_CACHE = { srcKey: '', out: null };
function shInk(t, clOpt) {
  const cl = clOpt || ((typeof SH !== 'undefined' && SH.cols) ? SH.cols : (t ? shaderPalette(t) : null));
  const c0 = cl && cl[0];
  if (!c0) {
    return {
      r: 255, g: 255, b: 255, sr: 255, sg: 255, sb: 255,
      hi: '#ffffff', key: '255,255,255', qKey: '31,31,31',
      rgba: (al) => 'rgba(255,255,255,' + al + ')'
    };
  }
  const srcKey = Math.round(c0[0]) + ',' + Math.round(c0[1]) + ',' + Math.round(c0[2]);
  if (_SH_INK_CACHE.srcKey === srcKey && _SH_INK_CACHE.out) return _SH_INK_CACHE.out;
  const [h, s] = rgb2hsl(c0[0], c0[1], c0[2]);
  let r = 255, g = 255, b = 255, sr = 255, sg = 255, sb = 255;
  if (s >= 0.08) {
    const base = hsl2rgb(h, clamp(s * 0.65, 0.28, 0.62), 0.72);
    r = Math.round(mix(255, base[0], 0.13));
    g = Math.round(mix(255, base[1], 0.13));
    b = Math.round(mix(255, base[2], 0.13));
    sr = Math.round(mix(255, base[0], 0.24));
    sg = Math.round(mix(255, base[1], 0.24));
    sb = Math.round(mix(255, base[2], 0.24));
  }
  const out = {
    r, g, b, sr, sg, sb,
    hi: 'rgb(' + r + ',' + g + ',' + b + ')',
    key: r + ',' + g + ',' + b,
    qKey: (sr >> 3) + ',' + (sg >> 3) + ',' + (sb >> 3),
    rgba: (al, soft) => 'rgba(' + (soft ? sr : r) + ',' + (soft ? sg : g) + ',' + (soft ? sb : b) + ',' + al + ')'
  };
  _SH_INK_CACHE.srcKey = srcKey;
  _SH_INK_CACHE.out = out;
  return out;
}
function shTrackAccent(t) {
  t = t || (typeof cur === 'function' ? cur() : null);
  const cl = (typeof SH !== 'undefined' && SH.cols) || (t && typeof shaderPalette === 'function' ? shaderPalette(t) : null);
  const c0 = (cl && cl[0]) ? cl[0] : [250, 46, 73];
  const [bh, bs, bl] = rgb2hsl(c0[0], c0[1], c0[2]);
  const bNeu = bs < .08;
  const trgb = bNeu
    ? hsl2rgb(bh, 0, clamp(bl * 1.45 + .22, .48, .72))
    : hsl2rgb(bh, clamp(bs * 1.15, .48, .95), clamp(bl * 1.2 + .08, .42, .58));
  return 'rgb(' + Math.round(trgb[0]) + ',' + Math.round(trgb[1]) + ',' + Math.round(trgb[2]) + ')';
}
function shDlBadgeCols(t) {
  t = t || (typeof cur === 'function' ? cur() : null);
  const cl = (typeof SH !== 'undefined' && SH.cols) || (t && typeof shaderPalette === 'function' ? shaderPalette(t) : null);
  const c0 = (cl && cl[0]) ? cl[0] : [250, 46, 73];
  const [bh, bs, bl] = rgb2hsl(c0[0], c0[1], c0[2]);
  const bNeu = bs < .08;
  const fillRgb = bNeu
    ? hsl2rgb(bh, 0, clamp(bl * 0.6 + .48, .72, .80))
    : hsl2rgb(bh, clamp(bs * .85, .42, .68), clamp(bl * 1.18 + .12, .66, .74));
  const arrowRgb = bNeu
    ? [34, 34, 38]
    : hsl2rgb(bh, clamp(bs * .40, .18, .36), .18);
  return {
    fill: 'rgb(' + Math.round(fillRgb[0]) + ',' + Math.round(fillRgb[1]) + ',' + Math.round(fillRgb[2]) + ')',
    arrow: 'rgb(' + Math.round(arrowRgb[0]) + ',' + Math.round(arrowRgb[1]) + ',' + Math.round(arrowRgb[2]) + ')'
  };
}

const FLU = { ok: null, cv: null, gl: null, loc: null };
function fluidInit() {
  try {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 340;
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }); if (!gl) throw 0;
    const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R;uniform float uBlur,uInt,uH;uniform vec2 o0,o1,o2,o3,o4;uniform vec3 c0,c1,c2,c3,base;
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<3;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
/* Interpolazione periodica C2 continua (coseno morbido su tutto il ciclo 2*PI):
   elimina completamente il taglio a gradino che fract() creava quando v superava 1.0 -> 0.0 */
vec3 pal(float v){
 float a=v*6.28318530718;
 float w0=pow(max(.5+.5*cos(a),0.),2.2);
 float w1=pow(max(.5+.5*cos(a-1.57079632679),0.),2.2);
 float w2=pow(max(.5+.5*cos(a-3.14159265359),0.),2.2);
 float w3=pow(max(.5+.5*cos(a-4.71238898038),0.),2.2);
 return (c0*w0+c1*w1+c2*w2+c3*w3)/max(.0001,w0+w1+w2+w3);
}
vec3 ok2lin(vec3 c){float l=c.x+.3963377774*c.y+.2158037573*c.z,m=c.x-.1055613458*c.y-.0638541728*c.z,s=c.x-.0894841775*c.y-1.2914855480*c.z;l=l*l*l;m=m*m*m;s=s*s*s;
 return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s);}
vec3 l2s(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){
 vec2 uv=gl_FragCoord.xy/R;float asp=R.x/max(R.y,1.);float sc=mix(2.,.8,uBlur);vec2 p=vec2(uv.x*asp,uv.y)*sc;
 vec2 q=vec2(fbm(p+o0),fbm(p+vec2(5.2,1.3)+o1));
 vec2 r=vec2(fbm(p+2.2*q+vec2(1.7,9.2)+o2),fbm(p+2.2*q+vec2(8.3,2.8)+o3));
 float f=fbm(p+2.*r);
 float v=f*1.85+.35*r.x+uH;
 vec3 lab=pal(v);
 float air=smoothstep(.28,.72,fbm(p*.6-q+13.+o4));
 float fl=mix(.88,.58,base.x);lab.yz*=mix(1.15,1.,base.x);
 lab=mix(base,lab,uInt*mix(fl,1.,air));
 vec3 col=l2s(ok2lin(lab));
 col+=(hash(floor(gl_FragCoord.xy)*1.31)-.5)*.004;
 gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;
    const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw gl.getProgramInfoLog(pr);
    gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const al = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    const L = n => gl.getUniformLocation(pr, n); FLU.loc = { R: L('R'), o: [L('o0'), L('o1'), L('o2'), L('o3'), L('o4')], H: L('uH'), B: L('uBlur'), I: L('uInt'), c: [L('c0'), L('c1'), L('c2'), L('c3')], base: L('base') };
    FLU.cv = cv; FLU.gl = gl; FLU.ok = true;
  } catch (e) { FLU.ok = false; }
}
function rgb2oklab(q) {
  const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, r = f(q[0]), g = f(q[1]), b = f(q[2]);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
const _FLU_C = [new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)], _FLU_BASE = new Float32Array(3);
let _FLU_COLS = null, _fluCacheCv = null, _fluCacheCtx = null, _fluLastPh = NaN, _fluLastW = 0, _fluLastH = 0;
function fluidPaint(c, cl, ph, w, h) {
  if (FLU.ok === null) fluidInit(); if (!FLU.ok) return false;
  const gl = FLU.gl, cv = FLU.cv, L = FLU.loc, ch = Math.round(160 * h / w);
  if (cv.height !== ch) cv.height = ch;
  let colsDirty = !_FLU_COLS || _FLU_COLS.length !== cl.length;
  if (!colsDirty) {
    for (let i = 0; i < cl.length; i++) {
      if (_FLU_COLS[i][0] !== cl[i][0] || _FLU_COLS[i][1] !== cl[i][1] || _FLU_COLS[i][2] !== cl[i][2]) { colsDirty = true; break; }
    }
  }
  const samePh = !colsDirty && _fluCacheCv && _fluLastW === cv.width && _fluLastH === cv.height && Math.abs(ph - _fluLastPh) < 1e-5;
  if (samePh) {
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(_fluCacheCv, 0, 0, w, h);
    return true;
  }
  if (colsDirty) {
    _FLU_COLS = cl.map(q => [q[0], q[1], q[2]]);
    const [bh, bs] = rgb2hsl(cl[0][0], cl[0][1], cl[0][2]);
    const bCol = hsl2rgb(bh, clamp(bs * .55, .15, .55), .16);
    for (let i = 0; i < 4; i++) {
      const ok = rgb2oklab(cl[i % cl.length]);
      _FLU_C[i][0] = ok[0]; _FLU_C[i][1] = ok[1]; _FLU_C[i][2] = ok[2];
    }
    const ob = rgb2oklab(bCol);
    _FLU_BASE[0] = ob[0]; _FLU_BASE[1] = ob[1]; _FLU_BASE[2] = ob[2];
  }
  gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(L.R, cv.width, cv.height); /* keep time out of the shader as an unbounded float so mobile GPUs do not lose cos()/hash() precision; wrap bounded offsets in JS */
  const t = ph * 1.9, TAU = Math.PI * 2, ORB = 2.5;
  const orbU = (loc, spd, p0) => { const a = (((t * spd / ORB + p0) % TAU) + TAU) % TAU; gl.uniform2f(loc, ORB * Math.cos(a), ORB * Math.sin(a)); };
  orbU(L.o[0], .12, 0); orbU(L.o[1], .10, 1.3); orbU(L.o[2], .07, 2.1); orbU(L.o[3], .06, 3.4); orbU(L.o[4], .03, 4.2);
  gl.uniform1f(L.H, (((.02 * t) % 1) + 1) % 1); gl.uniform1f(L.B, .55); gl.uniform1f(L.I, .95);
  for (let i = 0; i < 4; i++) gl.uniform3fv(L.c[i], _FLU_C[i]);
  gl.uniform3fv(L.base, _FLU_BASE);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (!_fluCacheCv) { _fluCacheCv = document.createElement('canvas'); _fluCacheCtx = _fluCacheCv.getContext('2d'); }
  if (_fluCacheCv.width !== cv.width || _fluCacheCv.height !== cv.height) { _fluCacheCv.width = cv.width; _fluCacheCv.height = cv.height; }
  _fluCacheCtx.drawImage(cv, 0, 0);
  _fluLastPh = ph; _fluLastW = cv.width; _fluLastH = cv.height;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(_fluCacheCv, 0, 0, w, h);
  return true;
}

let _shGrad = null, _shGradH = -1, _shGradCtx = null;
let _artShadCv = null, _artShadCtx = null, _artShadKey = '', _artShadPad = 0, _artShadLw = 0, _artShadLh = 0;

function drawSheet(c) {
  SH.lyStyleBtns = null;
  if (SH.t < .002 && !SH.drag) return; const t = cur(), oy = shY(), L = shLay(), H0 = albumOf(t).hue, K = SH.t;
  SHITS = []; c.save(); c.translate(0, oy);
  const rad = 46 * (1 - clamp((SH.t - .9) / .1, 0, 1)); rrPath(c, 0, 0, W, H + 80, rad); c.clip();
  const cl = SH.cols || shaderPalette(t), ph = SH.phase, rgba = (q, al) => 'rgba(' + (q[0] | 0) + ',' + (q[1] | 0) + ',' + (q[2] | 0) + ',' + al + ')';
  const dark = cl.reduce((m, q) => (q[0] + q[1] + q[2] < m[0] + m[1] + m[2] ? q : m), cl[0]);
  const cutCol = rgba([dark[0] * .28, dark[1] * .28, dark[2] * .28], .96);
  c.fillStyle = rgba([dark[0] * .32, dark[1] * .32, dark[2] * .32], 1); c.fillRect(0, 0, W, H + 80);
  if (!fluidPaint(c, cl, ph, W, H + 80)) {
    const R = Math.max(W, H);
    cl.forEach((q, i) => {
      const a1 = ph * (.55 + i * .13) + i * 1.9, a2 = ph * (.42 + i * .11) + i * 2.7, bx = W * (.5 + .52 * Math.sin(a1)), by = H * (.5 + .46 * Math.cos(a2)), br = R * (.5 + .14 * Math.sin(ph * .7 + i));
      const g = c.createRadialGradient(bx, by, 0, bx, by, br); g.addColorStop(0, rgba(q, .92)); g.addColorStop(.55, rgba(q, .42)); g.addColorStop(1, rgba(q, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H + 80);
    });
  }
  if (!_shGrad || _shGradH !== H || _shGradCtx !== c) {
    _shGradH = H; _shGradCtx = c;
    _shGrad = c.createLinearGradient(0, 0, 0, H); _shGrad.addColorStop(0, 'rgba(0,0,0,.08)'); _shGrad.addColorStop(1, 'rgba(0,0,0,.24)');
  }
  c.fillStyle = _shGrad; c.fillRect(0, 0, W, H + 80);
  const ink = shInk(t, cl);
  const white = ink.rgba(.96), dim = ink.rgba(.66, true), dimSub = ink.rgba(.56, true);
  rrPath(c, W / 2 - 20, TOP - 8, 40, 5, 2.5); c.fillStyle = ink.rgba(.38, true); c.fill();
  const drawEx = (tx, ty, shown, font) => {
    if (!t.ex) return;
    c.font = font; const tw = c.measureText(shown).width, bx = tx + tw + 7, by = ty - 15;
    rrPath(c, bx, by, 15.5, 15.5, 3.5); c.fillStyle = ink.rgba(.58, true); c.fill();
    txt(c, 'E', bx + 7.75, by + 11.4, F(800, 10), cutCol, 'center');
  };
  const p = clamp(L.p, 0, 1);
  const sc = SH.pk || .82;
  const s0 = L.as_art * sc, x0 = (W - s0) / 2, y0 = L.ay_art + (L.as_art - s0) / 2, r0 = 16 * sc;
  const s1 = 56, x1 = 24, y1 = TOP + 30, r1 = 9;
  const curS = mix(s0, s1, p), curX = mix(x0, x1, p), curY = mix(y0, y1, p), curR = mix(r0, r1, p);
  if (p < .98) {
    const shK = clamp((sc - .82) / .18, 0, 1.2), shA = (.24 + .26 * shK) * (1 - p);
    if (shA > .01) {
      const shAStr = (.24 + .26 * shK).toFixed(2);
      const blur = 20 + 24 * shK, offY = 9 + 13 * shK;
      const dpr = Math.max(1, (typeof S !== 'undefined' && W) ? S.width / W : 1);
      const qS = Math.round(s0 * 2) / 2, qR = Math.round(r0 * 2) / 2, qB = Math.round(blur * 2) / 2, qY = Math.round(offY * 2) / 2;
      const key = shAStr + '|' + qS + '|' + qR + '|' + qB + '|' + qY + '|' + dpr.toFixed(2);
      if (!_artShadCv) { _artShadCv = document.createElement('canvas'); _artShadCtx = _artShadCv.getContext('2d'); }
      if (_artShadKey !== key) {
        _artShadKey = key;
        const pad = Math.ceil(qB * 1.6 + Math.abs(qY) + 4);
        const lw = Math.ceil(qS + pad * 2), lh = Math.ceil(qS + pad * 2);
        const pw = Math.max(1, Math.ceil(lw * dpr)), ph2 = Math.max(1, Math.ceil(lh * dpr));
        if (_artShadCv.width !== pw) _artShadCv.width = pw;
        if (_artShadCv.height !== ph2) _artShadCv.height = ph2;
        _artShadPad = pad; _artShadLw = lw; _artShadLh = lh;
        const ctx = _artShadCtx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, lw, lh);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,' + shAStr + ')';
        ctx.shadowBlur = qB;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = qY;
        rrPath(ctx, pad, pad, qS, qS, qR);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
      }
      const scaleSh = curS / Math.max(1, qS);
      c.save();
      c.globalAlpha *= (1 - p);
      c.drawImage(_artShadCv, curX - _artShadPad * scaleSh, curY - _artShadPad * scaleSh, _artShadLw * scaleSh, _artShadLh * scaleSh);
      c.restore();
    }
  }
  if (SH.t > 0.05 && t && !t.user) {
    const alb = typeof albumOf === 'function' ? albumOf(t) : null;
    if (typeof t.thumb === 'string' && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(t.thumb) && /[?&]s=(?:288|544)\b/.test(t.thumb)) {
      const hi = typeof appleThumbAtSize === 'function' ? appleThumbAtSize(t.thumb, 1200) : t.thumb.replace(/([?&])s=(?:288|544)\b/, '$1s=1200');
      t.thumb = hi;
      if (t.id && typeof LIVE !== 'undefined' && LIVE.known && LIVE.known[t.id] && LIVE.known[t.id] !== t) {
        LIVE.known[t.id].thumb = hi;
      }
    }
    if (alb && alb !== t && !alb.user && typeof alb.thumb === 'string' && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(alb.thumb) && /[?&]s=(?:288|544)\b/.test(alb.thumb)) {
      const hiAlb = typeof appleThumbAtSize === 'function' ? appleThumbAtSize(alb.thumb, 1200) : alb.thumb.replace(/([?&])s=(?:288|544)\b/, '$1s=1200');
      alb.thumb = hiAlb;
      if (alb.id && typeof BYID !== 'undefined' && BYID[alb.id] && BYID[alb.id] !== alb) {
        BYID[alb.id].thumb = hiAlb;
      }
    }
    const curItem = alb || t;
    const curUrl = (curItem && curItem.thumb) || t.thumb;
    const artCur = (curItem && curItem.id && typeof ARTC !== 'undefined' && ARTC[curItem.id]) || (t.id && typeof ARTC !== 'undefined' && ARTC[t.id]);
    if (artCur && artCur._real && artCur.width > 0 && artCur.width < 720 && curUrl &&
        artCur._url === curUrl && !curItem._sheetHiResUpgraded &&
        typeof _covUrl !== 'undefined' && typeof liveCover === 'function') {
      curItem._sheetHiResUpgraded = true;
      delete _covUrl[curUrl];
      if (typeof _covLru !== 'undefined') _covLru.delete(curUrl);
      liveCover(curItem, curItem.id || t.id, true);
    }
  }
  drawArt(c, t, curX, curY, curS, curR);

  const pt = clamp(L.pt != null ? L.pt : p, 0, 1);
  const a0 = clamp(1 - pt * 1.5, 0, 1), a1 = clamp((pt - .25) * 1.35, 0, 1);
  if (a0 > .01) {
    const dy0 = pt * 14, mwT0 = L.btnX[0] - 28 - 26 - (t.ex ? 24 : 0), mwA0 = L.btnX[0] - 28 - 22;
    c.save(); c.globalAlpha = a0;
    const shownT0 = txt(c, t.title, 28, L.ty0_art + dy0, F(700, 21), white, 'left', mwT0);
    drawEx(28, L.ty0_art + dy0, shownT0, F(700, 21));
    const shownA0 = txt(c, subOfTrack(t), 28, L.ty0_art + 23 + dy0, F(400, 19.5), dim, 'left', mwA0);
    if (pt < .5) {
      c.font = F(400, 19.5);
      const aw0 = Math.max(80, Math.min(mwA0, c.measureText(shownA0).width + 20));
      shit(20, L.ty0_art + 4 + dy0, aw0, 28, () => openTrackArtist(t));
    }
    c.restore();
  }
  if (a1 > .01) {
    const dy1 = (1 - a1) * -16, mwT1 = L.btnX[0] - 92 - 24 - (t.ex ? 24 : 0), mwA1 = L.btnX[0] - 92 - 20;
    c.save(); c.globalAlpha = a1;
    const shownT1 = txt(c, t.title, 92, TOP + 52 + dy1, F(600, 18), white, 'left', mwT1);
    drawEx(92, TOP + 52 + dy1, shownT1, F(600, 18));
    const shownA1 = txt(c, subOfTrack(t), 92, TOP + 71 + dy1, F(400, 18), dim, 'left', mwA1);
    if (pt >= .5) {
      c.font = F(400, 18);
      const aw1 = Math.max(80, Math.min(mwA1, c.measureText(shownA1).width + 20));
      shit(86, TOP + 54 + dy1, aw1, 26, () => openTrackArtist(t));
    }
    c.restore();
  }

  if (p > .6) shit(16, TOP + 20, 68, 68, () => setSheetMode('art'));

  const fadeAlpha = clamp((p - .15) / .85, 0, 1);
  if (fadeAlpha > .01) {
    const sk = clamp(SRCUI.t || 0, 0, 1), skE = sk * sk * (3 - 2 * sk);
    const drawLySlot = (al, hitOn) => {
      if (skE < .99) drawLyrics(c, t, L, al * (1 - skE), hitOn && !SRCUI.open);
      else if (typeof window !== 'undefined') window._lyIntroActive = false;
      if (skE > .01) drawSrcPicker(c, t, L, al * skE, hitOn && SRCUI.open);
    };
    const isCross = (SH.mode === 'queue' && SH.fromMode === 'lyrics') || (SH.mode === 'lyrics' && SH.fromMode === 'queue');
    if (isCross) {
      const qP = clamp(SH.qModeP != null ? SH.qModeP : (SH.mode === 'queue' ? 1 : 0), 0, 1);
      if (qP < .99) drawLySlot(fadeAlpha * (1 - qP), SH.mode === 'lyrics');
      else if (typeof window !== 'undefined') window._lyIntroActive = false;
      if (qP > .01) drawQueue(c, L, fadeAlpha * qP);
    } else {
      const showQueue = (SH.mode === 'queue') || (SH.mode === 'art' && SH.fromMode === 'queue');
      if (showQueue) {
        if (typeof window !== 'undefined') window._lyIntroActive = false;
        drawQueue(c, L, fadeAlpha);
      } else {
        drawLySlot(fadeAlpha, SH.mode === 'lyrics');
      }
    }
  } else if (typeof window !== 'undefined') {
    window._lyIntroActive = false;
  }
  const al = L.alone || 0, ctrlA = (1 - al) * (1 - al), ctrlInteractive = al < .45;
  if (ctrlA > .005) {
    c.save();
    c.globalAlpha *= ctrlA;
    c.translate(0, al * 40);
    const dur = t.dur, f = SH.scrub != null ? SH.scrub : PL.pos / dur, sx = 28, sw = W - 56;
    slider(c, sx, L.sy, sw, f, SH.scrub != null, ink.rgba(.90), ink.rgba(.26, true));
    const shown = SH.scrub != null ? SH.scrub * dur : PL.pos;
    txt(c, fmt(shown), sx, L.sy + 21, F(600, 12), dimSub); txt(c, '-' + fmt(dur - shown), W - sx, L.sy + 21, F(600, 12), dimSub, 'right');
    const rawQ = PL.qualityLabel || (t && t.qualityLabel) || '';
    const qLabel = /hi-?res/i.test(rawQ) ? window.t('audio.quality_hires') : window.t('audio.quality_lossless');
    if (qLabel !== _qBadge.label || W !== _qBadge.w) {
      c.font = _qFont;
      const qTw = c.measureText(qLabel).width;
      const badgeW = clamp(qTw + 32, 80, W - 120);
      _qBadge.label = qLabel;
      _qBadge.w = W;
      _qBadge.badgeW = badgeW;
      _qBadge.fitted = fit(c, qLabel, badgeW - 24);
    }
    const badgeW = _qBadge.badgeW;
    rrPath(c, W / 2 - badgeW / 2, L.sy + 9.5, badgeW, 17, 4.5); c.fillStyle = ink.rgba(.15, true); c.fill();
    icon(c, 'lossless', W / 2 - badgeW / 2 + 13, L.sy + 18, 12, dim);
    txt(c, _qBadge.fitted, W / 2 + 7, L.sy + 21.5, _qFont, dim, 'center');
    if (ctrlInteractive) shit(sx - 8, L.sy - 22, sw + 16, 44, null, 'scrub');
    const pb = PL.playing ? 'pause' : 'play';
    const drawPressBtn = (key, cx, cy, r, drawFn) => {
      const sc = typeof pressScale === 'function' ? pressScale(key) : 1;
      const ta = typeof pressTint === 'function' ? pressTint(key, key.indexOf('tr:') === 0 ? 0.13 : undefined) : 0;
      c.save();
      if (sc !== 1 || ta > 0) {
        c.translate(cx, cy);
        if (sc !== 1) c.scale(sc, sc);
        if (ta > 0) { c.fillStyle = ink.rgba(ta.toFixed(4)); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
        c.translate(-cx, -cy);
      }
      drawFn();
      c.restore();
    };
    drawPressBtn('tr:back', W / 2 - 104, L.tcy, 28, () => icon(c, 'back', W / 2 - 104, L.tcy, 36, white));
    drawPressBtn('tr:play', W / 2, L.tcy, 34, () => {
      icon(c, pb, W / 2, L.tcy, 44, white);
      if (typeof isSpinnerActive === 'function' && isSpinnerActive()) {
        drawSpinnerRing(c, W / 2, L.tcy, 32, ink.rgba(0.92), 2.6);
      }
    });
    drawPressBtn('tr:fwd', W / 2 + 104, L.tcy, 28, () => icon(c, 'fwd', W / 2 + 104, L.tcy, 36, white));
    if (ctrlInteractive) {
      shit(W / 2 - 134, L.tcy - 34, 60, 68, () => prev(), null, { pressKey: 'tr:back' });
      shit(W / 2 - 34, L.tcy - 38, 68, 76, () => togglePlay(), null, { pressKey: 'tr:play' });
      shit(W / 2 + 74, L.tcy - 34, 60, 68, () => next(), null, { pressKey: 'tr:fwd' });
    }
    slider(c, 52, L.vy, W - 104, PL.vol, SH.volDrag, ink.rgba(.90), ink.rgba(.26, true)); icon(c, 'spk0', 33, L.vy, 17, dimSub); icon(c, 'spk1', W - 33, L.vy, 19, dimSub);
    if (ctrlInteractive) shit(42, L.vy - 22, W - 84, 44, null, 'vol');
    const xs = [W * .21, W * .5, W * .79], bi = [['lyrics', 'lyrics'], ['airplay', 'airplay'], ['queue', 'queue']];
    bi.forEach(([ic, mode], i) => {
      const isOut = mode === 'airplay';
      const isOutOn = isOut && typeof OUT_DRAWER !== 'undefined' && OUT_DRAWER.open;
      const on = isOutOn || (!isOut && mode && SH.mode === mode);
      const onP = clamp((SH.botHl && SH.botHl[mode] != null) ? SH.botHl[mode] : (on ? 1 : 0), 0, 1);
      const pk = 'sh:' + mode;
      drawPressBtn(pk, xs[i], L.bcy, 22, () => {
        if (onP > 0.003) { c.fillStyle = ink.rgba((0.20 * onP).toFixed(4), true); c.beginPath(); c.arc(xs[i], L.bcy, 22, 0, 7); c.fill(); }
        const icoCol = onP > 0.99 ? ink.hi : (onP > 0.003 ? ink.rgba((0.56 + 0.44 * onP).toFixed(3), onP < 0.85) : dimSub);
        icon(c, ic, xs[i], L.bcy, 22, icoCol, { fill: onP > 0.45 && !isOut, cut: cutCol });
      });
      if (ctrlInteractive) {
        shit(xs[i] - 30, L.bcy - 30, 60, 60, () => {
          if (isOut) {
            if (typeof OUT_DRAWER !== 'undefined' && OUT_DRAWER.open) {
              if (typeof closeOutDrawer === 'function') closeOutDrawer();
            } else if (typeof openOutDrawer === 'function') {
              openOutDrawer();
            }
          } else if (mode) {
            if (mode === 'lyrics' && SH.mode === 'lyrics' && SRCUI.open) { SRCUI.open = false; redraw(); return; }
            setSheetMode(SH.mode === mode ? 'art' : mode);
          }
        }, null, { pressKey: pk });
      }
    });
    c.restore();
  }
  c.restore();
  if (K > .002) {  }
}

const LY_FS = 31, LY_LH = 39, LY_GAP = 16, BG_FS = 22, BG_LH = 28;
const _qFont = F(600, 10.5), _lyTransFont = F(500, 16);
const _qBadge = { label: '', w: 0, badgeW: 80, fitted: '' };
function lyChs(c, tx) {
  const arr = Array.from(tx), n = arr.length, out = [];
  let acc = '', prevW = 0;
  for (let i = 0; i < n; i++) {
    const ch = arr[i], w = c.measureText(ch).width;
    acc += ch;
    const nextW = c.measureText(acc).width;
    const x = i === 0 ? 0 : (w > 0 ? Math.max(prevW - w * 0.45, nextW - w) : prevW);
    prevW = nextW;
    out.push({ ch, x, w, i, n });
  }
  return out;
}
function lyRows(c, ln, mw, fs) {
  c.font = F(700, fs); const rows = [];
  if (ln.w && ln.w.length) {
    const toks = []; let cur = [];
    ln.w.forEach((w, i) => { cur.push(w); if (/\s$/.test(w[0]) || i === ln.w.length - 1) { toks.push(cur); cur = []; } }); /* keep hyphenless syllables joined within the same word */
    let row = { it: [], x: 0 };
    toks.forEach(tk => {
      const items = tk.map(w => { const tx = w[0].replace(/\s+$/, ''); return { t: tx, s: w[1], e: w[2], tw: c.measureText(tx).width, adv: c.measureText(w[0]).width, chs: null }; });
      const fit = items.reduce((a, it, k) => a + (k < items.length - 1 ? it.adv : it.tw), 0);
      if (row.it.length && row.x + fit > mw) { rows.push(row); row = { it: [], x: 0 }; }
      items.forEach(it => { it.x = row.x; row.it.push(it); row.x += it.adv; });
    });
    rows.push(row); rows.forEach(r => { const l = r.it[r.it.length - 1]; r.w = l.x + l.tw; });
  } else {
    const ws = wrap(c, ln.text || '♪', mw), tot = Math.max(1, ws.reduce((a, x) => a + x.length, 0)); let cum = 0;
    ws.forEach(x => { const a = cum / tot; cum += x.length; rows.push({ it: [{ t: x, x: 0, tw: c.measureText(x).width, a, b: cum / tot, chs: null }], w: c.measureText(x).width, x: 0 }); });
  }
  rows.forEach(r => { r.ox = 0; });
  return rows;
}
const LY_INTRO_H = 72, LY_GAP_MIN_S = 4.0, LY_EXIT_LEAD_S = 0.85, LY_EXIT_END_S = 0.45, LY_PROG_END_S = 0.65;
function drawWavyRingLoader(c, cx, cy, size, prog, alpha, phase, ink) {
  if (alpha <= .005) return;
  const sc = 0.86 + 0.14 * clamp(alpha, 0, 1);
  const R = (size * 0.40) * sc, amp = 1.65 * sc, lobes = 8, segs = 72;
  const wavePh = (phase || 0) * 2.4, rot = (phase || 0) * 0.9;
  const traceWavy = (a0, a1) => {
    const span = a1 - a0, steps = Math.max(8, Math.ceil((span / (Math.PI * 2)) * segs));
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (span * i) / steps;
      const r = R + amp * Math.sin(lobes * (a - rot) + wavePh);
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
  };
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = 3.0 * sc;
  c.globalAlpha *= alpha;
  c.strokeStyle = ink ? ink.rgba(0.22, true) : 'rgba(255,255,255,0.22)';
  traceWavy(-Math.PI * 0.5, Math.PI * 1.5);
  const p = clamp(prog, 0.02, 1);
  c.strokeStyle = ink ? ink.rgba(0.94) : 'rgba(255,255,255,0.94)';
  traceWavy(-Math.PI * 0.5, -Math.PI * 0.5 + p * Math.PI * 2);
  c.restore();
}
function lyLayout(c, t, objs, mw) {
  const useLy = _hasLiveOrOffLy(t);
  const d = useLy ? (LIVE.ly[t.id] || (typeof liveLy === 'function' ? liveLy(t) : null)) : null, dur = t.dur || 180;
  const key = t.id + ':' + (d ? d.v : 0) + ':' + mw + ':' + objs.length + ':' + dur;
  if (SH.lyLay && SH.lyLay.key === key) return SH.lyLay;
  const blocks = []; let y = 20;
  const synced = !!(useLy && d && d.synced);
  const a0 = 6, b0 = Math.max(a0 + 1, dur - 10), n0 = Math.max(1, objs.length);
  const times = new Array(objs.length);
  for (let idx = 0; idx < objs.length; idx++) {
    times[idx] = synced ? objs[idx].start : (a0 + idx * (b0 - a0) / n0);
  }
  objs.forEach((ln, idx) => {
    const rawTxt = (ln.text || '').trim();
    const nextStart = idx + 1 < objs.length ? times[idx + 1] : dur;
    const isGap = Boolean(synced && !rawTxt && (!ln.w || !ln.w.length) && (nextStart - times[idx] > LY_GAP_MIN_S));
    if (isGap) {
      blocks.push({ ln, rows: [], bg: null, trans: null, y, h: 0, isGap: true, gapStart: times[idx], gapEnd: nextStart });
      return;
    }
    const rows = lyRows(c, ln, mw, LY_FS); let h = rows.length * LY_LH, bg = null, trans = null;
    if (ln.bg && ln.bg.length) { bg = ln.bg.map(b => ({ b, rows: lyRows(c, b, mw, BG_FS), y: 0 })); let by = h + 2; bg.forEach(x => { x.y = by; by += x.rows.length * BG_LH; }); h = by; }
    if (ln.translation) {
      c.font = _lyTransFont;
      const tLines = wrap(c, ln.translation, mw);
      for (let k = 0; k < tLines.length; k++) tLines[k] = fit(c, tLines[k], mw);
      trans = { lines: tLines, y: h + 3 };
      h += tLines.length * 22 + 4;
    }
    blocks.push({ ln, rows, bg, trans, y, h }); y += h + LY_GAP;
  });
  return SH.lyLay = { key, blocks, times, end: y, synced };
}
function lyProg(it, ln, pos, tf) {
  if (it.s != null && it.e != null) return it.e > it.s ? clamp((pos - it.s) / (it.e - it.s), 0, 1) : (pos >= it.s ? 1 : 0);
  return clamp((tf - it.a) / Math.max(.001, it.b - it.a), 0, 1);
}
function drawLyrics(c, t, L, fadeAlpha = 1, activeHit = true) {
  const sPos = PL.sPos != null ? PL.sPos : PL.pos;
  const objs = lyObjs(t);
  const mw = W - 48, lay = lyLayout(c, t, objs, mw), blocks = lay.blocks, times = lay.times;
  if (SH.lSnap) SH.lyLay = lay;
  let ci = -1;
  for (let i = 0; i < times.length; i++) { if (sPos >= times[i]) ci = i; else break; }
  SH.lAct = ci;

  let introH = 0, introAlpha = 0, introProg = 0, introVis = false;
  if (lay.synced && times.length > 0 && times[0] > LY_GAP_MIN_S && sPos < times[0] - 0.15) {
    const gapEnd = times[0];
    if (sPos < gapEnd - LY_EXIT_END_S) {
      const uOut = clamp((sPos - (gapEnd - LY_EXIT_LEAD_S)) / (LY_EXIT_LEAD_S - LY_EXIT_END_S), 0, 1);
      const ex = uOut * uOut * (3 - 2 * uOut);
      introH = LY_INTRO_H * (1 - ex);
      introAlpha = clamp(1 - ex * 1.25, 0, 1);
      introProg = clamp(sPos / Math.max(0.5, gapEnd - LY_PROG_END_S), 0, 1);
      introVis = introAlpha > .005;
    }
  }
  const gapOffsets = new Array(blocks.length);
  const gapStates = new Array(blocks.length);
  let dynShift = introH, gapVis = false;
  for (let i = 0; i < blocks.length; i++) {
    gapOffsets[i] = dynShift;
    const b = blocks[i];
    if (b.isGap && sPos >= b.gapStart && sPos < b.gapEnd - LY_EXIT_END_S) {
      const uIn = clamp((sPos - b.gapStart) / 0.25, 0, 1), inE = uIn * uIn * (3 - 2 * uIn);
      const uOut = clamp((sPos - (b.gapEnd - LY_EXIT_LEAD_S)) / (LY_EXIT_LEAD_S - LY_EXIT_END_S), 0, 1);
      const outE = uOut * uOut * (3 - 2 * uOut);
      const sc = inE * (1 - outE);
      const gh = LY_INTRO_H * sc;
      const ga = clamp(inE * (1 - outE * 1.25), 0, 1);
      const gp = clamp((sPos - b.gapStart) / Math.max(0.5, (b.gapEnd - LY_PROG_END_S) - b.gapStart), 0, 1);
      gapStates[i] = { h: gh, alpha: ga, prog: gp };
      dynShift += gh;
      if (ga > .005) gapVis = true;
    }
  }
  if (typeof window !== 'undefined') {
    window._lyIntroActive = Boolean(SH.mode === 'lyrics' && !SRCUI.open && (introVis || gapVis));
  }

  c.save(); c.beginPath(); c.rect(0, L.regTop, W, L.regBot - L.regTop); c.clip();
  SH.lMax = Math.max(0, lay.end + dynShift - (L.regBot - L.regTop) + 40);
  SH.lTarget = ci < 0 || !blocks[ci] ? 0 : clamp(blocks[ci].y + (gapOffsets[ci] || 0) - 30, 0, SH.lMax);
  const fci = Math.max(0, ci);
  { const lk = t.id + ':' + objs.length + ':' + (_hasLiveOrOffLy(t) && LIVE.ly[t.id] ? LIVE.ly[t.id].v : 0);
    if (SH.lSnap || SH.lKey !== lk) {
      SH.lScroll = SH.lTarget; SH.lHold = 0; SH.lSnap = false; SH.lKey = lk;
      blocks.forEach((b, idx) => {
        b.k = idx === ci ? 1 : 0;
        b.df = idx === fci ? 1 : (idx < fci ? clamp(1 - (fci - idx) * .36, .16, 1) : clamp(1 - Math.max(0, idx - fci - 1) * .20, .28, 1));
        b.blur = idx === fci ? 0 : (idx > fci ? clamp((idx - fci) * .72, 0, 3.0) : clamp((fci - idx) * .85, 0, 2.8));
      });
    }
  }
  const ink = shInk(t);
  if (introVis) {
    const iy = L.regTop + 20 + introH * 0.5 - SH.lScroll;
    if (iy >= L.regTop - 40 && iy <= L.regBot + 40) {
      const edge = lyEdgeY(L, iy);
      c.save();
      c.globalAlpha *= fadeAlpha * edge;
      drawWavyRingLoader(c, W / 2, iy, 36, introProg, introAlpha, sPos, ink);
      c.restore();
    }
  }
  const dim = ink.rgba(.42, true), activeCol = ink.hi, fnt = F(700, LY_FS), fb = F(700, BG_FS);
  const isAnim = (SRCUI.style || 'anim') === 'anim';
  const RISE = .14, FALL = .48, TOT = RISE + FALL;
  const morphing = L.p > 0.01 && L.p < 0.99;
  let blurBuiltThisFrame = 0;
  blocks.forEach((b, i) => {
    const yOff = gapOffsets[i] || 0;
    if (b.isGap) {
      const gs = gapStates[i];
      if (gs && gs.alpha > .005) {
        const gy = L.regTop + b.y + yOff + gs.h * 0.5 - SH.lScroll;
        if (gy >= L.regTop - 40 && gy <= L.regBot + 40) {
          const edge = lyEdgeY(L, gy);
          c.save();
          c.globalAlpha *= fadeAlpha * edge;
          drawWavyRingLoader(c, W / 2, gy, 36, gs.prog, gs.alpha, sPos, ink);
          c.restore();
        }
      }
      return;
    }
    const act = i === ci, ln = b.ln, lStart = times[i] || 0, end = ln.end != null ? ln.end : (times[i + 1] || t.dur);
    const lDur = Math.max(.4, end - lStart), tf = act ? clamp((sPos - lStart) / Math.max(.001, lDur), 0, 1) : (i < ci ? 1 : 0);
    const rawK = b.k != null ? b.k : (act ? 1 : 0);
    /* quintic smoothstep (C2 continuous, zero endpoint slope) for smooth progressive scaling */
    const smK = rawK * rawK * rawK * (rawK * (rawK * 6 - 15) + 10);
    const actK = isAnim ? smK : (act ? 1 : 0);
    const lineSc = isAnim ? (1 + .016 * actK) : 1;
    const rawDist = isAnim ? (b.df != null ? b.df : 1) : 1;
    const distFade = mix(rawDist, Math.max(rawDist, .70), L.alone || 0);
    const rawBlur = isAnim ? (b.blur != null ? b.blur : (i === fci ? 0 : (i > fci ? clamp((i - fci) * .72, 0, 3.0) : clamp((fci - i) * .85, 0, 2.8)))) : 0;
    const effBlur = rawBlur * mix(1, .80, L.alone || 0);
    const blockMidY = L.regTop + b.y + yOff + b.h * .42 - SH.lScroll;
    const byTop = L.regTop + b.y + yOff - SH.lScroll, byBot = byTop + b.h;
    if (byBot < L.regTop - 50 || byTop > L.regBot + 50) return;
    /* continuous weight for the blurred pass: rises with blur and fades with line activation so focus & blur crossfade smoothly */
    const blurW = (isAnim && !act) ? clamp(effBlur / .5, 0, 1) * (1 - actK) : 0;
    let paintK = 1 - blurW;
    if (blurW > .004) {
      const qBlur = Math.round(Math.max(.34, effBlur) * 3) / 3;
      const pad = Math.ceil(qBlur * 2.5) + 10;
      const bh = Math.ceil(b.h + pad * 2);
      const needsBuild = !b._bCv || b._bBlur !== qBlur || b._bW !== W || b._bH !== bh || b._bTint !== ink.qKey;
      const maxBlurBuilds = morphing ? 1 : 2;
      if (needsBuild && blurBuiltThisFrame >= maxBlurBuilds) {
        paintK = 1;
        if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
      } else {
        if (needsBuild) blurBuiltThisFrame++;
        const cv = drawBlurredLyBlock(c, b, Math.max(.34, effBlur), fnt, fb, ink);
        const bw = b._bW || W, bPad = b._bPad || pad, bH = b._bH || bh, dy = byTop - bPad;
        const al = distFade * fadeAlpha * blurW;
        if (al > .004) drawLyMasked(c, cv, dy, bw, bH, al, L);
        if (blurW >= .995 && actK < .02) {
          if (REG && activeHit && fadeAlpha > .5 && byBot > L.regTop && byTop < L.regBot) {
            const cy0 = Math.max(L.regTop, byTop), cy1 = Math.min(L.regBot, byBot);
            shit(0, cy0, W, cy1 - cy0, () => seek((times[i] || 0) + .2), 'lyrics');
          }
          return;
        }
      }
    }
    const baseAl = bCol => bCol === dim ? .42 : .26;
    const hiAl = hCol => hCol === activeCol ? 1 : .78;
    const paint = (rows, y0, lh, font, fs, base, hi, bgl) => rows.forEach((r, j) => {
      const yy = L.regTop + b.y + yOff + y0 + (j + 1) * lh - 8 - SH.lScroll; if (yy < L.regTop - 50 || yy > L.regBot + 50) return;
      /* match the exact edge fade curve of the cached blurred pass (lyEdgeY) to avoid any opacity jump on handoff */
      const edge = isAnim ? lyEdgeY(L, yy - 12) : (clamp((yy - L.regTop) / 48, 0, 1) * clamp((L.regBot - yy + 30) / 70, 0, 1));
      c.save();
      c.globalAlpha = edge * distFade * fadeAlpha * paintK;
      if (lineSc !== 1 && !bgl) { c.translate(24, blockMidY); c.scale(lineSc, lineSc); c.translate(-24, -blockMidY); }
      const bA = baseAl(base), hA = hiAl(hi);
      r.it.forEach(it => {
        const x = 24 + r.ox + it.x;
        let chs = it.chs;
        if (!chs && isAnim && (act || (i < ci && actK > .01))) {
          c.font = font;
          chs = it.chs = lyChs(c, it.t);
        }
        if (isAnim && (act || (i < ci && actK > .01)) && chs && chs.length) {
          const n = chs.length;
          const wStart = (it.s != null && it.e != null) ? it.s : (lStart + it.a * lDur * .82);
          const wDur = (it.s != null && it.e != null) ? Math.max(.06, it.e - it.s) : Math.max(.08, (it.b - it.a) * lDur * .82);
          const step = n > 1 ? clamp((wDur * .78) / (n - 1), .028, .056) : 0;
          const firstT0 = wStart - .03, lastEnd = wStart + (n - 1) * step - .03 + TOT;
          if (sPos <= firstT0) {
            txt(c, it.t, x, yy, font, base, 'left', 0, true);
          } else if (sPos >= lastEnd) {
            const al = bA + (hA - bA) * actK;
            txt(c, it.t, x, yy, font, ink.rgba(al.toFixed(3)), 'left', 0, true);
          } else {
            c.font = font; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
            for (let ciCh = 0; ciCh < n; ciCh++) {
              const ch = chs[ciCh];
              if (ch.ch === ' ') continue;
              const dtCh = sPos - (firstT0 + ciCh * step);
              if (dtCh <= 0) {
                c.fillStyle = base;
                c.fillText(ch.ch, x + ch.x, yy);
              } else if (dtCh >= TOT) {
                const al = bA + (hA - bA) * actK;
                c.fillStyle = ink.rgba(al.toFixed(3));
                c.fillText(ch.ch, x + ch.x, yy);
              } else {
                const uCol = clamp(dtCh / .22, 0, 1), lps = uCol * uCol * (3 - 2 * uCol);
                let env;
                if (dtCh < RISE) {
                  const u = dtCh / RISE;
                  env = u * u * (3 - 2 * u);
                } else {
                  const u = (dtCh - RISE) / FALL;
                  env = 1 - u * u * u * (u * (u * 6 - 15) + 10);
                }
                const cLift = -5.2 * env * actK;
                const cSc = 1 + .105 * env * actK;
                const al = bA + (hA - bA) * lps * actK;
                const cx = x + ch.x + ch.w * .5, cy = yy - fs * .32 + cLift;
                c.save();
                c.translate(cx, cy); c.scale(cSc, cSc); c.translate(-cx, -cy);
                c.fillStyle = ink.rgba(al.toFixed(3));
                c.fillText(ch.ch, x + ch.x, yy + cLift);
                c.restore();
              }
            }
          }
        } else {
          const p = act ? lyProg(it, ln, sPos, tf) : 0;
          txt(c, it.t, x, yy, font, base, 'left', 0, true);
          if (act && p > 0) {
            c.save(); c.beginPath(); c.rect(x - 4, yy - 42, it.tw * p + 6 * (p >= 1 ? 1 : 0), 56); c.clip();
            txt(c, it.t, x, yy, font, hi, 'left', 0, true);
            c.restore();
          }
        }
      });
      c.restore();
    });
    paint(b.rows, 0, LY_LH, fnt, LY_FS, dim, activeCol, false);
    if (b.bg) b.bg.forEach(x => paint(x.rows, x.y, BG_LH, fb, BG_FS, ink.rgba(.26, true), ink.rgba(.78), true));
    if (b.trans && b.trans.lines.length) {
      b.trans.lines.forEach((tl, ti) => {
        const ty = L.regTop + b.y + yOff + b.trans.y + (ti + 1) * 20 - 4 - SH.lScroll;
        if (ty < L.regTop - 40 || ty > L.regBot + 40) return;
        const edge = isAnim ? lyEdgeY(L, ty - 8) : (clamp((ty - L.regTop) / 48, 0, 1) * clamp((L.regBot - ty + 30) / 70, 0, 1));
        c.save();
        c.globalAlpha = edge * distFade * fadeAlpha * paintK * (act ? .78 : .42);
        txt(c, tl, 24, ty, _lyTransFont, ink.rgba(.85, true), 'left');
        c.restore();
      });
    }
    if (REG && activeHit && fadeAlpha > .5 && byBot > L.regTop && byTop < L.regBot) {
      const cy0 = Math.max(L.regTop, byTop), cy1 = Math.min(L.regBot, byBot);
      shit(0, cy0, W, cy1 - cy0, () => seek((times[i] || 0) + .2), 'lyrics');
    }
  });
  c.restore(); if (activeHit && fadeAlpha > .5) shit(0, L.regTop, W, L.regBot - L.regTop, null, 'lyrics');
}

/* Draw a blurred block with continuous per-pixel edge fade (destination-in vertical gradient) instead of per-line slicing; single drawImage when clear of edges */
const LY_TOPZ = 38, LY_BOTZ = 105;
function lyEdgeY(L, y) {
  const t = clamp((y - L.regTop) / LY_TOPZ, 0, 1), b = clamp((L.regBot - y) / LY_BOTZ, 0, 1);
  return (t * t * (3 - 2 * t)) * (b * b * (3 - 2 * b));
}
let _lyMaskCv = null;
let _qMaskCv = null;
function drawLyMasked(c, cv, dy, bw, bh, al, L) {
  const fadeTopEnd = L.regTop + LY_TOPZ, fadeBotStart = L.regBot - LY_BOTZ;
  if (dy >= fadeTopEnd && dy + bh <= fadeBotStart) {
    c.save(); c.globalAlpha = al; c.drawImage(cv, 0, dy, bw, bh); c.restore();
    return;
  }
  const mc = _lyMaskCv || (_lyMaskCv = document.createElement('canvas'));
  if (mc.width < cv.width || mc.height < cv.height) { mc.width = Math.max(mc.width, cv.width); mc.height = Math.max(mc.height, cv.height); }
  const mx = mc.getContext('2d');
  mx.setTransform(1, 0, 0, 1, 0, 0);
  mx.globalCompositeOperation = 'copy';
  mx.globalAlpha = 1;
  mx.drawImage(cv, 0, 0);
  mx.globalCompositeOperation = 'destination-in';
  const g = mx.createLinearGradient(0, 0, 0, cv.height);
  const stop = (y, a) => { const o = (y - dy) / bh; if (o >= 0 && o <= 1) g.addColorStop(o, 'rgba(0,0,0,' + a.toFixed(3) + ')'); };
  const edgeAt = y => lyEdgeY(L, y);
  const N = 12;
  stop(dy, edgeAt(dy));
  for (let s = 0; s <= N; s++) { const y = L.regTop + LY_TOPZ * s / N; if (y > dy && y < dy + bh) stop(y, edgeAt(y)); }
  for (let s = 0; s <= N; s++) { const y = fadeBotStart + LY_BOTZ * s / N; if (y > dy && y < dy + bh) stop(y, edgeAt(y)); }
  stop(dy + bh, edgeAt(dy + bh));
  mx.fillStyle = g;
  mx.fillRect(0, 0, cv.width, cv.height);
  mx.globalCompositeOperation = 'source-over';
  c.save(); c.globalAlpha = al;
  c.drawImage(mc, 0, 0, cv.width, cv.height, 0, dy, bw, bh);
  c.restore();
}

/* Offscreen cache for progressive blur on inactive lyrics lines: regenerates only when quantized blur (0.35px step) changes */
function drawBlurredLyBlock(c, b, blurPx, fnt, fb, ink) {
  const qBlur = Math.round(blurPx * 3) / 3;
  const dpr = Math.min(2, S.width / Math.max(1, W));
  const pad = Math.ceil(qBlur * 2.5) + 10;
  const bw = W, bh = Math.ceil(b.h + pad * 2);
  const tKey = ink ? ink.qKey : '31,31,31';
  if (!b._bCv || b._bBlur !== qBlur || b._bW !== bw || b._bH !== bh || b._bTint !== tKey) {
    const cv = b._bCv || (b._bCv = document.createElement('canvas'));
    cv.width = Math.ceil(bw * dpr);
    cv.height = Math.ceil(bh * dpr);
    b._bBlur = qBlur; b._bW = bw; b._bH = bh; b._bPad = pad; b._bTint = tKey;
    const bc = cv.getContext('2d');
    bc.setTransform(dpr, 0, 0, dpr, 0, 0);
    bc.clearRect(0, 0, bw, bh);
    let hasFilter = false;
    try {
      bc.filter = 'blur(' + (qBlur * dpr).toFixed(2) + 'px)';
      hasFilter = typeof bc.filter === 'string' && bc.filter.indexOf('blur') !== -1;
    } catch (e) {}
    const renderBlock = (ctx, ox, oy, mulA) => {
      const drawRows = (rows, y0, lh, font, col) => {
        ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = col;
        rows.forEach((r, j) => {
          const ry = pad + y0 + (j + 1) * lh - 8 + oy;
          r.it.forEach(it => {
            ctx.fillText(it.t, 24 + r.ox + it.x + ox, ry);
          });
        });
      };
      ctx.save();
      ctx.globalAlpha = mulA;
      drawRows(b.rows, 0, LY_LH, fnt, ink ? ink.rgba(.42, true) : 'rgba(255,255,255,.42)');
      if (b.bg) b.bg.forEach(x => drawRows(x.rows, x.y, BG_LH, fb, ink ? ink.rgba(.26, true) : 'rgba(255,255,255,.26)'));
      ctx.restore();
    };
    if (hasFilter) {
      renderBlock(bc, 0, 0, 1);
      bc.filter = 'none';
    } else {
      /* 9-tap multi-pass Gaussian fallback for WebViews without ctx.filter */
      const r1 = qBlur * .55, r2 = qBlur * 1.1;
      const taps = [
        [0, 0, .26],
        [-r1, 0, .11], [r1, 0, .11], [0, -r1, .11], [0, r1, .11],
        [-r2 * .7, -r2 * .7, .075], [r2 * .7, -r2 * .7, .075], [-r2 * .7, r2 * .7, .075], [r2 * .7, r2 * .7, .075]
      ];
      taps.forEach(([ox, oy, w]) => renderBlock(bc, ox, oy, w));
    }
  }
  return b._bCv;
}
let _lyPrewarmRaf = 0, _lyPrewarmKey = '';
window.prewarmLyrics = function(t) {
  if (_lyPrewarmRaf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(_lyPrewarmRaf);
    _lyPrewarmRaf = 0;
  }
  if (!t || typeof sc === 'undefined' || !sc || typeof S === 'undefined' || !S || !W) return;
  if (typeof SRCUI !== 'undefined' && (SRCUI.style || 'anim') !== 'anim') return;
  const objs = lyObjs(t), mw = W - 48;
  if (mw <= 0 || !objs || !objs.length) return;
  const lay = lyLayout(sc, t, objs, mw);
  const blocks = lay.blocks, times = lay.times;
  if (!blocks || !blocks.length) return;
  const sPos = PL.sPos != null ? PL.sPos : PL.pos;
  let ci = -1;
  for (let i = 0; i < times.length; i++) { if (sPos >= times[i]) ci = i; else break; }
  const fci = Math.max(0, ci);
  blocks.forEach((b, idx) => {
    if (b.isGap) return;
    if (b.k == null) b.k = idx === ci ? 1 : 0;
    if (b.df == null) b.df = idx === fci ? 1 : (idx < fci ? clamp(1 - (fci - idx) * .36, .16, 1) : clamp(1 - Math.max(0, idx - fci - 1) * .20, .28, 1));
    if (b.blur == null) b.blur = idx === fci ? 0 : (idx > fci ? clamp((idx - fci) * .72, 0, 3.0) : clamp((fci - idx) * .85, 0, 2.8));
  });
  const L = shLay();
  const maxScroll = Math.max(0, lay.end - (L.regBot - L.regTop) + 40);
  const targetScroll = (ci < 0 || !blocks[ci]) ? 0 : clamp(blocks[ci].y - 30, 0, maxScroll);
  const visIdxs = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.isGap || i === ci || (b.blur || 0) <= 0.002) continue;
    const byTop = L.regTop + b.y - targetScroll, byBot = byTop + b.h;
    if (byBot < L.regTop - 50 || byTop > L.regBot + 50) continue;
    visIdxs.push(i);
  }
  visIdxs.sort((a, b) => Math.abs(a - fci) - Math.abs(b - fci));
  if (!visIdxs.length || typeof requestAnimationFrame !== 'function') return;
  const fnt = F(700, LY_FS), fb = F(700, BG_FS), runKey = lay.key;
  _lyPrewarmKey = runKey;
  let cursor = 0;
  const step = () => {
    _lyPrewarmRaf = 0;
    if (_lyPrewarmKey !== runKey) return;
    const active = typeof cur === 'function' ? cur() : t;
    if (!active || active.id !== t.id || SH.lyLay !== lay) return;
    while (cursor < visIdxs.length) {
      const idx = visIdxs[cursor++];
      const b = blocks[idx];
      if (!b || b.isGap) continue;
      const effBlur = b.blur != null ? b.blur : (idx === fci ? 0 : (idx > fci ? clamp((idx - fci) * .72, 0, 3.0) : clamp((fci - idx) * .85, 0, 2.8)));
      if (effBlur <= 0.002) continue;
      const qBlur = Math.round(Math.max(.34, effBlur) * 3) / 3;
      const pad = Math.ceil(qBlur * 2.5) + 10;
      const bh = Math.ceil(b.h + pad * 2);
      if (!b._bCv || b._bBlur !== qBlur || b._bW !== W || b._bH !== bh) {
        drawBlurredLyBlock(sc, b, Math.max(.34, effBlur), fnt, fb);
        break;
      }
    }
    if (cursor < visIdxs.length) _lyPrewarmRaf = requestAnimationFrame(step);
  };
  _lyPrewarmRaf = requestAnimationFrame(step);
};
function drawSrcPicker(c, t, L, fadeAlpha = 1, activeHit = true) {
  if (fadeAlpha < .01) return;
  const d = (_hasLiveOrOffLy(t) && typeof liveLy === 'function') ? liveLy(t) : { sources: [], source: null }, raw = d.sources || [];
  const MAIN_IDS = ['apple', 'better', 'lrclib', 'netease'], OTH_IDS = ['kugou', 'ovh'];
  const byId = {}; raw.forEach(s => { byId[s.id] = s; });
  const main = MAIN_IDS.map(id => byId[id]).filter(Boolean);
  const oth = OTH_IDS.map(id => byId[id]).filter(Boolean);
  if (!main.length && raw.length) {
    raw.forEach(s => { if (s.group === 'main') main.push(s); else oth.push(s); });
  }
  const exT = clamp(SRCUI.exT || 0, 0, 1);
  const topY = TOP + 92, botY = L.sy - 14;
  const availH = Math.max(240, botY - topY);
  const ph = clamp(Math.round(availH * .115), 36, 44);
  const headerH = 44, footerH = 12 + 12 + ph + 4;
  const maxRowsH = Math.max(110, availH - headerH - footerH);
  const totRows = Math.max(1, main.length + (oth.length ? 1 + oth.length * exT : 0));
  const RH = clamp(maxRowsH / totRows, 26, 42);
  const x = 28, w = W - 56, yHead = topY + 20;

  c.save();
  c.beginPath(); c.rect(0, topY, W, availH); c.clip();
  c.globalAlpha = fadeAlpha;

  txt(c, window.t('lyrics.sources_title'), x, yHead, F(600, 22), '#fff');
  icon(c, 'x', x + w - 8, yHead - 7, 16, 'rgba(255,255,255,.85)', { lw: 1.9 });
  if (activeHit) shit(x + w - 34, yHead - 28, 48, 42, () => { SRCUI.open = false; redraw(); });

  let y = yHead + 20;
  try { c.letterSpacing = '1.3px'; } catch (e) {}
  txt(c, window.t('lyrics.source_header'), x, y, F(500, 11.5), 'rgba(255,255,255,.50)');
  try { c.letterSpacing = '0px'; } catch (e) {}
  y += 6;

  if (!main.length && !oth.length) {
    txt(c, LIVE.on ? window.t('lyrics.sources_loading') : window.t('lyrics.backend_required'), x, y + 30, F(400, 16), 'rgba(255,255,255,.6)');
    y += 56;
  } else {
    const fsRow = clamp(RH * .47, 15.5, 19);
    const fsSub = clamp(RH * .37, 12.5, 14.5);
    const drawSourceRow = (s, ry, rowAlpha, isSub) => {
      const cy = ry + RH * .5 + fsRow * .34;
      const ok = s.state === 'ok', pend = s.state === 'pending', sel = d.source === s.id && ok;
      const al = ok ? 1 : pend ? .62 : .45;
      const sub = ok
        ? (typeof lyKindLabel === 'function' ? lyKindLabel(s.kind) : LY_KIND[s.kind])
        : pend ? window.t('lyrics.status_loading') : s.state === 'error' ? window.t('lyrics.status_unreachable') : window.t('lyrics.status_none');
      c.globalAlpha = fadeAlpha * rowAlpha * al;
      txt(c, s.name, x, cy, F(sel ? 700 : 400, fsRow), isSub ? 'rgba(255,255,255,.88)' : '#fff');
      txt(c, sub, x + w - (sel ? 28 : 0), cy - 1, F(400, fsSub), 'rgba(255,255,255,.66)', 'right');
      if (sel) icon(c, 'check', x + w - 8, cy - fsSub * .36, 15.5, 'rgba(255,255,255,.95)', { lw: 2.1 });
      c.globalAlpha = fadeAlpha;
      if (activeHit && ok && LIVE.on && rowAlpha > .5) shit(x - 10, ry, w + 20, RH, () => { lyPick(t, s.id); redraw(); });
    };

    main.forEach((s, i) => { drawSourceRow(s, y + i * RH, 1, false); });
    y += main.length * RH;

    if (oth.length) {
      const ryMore = y, cyMore = ryMore + RH * .5 + fsRow * .34;
      txt(c, window.t('lyrics.other_sources'), x, cyMore, F(400, fsRow), 'rgba(255,255,255,.62)');
      c.save();
      c.translate(x + w - 8, cyMore - fsSub * .36);
      c.rotate(exT * Math.PI);
      icon(c, 'chevd', 0, 0, 14.5, 'rgba(255,255,255,.62)', { lw: 2 });
      c.restore();
      if (activeHit) shit(x - 10, ryMore, w + 20, RH, () => { SRCUI.ex = !SRCUI.ex; redraw(); });
      y += RH;

      const subH = oth.length * RH * exT;
      if (exT > .005) {
        c.save();
        c.beginPath(); c.rect(0, y, W, subH + 4); c.clip();
        oth.forEach((s, j) => {
          const itemP = clamp((exT * oth.length - j * .35) / Math.max(.3, 1 - j * .12), 0, 1);
          const slideDy = (1 - exT) * -10;
          drawSourceRow(s, y + j * RH + slideDy, itemP * exT, true);
        });
        c.restore();
      }
      y += subH;
    }
  }

  y = Math.min(y + 14, botY - ph - 16);
  if (_hasLetterSpacing) c.letterSpacing = '1.3px';
  txt(c, window.t('lyrics.style_header'), x, y, F(500, 11.5), 'rgba(255,255,255,.50)');
  if (_hasLetterSpacing) c.letterSpacing = '0px';
  y += 10;
  const gap = 14, pw = (w - gap) / 2, curSt = SRCUI.style || 'anim';
  if (fadeAlpha > 0.01 && (activeHit || !SH.lyStyleBtns || fadeAlpha >= SH.lyStyleBtns.alpha)) {
    SH.lyStyleBtns = { x, y, pw, ph, gap, alpha: fadeAlpha };
  }
  const isFallback = typeof FALLBACK !== 'undefined' && FALLBACK;
  [['anim', window.t('lyrics.style_animated')], ['classic', window.t('lyrics.style_classic')]].forEach(([id, lb], idx) => {
    const px = x + idx * (pw + gap), sel = curSt === id;
    if (isFallback) {
      rrPath(c, px, y, pw, ph, ph / 2);
      c.fillStyle = sel ? '#ffffff' : 'rgba(255,255,255,.14)';
      c.fill();
      txt(c, lb, px + pw / 2, y + ph / 2 + 5.5, F(sel ? 600 : 500, 15.5), sel ? '#111111' : '#ffffff', 'center');
    }
    if (activeHit) shit(px, y, pw, ph, () => { SRCUI.style = id; try { localStorage.setItem('sonora-ly-style', id); } catch (e) {} redraw(); });
  });

  c.restore();
}

let _qFadeCv = null, _qFadeCtx = null;
function drawQueueSwipeRemoveBg(c, rx, ry, rw, rh, r, sw) {
  const sRow = sw || (typeof SWQ !== 'undefined' ? SWQ : null);
  const cp = clamp((sRow && sRow.crossP) || 0, 0, 1);
  const bgR = Math.round(mix(205, 250, cp));
  const bgG = Math.round(mix(34, 46, cp));
  const bgB = Math.round(mix(52, 73, cp));
  const bgA = mix(0.38, 0.92, cp);
  c.fillStyle = 'rgba(' + bgR + ',' + bgG + ',' + bgB + ',' + bgA.toFixed(3) + ')';
  c.fillRect(rx, ry, rw, rh);

  const glAlpha = Math.min(1, r / 40);
  if (glAlpha <= 0.01) return;

  const glR = 255;
  const glG = Math.round(mix(175, 255, cp));
  const glB = Math.round(mix(182, 255, cp));
  const glCol = 'rgb(' + glR + ',' + glG + ',' + glB + ')';

  const shift = Math.min(r / 2, 46);
  const glScale = 0.55 + 0.45 * Math.min(1, r / 64);
  const gx = rx + rw - shift;
  const gy = ry + rh / 2;
  const nowMs = performance.now();

  let hitScale = 1;
  if (sRow && sRow.hitT > 0) {
    const ht = (nowMs - sRow.hitT) / 380;
    if (ht >= 0 && ht < 1) {
      if (ht < 0.4) {
        const p = ht / 0.4;
        hitScale = 1 + 0.32 * (1 - (1 - p) * (1 - p));
      } else {
        const p = (ht - 0.4) / 0.6;
        hitScale = 1.32 - 0.32 * (p * p * (3 - 2 * p));
      }
    }
  }

  c.save();
  c.translate(gx, gy);
  c.scale(glScale, glScale);
  c.globalAlpha *= glAlpha;

  c.save();
  c.translate(0, -8.5);
  if (hitScale !== 1) c.scale(hitScale, hitScale);
  icon(c, 'trash', 0, 0, 20, glCol, { lw: 2.1 });
  c.restore();

  c.font = F(600, 11.5);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = glCol;
  c.fillText(window.t('common.remove'), 0, 15);
  c.restore();
}
function drawQueueSkeleton(tc, startY, top, bot, qInk) {
  const rh = 60;
  const count = Math.max(5, Math.min(9, Math.ceil((bot - startY) / rh) + 1));
  const p = ((performance.now() % 1400) / 1400);
  const mw = Math.max(80, W - 80 - 70);
  const titleRatios = [0.58, 0.76, 0.48, 0.68, 0.54, 0.72, 0.50, 0.64, 0.60];
  const subRatios = [0.34, 0.44, 0.28, 0.38, 0.32, 0.40, 0.30, 0.36, 0.34];
  const skOpts = { baseCol: qInk.rgba(.11, true), peakCol: qInk.rgba(.24, true) };
  const hasSh = typeof skulletShimmer === 'function';
  for (let i = 0; i < count; i++) {
    const y = startY + i * rh;
    if (y < top - 70 || y > bot + 10) continue;
    const tw = Math.round(mw * titleRatios[i % titleRatios.length]);
    const sw = Math.round(mw * subRatios[i % subRatios.length]);
    if (hasSh) {
      skulletShimmer(tc, 24, y + 8, 44, 44, 6, p, skOpts);
      skulletShimmer(tc, 80, y + 16, tw, 14, 4, p, skOpts);
      skulletShimmer(tc, 80, y + 36, sw, 11, 4, p, skOpts);
      skulletShimmer(tc, W - 44, y + 24.5, 16, 2.2, 1.1, p, skOpts);
      skulletShimmer(tc, W - 44, y + 29, 16, 2.2, 1.1, p, skOpts);
      skulletShimmer(tc, W - 44, y + 33.5, 16, 2.2, 1.1, p, skOpts);
    } else {
      tc.fillStyle = skOpts.baseCol;
      rrPath(tc, 24, y + 8, 44, 44, 6); tc.fill();
      rrPath(tc, 80, y + 16, tw, 14, 4); tc.fill();
      rrPath(tc, 80, y + 36, sw, 11, 4); tc.fill();
    }
    tc.fillStyle = qInk.rgba(.12, true);
    tc.fillRect(80, y + rh - .5, W - 80, .5);
  }
  return count;
}

function drawQueue(c, L, fadeAlpha = 1) {
  const refillFromRadio = () => {
    const have = new Set(PL.queue.map(x => x && x.id).filter(Boolean));
    const add = [];
    while (LIVE.radio.length && add.length < 40) {
      const tr = LIVE.radio.shift();
      if (tr && tr.id && !have.has(tr.id)) { have.add(tr.id); add.push(tr); }
    }
    if (add.length) PL.queue.push(...add);
    if (LIVE.radio.length < 20 && !LIVE.radioBusy && LIVE.on && cur()) liveOnTrack(cur());
  };
  if (PL.infinity && PL.queue.length - PL.qi <= 20) {
    if (LIVE.radio.length) {
      refillFromRadio();
    } else if (!LIVE.radioBusy) {
      if (LIVE.on && cur()) liveOnTrack(cur());
      else moreTracks();
    }
  }

  // Orphaned drag cleanup fallback (primary drop commit runs through endPointer -> reorderQueue)
  if (SH.dragQueue && (typeof INP === 'undefined' || !INP.down || INP.mode !== 'queueGrip')) {
    const { fromIdx, toIdx } = SH.dragQueue;
    SH.dragQueue = null;
    reorderQueue(fromIdx, toIdx);
  }

  const isCross = (SH.mode === 'queue' && SH.fromMode === 'lyrics') || (SH.mode === 'lyrics' && SH.fromMode === 'queue');
  const qP = isCross ? (SH.qModeP != null ? SH.qModeP : 1) : clamp(L.p, 0, 1);
  const pw = (W - 48 - 20) / 3, py = L.regTop - 4 + (1 - qP) * 14;
  if (fadeAlpha > .5 && SH.mode === 'queue') {
    [['shuffle', PL.shuffle], ['repeat', PL.repeat > 0], ['infinity', PL.infinity]].forEach(([ic, on], i) => {
      const x = 24 + i * (pw + 10);
      shit(x, py, pw, 42, () => {
        if (i === 0) {
          cycleShuffleMode();
          SP.sP1.v += PL.shuffle ? 1.5 : -1.5;
        } else if (i === 1) {
          PL.repeat = (PL.repeat + 1) % 3;
          SP.sP2.v += PL.repeat > 0 ? 1.5 : -1.5;
          if (typeof syncNativeRepeat === 'function') syncNativeRepeat();
          if (typeof syncNativeNextTrack === 'function') syncNativeNextTrack(true);
          if (typeof savePlayerState === 'function') savePlayerState();
          redraw();
        } else {
          PL.infinity = !PL.infinity;
          SP.sP3.v += PL.infinity ? 1.5 : -1.5;
          if (PL.infinity && PL.queue.length - PL.qi <= 20) {
            if (LIVE.radio.length) {
              refillFromRadio();
            } else if (LIVE.on && cur()) {
              LIVE.radioBusy = false;
              liveOnTrack(cur());
            } else {
              moreTracks();
            }
          }
          redraw();
        }
      });
    });
  }
  const top = py + 62, bot = L.regBot, qBase = PL.qi + 1, rowCount = Math.max(0, PL.queue.length - qBase), rh = 60;
  SH.qMax = Math.max(0, 52 + rowCount * rh + 30 - (bot - top));
  if (fadeAlpha > .5 && SH.mode === 'queue') shit(0, top, W, bot - top, null, 'queue');
  const dpr = (S.width / Math.max(1, W)) || 1;
  const y0 = top - 8, y1 = bot, availH = Math.max(1, y1 - y0);
  const mw = Math.max(1, Math.round(W * dpr));
  const mh = Math.max(1, Math.round(availH * dpr));
  if (!_qMaskCv) _qMaskCv = document.createElement('canvas');
  if (_qMaskCv.width !== mw || _qMaskCv.height !== mh) { _qMaskCv.width = mw; _qMaskCv.height = mh; }
  const qc = _qMaskCv.getContext('2d');
  qc.setTransform(1, 0, 0, 1, 0, 0);
  qc.clearRect(0, 0, mw, mh);
  qc.save();
  qc.scale(dpr, dpr);
  qc.translate(0, -y0);
  const isDragging = !!(rowCount > 0 && typeof INP !== 'undefined' && INP.mode === 'queueGrip' && SH.dragQueue);
  let targetI = -1, pillY = 0;
  if (isDragging) {
    const pyTouch = SH.dragQueue.curY != null ? SH.dragQueue.curY : (typeof INP !== 'undefined' ? INP.y : 0);
    const localY = pyTouch - shY();
    if (SH.dragQueue.grabOff == null) {
      const startY = (SH.dragQueue.startY != null ? SH.dragQueue.startY : pyTouch) - shY();
      const startRowY = (top - SH.qScroll) + 52 + SH.dragQueue.fromIdx * rh;
      SH.dragQueue.grabOff = clamp(startY - startRowY, 0, rh);
    }
    const nowMs = performance.now();
    const dtScroll = SH.dragQueue._lastMs ? Math.min(0.05, (nowMs - SH.dragQueue._lastMs) / 1000) : 0.016;
    SH.dragQueue._lastMs = nowMs;
    if (SH.qMax > 0) {
      if (localY < top + 38 && SH.qScroll > 0) {
        const spd = clamp((top + 38 - localY) / 38, 0.15, 1.5);
        SH.qScroll = clamp(SH.qScroll - 320 * spd * dtScroll, 0, SH.qMax);
        redraw();
      } else if (localY > bot - 38 && SH.qScroll < SH.qMax) {
        const spd = clamp((localY - (bot - 38)) / 38, 0.15, 1.5);
        SH.qScroll = clamp(SH.qScroll + 320 * spd * dtScroll, 0, SH.qMax);
        redraw();
      }
    }
    pillY = clamp(localY - SH.dragQueue.grabOff, top - 10, bot - rh + 10);
    const baseDrag = top - SH.qScroll;
    const pillCenterY = pillY + rh * 0.5;
    targetI = clamp(Math.floor((pillCenterY - (baseDrag + 52)) / rh), 0, rowCount - 1);
    if (SH.dragQueue.toIdx != null && targetI !== SH.dragQueue.toIdx && typeof window.haptic === 'function') {
      window.haptic('tick');
    }
    SH.dragQueue.toIdx = targetI;
    SH.dragQueue.lastRelY = pillY - (baseDrag + 52);
  }
  const base = top - SH.qScroll;
  const settleObj = (!isDragging && SH.qSettle && SH.qSettle.idx >= 0 && SH.qSettle.idx < rowCount && PL.queue[qBase + SH.qSettle.idx] === SH.qSettle.item) ? SH.qSettle : null;
  if (!isDragging && SH.qSettle && !settleObj) SH.qSettle = null;
  const qInk = shInk(cur());
  const dlCols = typeof shDlBadgeCols === 'function' ? shDlBadgeCols(cur()) : { fill: shTrackAccent(cur()), arrow: '#111' };
  const drawPillRow = (tc, dt, y, lift) => {
    const k = clamp(lift || 0, 0, 1);
    tc.save();
    if (k > 0.005) {
      const pillX = 8, pillW = W - 16, pillH = rh - 4, pillR = 14;
      rrPath(tc, pillX, y + 2, pillW, pillH, pillR);
      tc.fillStyle = qInk.rgba((0.14 * k).toFixed(4), true);
      tc.fill();
    }
    drawArt(tc, dt, 24, y + 8, 44, 6);
    txt(tc, dt.title, 80, y + 28, F(mix(500, 600, k), 16), qInk.hi, 'left', W - 80 - 70);
    const isDl = typeof isDownloaded === 'function' && isDownloaded(dt);
    let sx = 80;
    if (isDl) {
      if (typeof drawDlBadge === 'function') drawDlBadge(tc, sx + 7.5, y + 42.2, 7.5, dlCols.fill, dlCols.arrow);
      sx += 21;
    }
    const subCol = qInk.rgba(mix(0.60, 0.78, k).toFixed(3), true);
    if (dt._smartRec) {
      icon(tc, 'spark', sx + 6, y + 42, 12, qInk.rgba(mix(0.82, 0.96, k).toFixed(3)), { fill: true });
      txt(tc, dt.artist, sx + 18, y + 47, F(400, 14), subCol, 'left', W - (sx + 18) - 70);
    } else if (dt._queued) {
      txt(tc, window.t('queue.in_queue_artist', { artist: dt.artist }), sx, y + 47, F(400, 14), qInk.rgba(mix(0.68, 0.84, k).toFixed(3), true), 'left', W - sx - 70);
    } else {
      txt(tc, dt.artist, sx, y + 47, F(400, 14), subCol, 'left', W - sx - 70);
    }
    icon(tc, 'grip', W - 36, y + 30, 20, qInk.rgba(mix(0.50, 0.92, k).toFixed(3), true));
    tc.restore();
  };
  const drawQueueRowBody = (rc, dt, y) => {
    drawArt(rc, dt, 24, y + 8, 44, 6);
    txt(rc, dt.title, 80, y + 28, F(500, 16), qInk.hi, 'left', W - 80 - 70);
    const isDl = typeof isDownloaded === 'function' && isDownloaded(dt);
    let sx = 80;
    if (isDl) {
      if (typeof drawDlBadge === 'function') drawDlBadge(rc, sx + 7.5, y + 42.2, 7.5, dlCols.fill, dlCols.arrow);
      sx += 21;
    }
    if (dt._smartRec) {
      icon(rc, 'spark', sx + 6, y + 42, 12, qInk.rgba(.84), { fill: true });
      txt(rc, dt.artist, sx + 18, y + 47, F(400, 14), qInk.rgba(.66, true), 'left', W - (sx + 18) - 70);
    } else if (dt._queued) {
      txt(rc, window.t('queue.in_queue_artist', { artist: dt.artist }), sx, y + 47, F(400, 14), qInk.rgba(.70, true), 'left', W - sx - 70);
    } else {
      txt(rc, dt.artist, sx, y + 47, F(400, 14), qInk.rgba(.62, true), 'left', W - sx - 70);
    }
    icon(rc, 'grip', W - 36, y + 30, 20, qInk.rgba(.50, true));
    rc.fillStyle = qInk.rgba(.12, true);
    rc.fillRect(80, y + rh - .5, W - 80, .5);
  };
  const drawSwipedQueueRow = (rc, dt, y, swx, swSt) => {
    const rx = 12, rw = W - 24, rbh = rh - 4;
    if (swx < -0.5) {
      const revW = Math.min(rw, -swx);
      const revX = rx + rw - revW;
      rc.save();
      rrPath(rc, revX, y + 2, revW, rbh, 14);
      rc.clip();
      drawQueueSwipeRemoveBg(rc, revX, y + 2, revW, rbh, -swx, swSt);
      rc.restore();
    }
    rc.save();
    if (swx < -0.5) {
      const rowRight = Math.max(0, rx + rw - Math.min(rw, -swx) - 2);
      rc.beginPath();
      rc.rect(0, y - 2, rowRight, rh + 4);
      rc.clip();
    }
    rc.translate(swx, 0);
    drawQueueRowBody(rc, dt, y);
    rc.restore();
  };
  const drawRemovingQueueRows = (rc) => {
    const qRem = SH.qRemoving;
    if (!qRem || !qRem.length) return;
    const rx = 12, rw = W - 24;
    for (let j = 0; j < qRem.length; j++) {
      const rm = qRem[j];
      if (!rm || !rm.tr) continue;
      const y = base + 52 + rm.relY;
      const curH = rh * clamp(rm.hP, 0, 1);
      if (curH <= 0.5 || y + curH < top - 16 || y > bot + 16) continue;
      const rbh = Math.max(0, curH - 4);
      const revW = Math.min(rw, Math.max(0, -rm.x));
      const revX = rx + rw - revW;
      rc.save();
      rc.beginPath();
      rc.rect(0, y, W, curH);
      rc.clip();
      rc.globalAlpha *= clamp(rm.hP * 1.15, 0, 1);
      if (revW > 0.5 && rbh > 1) {
        rc.save();
        rrPath(rc, revX, y + 2, revW, rbh, Math.min(14, rbh / 2));
        rc.clip();
        drawQueueSwipeRemoveBg(rc, revX, y + 2, revW, rbh, Math.max(0, -rm.x), rm);
        rc.restore();
      }
      if (rm.x > -W + 10) {
        rc.save();
        const rowRight = Math.max(0, revX - 2);
        rc.beginPath();
        rc.rect(0, y, rowRight, curH);
        rc.clip();
        rc.translate(rm.x, 0);
        drawQueueRowBody(rc, rm.tr, y);
        rc.restore();
      }
      rc.restore();
    }
  };
  txt(qc, window.t('queue.up_next'), 24, base + 14, F(700, 18), qInk.hi);
  const subTxt = (PL.shuffle && PL.smartShuffle) ? window.t('queue.smart_shuffle_sub') : (PL.infinity ? window.t('queue.autoplay_sub') : window.t('queue.end_sub'));
  txt(qc, subTxt, 24, base + 34, F(400, 14), qInk.rgba(.62, true));
  const hasRemoving = Boolean(SH.qRemoving && SH.qRemoving.length);
  const showSkelRows = !rowCount && !hasRemoving && !!LIVE.radioBusy;
  const nowMs = performance.now();
  let skelCount = 0;
  if (!rowCount) {
    SH._qSkelFadeT0 = 0;
    if (showSkelRows) {
      SH._qSkelSeen = true;
      SH._qSkelSeenMs = nowMs;
      skelCount = drawQueueSkeleton(qc, base + 52, top, bot, qInk);
    }
    if (hasRemoving) drawRemovingQueueRows(qc);
  } else {
    if (SH._qSkelSeen) {
      SH._qSkelSeen = false;
      SH._qSkelFadeT0 = (SH._qSkelSeenMs && (nowMs - SH._qSkelSeenMs) < 1500) ? nowMs : 0;
    }
    let qFadeK = 1;
    const qFadeDt = SH._qSkelFadeT0 ? Math.max(0, nowMs - SH._qSkelFadeT0) : 9999;
    if (SH._qSkelFadeT0 && qFadeDt < 260) {
      const rp = clamp(qFadeDt / 260, 0, 1);
      qFadeK = 1 - Math.pow(1 - rp, 3);
      if ((1 - qFadeK) > 0.005) {
        qc.save();
        qc.globalAlpha *= (1 - qFadeK);
        drawQueueSkeleton(qc, base + 52, top, bot, qInk);
        qc.restore();
      }
      if (typeof _skulletActive !== 'undefined') _skulletActive = true;
      if (typeof window !== 'undefined' && window.__IN_DRAW_SCENE && typeof scheduleSceneAnimRedraw === 'function') {
        scheduleSceneAnimRedraw();
      } else if (typeof scheduleAnimRedraw === 'function') {
        scheduleAnimRedraw();
      }
    } else {
      SH._qSkelFadeT0 = 0;
    }

    const renderQueueRows = (rc) => {
      const qOff = SH.qOff || (SH.qOff = new Map());
      const seen = new Map();
      const qSwSeen = new Map();
      const activeKeys = new Set();
      for (let i = 0; i < rowCount; i++) {
        const t = PL.queue[qBase + i];
        const n = seen.get(t) || 0;
        seen.set(t, n + 1);
        const qk = n ? (t.id + '#' + n) : t;
        const idKey = (t && t.id) || t;
        const qn = qSwSeen.get(idKey) || 0;
        qSwSeen.set(idKey, qn + 1);
        const qSwKey = 'q:' + ((t && t.id) ? t.id : ('r' + i)) + '#' + qn;
        activeKeys.add(qk);
        if (isDragging && i === SH.dragQueue.fromIdx) {
          qOff.delete(qk);
          continue;
        }
        if (settleObj && i === settleObj.idx) {
          qOff.delete(qk);
          continue;
        }

        let visualI = i;
        if (isDragging && SH.dragQueue) {
          const fromIdx = SH.dragQueue.fromIdx;
          if (fromIdx < targetI && i > fromIdx && i <= targetI) {
            visualI = i - 1;
          } else if (fromIdx > targetI && i >= targetI && i < fromIdx) {
            visualI = i + 1;
          }
        }

        const tgtRel = visualI * rh;
        let curRel = tgtRel;
        let entry = qOff.get(qk);
        if (isDragging || settleObj || entry) {
          if (!entry) {
            entry = { cur: i * rh, tgt: tgtRel };
            if (entry.cur !== tgtRel) qOff.set(qk, entry);
          } else {
            entry.tgt = tgtRel;
          }
          if (entry) curRel = entry.cur;
        }

        const y = base + 52 + curRel; if (y < top - 70 || y > bot + 10) continue;
        const swSt = typeof swqRowState === 'function' ? swqRowState(qSwKey) : null;
        const swx = swSt ? swSt.x : 0;
        if (Math.abs(swx) > 0.05) {
          drawSwipedQueueRow(rc, t, y, swx, swSt);
        } else {
          drawQueueRowBody(rc, t, y);
        }
        if (!isDragging && fadeAlpha > .5 && SH.mode === 'queue' && y + rh > top && y < bot) {
          const cy0 = Math.max(top, y), cy1 = Math.min(bot, y + rh);
          shit(0, cy0, W - 60, cy1 - cy0, () => { PL.qi += i + 1; PL.pos = 0; loadAudio(); redraw(); }, 'queue', { qRowKey: qSwKey, qRowIdx: i, qAbsIdx: qBase + i, qRowTrack: t });
          shit(W - 60, cy0, 60, cy1 - cy0, null, 'queueGrip', { rowIdx: i, absIdx: qBase + i, item: t });
        }
      }
      for (const k of qOff.keys()) { if (!activeKeys.has(k)) qOff.delete(k); }

      drawRemovingQueueRows(rc);

      if (isDragging && SH.dragQueue && SH.dragQueue.rowItem) {
        drawPillRow(rc, SH.dragQueue.rowItem, pillY, SH.dragQueue.lift != null ? SH.dragQueue.lift : 1);
      } else if (settleObj) {
        drawPillRow(rc, settleObj.item, base + 52 + settleObj.relY, settleObj.lift);
      }
    };

    if (qFadeK < 1 && typeof document !== 'undefined') {
      if (!_qFadeCv) { _qFadeCv = document.createElement('canvas'); _qFadeCtx = _qFadeCv.getContext('2d'); }
      if (_qFadeCv.width !== mw || _qFadeCv.height !== mh) { _qFadeCv.width = mw; _qFadeCv.height = mh; }
      const fc = _qFadeCtx;
      fc.setTransform(1, 0, 0, 1, 0, 0);
      fc.clearRect(0, 0, mw, mh);
      fc.save();
      fc.scale(dpr, dpr);
      fc.translate(0, -y0);
      renderQueueRows(fc);
      fc.restore();
      if (qFadeK > 0.005) {
        qc.save();
        qc.setTransform(1, 0, 0, 1, 0, 0);
        qc.globalAlpha *= qFadeK;
        qc.drawImage(_qFadeCv, 0, 0);
        qc.restore();
      }
    } else {
      renderQueueRows(qc);
    }
  }
  qc.restore();
  const Q_TOPZ = 42, Q_BOTZ = 68;
  const topFade = clamp(SH.qScroll / 22, 0, 1);
  const effRowCount = rowCount || skelCount;
  const hasBotOverflow = (52 + effRowCount * rh - SH.qScroll) > (bot - top) - 8 || SH.qMax > 0;
  if (topFade > 0.005 || hasBotOverflow) {
    const g = qc.createLinearGradient(0, 0, 0, mh);
    const topEnd = Math.min(0.45, (Q_TOPZ + 8) / availH);
    const botStart = Math.max(topEnd + 0.02, 1 - Q_BOTZ / availH);
    const N = 8;
    if (topFade > 0.005) {
      const minTopA = 1 - topFade;
      for (let s = 0; s <= N; s++) {
        const u = s / N;
        const sm = u * u * (3 - 2 * u);
        const a = minTopA + topFade * sm;
        g.addColorStop(u * topEnd, 'rgba(0,0,0,' + a.toFixed(3) + ')');
      }
    } else {
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(topEnd, 'rgba(0,0,0,1)');
    }
    if (hasBotOverflow) {
      for (let s = 0; s <= N; s++) {
        const u = s / N;
        const sm = u * u * (3 - 2 * u);
        const a = 1 - sm;
        g.addColorStop(botStart + u * (1 - botStart), 'rgba(0,0,0,' + a.toFixed(3) + ')');
      }
    } else {
      g.addColorStop(botStart, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
    }
    qc.globalCompositeOperation = 'destination-in';
    qc.fillStyle = g;
    qc.fillRect(0, 0, mw, mh);
    qc.globalCompositeOperation = 'source-over';
  }
  c.save();
  c.globalAlpha = fadeAlpha;
  c.drawImage(_qMaskCv, 0, 0, mw, mh, 0, y0, W, availH);
  c.restore();
}

function reorderQueue(fromIdx, toIdx) {
  if (fromIdx == null || toIdx == null || fromIdx === toIdx) return;
  const absFrom = PL.qi + 1 + fromIdx;
  const absTo = PL.qi + 1 + toIdx;
  if (absFrom >= 0 && absFrom < PL.queue.length && absTo >= 0 && absTo < PL.queue.length) {
    const [moved] = PL.queue.splice(absFrom, 1);
    PL.queue.splice(absTo, 0, moved);
    if (typeof syncNativeNextTrack === 'function') syncNativeNextTrack(true);
    const nx = PL.queue[PL.qi + 1];
    if (nx) {
      if (nx.id && typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.prefetch === 'function') {
        try { window.SonoraNative.prefetch(nx.id); } catch (e) {}
      }
      if (typeof preloadArt === 'function') preloadArt(nx, true);
    }
    redraw();
  }
}
window.reorderQueue = reorderQueue;

function removeFromQueue(rowIdx, tr, swState) {
  if (!PL || !Array.isArray(PL.queue)) return false;
  const qBase = PL.qi + 1;
  let absIdx = (rowIdx != null) ? (qBase + rowIdx) : -1;
  if (!(absIdx >= qBase && absIdx < PL.queue.length && (!tr || PL.queue[absIdx] === tr))) {
    absIdx = tr ? PL.queue.indexOf(tr, qBase) : -1;
  }
  if (absIdx < qBase || absIdx >= PL.queue.length) return false;
  const effRowIdx = absIdx - qBase;
  const remTrack = PL.queue[absIdx];
  const rh = 60;
  const qOff = SH.qOff || (SH.qOff = new Map());
  const oldRowCount = Math.max(0, PL.queue.length - qBase);
  const oldSeen = new Map();
  const survivingCurs = [];
  let remRelY = effRowIdx * rh;
  for (let i = 0; i < oldRowCount; i++) {
    const t = PL.queue[qBase + i];
    const n = oldSeen.get(t) || 0;
    oldSeen.set(t, n + 1);
    const qk = n ? (t.id + '#' + n) : t;
    const existing = qOff.get(qk);
    const curRel = existing ? existing.cur : i * rh;
    if (i === effRowIdx) {
      remRelY = curRel;
      qOff.delete(qk);
    } else {
      survivingCurs.push(curRel);
    }
  }
  PL.queue.splice(absIdx, 1);
  qOff.clear();
  const newRowCount = Math.max(0, PL.queue.length - qBase);
  const newSeen = new Map();
  for (let i = 0; i < newRowCount; i++) {
    const t = PL.queue[qBase + i];
    const n = newSeen.get(t) || 0;
    newSeen.set(t, n + 1);
    const qk = n ? (t.id + '#' + n) : t;
    const oldCur = survivingCurs[i] != null ? survivingCurs[i] : i * rh;
    const tgtRel = i * rh;
    if (Math.abs(oldCur - tgtRel) > 0.2) {
      qOff.set(qk, { cur: oldCur, tgt: tgtRel });
    }
  }
  if (!SH.qRemoving) SH.qRemoving = [];
  SH.qRemoving.push({
    tr: remTrack,
    relY: remRelY,
    x: swState ? (swState.x || 0) : -96,
    v: swState ? (swState.v || 0) : 0,
    crossP: swState && swState.crossP != null ? swState.crossP : 1,
    hitT: swState ? (swState.hitT || 0) : 0,
    doneT: performance.now(),
    hP: 1
  });
  if (typeof syncNativeNextTrack === 'function') syncNativeNextTrack(true);
  if (absIdx === qBase) {
    const nx = PL.queue[qBase];
    if (nx) {
      if (nx.id && typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.prefetch === 'function') {
        try { window.SonoraNative.prefetch(nx.id); } catch (e) {}
      }
      if (typeof preloadArt === 'function') preloadArt(nx, true);
    }
  }
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
  return true;
}
window.removeFromQueue = removeFromQueue;
