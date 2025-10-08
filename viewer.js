// ABBZ viewer.js
let scene, camera, renderer, controls;
let loadedObject = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let snappedPoints = [];
const statusEl = document.getElementById('status');
const distanceEl = document.getElementById('distance');

init();
animate();

function setStatus(txt) { if (statusEl) statusEl.textContent = 'Status: ' + txt; }

function init() {
  setStatus('initialisiere Szene');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(200, 200, 400);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemi.position.set(0, 200, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(100, 200, 100);
  scene.add(dir);

  window.addEventListener('resize', onWindowResize);
  document.getElementById('fileInput').addEventListener('change', handleFile, false);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  setStatus('bereit');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleFile(evt) {
  const f = evt.target.files && evt.target.files[0];
  if (!f) return;
  setStatus('lade Datei ' + f.name);
  const reader = new FileReader();
  reader.onload = function(e) { loadOBJFromText(e.target.result); };
  reader.onerror = function() { setStatus('Fehler beim Lesen der Datei'); };
  reader.readAsText(f);
}

function loadOBJFromText(text) {
  if (loadedObject) { scene.remove(loadedObject); disposeHierarchy(loadedObject); loadedObject = null; }
  const loader = new THREE.OBJLoader();
  let obj;
  try { obj = loader.parse(text); } catch (err) { setStatus('OBJ-Parsing Fehler'); console.error(err); return; }

  obj.traverse(function(child) {
    if (child.isMesh) {
      if (!(child.geometry && child.geometry.isBufferGeometry)) {
        child.geometry = new THREE.BufferGeometry().fromGeometry(child.geometry);
      }
      child.geometry.computeBoundingSphere();
      child.material = new THREE.MeshStandardMaterial({ color: 0x999999, metalness:0.1, roughness:0.9, side: THREE.DoubleSide });
    }
  });

  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = (maxDim > 0) ? (200 / maxDim) : 1;
  obj.scale.set(scale, scale, scale);

  const center = new THREE.Vector3(); box.getCenter(center);
  obj.position.sub(center.multiplyScalar(scale));

  loadedObject = obj;
  scene.add(obj);
  buildVertexIndex(obj);

  controls.reset(); controls.target.set(0,0,0);
  setStatus('Datei geladen');
  distanceEl.textContent = 'Distanz: –';
  snappedPoints = [];
}

function disposeHierarchy(node) {
  node.traverse(function(n) {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
      else n.material.dispose();
    }
  });
}

let vertexPositions = [];
function buildVertexIndex(object3d) {
  vertexPositions = [];
  object3d.traverse(function(child) {
    if (child.isMesh && child.geometry && child.geometry.isBufferGeometry) {
      const posAttr = child.geometry.attributes.position;
      if (!posAttr) return;
      const local = new THREE.Vector3();
      const worldMatrix = child.matrixWorld;
      for (let i = 0; i < posAttr.count; i++) {
        local.fromBufferAttribute(posAttr, i);
        const world = local.clone().applyMatrix4(worldMatrix);
        vertexPositions.push(world);
      }
    }
  });
}

function onPointerDown(event) {
  if (!loadedObject) return;
  if (event.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(loadedObject, true);
  if (intersects.length === 0) return;
  const hitPoint = intersects[0].point;

  let bestIdx = -1;
  let bestDist2 = Infinity;
  for (let i = 0; i < vertexPositions.length; i++) {
    const d2 = hitPoint.distanceToSquared(vertexPositions[i]);
    if (d2 < bestDist2) { bestDist2 = d2; bestIdx = i; }
  }
  if (bestIdx === -1) return;

  const snapped = vertexPositions[bestIdx].clone();
  snappedPoints.push(snapped);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 12, 12),
    new THREE.MeshBasicMaterial({ color: snappedPoints.length === 1 ? 0xff0000 : 0x0000ff })
  );
  marker.position.copy(snapped);
  marker.name = 'marker';
  scene.add(marker);

  if (snappedPoints.length === 2) {
    const d = snappedPoints[0].distanceTo(snappedPoints[1]);
    distanceEl.textContent = 'Distanz: ' + d.toFixed(2) + ' mm';
    setStatus('Messung abgeschlossen');
    setTimeout(() => { removeMarkers(); }, 3000);
    snappedPoints = [];
  } else {
    setStatus('Punkt 1 gesetzt, wähle Punkt 2');
  }
}

function removeMarkers() {
  const toRemove = [];
  scene.traverse(n => { if (n.name === 'marker') toRemove.push(n); });
  toRemove.forEach(n => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); scene.remove(n); });
}

function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
