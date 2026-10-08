/* Homepage-only progressive enhancement. No dependencies or shared global state. */
(() => {
  "use strict";
  const home = document.querySelector(".art-home");
  if (!home) return;

  const year = home.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const dialog = home.querySelector(".at-status-dialog");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const description = dialog.querySelector("#status-description");
  const closeDialog = () => dialog.close();
  dialog.querySelector(".at-dialog-close").addEventListener("click", closeDialog);
  dialog.querySelector(".at-dialog-confirm").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closeDialog();
  });

  // On HTTP, detect an unmerged section before navigation. Never replace the
  // real href: file://, modified clicks, and disabled JS use native navigation.
  // Teams only need to add their index.html; no homepage switch is required.
  if (!/^https?:$/.test(window.location.protocol)) return;
  let pendingNavigation = false;
  home.querySelectorAll("[data-experience]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (pendingNavigation) return;
      pendingNavigation = true;
      link.setAttribute("aria-busy", "true");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      let isMissing = false;
      try {
        const response = await fetch(link.href, { method: "HEAD", cache: "no-store", signal: controller.signal });
        isMissing = response.status === 404 || response.status === 410;
      } catch {
        // A server without HEAD support or temporary network failure should
        // not block the ordinary browser link and its own error handling.
      } finally {
        window.clearTimeout(timeout);
        link.removeAttribute("aria-busy");
        pendingNavigation = false;
      }
      if (isMissing) {
        description.textContent = link.dataset.experience === "batik"
          ? "蜡染工坊正在布置中。先感受一抹靛蓝的灵感，期待下一次与手作相遇。"
          : "花艺小室正在布置中。先留住一枝春的灵感，期待下一次与自然相遇。";
        if (!dialog.open) dialog.showModal();
      } else {
        window.location.assign(link.href);
      }
    });
  });
})();
