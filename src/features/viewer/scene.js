// scene.js — Three.js scene bootstrap for the DiaSAGE hero watch viewer.
//
// Extracted verbatim (values-wise) from website/index.html lines 2098–2291.
// THREE is assumed to be a global provided by <script src="assets/vendor/three.min.js">
// loaded before this module. Do NOT import 'three' as an ES module.
//
// Exports:
//   createScene(canvas) -> { scene, camera, renderer, materials, cubeRT, lights }
//
// `lights` is returned in addition to the required shape so downstream code
// (the finalize step after STL load) can reposition the key/fill lights
// exactly the way the original IIFE did. This is additive and does not
// break the documented return contract.

const THREE = window.THREE;

export function createScene(canvas) {
  // ==================== RENDERER ====================
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  // ==================== SCENE + CAMERA ====================
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50000);

  // ==================== ENVIRONMENT MAP ====================
  const cubeRT = new THREE.WebGLCubeRenderTarget(256);
  const cubeCamera = new THREE.CubeCamera(1, 1000, cubeRT);
  (function buildEnv() {
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(200, 32, 32);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: 'varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vPos; void main(){ float h=normalize(vPos).y*0.5+0.5; vec3 top=vec3(0.4,0.5,0.7); vec3 bot=vec3(0.05,0.05,0.08); vec3 mid=vec3(0.15,0.15,0.2); vec3 c=mix(bot,mid,smoothstep(0.0,0.3,h)); c=mix(c,top,smoothstep(0.3,0.8,h)); gl_FragColor=vec4(c,1.0); }'
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const spotGeo = new THREE.SphereGeometry(8, 8, 8);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const s1 = new THREE.Mesh(spotGeo, spotMat); s1.position.set(80, 120, 60); envScene.add(s1);
    const s2 = new THREE.Mesh(spotGeo, spotMat); s2.position.set(-60, 80, -40); envScene.add(s2);
    cubeCamera.position.set(0, 0, 0);
    cubeCamera.update(renderer, envScene);
  })();
  scene.environment = cubeRT.texture;

  // ==================== LIGHTING ====================
  const ambientLight = new THREE.AmbientLight(0x556688, 0.7);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(60, 100, 80);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.45);
  fillLight.position.set(-60, 40, -40);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xff8855, 0.3);
  rimLight.position.set(0, -20, -80);
  scene.add(rimLight);

  // ==================== MATERIALS ====================
  const materials = {
    matCase: new THREE.MeshStandardMaterial({ color: 0x5a9ec8, roughness: 0.3, metalness: 0.4 }),
    matESP: new THREE.MeshStandardMaterial({ color: 0x0a1a45, roughness: 0.35, metalness: 0.3 }),
    matScreen: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.15 }),
    matBattery: new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.35, metalness: 0.55 }),
    matSensorMLX: new THREE.MeshStandardMaterial({ color: 0x0a1a45, roughness: 0.3, metalness: 0.6 }),
    matSensorMAX: new THREE.MeshStandardMaterial({ color: 0x1a8a2a, roughness: 0.35, metalness: 0.4 }),
    matBand: new THREE.MeshStandardMaterial({ color: 0x1a4a8a, roughness: 0.5, metalness: 0.05 }),
    matEdge: new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.35 })
  };

  return {
    scene,
    camera,
    renderer,
    materials,
    cubeRT,
    lights: { ambientLight, keyLight, fillLight, rimLight }
  };
}
