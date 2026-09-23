// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'silks', start: 27, end: 39, transition: { type: 'fade', dur: 1.2 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.5,.05,.08)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'silks'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
