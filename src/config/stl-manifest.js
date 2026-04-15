// STL asset manifest — 3D model files are hosted as GitHub Releases assets,
// NOT committed to this repo. After creating the repo and a release tagged
// `v1.0-assets` with the 6 STL files uploaded, update RELEASE_BASE below.
//
// Each entry matches the schema consumed by the Three.js viewer:
//   url, name, materialKey (resolved in scene.js to a THREE.Material),
//   assembledPos [x, y, z], assembledRot [x, y, z], optional scale.
//
// Referenced materials: matCase, matESP, matBattery, matSensorMLX,
// matSensorMAX, matBand. These are defined in src/features/viewer/scene.js.

const RELEASE_BASE = 'https://github.com/<USERNAME>/<REPO>/releases/download/v1.0-assets/';

export const stlParts = [
  { url: RELEASE_BASE + 'case_body.stl', name: 'Kasa', materialKey: 'matCase',
    assembledPos: [0, 0, 0], assembledRot: [0, 0, 0] },
  { url: RELEASE_BASE + 'esp_board.stl', name: 'ESP32-S3', materialKey: 'matESP',
    assembledPos: [-1, 0, 4], assembledRot: [0, 0, 0] },
  { url: RELEASE_BASE + 'battery.stl', name: 'Batarya', materialKey: 'matBattery',
    assembledPos: [0, 8, -4], assembledRot: [-Math.PI / 2, -Math.PI / 2, 0] },
  { url: RELEASE_BASE + 'sensor_mlx.stl', name: 'MLX90614', materialKey: 'matSensorMLX',
    assembledPos: [8, -12, -5.4], assembledRot: [Math.PI, 0, 0] },
  { url: RELEASE_BASE + 'sensor_max30100.stl', name: 'MAX30100', materialKey: 'matSensorMAX',
    assembledPos: [-7, -12, -5], assembledRot: [Math.PI, 0, 0] },
  { url: RELEASE_BASE + 'bands_only_rotated_90degX.stl', name: 'Kordon', materialKey: 'matBand',
    assembledPos: [-1, 1, -31], assembledRot: [0, 0, Math.PI], scale: [0.85, 1.5, 1] }
];
