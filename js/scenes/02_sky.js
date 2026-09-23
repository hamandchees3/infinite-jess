// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'sky', start: 6, end: 15, transition: { type: 'white', dur: 0.8 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.4,.6,.9)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'sky'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
