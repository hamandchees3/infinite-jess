// 0–6 s · A cartridge tunes in. Curved CRT glass, scanlines, snow, a rolling picture,
// then SUBSIDIZED TIME / YEAR OF GLAD, and a push through the glass into the sky.
(function () {
const IJ = window.IJ;
const C = IJ.CUES;

const FS = `
in vec2 vUv; out vec4 o;
uniform sampler2D uT1, uT2; uniform vec2 uA;   // text textures, their aspects
uniform float uOn, uStatic, uRoll, uCard, uZoom, uGlow, uJit, uT;

const vec2 S = vec2(1.22, .915);             // screen half-size in p-space (4:3)

vec3 sky(vec2 uv){
  vec3 c = mix(vec3(.6,.72,.84), vec3(.17,.34,.62), smoothstep(.0, 1., uv.y));
  float n = fbm(uv*vec2(3.,5.) + vec2(uT*.05, 0.));
  float cl = smoothstep(.55, .85, n + .3*(1.-uv.y) - .28);
  return mix(c, vec3(.9,.92,.93), cl*.45);
}
float textAt(sampler2D t, float aspect, vec2 uv, vec2 c, float w){
  vec2 sz = vec2(w, w/aspect*(S.x/S.y));
  vec2 tuv = (uv - c)/sz + .5;
  if (any(lessThan(tuv, vec2(0))) || any(greaterThan(tuv, vec2(1)))) return 0.;
  return texture(t, vec2(tuv.x, 1.-tuv.y)).a;
}
vec3 card(vec2 uv){
  vec3 c = sky(uv);
  float a1 = textAt(uT1, uA.x, uv, vec2(.5,.63), .42);
  float a2 = textAt(uT2, uA.y, uv, vec2(.5,.47), .78);
  // thin rules around the title
  float rule = (1.-smoothstep(.0015,.003, abs(uv.y-.555)))*step(abs(uv.x-.5), .3)
             + (1.-smoothstep(.0015,.003, abs(uv.y-.375)))*step(abs(uv.x-.5), .3);
  float sh = textAt(uT2, uA.y, uv + vec2(-.004,.006), vec2(.5,.47), .78);
  c = mix(c, c*.45, sh*.75);
  c = mix(c, vec3(1.,.98,.93), max(max(a1*.9, a2), rule*.8));
  return c;
}
vec3 snow(vec2 uv){
  float n = hash12(floor(uv*vec2(360.,270.)) + floor(uT*40.)*vec2(13.1,7.7));
  float streak = hash11(floor(uv.y*270.) + floor(uT*40.)*3.1);
  float bar = .75 + .25*sin((uv.y + uT*.9)*9.);
  return vec3(mix(n, streak, .25)*bar);
}
vec3 tube(vec2 uv){
  // vertical hold slipping: roll the picture with a blanking bar
  float y = uv.y + uRoll;
  float blank = smoothstep(.0,.02, fract(y)) * smoothstep(1.,.97, fract(y));
  vec2 u = vec2(uv.x, fract(y));
  u.x += (hash11(floor(u.y*270.) + floor(uT*60.)) - .5) * .004 * uJit;
  vec3 c = uCard > 0. ? card(u) * uCard : vec3(0.);
  c = mix(c, snow(u), uStatic);
  return c * (uRoll != 0. ? blank : 1.);
}
void main(){
  vec2 p = (2.*gl_FragCoord.xy - uRes)/uRes.y;
  p /= uZoom;
  vec2 q = p / S;
  vec2 q2 = q * (1. + .07*dot(q,q));           // bulging glass
  float scr = sdRBox(q2, vec2(1.), .16);
  float px = 2./uRes.y/uZoom/S.y;
  vec3 col = vec3(0.);
  vec2 uv = q2*.5 + .5;
  float bright = 0.;
  if (scr < px*2.) {
    // power-on: a line that opens into a picture
    float open = uOn;
    float band = mix(.004, 1.05, open);
    float bandMask = 1. - smoothstep(band - .01, band, abs(q2.y));
    float hMask = 1. - smoothstep(mix(.15, 1.05, smoothstep(0., .25, open)), mix(.16,1.06,smoothstep(0.,.25,open)), abs(q2.x));
    float boost = 1. + 2.5*(1.-smoothstep(0., .6, open));
    // chromatic misconvergence
    float ab = .003 + .006*uStatic;
    vec3 c;
    c.r = tube(uv + vec2(ab, 0.)).r;
    c.g = tube(uv).g;
    c.b = tube(uv - vec2(ab, 0.)).b;
    if (open < 1.) c = mix(vec3(.85,.9,1.), c, smoothstep(.3, .9, open));
    c *= bandMask * hMask * boost * step(.0001, open);
    // scanlines and aperture grille
    float lines = 260.;
    c *= .62 + .38*pow(abs(sin(uv.y*lines*PI)), .8);
    float m = mod(gl_FragCoord.x, 3.);
    vec3 grille = vec3(m < 1. ? 1. : .78, (m >= 1. && m < 2.) ? 1. : .78, m >= 2. ? 1. : .78);
    c *= mix(vec3(1.), grille, .5/max(1., uZoom*.5));
    // flicker + edge darkening of the tube
    c *= .96 + .04*sin(uT*113.);
    c *= smoothstep(1.25, .45, length(q2*vec2(.9,1.)));
    bright = luma(c);
    // dark glass when off, a soft window reflection always
    vec3 glass = vec3(.028,.032,.035) + .03*smoothstep(.9, -.6, q2.x + q2.y*1.3);
    glass += .035*smoothstep(.04, .0, abs(q2.x + q2.y*.6 + .35))*smoothstep(1.,.2,length(q2));
    col = glass + c;
    col *= 1. - smoothstep(-px*2., px*2., scr);
  }
  // bezel and the room
  float bez = sdRBox(p, S*vec2(1.12,1.14) + vec2(.08), .22);
  if (scr > -px*2.) {
    vec3 plastic = mix(vec3(.05,.045,.04), vec3(.085,.075,.065), smoothstep(-1., 1., p.y));
    float rim = smoothstep(.03, 0., abs(scr - .01));
    plastic += rim*.05;
    float inner = smoothstep(.0, .09, scr);                  // inner shadow near the glass
    plastic *= .55 + .45*inner;
    vec3 room = vec3(.012,.011,.012) * (1. - .4*length(p)/2.);
    vec3 outside = mix(plastic, room, smoothstep(-.005, .005, bez));
    // light spill from the picture
    outside += vec3(.35,.45,.6) * uOn * (.35 + .65*uCard) * .12 * exp(-max(scr,0.)*2.5) * (1.-uStatic*.4);
    col = mix(col, outside, smoothstep(-px*2., px*2., scr));
  }
  col = mix(col, vec3(1.,.99,.96)*1.3, uGlow);
  o = vec4(col, 1.);
}`;

IJ.registerScene({
  name: 'crt', start: 0, end: 6,
  post: { bloom: 0.5, grain: 0.05, vignette: 0.5, thresh: 0.7 },
  init() {
    this.p = IJ.program(FS, null, 'crt');
    this.t1 = IJ.text('SUBSIDIZED  TIME', { font: 'sans', size: 64, weight: 500, spacing: 0.32 });
    this.t2 = IJ.text('Year of Glad', { font: 'display', size: 170, italic: true });
  },
  render(t) {
    const on = IJ.ease.out(IJ.clamp((t - C.crtOn) / 0.45));
    let stat = IJ.smooth(C.staticStart - 0.1, C.staticStart + 0.05, t) * (1 - IJ.smooth(C.tune + 0.25, C.card, t));
    stat = Math.max(stat, t > C.card ? 0.05 * (1 - IJ.smooth(C.card, C.card + 1.2, t)) : 0);
    if (t < C.staticStart - 0.1 && on > 0) stat = 0.35;
    let roll = 0;
    if (t > C.tune && t < C.card) { const k = (C.card - t) / (C.card - C.tune); roll = -(k * k * 2.6) % 1; }
    const card = t > C.tune ? 1 : 0;
    const zoom = 1 + 9 * Math.pow(IJ.clamp((t - C.push) / (6.0 - C.push)), 2.6);
    const glow = IJ.smooth(5.55, 6.0, t);
    this.p.draw({
      uT1: this.t1.tex, uT2: this.t2.tex, uA: [this.t1.aspect, this.t2.aspect],
      uOn: on, uStatic: stat, uRoll: roll, uCard: card, uZoom: zoom, uGlow: glow,
      uJit: 0.3 + stat * 2, uT: t,
    });
  },
});
})();
