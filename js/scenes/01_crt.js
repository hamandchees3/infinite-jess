// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'crt', start: 0, end: 6, 
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.1,.2,.3)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'crt'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
