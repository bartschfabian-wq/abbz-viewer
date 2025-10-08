/* OrbitControls.js - wrapper to load classic example and attach to THREE */
(async function(){
  const u = 'https://cdn.jsdelivr.net/npm/three@0.149.0/examples/js/controls/OrbitControls.js';
  const r = await fetch(u).then(t=>t.text());
  eval(r);
})();
