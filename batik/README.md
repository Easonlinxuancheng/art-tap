# Art Tap · Batik workshop

This module lives on the `batik` branch of [Easonlinxuancheng/art-tap](https://github.com/Easonlinxuancheng/art-tap). It is independent of the exhibition homepage on `homepage-eason` and is intended for Group A's Batik work.

## Run

Open `batik/index.html` directly, or serve the repository root:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/batik/index.html. No install, build, CDN, or external artwork is required.

The header's `../index.html` links return to the shared homepage after integration. A checkout of only the `batik` branch does not include the homepage; enter the game using the direct path above. Keep the stable `main` branch unchanged until the team's integration step.

## Files

```text
batik/index.html       Workshop panels and controls
batik/css/batik.css    Independent workshop styles and scene animations
batik/js/app.js        Craft flow, actions, exports, and restart
batik/js/cloth.js      Linen canvas, wax mask, spatial dye field
batik/js/viewer.js     Lightweight WebGL geometry and 3D controls
```

## Craft flow

Select a carrier, prepare indigo, draw wax, dye and oxidize, rinse, manually dewax, cut/assemble, and view the finished 3D piece. Four carriers are available: framed linen art, a round coaster, a linen bag, and a linen shirt.

- Draw anywhere, including outside the cut guide. Wax is consumed by strokes and replenished manually. A starter motif, undo, clear, and brush width are available.
- Full, lower-half, and local dye regions accumulate independently. Depth depends on the number of passes, not soak time. Lifting triggers a yellow-green to indigo transition over about 2.6 seconds.
- Repeat passes freely. Individual regions saturate after six layers; other regions can still be dyed. Click the controls or drag the cloth handle down/up to immerse/lift.
- Rinsing removes the simulated surface haze while retaining dye layers. Hot-water dewaxing requires manual removal; early or late removal adds slight edge bleed without destroying the artwork.
- Cutting occurs only at assembly and uses the selected carrier's mask. Front UV coordinates preserve the same artwork. Back and side panels reuse the design to complete the object.
- Drag to rotate, use the wheel/pinch to zoom, or focus the model and use arrow keys and +/-. Home resets its view. Auto-rotation resumes after idle and stops with reduced-motion preferences.
- Export the current view as a PNG collectible card or save the cropped flat pattern. Native file sharing is used when supported; otherwise the image downloads for manual sharing.

For keyboard drawing, focus the cloth, move with arrows, press Space to lower the pen, draw using arrows, then press Space again to lift it. Shift+arrow moves farther. Touch drawing does not scroll the page inside the canvas.

This educational simulation compresses craft timings and uses stylized meshes, rather than a cloth-physics or tailoring simulator. If WebGL is unavailable, the viewer explicitly shows a flat fallback.

## Integration

Keep all module files under `batik/` and the public entry at `batik/index.html`. Its only browser namespaces are `ArtTapCloth` and `ArtTapViewer`, used by its own controller. It has no homepage CSS/JS dependency. Keep Batik documentation here so its branch can merge alongside the homepage without editing the same root README.

## Verification

All four carriers passed a complete browser flow from entry through exported artwork and restart. Checks include desktop/mobile layout, pointer/touch/keyboard drawing, drag-to-immerse/lift, real WebGL rendering, PNG export, and no browser runtime exceptions. Independent pixel checks verified wax resist, half/local dye separation, carrier cropping, color saturation, and reset during oxidation. WebGL interaction, reduced motion, resizing, and unavailable-WebGL fallback were also checked.