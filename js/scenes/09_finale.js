// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'finale', start: 81, end: 90, transition: { type: 'fade', dur: 2.0 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.05,.03,.1)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'finale'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
