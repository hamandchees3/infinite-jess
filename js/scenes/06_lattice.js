// placeholder
(function () {
const IJ = window.IJ;
IJ.registerScene({
  name: 'lattice', start: 48, end: 57, transition: { type: 'glitch', dur: 0.8 },
  init() { this.p = IJ.program(`in vec2 vUv; out vec4 o; void main(){ o = vec4(vec3(.1,0.,.2)*(.6+.4*vUv.y) + .1*sin(uLocal*3.+vUv.x*10.), 1.); }`, null, 'lattice'); },
  render(t, local) { this.p.draw({ uLocal: local }); },
});
})();
