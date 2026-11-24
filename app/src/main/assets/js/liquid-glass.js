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
uniform sampler2D uScene; uniform sampler2D uBlur; uniform sampler2D uUI; uniform sampler2D uTopMid;
uniform vec2 uRes; uniform float uDpr; uniform float uDither; uniform float uUseUI;
uniform float uMode;
uniform vec4 uRect; uniform float uRadius; uniform float uOpacity;
uniform float uRefH; uniform float uRefA; uniform float uDepth; uniform float uChroma; uniform float uZoom;
uniform float uBlurMix; uniform float uSlosh; uniform float uGlow;
uniform float uBright; uniform float uContrast; uniform float uSat;
uniform float uHlStyle; uniform vec4 uHlColor; uniform vec2 uHlDir; uniform float uHlFalloff; uniform float uHlWidth; uniform float uHlBlur; uniform float uHlAlpha;
uniform float uHasInner; uniform vec4 uInnerColor; uniform vec2 uInnerOff; uniform float uInnerR;
uniform vec4 uSurface; uniform vec4 uTint;
uniform vec4 uShadowC; uniform vec3 uShadowP;
uniform vec4 uTopBlur; uniform vec4 uTopBlurPrev;
uniform float uTopBlurH; uniform float uTopSplit;
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
  if (uUseUI > 0.5) {
    vec4 u = texture2D(uUI, uv);
    vec3 s;
    if (blurMix <= 0.001) {
      s = texture2D(uScene, uv).rgb;
    } else {
      float barMask = smoothstep(0.01, 0.08, u.a);
      s = mix(texture2D(uScene, uv).rgb, texture2D(uBlur, uv).rgb, blurMix * barMask);
    }
    return u.rgb + s * (1.0 - u.a);
  }
  if (blurMix >= 0.999) return texture2D(uBlur, uv).rgb;
  if (blurMix <= 0.001) return texture2D(uScene, uv).rgb;
  return mix(texture2D(uScene, uv).rgb, texture2D(uBlur, uv).rgb, blurMix);
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
float noise(){ return (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0 * uDither; }

void main(){
  vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uMode > 1.5) {
    vec2 uv = q / uRes;
    vec3 col = texture2D(uScene, uv).rgb;
    if (q.y < uTopBlurH && (uTopBlur.a > 0.001 || uTopBlurPrev.a > 0.001)) {
      float isPrev = step(q.x, uTopSplit) * step(0.5, uTopSplit);
      vec4 tb = mix(uTopBlur, uTopBlurPrev, isPrev);
      if (tb.a > 0.001) {
        float shK = 1.0;
        if (uSheetCut.x > 0.0) {
          vec2 shHs = vec2(uRes.x * 0.5, uRes.y);
          vec2 shCc = q - vec2(uRes.x * 0.5, uSheetCut.x + uRes.y);
          float shSd = sdRR(shCc, shHs, uSheetCut.y);
          shK = smoothstep(-0.85 * uDpr, 0.5 * uDpr, shSd);
        }
        float p = tb.a * shK;
        if (p > 0.001) {
          float t = clamp(q.y / max(1.0, uTopBlurH), 0.0, 1.0);
          vec3 bHi = texture2D(uBlur, uv).rgb;
          vec3 bMid = texture2D(uTopMid, uv).rgb;
          vec2 px = (1.6 * uDpr) / uRes;
          vec3 bLow = 0.25 * (
            texture2D(uScene, clamp(uv + vec2(px.x, px.y), 0.0, 1.0)).rgb +
            texture2D(uScene, clamp(uv + vec2(-px.x, px.y), 0.0, 1.0)).rgb +
            texture2D(uScene, clamp(uv + vec2(px.x, -px.y), 0.0, 1.0)).rgb +
            texture2D(uScene, clamp(uv + vec2(-px.x, -px.y), 0.0, 1.0)).rgb
          );
          // Smooth 4-stop progressive blur matching original 6-band CSS curve (24px -> 8px -> 2.5px -> sharp)
          vec3 blurred;
          if (t < 0.36) {
            blurred = mix(bHi, bMid, smoothstep(0.08, 0.36, t));
          } else if (t < 0.72) {
            blurred = mix(bMid, bLow, smoothstep(0.36, 0.72, t));
          } else {
            blurred = mix(bLow, col, smoothstep(0.72, 1.0, t));
          }
          col = mix(col, blurred, p);
          // Original smooth top-to-bottom shadow/tint scrim (0.82 -> 0) blended over the progressive blur
          float tintA = 0.82 * (1.0 - t) * p;
          col = mix(col, tb.rgb, tintA);
        }
      }
    }
    gl_FragColor = vec4(col, 1.0);
    return;
  }

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
    float outMask = smoothstep(-0.85 * uDpr, 0.5 * uDpr, sd) * shKeep;
    if (outMask <= 0.001) discard;
    float R = max(uShadowP.x, 1.0);
    float ssd = sdRR(cc - uShadowP.yz, hs, r);
    float a = 1.0 / (1.0 + exp(clamp(3.404 * ssd / R, -20.0, 20.0)));
    a *= outMask * uShadowC.a * uOpacity;
    gl_FragColor = vec4(uShadowC.rgb * a, a);
    return;
  }

  float edge = (1.0 - smoothstep(-0.85 * uDpr, 0.5 * uDpr, sd)) * shKeep;
  if (edge <= 0.0) discard;

  vec2 eq = q;
  if (uZoom > 0.01 && abs(uZoom - 1.0) > 0.001) eq = cc / uZoom + uRect.xy;
  vec2 refq = eq; vec2 disp = vec2(0.0);
  float gr = min(r * 1.5, min(hs.x, hs.y));
  vec2 cachedBg = vec2(0.0);
  bool hasBg = false;
  if (uRefH > 0.0 && uRefA != 0.0 && -sd < uRefH) {
    float cs = min(sd, 0.0);
    float d = circleMap(1.0 - (-cs / uRefH)) * (-uRefA);
    cachedBg = gradSdRR(cc, hs, gr);
    hasBg = true;
    vec2 nc = length(cc) > 0.0001 ? normalize(cc) : vec2(0.0);
    vec2 tg = cachedBg + uDepth * nc;
    vec2 g = length(tg) > 0.0001 ? normalize(tg) : vec2(0.0);
    refq = eq + d * g;
    if (uChroma > 0.0) disp = d * g * (uChroma * ((cc.x * cc.y) / (hs.x * hs.y)));
  }
  refq.x += uSlosh;

  vec3 col;
  if (dot(disp, disp) > 0.0001) {
    col.r = bd(refq + disp * 0.55, uBlurMix).r;
    col.g = bd(refq, uBlurMix).g;
    col.b = bd(refq - disp * 0.65, uBlurMix).b;
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
    if (mask > 0.001) {
      vec2 grad = hasBg ? cachedBg : gradSdRR(cc, hs, gr);
      float d = dot(grad, uHlDir);
      vec3 hlRgb = uTint.a > 0.25 ? mix(uHlColor.rgb, clamp(uTint.rgb * 1.35 + 0.2, 0.0, 1.0), clamp(uTint.a * 0.65, 0.0, 0.55)) : uHlColor.rgb;
      if (uHlStyle > 2.5) {
        if (d > 0.0) col = mix(col, hlRgb, clamp(pow(d, max(0.1, uHlFalloff)) * uHlAlpha * mask, 0.0, 1.0));
      } else if (uHlStyle > 1.5) {
        col = clamp(col + hlRgb * (pow(abs(d), max(0.1, uHlFalloff)) * uHlAlpha * mask), 0.0, 1.0);
      } else {
        col = clamp(col + hlRgb * (uHlAlpha * mask), 0.0, 1.0);
      }
    }
  }

  col = clamp(col + vec3(uGlow), 0.0, 1.0);
  float al = edge * uOpacity;
  gl_FragColor = vec4((col + noise()) * al, al);
}`;

  const BVS = 'attribute vec2 a; varying vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }';
  const DFS = `
precision mediump float;
varying vec2 v; uniform sampler2D uImage; uniform vec2 uTexel;
void main(){
  vec4 c = texture2D(uImage, v) * 0.5;
  c += (texture2D(uImage, v + vec2(-uTexel.x, -uTexel.y))
      + texture2D(uImage, v + vec2( uTexel.x, -uTexel.y))
      + texture2D(uImage, v + vec2(-uTexel.x,  uTexel.y))
      + texture2D(uImage, v + vec2( uTexel.x,  uTexel.y))) * 0.125;
  gl_FragColor = c;
}`;
  const BFS = `
precision mediump float;
varying vec2 v; uniform sampler2D uImage; uniform vec2 uStep;
vec2 reflectUV(vec2 uv){ vec2 m = mod(abs(uv), 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
void main(){
  vec2 o1 = uStep * 1.3846154;
  vec2 o2 = uStep * 3.2307692;
  vec4 c = texture2D(uImage, v) * 0.2270270;
  c += (texture2D(uImage, reflectUV(v + o1)) + texture2D(uImage, reflectUV(v - o1))) * 0.3162162;
  c += (texture2D(uImage, reflectUV(v + o2)) + texture2D(uImage, reflectUV(v - o2))) * 0.0702703;
  gl_FragColor = c;
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
    setPressed(on) { this._pt = on ? 1 : 0; this.lg.busy = true; if (typeof window !== 'undefined' && typeof window.wakeFrame === 'function') window.wakeFrame(); return this; }
    reset(name) { if (name) delete this.own[name]; else this.own = {}; return this; }
    destroy() { this.lg.remove(this); }
  }

  class LiquidGlass {

    constructor(canvas, options) {
      const o = options || {};
      this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
      if (!this.canvas) throw new Error('LiquidGlass: canvas not found');
      this.maxDpr = Math.min(o.maxDpr || 2, 2); this.autoUpload = o.autoUpload !== false; this.dither = o.dither !== false; this.onResize = o.onResize || null; this.onContextRestored = o.onContextRestored || null;
      this.defaults = Object.assign({}, o.defaults || {});
      this.glasses = []; this.scene = null; this.overlay = null; this.dpr = 1; this.busy = false;
      this.topBlur = [0, 0, 0, 0]; this.topBlurPrev = [0, 0, 0, 0]; this.topBlurH = 112; this.topBlurSplit = 0; this.topBlurSheetCut = null;
      this._sceneDirty = true; this._overlayDirty = true; this._sceneUp = false; this._overlayUp = false;
      this._sceneTexW = 0; this._sceneTexH = 0; this._ovTexW = 0; this._ovTexH = 0;
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
      this.prog = this._program(VS, FS); this.bprog = this._program(BVS, BFS); this.dprog = this._program(BVS, DFS);
      const names = ['uScene', 'uBlur', 'uUI', 'uTopMid', 'uRes', 'uBox', 'uDpr', 'uDither', 'uUseUI', 'uMode', 'uRect', 'uRadius', 'uOpacity', 'uRefH', 'uRefA', 'uDepth', 'uChroma', 'uZoom', 'uBlurMix', 'uSlosh', 'uGlow',
        'uBright', 'uContrast', 'uSat', 'uHlStyle', 'uHlColor', 'uHlDir', 'uHlFalloff', 'uHlWidth', 'uHlBlur', 'uHlAlpha', 'uHasInner', 'uInnerColor', 'uInnerOff', 'uInnerR', 'uSurface', 'uTint', 'uShadowC', 'uShadowP', 'uTopBlur', 'uTopBlurPrev', 'uTopBlurH', 'uTopSplit', 'uSheetCut'];
      this.U = {}; names.forEach((n) => { this.U[n] = gl.getUniformLocation(this.prog, n); });
      this.BU = { uImage: gl.getUniformLocation(this.bprog, 'uImage'), uStep: gl.getUniformLocation(this.bprog, 'uStep') };
      this.DU = { uImage: gl.getUniformLocation(this.dprog, 'uImage'), uTexel: gl.getUniformLocation(this.dprog, 'uTexel') };
      this.aLoc = gl.getAttribLocation(this.prog, 'a'); this.bLoc = gl.getAttribLocation(this.bprog, 'a'); this.dLoc = gl.getAttribLocation(this.dprog, 'a');
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
      this.texA = mk(3); this.texH = mk(3); this.texHT = mk(3); this.fboA = gl.createFramebuffer(); this.fboH = gl.createFramebuffer(); this.fboHT = gl.createFramebuffer();
      this.texT = mk(3); this.fboT = gl.createFramebuffer(); this._bl = new Map(); this._ver = 0; this._dsVer = -1;
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.scene);
      this._bw = this._bh = 0; this._sceneUp = this._overlayUp = false;
      this._sceneTexW = this._sceneTexH = this._ovTexW = this._ovTexH = 0;
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
        gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      };
      if (this._bw !== hw || this._bh !== hh) {
        alloc(this.texH, this.fboH, hw, hh); alloc(this.texHT, this.fboHT, hw, hh); alloc(this.texA, this.fboA, fw, fh); alloc(this.texT, this.fboT, fw, fh);
        for (const e of this._bl.values()) { gl.deleteTexture(e.tex); gl.deleteFramebuffer(e.fbo); }
        this._bl.clear(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); this._bw = hw; this._bh = hh; this._dsVer = -1;
      }
      const key = Math.round(radius * 2) / 2; let e = this._bl.get(key);
      const useHalf = key <= 6.0;
      if (e && e.ver === this._ver && this._dsVer === this._ver) return e.tex;
      if (this._blurFreeze && e) { this._blurStale = true; this._blurMapVer = -1; return e.tex; }
      // Unbind any FBO textures from TEXTURE1/TEXTURE3 before rendering to FBOs (prevents WebGL2 feedback loops)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      if (this._dsVer !== this._ver) {
        gl.useProgram(this.dprog); gl.disable(gl.BLEND);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tri); gl.enableVertexAttribArray(this.dLoc); gl.vertexAttribPointer(this.dLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(this.DU.uImage, 0);
        gl.uniform2f(this.DU.uTexel, 1.0 / cw, 1.0 / ch);
        gl.viewport(0, 0, hw, hh); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboH); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.scene); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.uniform2f(this.DU.uTexel, 1.0 / hw, 1.0 / hh);
        gl.viewport(0, 0, fw, fh); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA); gl.bindTexture(gl.TEXTURE_2D, this.texH); gl.drawArrays(gl.TRIANGLES, 0, 3);
        this._dsVer = this._ver;
        this._bprogBound = false;
      }
      if (!this._inBlurBatch || !this._bprogBound) {
        gl.useProgram(this.bprog); gl.disable(gl.BLEND);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tri); gl.enableVertexAttribArray(this.bLoc); gl.vertexAttribPointer(this.bLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(this.BU.uImage, 0);
        if (this._inBlurBatch) this._bprogBound = true;
      }
      const pass = (src, dst, w, h, dx, dy) => { gl.viewport(0, 0, w, h); gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(this.BU.uStep, dx, dy); gl.drawArrays(gl.TRIANGLES, 0, 3); };
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
        alloc(tex, fbo, useHalf ? hw : fw, useHalf ? hh : fh); e = { tex, fbo, ver: -1 }; this._bl.set(key, e);
      }
      if (useHalf) {
        // Half-res blur for light glass (tabbar/miniplayer/buttons): 4x more pixels + Dual-Kawase prefilter eliminates white-text shimmer
        const passes = radius > 4.5 ? 2 : 1;
        const s = (radius * 0.232) / Math.sqrt(passes);
        pass(this.texH, this.fboHT, hw, hh, s / hw, 0); pass(this.texHT, e.fbo, hw, hh, 0, s / hh);
        if (passes > 1) {
          pass(e.tex, this.fboHT, hw, hh, s / hw, 0); pass(this.texHT, e.fbo, hw, hh, 0, s / hh);
        }
      } else {
        // Clamp per-pass step <= 1.2 quarter-res px and chain passes to stay Nyquist-clean (zero ghosting/striping)
        const passes = radius > 18.0 ? 4 : (radius > 10.0 ? 3 : 2);
        const s = Math.min(1.2, (radius * 0.145) / Math.sqrt(passes));
        pass(this.texA, this.fboT, fw, fh, s / fw, 0); pass(this.texT, e.fbo, fw, fh, 0, s / fh);
        for (let pi = 1; pi < passes; pi++) {
          pass(e.tex, this.fboT, fw, fh, s / fw, 0); pass(this.texT, e.fbo, fw, fh, 0, s / fh);
        }
      }
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
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.scene);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.scene);
        this._sceneUp = true; this._sceneDirty = false; this._ver++;
      }
      if (this.overlay && (this.autoUpload || this._overlayDirty || !this._overlayUp)) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex.overlay);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.overlay);
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
      const tbProg = (this.topBlur && this.topBlur[3]) || 0;
      const tbPrevProg = (this.topBlurPrev && this.topBlurPrev[3]) || 0;
      const hasTopBlur = tbProg > 0.001 || tbPrevProg > 0.001;
      const tbBlurKey = Math.round(16 * dpr * 2) / 2;
      const tbMidKey = Math.round(6 * dpr * 2) / 2;
      this._blurStale = false;
      this._inBlurBatch = true; this._bprogBound = false;
      if (hasTopBlur) {
        if (!blurTex.has(tbBlurKey)) blurTex.set(tbBlurKey, this._blurTex(tbBlurKey));
        if (!blurTex.has(tbMidKey)) blurTex.set(tbMidKey, this._blurTex(tbMidKey));
      }
      for (let i = 0; i < list.length; i++) {
        const b = (list[i].get('blur') || 0) * dpr;
        if (b > 0.05) {
          const bk = Math.round(b * 2) / 2;
          if (!blurTex.has(bk)) blurTex.set(bk, this._blurTex(bk));
        }
      }
      this._inBlurBatch = false; this._bprogBound = false;
      const tbTex = hasTopBlur ? blurTex.get(tbBlurKey) : null;
      const tbMidTex = hasTopBlur ? blurTex.get(tbMidKey) : null;
      let boundBlurTex = null;

      gl.useProgram(this.prog); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(this.aLoc); gl.vertexAttribPointer(this.aLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(U.uScene, 0); gl.uniform1i(U.uBlur, 1); gl.uniform1i(U.uUI, 2); gl.uniform1i(U.uTopMid, 3);
      gl.uniform2f(U.uRes, cw, ch); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uDither, this.dither ? 1 : 0); gl.uniform1f(U.uUseUI, 0);
      gl.uniform4f(U.uTopBlur, this.topBlur[0], this.topBlur[1], this.topBlur[2], tbProg);
      gl.uniform4f(U.uTopBlurPrev, this.topBlurPrev[0], this.topBlurPrev[1], this.topBlurPrev[2], tbPrevProg);
      gl.uniform1f(U.uTopBlurH, (this.topBlurH || 112) * dpr);
      gl.uniform1f(U.uTopSplit, (this.topBlurSplit || 0) * dpr);
      if (hasTopBlur && tbTex) {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tbTex); boundBlurTex = tbTex;
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tbMidTex || tbTex);
      } else {
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      }
      const tbCut = this.topBlurSheetCut;
      if (tbCut && tbCut.y !== undefined) gl.uniform2f(U.uSheetCut, Math.max(0.01, tbCut.y * dpr), (tbCut.r || 0) * dpr);
      else gl.uniform2f(U.uSheetCut, 0, 0);
      gl.disable(gl.BLEND); gl.uniform1f(U.uMode, 2); this._box(0, 0, cw, ch);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const S = gl.SCISSOR_TEST;
      let scissorOn = false;
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
          if (sw <= 0 || sh2 <= 0) { if (scissorOn) { gl.disable(S); scissorOn = false; } continue; }
          if (!scissorOn) { gl.enable(S); scissorOn = true; }
          gl.scissor(sx0, sy0, sw, sh2);
        } else if (scissorOn) {
          gl.disable(S); scissorOn = false;
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
        if (bt && bt !== boundBlurTex) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bt); boundBlurTex = bt; }
        gl.uniform1f(U.uBlurMix, bt ? 1 : 0);
        gl.uniform1f(U.uRefH, (g.get('refractionHeight') || 0) * dpr); gl.uniform1f(U.uRefA, (g.get('refractionAmount') || 0) * dpr);
        gl.uniform1f(U.uDepth, g.get('depthEffect') ? 1 : 0);
        const ca = g.get('chromaticAberration'); gl.uniform1f(U.uChroma, typeof ca === 'number' ? ca : (ca ? 1 : 0));
        gl.uniform1f(U.uZoom, g.get('zoom') || 1); gl.uniform1f(U.uSlosh, clamp(g.slosh, -16, 16) * dpr);
        gl.uniform1f(U.uGlow, inter ? 0.08 * clamp(pp, 0, 1) : 0);
        gl.uniform1f(U.uBright, g.get('brightness') || 0); gl.uniform1f(U.uContrast, g.get('contrast') === undefined ? 1 : g.get('contrast'));
        gl.uniform1f(U.uSat, g.get('vibrancy') ? 1.5 : (g.get('saturation') === undefined ? 1 : g.get('saturation')));

        let hs = 0, hc0 = 1, hc1 = 1, hc2 = 1, hc3 = 0.5, ha = 0.7853981633974483, hf = 1, hwid = dpr, hb = 0.5 * dpr, hal = 1;
        const hl = g.get('highlight');
        if (hl) {
          if (typeof hl === 'object') {
            hs = hl.style === 'ambient' ? 3 : hl.style === 'plain' ? 1 : 2;
            if (hl.color) { const hpc = parseColor(hl.color); hc0 = hpc[0]; hc1 = hpc[1]; hc2 = hpc[2]; hc3 = hpc[3]; }
            if (hl.angle !== undefined) ha = hl.angle * 0.017453292519943295;
            if (hl.falloff !== undefined) hf = hl.falloff;
            if (hl.width !== undefined) hwid = hl.width * dpr;
            if (hl.blurRadius !== undefined) hb = hl.blurRadius * dpr;
            if (hl.alpha !== undefined) hal = hl.alpha;
          } else hs = 2;
        }
        gl.uniform1f(U.uHlStyle, hs); gl.uniform4f(U.uHlColor, hc0, hc1, hc2, hc3); gl.uniform2f(U.uHlDir, Math.cos(ha), Math.sin(ha)); gl.uniform1f(U.uHlFalloff, hf);
        gl.uniform1f(U.uHlWidth, hwid); gl.uniform1f(U.uHlBlur, hb); gl.uniform1f(U.uHlAlpha, hal);

        let hasIn = 0, ic0 = 0, ic1 = 0, ic2 = 0, ic3 = 0.15, iox = 0, ioy = 0, ir = 0; const is = g.get('innerShadow');
        if (is) {
          if (typeof is === 'object') {
            if (is.color) { const ipc = parseColor(is.color); ic0 = ipc[0]; ic1 = ipc[1]; ic2 = ipc[2]; ic3 = ipc[3]; }
            ir = (is.radius !== undefined ? is.radius : 24) * dpr;
            if (is.offset) { iox = is.offset.x * dpr; ioy = is.offset.y * dpr; } else { iox = 0; ioy = ir; }
            if (is.alpha !== undefined) ic3 *= is.alpha;
          } else { ir = 24 * dpr; iox = 0; ioy = 12 * dpr; }
          if (ic3 > 0.001 && ir > 0.1) hasIn = 1;
        }
        gl.uniform1f(U.uHasInner, hasIn); gl.uniform4f(U.uInnerColor, ic0, ic1, ic2, ic3); gl.uniform2f(U.uInnerOff, iox, ioy); gl.uniform1f(U.uInnerR, ir);
        const sf = parseColor(g.get('surfaceColor')), tt = parseColor(g.get('tint'));
        gl.uniform4f(U.uSurface, sf[0], sf[1], sf[2], sf[3]); gl.uniform4f(U.uTint, tt[0], tt[1], tt[2], tt[3]);
        this._box(cx - hw - 2, cy - hh - 2, cx + hw + 2, cy + hh + 2);
      }
      if (scissorOn) gl.disable(S);
      gl.disable(gl.BLEND);
      // Unbind FBO textures from TEXTURE1/TEXTURE3 after draw so next frame's FBO writes never hit feedback loops
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.blur);
      gl.activeTexture(gl.TEXTURE0);
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
