// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'dusk', start: 69, end: 81, transition: { type: 'dissolve', dur: 1.8 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.9,.7,.7)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'dusk'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
