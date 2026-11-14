(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); module.exports.default = module.exports; }
  else { root.LiquidGlass = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  let _cctx = null, _ccN = 0; const _cc = {};
  function parseColor(c) {
    if (c == null || c === false) return [0, 0, 0, 0];
    if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]];
    const key = String(c); if (_cc[key]) return _cc[key];
    if (_ccN > 512) { for (const k in _cc) delete _cc[k]; _ccN = 0; }
    if (!_cctx) _cctx = document.createElement('canvas').getContext('2d');
    _cctx.fillStyle = '#000'; _cctx.fillStyle = key; const s = _cctx.fillStyle;
    let r = 0, g = 0, b = 0, a = 1;
    if (s[0] === '#') { r = parseInt(s.slice(1, 3), 16); g = parseInt(s.slice(3, 5), 16); b = parseInt(s.slice(5, 7), 16); }
    else { const m = s.match(/[\d.]+/g) || [0, 0, 0]; r = +m[0]; g = +m[1]; b = +m[2]; if (m.length > 3) a = +m[3]; }
    _ccN++;
    return (_cc[key] = [r / 255, g / 255, b / 255, a]);
  }

  const GLOBAL_DEFAULTS = {
    visible: true, layer: 1, opacity: 1, cornerRadius: 9999, interactive: false, useOverlay: false,
    blur: 0, refractionHeight: 16, refractionAmount: 24, depthEffect: 0, chromaticAberration: 0.8, zoom: 1,
    brightness: 0, contrast: 1, saturation: 1, vibrancy: false,
    highlight: { width: 1, blurRadius: 0.5, alpha: 0.5, style: 'default', angle: 45, falloff: 1 },
    shadow: { radius: 24, offsetX: 0, offsetY: 4, color: 'rgba(0,0,0,0.12)', alpha: 1 },
    innerShadow: null, surfaceColor: null, tint: null,
    clipXMin: undefined, clipXMax: undefined, clipYMax: undefined, clipSheet: null
  };

  const VS = 'attribute vec2 a; uniform vec2 uRes; uniform vec4 uBox; void main(){ vec2 p = uBox.xy + a * uBox.zw; gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0); }';

  const FS = `
precision highp float;
uniform sampler2D uScene; uniform sampler2D uBlur; uniform sampler2D uUI;
uniform vec2 uRes; uniform float uDpr; uniform float uDither; uniform float uUseUI;
uniform float uMode;
uniform vec4 uRect; uniform float uRadius; uniform float uOpacity;
uniform float uRefH; uniform float uRefA; uniform float uDepth; uniform float uChroma; uniform float uZoom;
uniform float uBlurMix; uniform float uSlosh; uniform float uGlow;
uniform float uBright; uniform float uContrast; uniform float uSat;
uniform float uHlStyle; uniform vec4 uHlColor; uniform float uHlAngle; uniform float uHlFalloff; uniform float uHlWidth; uniform float uHlBlur; uniform float uHlAlpha;
uniform float uHasInner; uniform vec4 uInnerColor; uniform vec2 uInnerOff; uniform float uInnerR;
uniform vec4 uSurface; uniform vec4 uTint;
uniform vec4 uShadowC; uniform vec3 uShadowP;
uniform vec4 uTopBlur;
uniform float uTopBlurH;
uniform vec2 uSheetCut;

float radiusFix(float r, vec2 hs){ return min(r, min(hs.x, hs.y)); }
float sdRR(vec2 p, vec2 hs, float r){
  vec2 q = abs(p) - (hs - vec2(r));
  return length(max(q, 0.0)) - r + min(max(q.x, q.y), 0.0);
}
vec2 gradSdRR(vec2 p, vec2 hs, float r){
  vec2 q = abs(p) - (hs - vec2(r));
  if (q.x >= 0.0 || q.y >= 0.0) {
    vec2 m = max(q, 0.0); float l = length(m);
    return l > 0.0001 ? sign(p) * (m / l) : vec2(0.0);
  }
  float gx = step(q.y, q.x);
  return sign(p) * vec2(gx, 1.0 - gx);
}
float circleMap(float x){ float c = clamp(x, -1.0, 1.0); return 1.0 - sqrt(max(0.0, 1.0 - c * c)); }
vec2 reflectUV(vec2 uv){ vec2 m = mod(abs(uv), 2.0); return mix(m, 2.0 - m, step(1.0, m)); }

vec3 bd(vec2 q, float blurMix){
  vec2 uv = reflectUV(q / uRes);
  vec3 s = texture2D(uScene, uv).rgb;
  if (blurMix > 0.001) s = mix(s, texture2D(uBlur, uv).rgb, blurMix);
  if (uUseUI > 0.5) {
    vec4 u = texture2D(uUI, uv);
    return u.rgb + s * (1.0 - u.a);
  }
  return s;
}
vec3 colorControls(vec3 col){
  if (uBright == 0.0 && uContrast == 1.0 && uSat == 1.0) return col;
  float inv = 1.0 - uSat;
  float r = 0.213 * inv, g = 0.715 * inv, b = 0.072 * inv;
  float c = uContrast, t = 0.5 - c * 0.5 + uBright;
  vec3 o;
  o.r = (c * (r + uSat)) * col.r + (c * g) * col.g + (c * b) * col.b + t;
  o.g = (c * r) * col.r + (c * (g + uSat)) * col.g + (c * b) * col.b + t;
  o.b = (c * r) * col.r + (c * g) * col.g + (c * (b + uSat)) * col.b + t;
  return clamp(o, 0.0, 1.0);
}
float noise(){ return (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0 * uDither; }

void main(){
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uMode > 1.5) { gl_FragColor = vec4(clamp(bd(q, 0.0) + noise(), 0.0, 1.0), 1.0); return; }

  float shKeep = 1.0;
  if (uSheetCut.x > 0.0) {
    vec2 shHs = vec2(uRes.x * 0.5, uRes.y);
    vec2 shCc = q - vec2(uRes.x * 0.5, uSheetCut.x + uRes.y);
    float shSd = sdRR(shCc, shHs, uSheetCut.y);
    shKeep = smoothstep(-0.85 * uDpr, 0.5 * uDpr, shSd);
    if (shKeep <= 0.001) discard;
  }

  vec2 hs = uRect.zw; vec2 cc = q - uRect.xy;
  float r = radiusFix(uRadius, hs);
  float sd = sdRR(cc, hs, r);

  if (uMode < 0.5) {
    float R = max(uShadowP.x, 1.0);
    float ssd = sdRR(cc - uShadowP.yz, hs, r);
    float a = 1.0 / (1.0 + exp(clamp(3.404 * ssd / R, -20.0, 20.0)));
    a *= smoothstep(-0.85 * uDpr, 0.5 * uDpr, sd) * uShadowC.a * uOpacity * shKeep;
    gl_FragColor = vec4(uShadowC.rgb * a, a);
    return;
  }

  float edge = (1.0 - smoothstep(-0.85 * uDpr, 0.5 * uDpr, sd)) * shKeep;
  if (edge <= 0.0) discard;

  vec2 eq = q;
  if (uZoom > 0.01 && abs(uZoom - 1.0) > 0.001) eq = cc / uZoom + uRect.xy;
  vec2 refq = eq; vec2 disp = vec2(0.0);
  if (uRefH > 0.0 && uRefA != 0.0 && -sd < uRefH) {
    float cs = min(sd, 0.0);
    float d = circleMap(1.0 - (-cs / uRefH)) * (-uRefA);
    float gr = min(r * 1.5, min(hs.x, hs.y));
    vec2 bg = gradSdRR(cc, hs, gr);
    vec2 nc = length(cc) > 0.0001 ? normalize(cc) : vec2(0.0);
    vec2 tg = bg + uDepth * nc;
    vec2 g = length(tg) > 0.0001 ? normalize(tg) : vec2(0.0);
    refq = eq + d * g;
    if (uChroma > 0.0) disp = d * g * (uChroma * ((cc.x * cc.y) / (hs.x * hs.y)));
  }
  refq.x += uSlosh;

  vec3 col;
  if (length(disp) > 0.01) {
    vec3 red = bd(refq + disp, uBlurMix);
    vec3 ora = bd(refq + disp * (2.0 / 3.0), uBlurMix);
    vec3 yel = bd(refq + disp * (1.0 / 3.0), uBlurMix);
    vec3 grn = bd(refq, uBlurMix);
    vec3 cya = bd(refq - disp * (1.0 / 3.0), uBlurMix);
    vec3 blu = bd(refq - disp * (2.0 / 3.0), uBlurMix);
    vec3 pur = bd(refq - disp, uBlurMix);
    col.r = red.r / 3.5 + ora.r / 3.5 + yel.r / 3.5 + pur.r / 7.0;
    col.g = ora.g / 7.0 + yel.g / 3.5 + grn.g / 3.5 + cya.g / 3.5;
    col.b = cya.b / 3.0 + blu.b / 3.0 + pur.b / 3.0;
  } else col = bd(refq, uBlurMix);

  col = colorControls(col);
  if (uTint.a > 0.0) col = mix(col, uTint.rgb, uTint.a);
  if (uSurface.a > 0.0) col = mix(col, uSurface.rgb, uSurface.a);

  if (uHasInner > 0.5 && uInnerR > 0.01 && uInnerColor.a > 0.001) {
    float ssd = sdRR(cc - uInnerOff, hs, r);
    float cut = smoothstep(-uInnerR, 0.0, ssd);
    float sa = cut * uInnerColor.a * smoothstep(0.0, uInnerR, -sd);
    col = mix(col, uInnerColor.rgb, clamp(sa, 0.0, 1.0));
  }

  if (uHlStyle > 0.5 && uHlAlpha > 0.0 && uHlWidth > 0.0) {
    float sdist = abs(sd + uHlWidth * 0.5) - (uHlWidth * 0.5);
    float mask = (1.0 - smoothstep(-0.25 * uDpr, max(0.85 * uDpr, uHlBlur), sdist)) * (1.0 - smoothstep(-1.0 * uDpr, 0.15 * uDpr, sd));
    float gr = min(r * 1.5, min(hs.x, hs.y));
    vec2 grad = gradSdRR(cc, hs, gr);
    vec2 nrm = vec2(cos(uHlAngle), sin(uHlAngle));
    float d = dot(grad, nrm);
    vec3 hlRgb = uTint.a > 0.25 ? mix(uHlColor.rgb, clamp(uTint.rgb * 1.35 + 0.2, 0.0, 1.0), clamp(uTint.a * 0.65, 0.0, 0.55)) : uHlColor.rgb;
    if (uHlStyle > 2.5) {
      if (d > 0.0) col = mix(col, hlRgb, clamp(pow(d, max(0.1, uHlFalloff)) * uHlAlpha * mask, 0.0, 1.0));
    } else if (uHlStyle > 1.5) {
      col = clamp(col + hlRgb * (pow(abs(d), max(0.1, uHlFalloff)) * uHlAlpha * mask), 0.0, 1.0);
    } else {
      col = clamp(col + hlRgb * (uHlAlpha * mask), 0.0, 1.0);
    }
  }

  col = clamp(col + vec3(uGlow), 0.0, 1.0);
  float al = edge * uOpacity;
  gl_FragColor = vec4((col + noise()) * al, al);
}`;

  const BVS = 'attribute vec2 a; varying vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }';
  const BFS = `
precision highp float;
varying vec2 v; uniform sampler2D uImage; uniform vec2 uStep;
vec2 reflectUV(vec2 uv){ vec2 m = mod(abs(uv), 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
void main(){
  vec4 c = texture2D(uImage, v) * 0.227027; float tw = 0.227027;
  for (int i = 1; i < 5; i++) {
    float w = i == 1 ? 0.1945946 : (i == 2 ? 0.1216216 : (i == 3 ? 0.054054 : 0.016216));
    vec2 o = uStep * float(i);
    c += texture2D(uImage, reflectUV(v + o)) * w; c += texture2D(uImage, reflectUV(v - o)) * w; tw += w * 2.0;
  }
  gl_FragColor = c / tw;
}`;

  class Glass {
    constructor(lg, opts) {
      this.lg = lg; this.own = {};
      this.x = 0; this.y = 0; this.width = 0; this.height = 0;
      this.press = 0; this.slosh = 0;
      this._pt = 0; this._pp = 0; this._pv = 0;
      this.set(opts || {});
    }
    set(o) {
      for (const k in o) {
        const v = o[k];
        if (k === 'x' || k === 'y' || k === 'width' || k === 'height' || k === 'press' || k === 'slosh') this[k] = v;
        else if (k in GLOBAL_DEFAULTS) this.own[k] = v;
        else console.warn('LiquidGlass: unknown option "' + k + '"');
      }
      return this;
    }
    get(name) {
      if (this.own[name] !== undefined) return this.own[name];
      const d = this.lg.defaults[name]; if (d !== undefined) return d;
      return GLOBAL_DEFAULTS[name];
    }
    setPressed(on) { this._pt = on ? 1 : 0; this.lg.busy = true; return this; }
    reset(name) { if (name) delete this.own[name]; else this.own = {}; return this; }
    destroy() { this.lg.remove(this); }
  }

  class LiquidGlass {

    constructor(canvas, options) {
      const o = options || {};
      this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
      if (!this.canvas) throw new Error('LiquidGlass: canvas not found');
      this.maxDpr = o.maxDpr || 3; this.autoUpload = o.autoUpload !== false; this.dither = o.dither !== false; this.onResize = o.onResize || null; this.onContextRestored = o.onContextRestored || null;
      this.defaults = Object.assign({}, o.defaults || {});
      this.glasses = []; this.scene = null; this.overlay = null; this.dpr = 1; this.busy = false;
      this.topBlur = [0, 0, 0, 0]; this.topBlurH = 112;
      this._sceneDirty = true; this._overlayDirty = true; this._sceneUp = false; this._overlayUp = false;
      this._bw = 0; this._bh = 0; this._lost = false; this._t = 0;
      this._initGL(); this.resize();
      if (o.autoResize !== false && typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(() => { this.resize(); if (this.onResize) this.onResize(this); this._sceneDirty = this._overlayDirty = true; });
        this._ro.observe(this.canvas);
      }
      this.canvas.addEventListener('webglcontextlost', this._lostH = (e) => { e.preventDefault(); this._lost = true; });
      this.canvas.addEventListener('webglcontextrestored', this._restH = () => { this._initGL(); this._lost = false; this._sceneDirty = this._overlayDirty = true; if (this.onContextRestored) this.onContextRestored(this); });
    }

    static supported() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } }

    _program(vs, fs) {
      const gl = this.gl, sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error('LiquidGlass shader: ' + gl.getShaderInfoLog(x)); return x; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('LiquidGlass link: ' + gl.getProgramInfoLog(p));
      return p;
    }

    _initGL() {
      const attr = { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
      const gl = this.gl = this.canvas.getContext('webgl2', attr) || this.canvas.getContext('webgl', attr);
      if (!gl) throw new Error('LiquidGlass: WebGL is not available');
      this.prog = this._program(VS, FS); this.bprog = this._program(BVS, BFS);
      const names = ['uScene', 'uBlur', 'uUI', 'uRes', 'uBox', 'uDpr', 'uDither', 'uUseUI', 'uMode', 'uRect', 'uRadius', 'uOpacity', 'uRefH', 'uRefA', 'uDepth', 'uChroma', 'uZoom', 'uBlurMix', 'uSlosh', 'uGlow',
        'uBright', 'uContrast', 'uSat', 'uHlStyle', 'uHlColor', 'uHlAngle', 'uHlFalloff', 'uHlWidth', 'uHlBlur', 'uHlAlpha', 'uHasInner', 'uInnerColor', 'uInnerOff', 'uInnerR', 'uSurface', 'uTint', 'uShadowC', 'uShadowP', 'uTopBlur', 'uTopBlurH', 'uSheetCut'];
      this.U = {}; names.forEach((n) => { this.U[n] = gl.getUniformLocation(this.prog, n); });
      this.BU = { uImage: gl.getUniformLocation(this.bprog, 'uImage'), uStep: gl.getUniformLocation(this.bprog, 'uStep') };
      this.aLoc = gl.getAttribLocation(this.prog, 'a'); this.bLoc = gl.getAttribLocation(this.bprog, 'a');
      this.quad = gl.createBuffer(); this.tri = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      if (!this._list) this._list = [];
      if (!this._blurTexMap) this._blurTexMap = new Map();
      const mk = (unit, filter) => {
        gl.activeTexture(gl.TEXTURE0 + unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); return t;
      };
      this.tex = { scene: mk(0), blur: mk(1), overlay: mk(2) };
      this.texA = mk(3); this.texH = mk(3); this.fboA = gl.createFramebuffer(); this.fboH = gl.createFramebuffer();
      this.texT = mk(3); this.fboT = gl.createFramebuffer(); this._bl = new Map(); this._ver = 0; this._dsVer = -1;
      this._bw = this._bh = 0; this._sceneUp = this._overlayUp = false;
      this._blurFreeze = false; this._blurStale = false;
    }

    setScene(src) { this.scene = src; this._sceneDirty = true; return this; }
    setOverlay(src) { this.overlay = src; this._overlayDirty = true; return this; }
    markSceneDirty() { this._sceneDirty = true; }
    markOverlayDirty() { this._overlayDirty = true; }
    setDefaults(o) { Object.assign(this.defaults, o); return this; }
    get width() { return this.canvas.clientWidth; }
    get height() { return this.canvas.clientHeight; }

    resize() {
      const c = this.canvas; this.dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, this.maxDpr);
      const w = Math.max(1, Math.round(c.clientWidth * this.dpr)), h = Math.max(1, Math.round(c.clientHeight * this.dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      return this;
    }

    add(opts) { const g = new Glass(this, opts); this.glasses.push(g); return g; }
    remove(g) { const i = this.glasses.indexOf(g); if (i >= 0) this.glasses.splice(i, 1); return this; }

    _animate(dt) {
      const k = 300, c = 2 * 0.5 * Math.sqrt(k); let busy = false;
      for (const g of this.glasses) {
        if (!g.get('interactive')) continue;
        const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (let i = 0; i < n; i++) { const a = k * (g._pt - g._pp) - c * g._pv; g._pv += a * h; g._pp += g._pv * h; }
        if (Math.abs(g._pt - g._pp) < 0.001 && Math.abs(g._pv) < 0.01) { g._pp = g._pt; g._pv = 0; } else busy = true;
      }
      this.busy = busy;
    }

    _blurTex(radius) {
      const gl = this.gl, cw = this.canvas.width, ch = this.canvas.height;
      const hw = Math.max(16, cw >> 1), hh = Math.max(16, ch >> 1), fw = Math.max(16, cw >> 2), fh = Math.max(16, ch >> 2);
      const alloc = (tex, fbo, w, h) => {
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      };
      if (this._bw !== fw || this._bh !== fh) {
        alloc(this.texH, this.fboH, hw, hh); alloc(this.texA, this.fboA, fw, fh); alloc(this.texT, this.fboT, fw, fh);
        for (const e of this._bl.values()) { gl.deleteTexture(e.tex); gl.deleteFramebuffer(e.fbo); }
        this._bl.clear(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); this._bw = fw; this._bh = fh; this._dsVer = -1;
      }
      const key = Math.round(radius * 2) / 2; let e = this._bl.get(key);
      if (e && e.ver === this._ver) return e.tex;
      if (this._blurFreeze && e) { this._blurStale = true; this._blurMapVer = -1; return e.tex; }
      if (!this._inBlurBatch || !this._bprogBound) {
        gl.useProgram(this.bprog); gl.disable(gl.BLEND);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tri); gl.enableVertexAttribArray(this.bLoc); gl.vertexAttribPointer(this.bLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(this.BU.uImage, 0);
        if (this._inBlurBatch) this._bprogBound = true;
      }
      const pass = (src, dst, w, h, dx, dy) => { gl.viewport(0, 0, w, h); gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(this.BU.uStep, dx, dy); gl.drawArrays(gl.TRIANGLES, 0, 3); };
      if (this._dsVer !== this._ver) { pass(this.tex.scene, this.fboH, hw, hh, 0, 0); pass(this.texH, this.fboA, fw, fh, 0, 0); this._dsVer = this._ver; }
      if (!e) {
        if (this._bl.size >= 16) {
          for (const [k2, e2] of this._bl) {
            if (e2.ver !== this._ver) {
              gl.deleteTexture(e2.tex); gl.deleteFramebuffer(e2.fbo); this._bl.delete(k2);
              break;
            }
          }
        }
        const tex = gl.createTexture(), fbo = gl.createFramebuffer();
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        alloc(tex, fbo, fw, fh); e = { tex, fbo, ver: -1 }; this._bl.set(key, e);
      }
      const s = radius * 0.082;
      pass(this.texA, this.fboT, fw, fh, s / fw, 0); pass(this.texT, e.fbo, fw, fh, 0, s / fh);
      pass(e.tex, this.fboT, fw, fh, s / fw, 0); pass(this.texT, e.fbo, fw, fh, 0, s / fh);
      e.ver = this._ver; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.scene);
      return e.tex;
    }
    _box(x0, y0, x1, y1) {
      const cw = this.canvas.width, ch = this.canvas.height;
      x0 = clamp(x0, 0, cw); x1 = clamp(x1, 0, cw); y0 = clamp(y0, 0, ch); y1 = clamp(y1, 0, ch);
      if (x1 <= x0 || y1 <= y0) return;
      this.gl.uniform4f(this.U.uBox, x0, y0, x1 - x0, y1 - y0);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    render() {
      if (this._lost || !this.scene || (this.gl && typeof this.gl.isContextLost === 'function' && this.gl.isContextLost())) return this;
      const gl = this.gl, U = this.U, now = performance.now(), dt = Math.min(0.05, (now - (this._t || now)) / 1000); this._t = now;
      this._animate(dt);
      const cw = this.canvas.width, ch = this.canvas.height, dpr = this.dpr;
      if (this.autoUpload || this._sceneDirty || !this._sceneUp) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.scene); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.scene);
        this._sceneUp = true; this._sceneDirty = false; this._ver++;
      }
      if (this.overlay && (this.autoUpload || this._overlayDirty || !this._overlayUp)) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex.overlay); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.overlay);
        this._overlayUp = true; this._overlayDirty = false;
      }
      const list = this._list || (this._list = []);
      list.length = 0;
      const glasses = this.glasses;
      for (let i = 0; i < glasses.length; i++) {
        const g = glasses[i];
        if (!g.get('visible') || g.width <= 0 || g.height <= 0 || g.get('opacity') <= 0.003) continue;
        const clipMin = g.get('clipXMin'), clipMax = g.get('clipXMax'), clipYMax = g.get('clipYMax');
        if (clipMin !== undefined || clipMax !== undefined || clipYMax !== undefined) {
          const sx0 = clamp(Math.round((clipMin !== undefined ? clipMin : 0) * dpr), 0, cw);
          const sx1 = clamp(Math.round((clipMax !== undefined ? clipMax * dpr : cw)), 0, cw);
          const sy0 = clamp(Math.round(ch - (clipYMax !== undefined ? clipYMax * dpr : ch)), 0, ch);
          if (sx1 <= sx0 || ch <= sy0) continue;
        }
        g._renderIdx = i;
        list.push(g);
      }
      if (list.length > 1) list.sort((a, b) => (a.get('layer') - b.get('layer')) || (a._renderIdx - b._renderIdx));
      const blurTex = this._blurTexMap || (this._blurTexMap = new Map());
      if (this._blurMapVer !== this._ver || this._blurMapW !== cw || this._blurMapH !== ch || this._blurMapDpr !== dpr) {
        blurTex.clear();
        this._blurMapVer = this._ver; this._blurMapW = cw; this._blurMapH = ch; this._blurMapDpr = dpr;
      }
      this._blurStale = false;
      this._inBlurBatch = true; this._bprogBound = false;
      for (let i = 0; i < list.length; i++) {
        const b = (list[i].get('blur') || 0) * dpr;
        if (b > 0.05) {
          const bk = Math.round(b * 2) / 2;
          if (!blurTex.has(bk)) blurTex.set(bk, this._blurTex(bk));
        }
      }
      this._inBlurBatch = false; this._bprogBound = false;
      const tbProg = (this.topBlur && this.topBlur[3]) || 0;

      gl.useProgram(this.prog); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(this.aLoc); gl.vertexAttribPointer(this.aLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(U.uScene, 0); gl.uniform1i(U.uBlur, 1); gl.uniform1i(U.uUI, 2);
      gl.uniform2f(U.uRes, cw, ch); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uDither, this.dither ? 1 : 0); gl.uniform1f(U.uUseUI, 0);
      gl.uniform4f(U.uTopBlur, this.topBlur[0], this.topBlur[1], this.topBlur[2], tbProg);
      gl.uniform1f(U.uTopBlurH, (this.topBlurH || 112) * dpr);
      gl.disable(gl.BLEND); gl.uniform1f(U.uMode, 2); this._box(0, 0, cw, ch);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const S = gl.SCISSOR_TEST;
      for (let li = 0; li < list.length; li++) {
        const g = list[li];
        const inter = !!g.get('interactive'), pp = clamp(inter ? g._pp : g.press, 0, 1.5);
        const sc = inter ? 1 + (1.6 / Math.max(1, g.height)) * pp : 1;
        const cx = (g.x + g.width / 2) * dpr, cy = (g.y + g.height / 2) * dpr, hw = g.width / 2 * dpr * sc, hh = g.height / 2 * dpr * sc;
        const radius = Math.min(g.get('cornerRadius') * dpr * sc, hw, hh), opacity = g.get('opacity');
        const clipMin = g.get('clipXMin'), clipMax = g.get('clipXMax'), clipYMax = g.get('clipYMax');
        const hasClip = clipMin !== undefined || clipMax !== undefined || clipYMax !== undefined;
        if (hasClip) {
          const sx0 = clamp(Math.round((clipMin !== undefined ? clipMin : 0) * dpr), 0, cw);
          const sx1 = clamp(Math.round((clipMax !== undefined ? clipMax * dpr : cw)), 0, cw);
          const sy0 = clamp(Math.round(ch - (clipYMax !== undefined ? clipYMax * dpr : ch)), 0, ch);
          const sw = sx1 - sx0, sh2 = ch - sy0;
          if (sw <= 0 || sh2 <= 0) { gl.disable(S); continue; }
          gl.enable(S); gl.scissor(sx0, sy0, sw, sh2);
        } else {
          gl.disable(S);
        }
        gl.uniform4f(U.uRect, cx, cy, hw, hh); gl.uniform1f(U.uRadius, radius); gl.uniform1f(U.uOpacity, opacity);
        gl.uniform1f(U.uUseUI, g.get('useOverlay') ? 1 : 0);
        const cs = g.get('clipSheet');
        if (cs && cs.y !== undefined) gl.uniform2f(U.uSheetCut, Math.max(0.01, cs.y * dpr), (cs.r || 0) * dpr);
        else gl.uniform2f(U.uSheetCut, 0, 0);

        const sh = g.get('shadow');
        if (sh) {
          const s = typeof sh === 'object' ? sh : {}, R = (s.radius !== undefined ? s.radius : 24) * dpr;
          const ox = (s.offsetX !== undefined ? s.offsetX : (s.offset ? s.offset.x : 0)) * dpr;
          const oy = (s.offsetY !== undefined ? s.offsetY : (s.offset ? s.offset.y : R / dpr / 6)) * dpr;
          const col = parseColor(s.color !== undefined ? s.color : 'rgba(0,0,0,0.12)'), a = col[3] * (s.alpha !== undefined ? s.alpha : 1);
          if (a > 0.002 && R > 0.1) {
            gl.uniform1f(U.uMode, 0); gl.uniform4f(U.uShadowC, col[0], col[1], col[2], a); gl.uniform3f(U.uShadowP, R, ox, oy);
            const m = R * 1.6 + 4; this._box(cx - hw - m + Math.min(0, ox), cy - hh - m + Math.min(0, oy), cx + hw + m + Math.max(0, ox), cy + hh + m + Math.max(0, oy));
          }
        }

        gl.uniform1f(U.uMode, 1);
        const blur = g.get('blur') || 0, blurPx = blur * dpr;
        const bt = blurPx > 0.05 ? blurTex.get(Math.round(blurPx * 2) / 2) : null;
        if (bt) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bt); }
        gl.uniform1f(U.uBlurMix, bt ? 1 : 0);
        gl.uniform1f(U.uRefH, (g.get('refractionHeight') || 0) * dpr); gl.uniform1f(U.uRefA, (g.get('refractionAmount') || 0) * dpr);
        gl.uniform1f(U.uDepth, g.get('depthEffect') ? 1 : 0);
        const ca = g.get('chromaticAberration'); gl.uniform1f(U.uChroma, typeof ca === 'number' ? ca : (ca ? 1 : 0));
        gl.uniform1f(U.uZoom, g.get('zoom') || 1); gl.uniform1f(U.uSlosh, clamp(g.slosh, -16, 16) * dpr);
        gl.uniform1f(U.uGlow, inter ? 0.08 * clamp(pp, 0, 1) : 0);
        gl.uniform1f(U.uBright, g.get('brightness') || 0); gl.uniform1f(U.uContrast, g.get('contrast') === undefined ? 1 : g.get('contrast'));
        gl.uniform1f(U.uSat, g.get('vibrancy') ? 1.5 : (g.get('saturation') === undefined ? 1 : g.get('saturation')));

        let hs = 0, hc = [1, 1, 1, 0.5], ha = (45 * Math.PI) / 180, hf = 1, hwid = dpr, hb = 0.5 * dpr, hal = 1;
        const hl = g.get('highlight');
        if (hl) {
          if (typeof hl === 'object') {
            hs = hl.style === 'ambient' ? 3 : hl.style === 'plain' ? 1 : 2;
            if (hl.color) hc = parseColor(hl.color);
            if (hl.angle !== undefined) ha = hl.angle * Math.PI / 180;
            if (hl.falloff !== undefined) hf = hl.falloff;
            if (hl.width !== undefined) hwid = hl.width * dpr;
            if (hl.blurRadius !== undefined) hb = hl.blurRadius * dpr;
            if (hl.alpha !== undefined) hal = hl.alpha;
          } else hs = 2;
        }
        gl.uniform1f(U.uHlStyle, hs); gl.uniform4f(U.uHlColor, hc[0], hc[1], hc[2], hc[3]); gl.uniform1f(U.uHlAngle, ha); gl.uniform1f(U.uHlFalloff, hf);
        gl.uniform1f(U.uHlWidth, hwid); gl.uniform1f(U.uHlBlur, hb); gl.uniform1f(U.uHlAlpha, hal);

        let hasIn = 0, ic = [0, 0, 0, 0.15], io = [0, 0], ir = 0; const is = g.get('innerShadow');
        if (is) {
          if (typeof is === 'object') {
            if (is.color) ic = parseColor(is.color).slice();
            ir = (is.radius !== undefined ? is.radius : 24) * dpr; io = is.offset ? [is.offset.x * dpr, is.offset.y * dpr] : [0, ir];
            if (is.alpha !== undefined) ic[3] *= is.alpha;
          } else { ir = 24 * dpr; io = [0, 12 * dpr]; }
          if (ic[3] > 0.001 && ir > 0.1) hasIn = 1;
        }
        gl.uniform1f(U.uHasInner, hasIn); gl.uniform4f(U.uInnerColor, ic[0], ic[1], ic[2], ic[3]); gl.uniform2f(U.uInnerOff, io[0], io[1]); gl.uniform1f(U.uInnerR, ir);
        const sf = parseColor(g.get('surfaceColor')), tt = parseColor(g.get('tint'));
        gl.uniform4f(U.uSurface, sf[0], sf[1], sf[2], sf[3]); gl.uniform4f(U.uTint, tt[0], tt[1], tt[2], tt[3]);
        this._box(cx - hw - 2, cy - hh - 2, cx + hw + 2, cy + hh + 2);
        if (hasClip) gl.disable(S);
      }
      gl.disable(gl.BLEND);
      return this;
    }

    destroy() {
      if (this._ro) this._ro.disconnect();
      const c = this.canvas; c.removeEventListener('webglcontextlost', this._lostH); c.removeEventListener('webglcontextrestored', this._restH);
      this.glasses.length = 0;
      const ext = this.gl && this.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    }
  }

  LiquidGlass.version = '2.0.0';
  LiquidGlass.defaults = GLOBAL_DEFAULTS;
  LiquidGlass.Glass = Glass;
  return LiquidGlass;
});
