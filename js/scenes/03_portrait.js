// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'portrait', start: 15, end: 27, transition: { type: 'fade', dur: 1.6 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.9,.6,.3)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'portrait'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
