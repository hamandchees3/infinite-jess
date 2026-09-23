// INFINITE JESS — core: WebGL2 plumbing, math, text, and shared renderers.
// Everything here is plain JS on the global IJ namespace so the film runs from file://.
(function () {
'use strict';
const IJ = (window.IJ = window.IJ || {});

// ------------------------------------------------------------------ math ---
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};
// Keyframes: frames = [[time, value], ...], value is a number or an array.
function key(t, frames, e = ease.sine) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0] = frames[i], [t1, v1] = frames[i + 1];
    if (t < t1) {
      const u = e((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return frames[frames.length - 1][1];
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Object.assign(IJ, { clamp, lerp, smooth, ease, key, rng });

// column-major 4x4 matrices
const M4 = {
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  persp(fovy, aspect, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / aspect; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  },
  lookAt(e, c, u = [0, 1, 0]) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  ortho2D(aspect) { // p-space (y in [-1,1], x in [-aspect,aspect]) -> clip
    const o = new Float32Array(16); o[0] = 1 / aspect; o[5] = 1; o[10] = 1; o[15] = 1; return o;
  },
};
IJ.M4 = M4;

// ----------------------------------------------------------- GLSL prelude ---
IJ.GLSL = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
uniform vec2 uRes;
uniform float uTime;
uniform float uLocal;
#define PI 3.14159265
#define TAU 6.2831853
float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y); }
float gnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  vec2 ga=hash22(i)*2.-1., gb=hash22(i+vec2(1,0))*2.-1., gc=hash22(i+vec2(0,1))*2.-1., gd=hash22(i+vec2(1,1))*2.-1.;
  float a=dot(ga,f), b=dot(gb,f-vec2(1,0)), c=dot(gc,f-vec2(0,1)), d=dot(gd,f-vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)*1.4; }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(1.7,9.2); a*=.5; } return s; }
float gfbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*gnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(1.7,9.2); a*=.5; } return s; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
float sdCircle(vec2 p, float r){ return length(p)-r; }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
float sdRBox(vec2 p, vec2 b, float r){ return sdBox(p, b-r)-r; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdCapsule(vec2 p, vec2 a, vec2 b, float ra, float rb){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-mix(ra,rb,h); }
float sdEllipse(vec2 p, vec2 ab){ float k0=length(p/ab), k1=length(p/(ab*ab)); return k0*(k0-1.)/max(k1,1e-5); }
float smin(float a, float b, float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }
float sdHeart(vec2 p){ p.x=abs(p.x);
  if(p.y+p.x>1.) return sqrt(dot(p-vec2(.25,.75),p-vec2(.25,.75)))-sqrt(2.)/4.;
  return sqrt(min(dot(p-vec2(0,1),p-vec2(0,1)), dot(p-.5*max(p.x+p.y,0.),p-.5*max(p.x+p.y,0.))))*sign(p.x-p.y); }
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C){
  vec2 a=B-A, b=A-2.*B+C, c=a*2., d=A-pos;
  float kk=1./max(dot(b,b),1e-6), kx=kk*dot(a,b), ky=kk*(2.*dot(a,a)+dot(d,b))/3., kz=kk*dot(d,a);
  float res=0., p=ky-kx*kx, p3=p*p*p, q=kx*(2.*kx*kx-3.*ky)+kz, h=q*q+4.*p3;
  if(h>=0.){ h=sqrt(h); vec2 x=(vec2(h,-h)-q)/2.; vec2 uv=sign(x)*pow(abs(x),vec2(1./3.)); float t=clamp(uv.x+uv.y-kx,0.,1.); vec2 q2=d+(c+b*t)*t; res=dot(q2,q2); }
  else { float z=sqrt(-p), v=acos(q/(p*z*2.))/3., m=cos(v), n=sin(v)*1.732050808; vec3 t=clamp(vec3(m+m,-n-m,n-m)*z-kx,0.,1.);
    vec2 q1=d+(c+b*t.x)*t.x; vec2 q2=d+(c+b*t.y)*t.y; res=min(dot(q1,q1),dot(q2,q2)); }
  return sqrt(res); }
float fillAA(float d, float aa){ return 1.-smoothstep(-aa, aa, d); }
vec3 hsv2rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(0,2,1)/3.)*6.-3.); return c.z*mix(vec3(1),clamp(p-1.,0.,1.),c.y); }
float luma(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float easeIO(float t){ t=clamp(t,0.,1.); return t<.5 ? 4.*t*t*t : 1.-pow(-2.*t+2.,3.)/2.; }
float sat(float x){ return clamp(x,0.,1.); }
`;

IJ.VS_FULL = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.-1., 0., 1.); }`;

// ------------------------------------------------------------- GL setup ---
IJ.initGL = function (canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  IJ.gl = gl;
  IJ.floatRT = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  IJ.emptyVAO = gl.createVertexArray();
  return gl;
};

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n');
    const m = /ERROR: \d+:(\d+)/.exec(log);
    const ln = m ? +m[1] : 0;
    const ctx = lines.slice(Math.max(0, ln - 4), ln + 2).map((l, i) => (Math.max(0, ln - 4) + i + 1) + ': ' + l).join('\n');
    console.error(`[${label}] shader compile error\n${log}\n${ctx}`);
    throw new Error(`Shader compile failed: ${label}`);
  }
  return s;
}

// Program with automatic uniform dispatch: prog.set({uName: value, ...}).
IJ.program = function (fsBody, vsSrc, label = 'prog') {
  const gl = IJ.gl;
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc || IJ.VS_FULL, label + '.vs');
  const fsSrc = fsBody.startsWith('#version') ? fsBody : IJ.GLSL + fsBody;
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, label + '.fs');
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(`[${label}] link error`, gl.getProgramInfoLog(p));
    throw new Error('Program link failed: ' + label);
  }
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  let unit = 0;
  const prog = {
    p, uniforms, label,
    use() { gl.useProgram(p); unit = 0; return prog; },
    set(obj) {
      for (const k in obj) {
        const u = uniforms[k]; if (!u) continue;
        const v = obj[k], l = u.loc;
        switch (u.type) {
          case gl.FLOAT: u.size > 1 ? gl.uniform1fv(l, v) : gl.uniform1f(l, v); break;
          case gl.FLOAT_VEC2: gl.uniform2fv(l, v); break;
          case gl.FLOAT_VEC3: gl.uniform3fv(l, v); break;
          case gl.FLOAT_VEC4: gl.uniform4fv(l, v); break;
          case gl.INT: case gl.BOOL: u.size > 1 ? gl.uniform1iv(l, v) : gl.uniform1i(l, v); break;
          case gl.FLOAT_MAT2: gl.uniformMatrix2fv(l, false, v); break;
          case gl.FLOAT_MAT3: gl.uniformMatrix3fv(l, false, v); break;
          case gl.FLOAT_MAT4: gl.uniformMatrix4fv(l, false, v); break;
          case gl.SAMPLER_2D: case gl.SAMPLER_3D: {
            const is3D = u.type === gl.SAMPLER_3D;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(is3D ? gl.TEXTURE_3D : gl.TEXTURE_2D, v);
            gl.uniform1i(l, unit++);
            break;
          }
        }
      }
      return prog;
    },
    // Full-screen pass with the standard uniforms.
    draw(obj) {
      prog.use();
      prog.set({ uRes: [IJ.curW, IJ.curH], uTime: IJ.time || 0 });
      if (obj) prog.set(obj);
      gl.bindVertexArray(IJ.emptyVAO);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return prog;
    },
  };
  return prog;
};

// Render targets. IJ.curW/curH track the bound target's size.
IJ.fbo = function (w, h, opts = {}) {
  const gl = IJ.gl;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const hdr = opts.float !== false && IJ.floatRT;
  gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  const filt = opts.nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let depth = null;
  if (opts.depth) {
    depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    fb, tex, w, h, depth,
    bind() { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); IJ.curW = w; IJ.curH = h; },
    dispose() { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); if (depth) gl.deleteRenderbuffer(depth); },
  };
};

IJ.blend = function (mode) {
  const gl = IJ.gl;
  if (!mode) { gl.disable(gl.BLEND); return; }
  gl.enable(gl.BLEND);
  if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
  else if (mode === 'premult') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  else if (mode === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
  else if (mode === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
};

// Scene-wide helpers for p-space: y in [-1,1], x in [-aspect, aspect].
IJ.aspect = () => IJ.curW / IJ.curH;

// -------------------------------------------------------------- text -------
// Rasterize text with the system's own fonts (no font files) into a texture.
IJ.FONTS = {
  serif: "'Hoefler Text', 'Baskerville', 'Garamond', 'Georgia', 'Times New Roman', serif",
  display: "'Didot', 'Bodoni 72', 'Hoefler Text', 'Baskerville', 'Georgia', serif",
  mono: "'American Typewriter', 'Courier New', 'Courier', monospace",
  chalk: "'Chalkduster', 'Chalkboard SE', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive",
  hand: "'Bradley Hand', 'Noteworthy', 'Segoe Print', 'Comic Sans MS', cursive",
  script: "'Snell Roundhand', 'Savoye LET', 'Brush Script MT', 'Segoe Script', cursive",
  sans: "'Avenir Next', 'Helvetica Neue', 'Segoe UI', Arial, sans-serif",
};
IJ.text = function (str, o = {}) {
  const gl = IJ.gl;
  const size = o.size || 128;
  const font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${IJ.FONTS[o.font] || o.font || IJ.FONTS.serif}`;
  const lines = String(str).split('\n');
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = font;
  const ls = (o.spacing || 0) * size;
  const measure = s => {
    if (!ls) return x.measureText(s).width;
    let w = 0; for (const ch of s) w += x.measureText(ch).width; return w + ls * Math.max(0, [...s].length - 1);
  };
  const widths = lines.map(measure);
  const lh = (o.lineHeight || 1.25) * size;
  const pad = Math.ceil(size * (o.pad != null ? o.pad : 0.3));
  c.width = Math.ceil(Math.max(...widths) + pad * 2);
  c.height = Math.ceil(lh * lines.length + pad * 2);
  x.font = font;
  x.fillStyle = o.color || '#fff';
  x.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    const w = widths[i];
    let px = pad;
    if (o.align === 'center') px = (c.width - w) / 2;
    else if (o.align === 'right') px = c.width - pad - w;
    const py = pad + lh * i + size * 0.95;
    if (!ls) x.fillText(line, px, py);
    else for (const ch of line) { x.fillText(ch, px, py); px += x.measureText(ch).width + ls; }
  });
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, w: c.width, h: c.height, aspect: c.width / c.height, canvas: c };
};

// Textured quad in p-space with tint, alpha, mip blur and a left-to-right wipe.
let spriteProg = null;
IJ.sprite = function (t, o) {
  const gl = IJ.gl;
  if (!spriteProg) {
    spriteProg = IJ.program(`
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec4 uTint; uniform float uBias; uniform vec2 uWipe;
void main(){
  vec4 c = texture(uTex, vUv, uBias);
  float m = uWipe.y > 0. ? clamp((uWipe.x*(1.+uWipe.y) - vUv.x)/uWipe.y, 0., 1.) : 1.;
  o = c * uTint * m;
}`, `#version 300 es
uniform vec4 uRect; uniform float uRot; uniform float uAspect;
out vec2 vUv;
void main(){
  vec2 q = vec2(gl_VertexID&1, (gl_VertexID>>1)&1);
  vUv = vec2(q.x, 1.-q.y);
  vec2 p = (q-.5)*uRect.zw;
  float c = cos(uRot), s = sin(uRot);
  p = vec2(c*p.x - s*p.y, s*p.x + c*p.y) + uRect.xy;
  gl_Position = vec4(p.x/uAspect, p.y, 0., 1.);
}`, 'sprite');
  }
  const h = o.h, w = o.w || h * t.aspect;
  const a = o.alpha == null ? 1 : o.alpha;
  const col = o.color || [1, 1, 1];
  IJ.blend(o.blend || 'premult');
  spriteProg.use().set({
    uTex: t.tex, uRect: [o.x || 0, o.y || 0, w, h], uRot: o.rot || 0, uAspect: IJ.aspect(),
    uTint: [col[0] * a, col[1] * a, col[2] * a, a], uBias: o.blur || 0, uWipe: [o.wipe == null ? 1 : o.wipe, o.wipe == null ? 0 : (o.soft || 0.15)],
  });
  gl.bindVertexArray(IJ.emptyVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

// ------------------------------------------------- instanced glow lines ---
// Segments: [x0,y0,z0, x1,y1,z1, r,g,b,a, halfWidth, glow]. Width is in p-space units
// (screen height = 2). In 3D mode widths are world units projected by the camera.
IJ.Lines = function (max) {
  const gl = IJ.gl;
  const STRIDE = 12;
  const data = new Float32Array(max * STRIDE);
  const vao = gl.createVertexArray(), buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  const attr = (loc, size, off) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off * 4);
    gl.vertexAttribDivisor(loc, 1);
  };
  attr(0, 3, 0); attr(1, 3, 3); attr(2, 4, 6); attr(3, 2, 10);
  gl.bindVertexArray(null);
  if (!IJ._lineProg) {
    IJ._lineProg = IJ.program(`
in vec2 vL; in float vLen; in float vW; in vec4 vCol; in float vGlow; in float vExt;
uniform float uSoft; out vec4 o;
void main(){
  float ax = vL.x < 0. ? vL.x : (vL.x > vLen ? vL.x - vLen : 0.);
  float d = length(vec2(ax, vL.y));
  float core = clamp(vW + .6 - d, 0., 1.) * min(1., vW*1.5 + .25);
  float g = vGlow * pow(max(0., 1. - d/vExt), 2.2);
  float a = clamp(core + g, 0., 4.) * vCol.a;
  o = vec4(vCol.rgb * a, min(a, 1.));
}`, `#version 300 es
layout(location=0) in vec3 aP0; layout(location=1) in vec3 aP1; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aWG;
uniform mat4 uMVP; uniform vec2 uRes; uniform float uPersp; uniform float uProjY;
out vec2 vL; out float vLen; out float vW; out vec4 vCol; out float vGlow; out float vExt;
void main(){
  vec4 c0 = uMVP*vec4(aP0,1.), c1 = uMVP*vec4(aP1,1.);
  vec2 s0 = (c0.xy/c0.w*.5+.5)*uRes, s1 = (c1.xy/c1.w*.5+.5)*uRes;
  float wScale = uPersp > .5 ? uProjY*.5*uRes.y / (.5*(c0.w+c1.w)) : .5*uRes.y;
  float w = max(aWG.x * wScale, .35);
  float ext = w * (1. + aWG.y) + 1.5;
  vec2 d = s1 - s0; float L = length(d);
  vec2 dir = L > 1e-4 ? d/L : vec2(1,0); vec2 nrm = vec2(-dir.y, dir.x);
  float sx = float(gl_VertexID & 1), sy = float((gl_VertexID >> 1) & 1)*2. - 1.;
  float al = sx < .5 ? -ext : L + ext;
  vec2 pos = s0 + al*dir + sy*ext*nrm;
  vL = vec2(al, sy*ext); vLen = L; vW = w; vCol = aCol; vGlow = aWG.y; vExt = ext;
  float z = mix(c0.z/c0.w, c1.z/c1.w, sx);
  gl_Position = vec4(pos/uRes*2.-1., clamp(z,-1.,1.), 1.);
}`, 'lines');
  }
  let n = 0;
  return {
    data,
    clear() { n = 0; },
    get count() { return n; },
    add(x0, y0, z0, x1, y1, z1, r, g, b, a, w, glow) {
      if (n >= max) return;
      const o = n * STRIDE;
      data[o] = x0; data[o + 1] = y0; data[o + 2] = z0; data[o + 3] = x1; data[o + 4] = y1; data[o + 5] = z1;
      data[o + 6] = r; data[o + 7] = g; data[o + 8] = b; data[o + 9] = a; data[o + 10] = w; data[o + 11] = glow || 0;
      n++;
    },
    add2(x0, y0, x1, y1, col, w, glow) { this.add(x0, y0, 0, x1, y1, 0, col[0], col[1], col[2], col[3] == null ? 1 : col[3], w, glow); },
    // mvp: Float32Array matrix; persp: true for world-size widths; projY = proj[5]
    draw(mvp, opts = {}) {
      if (!n) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * STRIDE);
      IJ.blend(opts.blend || 'add');
      IJ._lineProg.use().set({ uMVP: mvp || M4.ortho2D(IJ.aspect()), uRes: [IJ.curW, IJ.curH], uPersp: opts.persp ? 1 : 0, uProjY: opts.projY || 1 });
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.bindVertexArray(null);
    },
  };
};

// ------------------------------------------------ instanced glow points ---
// Points: [x,y,z, size, r,g,b,a, glow, spikes]. size in p-space units (or world units in persp).
IJ.Points = function (max) {
  const gl = IJ.gl;
  const STRIDE = 10;
  const data = new Float32Array(max * STRIDE);
  const vao = gl.createVertexArray(), buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  const attr = (loc, size, off) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off * 4);
    gl.vertexAttribDivisor(loc, 1);
  };
  attr(0, 4, 0); attr(1, 4, 4); attr(2, 2, 8);
  gl.bindVertexArray(null);
  if (!IJ._pointProg) {
    IJ._pointProg = IJ.program(`
in vec2 vQ; in vec4 vCol; in vec2 vGS; in float vR; out vec4 o;
void main(){
  float d = length(vQ);
  float core = smoothstep(1., .55, d/vR);
  float glow = vGS.x * exp(-3.5*d/(vR*(1.+vGS.x*3.)));
  float sp = 0.;
  if (vGS.y > 0.) { vec2 a = abs(vQ)/vR; sp = vGS.y * (exp(-a.x*9.)*exp(-a.y*.9) + exp(-a.y*9.)*exp(-a.x*.9)) ; }
  float a = (core + glow + sp) * vCol.a;
  o = vec4(vCol.rgb*a, min(a,1.));
}`, `#version 300 es
layout(location=0) in vec4 aPS; layout(location=1) in vec4 aCol; layout(location=2) in vec2 aGS;
uniform mat4 uMVP; uniform vec2 uRes; uniform float uPersp; uniform float uProjY;
out vec2 vQ; out vec4 vCol; out vec2 vGS; out float vR;
void main(){
  vec4 c = uMVP*vec4(aPS.xyz,1.);
  float scale = uPersp > .5 ? uProjY*.5*uRes.y / c.w : .5*uRes.y;
  float r = max(aPS.w*scale, .7);
  float ext = r*(1. + aGS.x*4. + aGS.y*5.) + 1.;
  vec2 q = vec2(float(gl_VertexID&1), float((gl_VertexID>>1)&1))*2.-1.;
  vQ = q*ext; vCol = aCol; vGS = aGS; vR = r;
  gl_Position = vec4(c.xy/c.w + q*ext/uRes*2., clamp(c.z/c.w,-1.,1.), 1.);
}`, 'points');
  }
  let n = 0;
  return {
    data,
    clear() { n = 0; },
    get count() { return n; },
    add(x, y, z, size, r, g, b, a, glow, spikes) {
      if (n >= max) return;
      const o = n * STRIDE;
      data[o] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = size;
      data[o + 4] = r; data[o + 5] = g; data[o + 6] = b; data[o + 7] = a; data[o + 8] = glow || 0; data[o + 9] = spikes || 0;
      n++;
    },
    draw(mvp, opts = {}) {
      if (!n) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * STRIDE);
      IJ.blend(opts.blend || 'add');
      IJ._pointProg.use().set({ uMVP: mvp || M4.ortho2D(IJ.aspect()), uRes: [IJ.curW, IJ.curH], uPersp: opts.persp ? 1 : 0, uProjY: opts.projY || 1 });
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.bindVertexArray(null);
    },
  };
};

// ----------------------------------------------- dynamic triangle strips ---
// Generic vertex buffer: per-vertex [x,y,z, u,v, a,b,c] (8 floats) drawn with a custom program.
IJ.Mesh = function (maxVerts) {
  const gl = IJ.gl;
  const STRIDE = 8;
  const data = new Float32Array(maxVerts * STRIDE);
  const vao = gl.createVertexArray(), buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE * 4, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * 4, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE * 4, 20);
  gl.bindVertexArray(null);
  let n = 0;
  return {
    data,
    clear() { n = 0; },
    get count() { return n; },
    v(x, y, z, u, w, a, b, c) {
      if (n >= maxVerts) return;
      const o = n * STRIDE;
      data[o] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = u; data[o + 4] = w; data[o + 5] = a || 0; data[o + 6] = b || 0; data[o + 7] = c || 0;
      n++;
    },
    upload() { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * STRIDE); },
    draw(mode, first = 0, count = n) { gl.bindVertexArray(vao); gl.drawArrays(mode, first, count); gl.bindVertexArray(null); },
  };
};

// Tileable 3D value-noise texture (fbm-ready), computed in JS at load.
IJ.noise3D = function (N = 64, seed = 7) {
  const gl = IJ.gl;
  const R = rng(seed);
  const P = 8; // lattice period
  const lat = new Float32Array(P * P * P).map(() => R());
  const L = (x, y, z) => lat[((z % P + P) % P) * P * P + ((y % P + P) % P) * P + ((x % P + P) % P)];
  const out = new Uint8Array(N * N * N * 4);
  const sm = t => t * t * (3 - 2 * t);
  // two channels: low-frequency value noise (period 8) and a 2x-frequency one (period 16 via doubled coords)
  const vn = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const a = lerp(lerp(L(xi, yi, zi), L(xi + 1, yi, zi), xf), lerp(L(xi, yi + 1, zi), L(xi + 1, yi + 1, zi), xf), yf);
    const b = lerp(lerp(L(xi, yi, zi + 1), L(xi + 1, yi, zi + 1), xf), lerp(L(xi, yi + 1, zi + 1), L(xi + 1, yi + 1, zi + 1), xf), yf);
    return lerp(a, b, zf);
  };
  // Worley-ish cells for billowy clouds (period 4 cells)
  const C = 4, cells = [];
  for (let i = 0; i < C * C * C; i++) cells.push([R(), R(), R()]);
  const worley = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let md = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy, cz = zi + dz;
      const c = cells[(((cz % C) + C) % C) * C * C + (((cy % C) + C) % C) * C + (((cx % C) + C) % C)];
      const ddx = cx + c[0] - x, ddy = cy + c[1] - y, ddz = cz + c[2] - z;
      md = Math.min(md, ddx * ddx + ddy * ddy + ddz * ddz);
    }
    return Math.sqrt(md);
  };
  let o = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N * P, v = y / N * P, w = z / N * P;
    const n1 = vn(u, v, w);
    const n2 = vn(u * 2, v * 2, w * 2);
    const n3 = vn(u * 4, v * 4, w * 4);
    const wr = 1 - Math.min(1, worley(x / N * C, y / N * C, z / N * C) * 1.1);
    out[o++] = n1 * 255; out[o++] = n2 * 255; out[o++] = n3 * 255; out[o++] = wr * 255;
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, N, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
  return tex;
};

// ---------------------------------------------------------------- scenes ---
IJ.scenes = [];
IJ.registerScene = function (s) { IJ.scenes.push(s); };
})();
