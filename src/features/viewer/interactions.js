// interactions.js — static "frozen hold-state" render + resize handler.
//
// The source IIFE (website/index.html ~2268–2290) has NO mouse or touch
// interactions — there's an explicit `// No mouse interaction - static view`
// comment. The only runtime behavior after load is:
//   1. A resize handler that resizes the renderer, updates camera.aspect,
//      and re-renders a single frame.
//   2. A zeroed watchGroup rotation + single renderer.render() call.
//
// We reproduce that here and expose a small public API for future use
// (hot reload, manual re-render after state changes, etc).
//
// Exports:
//   setupInteractions({ scene, camera, renderer, watchGroup, canvas })
//     -> { renderScene, dispose }

export function setupInteractions(ctx) {
  const { scene, camera, renderer, watchGroup, canvas } = ctx;
  const wrapper = canvas.parentElement;

  function renderScene() {
    if (watchGroup) {
      watchGroup.rotation.x = 0;
      watchGroup.rotation.y = 0;
      watchGroup.rotation.z = 0;
    }
    renderer.render(scene, camera);
  }

  function resizeWatchCanvas() {
    const w = wrapper ? wrapper.clientWidth : canvas.clientWidth;
    const h = Math.max(w * 0.9, 460);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderScene();
  }

  // Initial sizing + render (matches source's resizeWatchCanvas() + renderOnce()).
  resizeWatchCanvas();
  window.addEventListener('resize', resizeWatchCanvas);

  function dispose() {
    window.removeEventListener('resize', resizeWatchCanvas);
  }

  return { renderScene, dispose };
}
