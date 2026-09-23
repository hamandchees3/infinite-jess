// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'chalk', start: 57, end: 69, transition: { type: 'fade', dur: 1.0 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.1,.18,.15)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'chalk'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
