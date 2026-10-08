# Art Tap

An interactive art website exploring Batik and Flower Arrangement, built with plain HTML, CSS, and JavaScript.

Repository: [Easonlinxuancheng/art-tap](https://github.com/Easonlinxuancheng/art-tap).

## Branches and team ownership

| Branch | Scope | Files |
| --- | --- | --- |
| `main` | Stable integration baseline | Updated only through the team's integration workflow |
| `homepage-eason` | Eason's exhibition homepage and integration entry points | `index.html`, `css/global.css`, `js/main.js`, `assets/homepage/`, this README |
| `batik` | Playable Batik workshop for Group A | `batik/`, including its own README |
| Flower team's branch | Group B's Flower Arrangement experience | `flower/`, supplied by Group B |

Homepage and Batik commits are independent changes from the shared baseline. Each branch contains only its own module plus the baseline files. The two entry URLs are reserved for later integration; publishing a branch does not merge it into `main`.

## Homepage files

```text
index.html                 Exhibition homepage and two section links
css/global.css             Design tokens and scoped homepage styles
js/main.js                 Independent homepage enhancements
assets/homepage/            Local SVG illustrations and favicon
```

The entry links are `batik/index.html` and `flower/index.html`. The Batik game is available on the separate [batik branch](https://github.com/Easonlinxuancheng/art-tap/tree/batik/batik); Flower Arrangement remains Group B's integration point. The homepage's illustrations are decorative assets, not the game implementation.

## Preview

Open `index.html` directly in a browser, or serve the repository root:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/. No install or build is required; all fonts have system fallbacks and all artwork is local. To preview the entire site, combine the module branches on a dedicated integration branch, or use a local workspace containing both modules.

## Integration contract

- Preserve `batik/index.html` and `flower/index.html`. These relative links work under a repository subpath, including GitHub Pages.
- Each team owns its HTML, CSS, JavaScript, assets, and module documentation inside its section directory. A section's home link is `../index.html`.
- The homepage body uses `.art-home`; its CSS selectors use `.at-` names. `js/main.js` creates no global variables. Module pages do not need to load the homepage files.
- Shared design tokens have an `--at-` prefix. `css/global.css` contains no unscoped element reset. Apply `art-home` only to the homepage.
- Over HTTP, a normal section click checks the target with a bounded HEAD request. A confirmed 404/410 shows the preparation dialog. Once a module exists, navigation works automatically. Native links remain available on `file://`, with JavaScript disabled, and for modified clicks.
- Use a static server without SPA fallback: unknown paths should return 404, not the homepage.
- Keep module-specific documentation in its module folder to avoid conflicting root README edits.
- Review and integrate the branches before changing `main`. Branch publication does not deploy a live website.

## Verification

The homepage was checked at 320, 390, 768, 1024, and 1440px widths, including assets, keyboard navigation, reduced motion, unavailable-section dialogs, and existing-section navigation. The page remains readable without JavaScript. See the Batik branch's module README for game behavior and its verification.