// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'cats', start: 39, end: 48, transition: { type: 'iris', dur: 1.2 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.8,.75,.6)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'cats'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
