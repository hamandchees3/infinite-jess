// 6–15 s · Through the glass and up through the clouds (a nod to the blue-sky
// first-edition cover). Raymarched volumetric cumulus from a JS-built 3D noise texture.
// Title: INFINITE JESS, an entertainment¹.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;

const CLOUD_FS = `
in vec2 vUv; out vec4 o;
uniform sampler3D uNoise;
uniform vec3 uCam; uniform mat3 uRot; uniform vec3 uSun; uniform float uT, uExpo, uWarm;
const float CB = 0., CT = 1.7;

float remap(float x, float a, float b, float c, float d){ return c + (x-a)/(b-a)*(d-c); }
float dens(vec3 p){
  float h = (p.y - CB)/(CT - CB);
  if (h <= 0. || h >= 1.) return 0.;
  float prof = smoothstep(0., .1, h) * smoothstep(1., .3, h);
  vec3 q = p*vec3(.075,.1,.075) + vec3(uT*.004, 0., -uT*.002);
  vec4 n = texture(uNoise, q);
  float base = n.a*.62 + n.r*.38;
  float d = sat(remap(base*mix(.7, 1., prof) - (1.-prof)*.35, .46, 1., 0., 1.));
  if (d <= 0.) return 0.;
  vec4 m = texture(uNoise, q*5.1 + vec3(uT*.008, 0., 0.));
  d = sat(d - (m.g*.55 + m.b*.45)*.32*(1.-d*.8));
  return d*4.2;
}
float hg(float c, float g){ float g2 = g*g; return (1.-g2)/(4.*PI*pow(1.+g2-2.*g*c, 1.5)); }
vec3 skyCol(vec3 rd){
  float y = max(rd.y, 0.);
  vec3 zen = mix(vec3(.11,.3,.7), vec3(.3,.42,.7), uWarm);
  vec3 hor = mix(vec3(.72,.84,.95), vec3(1.,.8,.6), uWarm);
  vec3 c = mix(hor, zen, pow(y, .55));
  float s = max(dot(rd, uSun), 0.);
  c += vec3(1.,.9,.75)*(pow(s, 900.)*6. + pow(s, 24.)*.35 + pow(s, 4.)*.12*(1.+uWarm*2.));
  if (rd.y < 0.) c = mix(hor*.95, mix(vec3(.36,.5,.68), vec3(.6,.5,.52), uWarm), sat(-rd.y*2.5)); // haze over the sea below
  return c;
}
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  vec3 rd = normalize(uRot * vec3(p, -1.9));
  vec3 ro = uCam;
  vec3 sky = skyCol(rd);
  // slab intersection
  float t0 = 0., t1 = 60.;
  if (abs(rd.y) > 1e-4) {
    float ta = (CB-ro.y)/rd.y, tb = (CT-ro.y)/rd.y;
    t0 = max(min(ta,tb), 0.); t1 = min(max(ta,tb), 60.);
  } else if (ro.y < CB || ro.y > CT) t1 = -1.;
  vec3 col = vec3(0.); float T = 1.; float tHit = 60.;
  if (t1 > t0) {
    float cosA = dot(rd, uSun);
    float phase = mix(hg(cosA, .65), hg(cosA, -.15), .35)*4.*PI*.5 + .35;
    vec3 sunC = mix(vec3(1.,.97,.92), vec3(1.,.78,.55), uWarm)*1.35;
    vec3 amb = mix(vec3(.55,.66,.82), vec3(.7,.62,.62), uWarm);
    float t = t0;
    float dt = .09;
    t += dt*hash12(gl_FragCoord.xy + fract(uT)*91.);
    for (int i = 0; i < 90; i++) {
      if (t > t1 || T < .015) break;
      vec3 pos = ro + rd*t;
      float d = dens(pos);
      if (d > .005) {
        if (tHit > 59.) tHit = t;
        float ld = dens(pos + uSun*.18) + dens(pos + uSun*.45) + dens(pos + uSun*.9)*.8;
        float sh = exp(-ld*.42);
        float h = (pos.y - CB)/(CT - CB);
        float powder = 1. - exp(-d*1.6);
        vec3 L = sunC*sh*phase*(.35 + .65*powder) + amb*(.45 + .6*h);
        float a = 1. - exp(-d*dt*1.6);
        col += T*a*L;
        T *= 1. - a;
        dt = .07 + t*.012;
      } else dt = .16 + t*.02;
      t += dt;
    }
  }
  vec3 c = col + T*sky;
  // aerial perspective
  float fog = 1. - exp(-max(tHit - 2., 0.)*.035);
  c = mix(c, mix(vec3(.72,.82,.93), vec3(1.,.82,.66), uWarm), fog*(1.-T)*.8);
  o = vec4(c*uExpo, 1.);
}`;

const BLIT_FS = `
in vec2 vUv; out vec4 o; uniform sampler2D uTex;
void main(){ o = vec4(texture(uTex, vUv).rgb, 1.); }`;

function rotYawPitch(yaw, pitch, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // columns: right, up, back (camera looks down -Z)
  const fwd = [-sy * cp, sp, -cy * cp];
  const right0 = [cy, 0, -sy];
  const up0 = [right0[1] * fwd[2] - right0[2] * fwd[1], right0[2] * fwd[0] - right0[0] * fwd[2], right0[0] * fwd[1] - right0[1] * fwd[0]];
  const right = right0.map((v, i) => v * cr + up0[i] * sr);
  const up = up0.map((v, i) => v * cr - right0[i] * sr);
  const back = fwd.map(v => -v);
  return new Float32Array([...right, ...up, ...back]);
}

IJ.registerScene({
  name: 'sky', start: 6, end: 15, transition: { type: 'white', dur: 0.8 },
  post(l) { return { bloom: 0.35, grain: 0.03, vignette: 0.3, thresh: 0.85 }; },
  init() {
    this.noise = IJ.noise3D(64, 11);
    this.cloud = IJ.program(CLOUD_FS, null, 'clouds');
    this.blit = IJ.program(BLIT_FS, null, 'blit');
    this.title = IJ.text('INFINITE  JESS', { font: 'display', size: 200, spacing: 0.12 });
    this.sub = IJ.text('an entertainment', { font: 'serif', size: 110, italic: true });
    this.fn = IJ.text('1', { font: 'display', size: 110 });
    const s = [0.85, 0.36, -0.55]; const l = Math.hypot(...s);
    this.sun = s.map(v => v / l);
  },
  resize(W, H) {
    if (this.rt) this.rt.dispose();
    this.rt = IJ.fbo(Math.round(W * 0.5), Math.round(H * 0.5));
  },
  render(t, l) {
    const target = IJ.target;
    if (!this.rt) this.resize(IJ.W, IJ.H);
    // camera: rise up through the deck, then drift above it; at the end tilt to the sun
    const y = IJ.key(l, [[0, 1.3], [0.9, 1.78], [2.8, 2.4], [9, 2.8]], IJ.ease.sine);
    const z = -l * 0.9;
    const pitch = IJ.key(l, [[0, 0.22], [2.2, 0.06], [3.5, -0.02], [7.2, -0.03], [9, 0.16]], IJ.ease.sine);
    const yaw = IJ.key(l, [[0, -0.12], [9, 0.22]], IJ.ease.sine);
    const warm = IJ.smooth(6.6, 9, l);
    this.rt.bind();
    this.cloud.draw({
      uNoise: this.noise, uCam: [0.3 * Math.sin(l * 0.2), y, z], uRot: rotYawPitch(yaw, pitch, 0.02 * Math.sin(l * 0.5)),
      uSun: this.sun, uT: t, uExpo: 1 + 0.6 * (1 - IJ.smooth(0, 1.2, l)), uWarm: warm,
    });
    target.bind();
    this.blit.draw({ uTex: this.rt.tex });
    // title
    const a = IJ.smooth(C.titleIn - 6, C.titleIn - 6 + 1.8, l) * (1 - IJ.smooth(7.0, 8.4, l));
    if (a > 0) {
      const k = IJ.ease.out(IJ.clamp((l - (C.titleIn - 6)) / 2.4));
      const h = 0.46 * (1.07 - 0.07 * k);
      const ty = 0.38 + 0.03 * (1 - k);
      IJ.sprite(this.title, { x: 0.014, y: ty - 0.014, h, alpha: a * 0.4, color: [0.05, 0.12, 0.25], blur: 3 + 3 * (1 - k) });
      IJ.sprite(this.title, { x: 0, y: ty, h, alpha: a, color: [1, 0.99, 0.96], blur: 4 * (1 - k) });
      const a2 = IJ.smooth(3.9, 5.2, l) * (1 - IJ.smooth(7.0, 8.4, l));
      if (a2 > 0) {
        IJ.sprite(this.sub, { x: 0.008, y: 0.132, h: 0.19, alpha: a2 * 0.4, color: [0.05, 0.12, 0.25], blur: 2.5 });
        IJ.sprite(this.sub, { x: 0, y: 0.14, h: 0.19, alpha: a2, color: [1, 0.98, 0.94], blur: 1.5 * (1 - IJ.smooth(3.9, 5.2, l)) });
        // the footnote marker arrives a beat later, with a little bounce
        const fk = IJ.clamp((l - 5.1) / 0.7);
        if (fk > 0) {
          const bounce = IJ.ease.outBack(fk);
          const subW = 0.19 * this.sub.aspect, padP = 0.19 * (0.3 * 110) / this.sub.h;
          IJ.sprite(this.fn, { x: subW / 2 - padP + 0.028, y: 0.19 + 0.05 * (1 - bounce), h: 0.11, alpha: a2 * Math.min(1, fk * 2), color: [1, 0.93, 0.8] });
        }
      }
    }
  },
});
})();
