// stl-loader.js — parallel STL loader for the DiaSAGE watch viewer.
//
// Extracted from website/index.html (lines ~2172–2265). Consumes the manifest
// provided by ../../config/stl-manifest.js and resolves materialKey -> the
// actual THREE.Material instance built in scene.js.
//
// THREE + THREE.STLLoader are globals (loaded via <script> tags).
//
// Exports:
//   loadStlParts(sceneCtx, { onProgress } = {}) -> Promise<{ watchGroup, components }>
//
// After all parts load this function also applies assembled positions/
// rotations and repositions keyLight/fillLight based on the model bounding
// box — mirroring the original `finalizeScene()` behavior. The caller is
// expected to render once after the promise resolves (see interactions.js).

import { stlParts } from '../../config/stl-manifest.js';

const THREE = window.THREE;

export async function loadStlParts(sceneCtx, opts) {
  const { scene, camera, materials, cubeRT, lights } = sceneCtx;
  const onProgress = (opts && opts.onProgress) || null;

  const watchGroup = new THREE.Group();
  scene.add(watchGroup);

  const components = new Array(stlParts.length);
  const total = stlParts.length;
  let loadedCount = 0;

  const stlLoader = new THREE.STLLoader();

  function processLoaded(geometry, idx) {
    const part = stlParts[idx];
    const material = materials[part.materialKey];
    if (!material) {
      console.warn('[stl-loader] Unknown materialKey:', part.materialKey, 'for', part.name);
    }

    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    geometry.center();

    if (part.scale) {
      const sc = part.scale;
      if (Array.isArray(sc)) { geometry.scale(sc[0], sc[1], sc[2]); }
      else { geometry.scale(sc, sc, sc); }
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Edge lines (same threshold 25 as source)
    const edgeGeo = new THREE.EdgesGeometry(geometry, 25);
    const edgeLines = new THREE.LineSegments(edgeGeo, materials.matEdge);
    mesh.add(edgeLines);

    // Env map on this part's material
    if (material) {
      material.envMap = cubeRT.texture;
      material.envMapIntensity = 0.6;
      material.needsUpdate = true;
    }

    // Special case: rounded screen plane overlay on the ESP board.
    // Original source detected by index===1; we detect by materialKey so
    // the manifest can reorder parts safely.
    if (part.materialKey === 'matESP') {
      const sw = 32, sh = 40, sr = 5;
      const screenShape = new THREE.Shape();
      screenShape.moveTo(-sw / 2 + sr, -sh / 2);
      screenShape.lineTo(sw / 2 - sr, -sh / 2);
      screenShape.quadraticCurveTo(sw / 2, -sh / 2, sw / 2, -sh / 2 + sr);
      screenShape.lineTo(sw / 2, sh / 2 - sr);
      screenShape.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - sr, sh / 2);
      screenShape.lineTo(-sw / 2 + sr, sh / 2);
      screenShape.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - sr);
      screenShape.lineTo(-sw / 2, -sh / 2 + sr);
      screenShape.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2 + sr, -sh / 2);
      const screenGeo = new THREE.ShapeGeometry(screenShape);
      const screenPlane = new THREE.Mesh(screenGeo, materials.matScreen);
      screenPlane.position.z = 5.5;
      mesh.add(screenPlane);
    }

    watchGroup.add(mesh);
    components[idx] = { mesh: mesh, part: part };
  }

  // Parallel loads; resolve when all have settled (success or error).
  const promises = stlParts.map((part, idx) => new Promise((resolve) => {
    stlLoader.load(
      part.url,
      (geometry) => {
        try { processLoaded(geometry, idx); }
        catch (err) { console.warn('[stl-loader] process error:', part.name, err); }
        loadedCount++;
        if (onProgress) { try { onProgress(loadedCount, total); } catch (_) { /* noop */ } }
        resolve();
      },
      undefined,
      (err) => {
        console.warn('STL error:', part.name, err);
        loadedCount++;
        if (onProgress) { try { onProgress(loadedCount, total); } catch (_) { /* noop */ } }
        resolve(); // don't block other parts
      }
    );
  }));

  await Promise.all(promises);

  // ==================== FINALIZE (from source finalizeScene) ====================
  for (let i = 0; i < components.length; i++) {
    if (!components[i]) continue;
    const fi = stlParts[i];
    components[i].mesh.position.set(fi.assembledPos[0], fi.assembledPos[1], fi.assembledPos[2]);
    components[i].mesh.rotation.set(fi.assembledRot[0], fi.assembledRot[1], fi.assembledRot[2]);
  }

  const box = new THREE.Box3();
  for (let i = 0; i < components.length; i++) {
    if (components[i]) box.expandByObject(components[i].mesh);
  }
  const bbSize = new THREE.Vector3();
  box.getSize(bbSize);
  const modelMaxDim = Math.max(bbSize.x, bbSize.y, bbSize.z) || 120;

  const camR = modelMaxDim * 2;
  camera.position.set(camR * 0.4, camR * 0.15, camR * 0.8);
  camera.lookAt(0, 0, 0);
  camera.near = 0.1;
  camera.far = modelMaxDim * 50;
  camera.updateProjectionMatrix();

  if (lights && lights.keyLight) {
    lights.keyLight.position.set(modelMaxDim, modelMaxDim * 1.5, modelMaxDim * 0.8);
  }
  if (lights && lights.fillLight) {
    lights.fillLight.position.set(-modelMaxDim * 0.8, modelMaxDim * 0.4, -modelMaxDim * 0.5);
  }

  return { watchGroup, components };
}
