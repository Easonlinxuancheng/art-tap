/* Batik workshop controller. The cloth is persistent across every craft step. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const scene = $("scene");
  if (!scene || !window.ArtTapCloth || !window.ArtTapViewer) return;
  const names = { hanging: "亚麻挂画", coaster: "圆形杯垫", bag: "亚麻包包", shirt: "亚麻上衣" };
  const steps = [
    { id: "choose", title: "先选一件，想留下的器物。", description: "同一方原生态亚麻布，四种不同的归宿。选择你想亲手完成的作品。", note: "虚线仅提示成品边界。绘蜡与浸染时可以自由超框，成型时再沿线裁切。", next: "选好了，开始制靛" },
    { id: "prepare", title: "把草木，酿成一缸蓝。", description: "草木成浆，静待发酵，古法蓝染自此始。依次投入蓝靛草、注水、搅拌，制成染液。", note: "真实制靛需要更长时间；这里将等待压缩，让你感受每一步的变化。", next: "染液已备好，去绘蜡" },
    { id: "wax", title: "以蜡作笔，留一方空白。", description: "按住鼠标或用手指滑动，在布上留下你的线条。蜂蜡会封住底色，脱蜡后便显出蓝白纹样。", note: "蜡量不足时请沾取蜂蜡。也可先添一朵纹样，再接着自由绘画。", next: "纹样画好了，去浸染" },
    { id: "dye", title: "入缸为绿，出氧为蓝。", description: "选好染色范围，将布浸入染缸，再亲手取出。观察嫩黄绿在空气中慢慢氧化成靛蓝。", note: "深浅由浸染次数决定，与浸泡时长无关。可自由叠加全幅、下半幅与局部染色，同一处的颜色会渐渐饱和。", next: "颜色满意了，去漂洗" },
    { id: "rinse", title: "洗尽浮色，留下清透。", description: "让清水流过染好的麻布，洗去浮色。布料随水流轻颤，靛蓝与蜡纹的边界渐渐清晰。", note: "这一步清洗表面的浮色，先前叠加的染色层次会保留下来。", next: "漂洗完成，去脱蜡" },
    { id: "dewax", title: "蜡尽，花纹便醒了。", description: "把布放入热水，观察蜂蜡融化。指示进入标记区时亲手取出，让属于你的蓝白纹样显现。", note: "取布早一点或晚一点，会留下轻微晕染。手作没有标准答案，每一块布都有自己的痕迹。", next: "纹样已显，去成型" },
    { id: "assemble", title: "裁布折片，穿针引线。", description: "沿虚线保留你的纹样，把染好的麻布缝制成器物。每一笔线条，每一层靛蓝，都留在这件作品里。", note: "虚线外的创作此刻才会裁去。挂画装框，杯垫收边；包包与上衣则继续折片、缝制。", next: "观赏我的作品" },
    { id: "result", title: "这一件，独属于你。", description: "草木染岁月，蜡笔绘山河。一布一纹，皆是独一份的手工温柔。", note: "拖拽旋转，滚轮或双指缩放。静置片刻，作品会恢复缓慢自转。" },
  ];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let step = 0;
  let carrier = "hanging";
  let prep = 0;
  let busy = false;
  let immersed = false;
  let rinsed = false;
  let dewaxed = false;
  let assembled = false;
  let dewaxFraction = 0;
  let hotStarted = 0;
  let generation = 0;
  let hotFrame = 0;
  let viewer = null;
  let clothState = { wax: 100, hasMarks: false, strokeCount: 0, dips: 0, busy: false };
  let announcerTimer = 0;
  const cloth = window.ArtTapCloth.create($("cloth-canvas"), {
    carrier,
    onChange(state) { clothState = state; updateControls(); },
    onHint: announce,
  });
  clothState = cloth.getState();
  cloth.setBrush(Number($("brush-size").value));

  function announce(message) {
    clearTimeout(announcerTimer);
    $("live-status").textContent = message;
    $("live-status").classList.add("is-visible");
    announcerTimer = window.setTimeout(() => $("live-status").classList.remove("is-visible"), 5000);
  }

  function readyForNext() {
    if (busy || immersed || clothState.busy) return false;
    return [true, prep === 4, clothState.hasMarks, clothState.dips > 0, rinsed, dewaxed, assembled, false][step];
  }

  function updateControls() {
    $("wax-meter").value = clothState.wax;
    $("wax-value").textContent = `${Math.ceil(clothState.wax)}%`;
    $("dip-count").textContent = String(clothState.dips);
    $("undo-wax").disabled = !clothState.hasMarks;
    $("clear-wax").disabled = !clothState.hasMarks;
    $("next-step").disabled = !readyForNext();
    $("dip-action").disabled = busy || clothState.busy;
    $("cloth-handle").hidden = step !== 3 && step !== 5;
    $("cloth-handle").disabled = busy || clothState.busy || (step === 5 && dewaxed);
    $("cloth-handle-label").textContent = immersed ? "上提取布" : "下拉入缸";
    document.querySelectorAll("[data-dye-region]").forEach(button => { button.disabled = busy || immersed || clothState.busy; });
    const hints = [
      "选择载体后，就可以开始。",
      prep === 4 ? "染液已经就绪。" : `已完成 ${prep} / 4 个制靛动作。`,
      clothState.hasMarks ? "可以继续绘画，也可以带着纹样进入染缸。" : "先在布上画几笔，或添加一朵起手纹样。",
      immersed ? "布料正在缸中，请亲手取出。" : busy ? "等待这一层颜色完成氧化。" : clothState.dips ? "可以继续叠染，也可以开始清水漂洗。" : "至少完成一次浸染与氧化。",
      rinsed ? "浮色已经洗净，可以进行下一步。" : "开始漂洗，观察清水带走浮色。",
      dewaxed ? "蜂蜡已褪去，作品准备成型。" : immersed ? "留意取布区间，点击取出布料。" : "把布放入热水，再亲手取出。",
      assembled ? "器物已经成型，去看看它的每一面。" : "点击开始成型，让麻布成为器物。",
      "",
    ];
    $("step-hint").textContent = hints[step];
  }

  function setStep(index, focus = true) {
    step = index;
    const current = steps[index];
    scene.dataset.phase = current.id;
    scene.classList.remove("is-immersed", "is-lifting", "is-stirring", "is-rinsing", "is-melting", "is-folding", "is-sewing", "has-leaves");
    document.querySelectorAll("[data-step]").forEach((item, i) => {
      item.classList.toggle("is-current", i === index);
      item.classList.toggle("is-complete", i < index);
      if (i === index) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
    });
    steps.forEach(s => { $(`panel-${s.id}`).hidden = s.id !== current.id; });
    $("step-kicker").textContent = `BATIK STUDIO / ${String(index + 1).padStart(2, "0")} — 08`;
    $("step-title").textContent = current.title;
    $("step-description").textContent = current.description;
    $("step-note").textContent = current.note;
    $("next-step").hidden = index === 7;
    $("step-hint").hidden = index === 7;
    $("next-step").textContent = current.next || "";
    $("scene-badge").textContent = `${names[carrier]} · 原生态亚麻粗布`;
    const captions = ["先选器物，再由你留下纹样", "一缸草木，渐渐酿出蓝意", "按住并滑动绘蜡 · 虚线外也可以自由画", "选择范围 · 入缸浸染 · 取出氧化", "清水流过，布面渐渐清透", "热水化蜡 · 亲手取出布料", "只在这一刻，沿着虚线裁切", "拖拽旋转 360° · 滚轮 / 双指缩放"];
    $("scene-caption").textContent = captions[index];
    cloth.setMode(index === 2 ? "draw" : index === 3 ? "select" : "display");
    $("cloth-canvas").setAttribute("aria-label", index === 2 ? "绘蜡布面：按住鼠标或手指绘画；键盘方向键移动笔尖，空格切换落笔与提笔" : index === 3 ? "染色布面：局部模式下点击或使用方向键选择染色位置" : "当前工序的亚麻布与纹样");
    if (index === 3) scene.style.setProperty("--liquid-color", "#203e60");
    if (index === 4) scene.style.setProperty("--liquid-color", "#a8cfd2");
    if (index === 5) scene.style.setProperty("--liquid-color", "#c7c8a5");
    if (index === 7) showResult();
    updateControls();
    if (focus) {
      $("step-title").setAttribute("tabindex", "-1");
      $("step-title").focus({ preventScroll: true });
      $("stepper").scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
      announce(`进入${index + 1} / 8：${current.title}`);
    }
  }

  function animate(duration, render, allowReduction = true) {
    const run = generation;
    const actualDuration = reducedMotion.matches && allowReduction ? Math.min(duration, 400) : duration;
    return new Promise(resolve => {
      const start = performance.now();
      function frame(now) {
        if (run !== generation) return resolve(false);
        const progress = Math.min(1, (now - start) / actualDuration);
        render(progress);
        if (progress < 1) requestAnimationFrame(frame); else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  document.querySelectorAll("[data-carrier]").forEach(button => {
    button.addEventListener("click", () => {
      if (step !== 0) return;
      carrier = button.dataset.carrier;
      cloth.setCarrier(carrier);
      document.querySelectorAll("[data-carrier]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      $("scene-badge").textContent = `${names[carrier]} · 原生态亚麻粗布`;
      announce(`已选择${names[carrier]}。虚线仅在最终成型时裁切。`);
    });
  });

  $("next-step").addEventListener("click", () => { if (readyForNext()) setStep(step + 1); });

  const prepLabels = ["投入蓝靛草", "注入清水", "搅拌发酵", "静候制成靛蓝"];
  const prepMessages = ["蓝靛草已入缸，添一瓢清水吧。", "水已没过草叶，开始缓缓搅拌。", "草木的颜色融进水中，再等片刻。", "深靛蓝原液已备好，去布上绘蜡吧。"];
  $("prep-action").addEventListener("click", async () => {
    if (step !== 1 || busy || prep >= 4) return;
    busy = true;
    $("prep-action").disabled = true;
    const part = prep;
    scene.classList.toggle("has-leaves", part === 0);
    scene.classList.toggle("is-stirring", part >= 2);
    $("prep-status").textContent = ["草叶缓缓落入染缸…", "清水漫过草叶…", "水纹流动，草木色渐渐释出…", "静待草木成蓝…"][part];
    updateControls();
    const palettes = [[151, 163, 126], [137, 158, 140], [77, 126, 140], [32, 62, 96]];
    const before = part === 0 ? [175, 179, 149] : palettes[part - 1];
    const after = palettes[part];
    const finished = await animate([1000, 1200, 2200, 3000][part], p => {
      const rgb = before.map((v, i) => Math.round(v + (after[i] - v) * p));
      scene.style.setProperty("--liquid-color", `rgb(${rgb.join(",")})`);
      scene.style.setProperty("--fill-level", String((part + p) / 4));
      $("prep-progress").value = (part + p) * 25;
    });
    if (!finished) return;
    prep += 1;
    busy = false;
    scene.classList.remove("is-stirring", "has-leaves");
    $("prep-action").disabled = prep === 4;
    $("prep-action").textContent = prepLabels[prep] || "靛蓝原液已制成";
    $("prep-status").textContent = prepMessages[part];
    announce(prepMessages[part]);
    updateControls();
  });

  $("brush-size").addEventListener("input", event => cloth.setBrush(Number(event.target.value)));
  $("refill-wax").addEventListener("click", () => { cloth.refillWax(); announce("蜂蜡已沾满，继续画下你的灵感。 "); });
  $("undo-wax").addEventListener("click", () => cloth.undo());
  $("clear-wax").addEventListener("click", () => { cloth.clearWax(); announce("布面已经清空，可以重新创作。 "); });
  $("motif-wax").addEventListener("click", () => { cloth.addMotif(); });

  document.querySelectorAll("[data-dye-region]").forEach(button => {
    button.addEventListener("click", () => {
      if (busy || immersed || step !== 3) return;
      cloth.setDyeRegion(button.dataset.dyeRegion);
      document.querySelectorAll("[data-dye-region]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      const hints = { full: "本次浸染整幅布料。", half: "本次浸染下半幅，可与其他范围叠加。", local: "点击布面选择局部浸染的位置，再将布料入缸。" };
      $("dye-status").textContent = hints[button.dataset.dyeRegion];
      announce(hints[button.dataset.dyeRegion]);
    });
  });
  $("dip-action").addEventListener("click", async () => {
    if (step !== 3 || busy || clothState.busy) return;
    if (!immersed) {
      immersed = true;
      cloth.setMode("display");
      scene.classList.add("is-immersed");
      scene.classList.remove("is-lifting");
      $("dip-action").textContent = "取出布料，开始氧化";
      $("dye-status").textContent = "布料已浸入染液。现在可以取出，久泡不会加深颜色。";
      $("oxidation-progress").value = 0;
      updateControls();
      return;
    }
    immersed = false;
    busy = true;
    const run = generation;
    scene.classList.remove("is-immersed");
    scene.classList.add("is-lifting");
    $("dip-action").textContent = "空气氧化中…";
    $("dye-status").textContent = "嫩黄绿正在从边缘向内，慢慢转成靛蓝…";
    updateControls();
    try {
      await Promise.all([cloth.dye(), animate(2600, p => { $("oxidation-progress").value = p * 100; })]);
      if (run !== generation) return;
      clothState = cloth.getState();
      $("oxidation-progress").value = 100;
      $("dye-status").textContent = `第 ${clothState.dips} 次氧化完成。可更换范围继续叠染，或前往漂洗。`;
      announce(`第 ${clothState.dips} 次浸染完成，布料已氧化成蓝色。`);
    } catch {
      if (run !== generation) return;
      announce("本次浸染未完成，请再试一次。之前的纹样仍然保留。 ");
    } finally {
      if (run === generation) {
        busy = false;
        scene.classList.remove("is-lifting");
        cloth.setMode("select");
        $("dip-action").textContent = "再浸染一次";
        updateControls();
      }
    }
  });

  // A separate handle keeps cloth dragging distinct from selecting a local dye area.
  const handle = $("cloth-handle");
  let handleStart = null;
  let draggedHandle = false;
  function useHandle() {
    if (handle.disabled) return;
    if (step === 3) $("dip-action").click();
    else if (step === 5) $("dewax-action").click();
  }
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || handle.disabled) return;
    handleStart = { y: event.clientY, id: event.pointerId };
    draggedHandle = false;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointerup", event => {
    if (!handleStart || handleStart.id !== event.pointerId) return;
    const delta = event.clientY - handleStart.y;
    handleStart = null;
    if (Math.abs(delta) > 24) {
      draggedHandle = true;
      if ((!immersed && delta > 0) || (immersed && delta < 0)) useHandle();
      else announce(immersed ? "向上提起手柄，把布料取出。" : "向下拉动手柄，把布料放入缸中。");
    }
  });
  handle.addEventListener("pointercancel", () => { handleStart = null; draggedHandle = false; });
  handle.addEventListener("click", event => {
    // Keyboard activation has detail=0 and must not inherit a suppressed drag click.
    if (draggedHandle && event.detail !== 0) { draggedHandle = false; return; }
    draggedHandle = false;
    useHandle();
  });

  $("rinse-action").addEventListener("click", async () => {
    if (step !== 4 || busy || rinsed) return;
    busy = true;
    $("rinse-action").disabled = true;
    $("rinse-action").textContent = "清水漂洗中…";
    scene.classList.add("is-rinsing");
    updateControls();
    const finished = await animate(4000, p => {
      cloth.rinse(p);
      $("rinse-progress").value = p * 100;
      $("rinse-status").textContent = p < .5 ? "清水流过布面，洗去浮色…" : "布料轻颤，靛蓝渐渐清透…";
      scene.style.setProperty("--wash-progress", String(p));
    });
    if (!finished) return;
    busy = false;
    rinsed = true;
    scene.classList.remove("is-rinsing");
    $("rinse-action").textContent = "漂洗已完成";
    $("rinse-status").textContent = "浮色已洗去，原有染色层次完整保留。";
    announce("漂洗完成，可以进入热水脱蜡。 ");
    updateControls();
  });

  $("dewax-action").addEventListener("click", async () => {
    if (step !== 5 || busy || dewaxed) return;
    if (!immersed) {
      immersed = true;
      hotStarted = performance.now();
      dewaxFraction = 0;
      scene.classList.add("is-immersed", "is-melting");
      $("dewax-action").textContent = "取出布料";
      updateControls();
      const run = generation;
      function heat(now) {
        if (run !== generation || !immersed) return;
        dewaxFraction = Math.min(1, (now - hotStarted) / 7000);
        cloth.dewax(Math.min(1, dewaxFraction / .62), 0);
        $("dewax-progress").value = dewaxFraction * 100;
        scene.style.setProperty("--melt-progress", String(dewaxFraction));
        $("dewax-status").textContent = dewaxFraction < .6 ? "蜂蜡逐渐融化，留意标记中的取布区间…" : dewaxFraction <= .82 ? "此刻取出，纹样边缘最清晰。" : "再晚一点取出，会留下柔和的自然晕染。";
        if (dewaxFraction < 1) hotFrame = requestAnimationFrame(heat);
      }
      hotFrame = requestAnimationFrame(heat);
      announce("布料已经入热水，留意进度并亲手取出。 ");
      return;
    }
    immersed = false;
    busy = true;
    cancelAnimationFrame(hotFrame);
    scene.classList.remove("is-immersed");
    scene.classList.add("is-lifting");
    $("dewax-action").disabled = true;
    $("dewax-action").textContent = "蜡纹正在显现…";
    const bleed = Math.min(.8, Math.max(0, .6 - dewaxFraction, dewaxFraction - .82) * 1.1);
    const startMelt = Math.min(1, dewaxFraction / .62);
    updateControls();
    const finished = await animate(900, p => cloth.dewax(startMelt + (1 - startMelt) * p, bleed));
    if (!finished) return;
    busy = false;
    dewaxed = true;
    scene.classList.remove("is-lifting", "is-melting");
    $("dewax-action").textContent = "蜂蜡已脱净";
    $("dewax-status").textContent = bleed > .06 ? "纹样显现，边缘留下了轻柔的晕染。这是你的手作印记。" : "时机刚好。蜡层已尽，蓝白纹样清晰显现。";
    announce($("dewax-status").textContent);
    updateControls();
  });

  $("assemble-action").addEventListener("click", async () => {
    if (step !== 6 || busy || assembled) return;
    busy = true;
    $("assemble-action").disabled = true;
    $("assemble-action").textContent = "正在裁布成型…";
    const needsSewing = carrier === "bag" || carrier === "shirt";
    let cut = false;
    updateControls();
    const finished = await animate(needsSewing ? 5300 : 3300, p => {
      $("assembly-progress").value = p * 100;
      scene.style.setProperty("--seam-progress", String(Math.max(0, (p - .5) * 2)));
      if (p > .22 && !cut) { cut = true; cloth.setCut(true); }
      scene.classList.toggle("is-folding", needsSewing && p > .28 && p < .64);
      scene.classList.toggle("is-sewing", needsSewing && p >= .55);
      $("assembly-status").textContent = p < .28 ? "沿虚线裁下布片，保留边界内的纹样…" : needsSewing ? p < .58 ? "顺着布纹折片，柔和的褶痕慢慢成形…" : "穿针引线，细密针脚将布片缝成器物…" : carrier === "hanging" ? "收好布边，将画芯嵌入细木相框…" : "叠合布层，收出圆润厚实的杯垫边缘…";
    });
    if (!finished) return;
    busy = false;
    assembled = true;
    scene.classList.remove("is-folding", "is-sewing");
    $("assemble-action").textContent = "器物已成型";
    $("assembly-status").textContent = `${names[carrier]}已完成。去转一转，看看属于你的每一面。`;
    announce($("assembly-status").textContent);
    updateControls();
  });

  function showResult() {
    $("viewer").hidden = false;
    if (viewer) viewer.destroy();
    viewer = window.ArtTapViewer.create($("viewer"), cloth.texture(), carrier);
    $("result-title").textContent = `我的${names[carrier]}`;
    $("result-description").textContent = `${clothState.dips} 次草木浸染 · ${clothState.strokeCount} 道手绘蜡纹 · 独一份的手工温柔`;
  }
  $("reset-view").addEventListener("click", () => viewer?.resetView());

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Image export unavailable")), "image/png"));
  }
  function cropPattern() {
    const texture = cloth.texture();
    const out = document.createElement("canvas");
    out.width = out.height = 1200;
    const ctx = out.getContext("2d");
    ctx.scale(1200, 1200);
    ctx.beginPath();
    if (carrier === "coaster") ctx.arc(.5, .5, .38, 0, Math.PI * 2);
    else if (carrier === "shirt") {
      const points = [[.12,.21],[.32,.1],[.4,.1],[.42,.18],[.58,.18],[.6,.1],[.68,.1],[.88,.21],[.98,.42],[.79,.53],[.72,.42],[.72,.91],[.28,.91],[.28,.42],[.21,.53],[.02,.42]];
      points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.closePath();
    } else if (carrier === "bag") ctx.rect(.18, .18, .64, .67);
    else ctx.rect(.1, .1, .8, .8);
    ctx.clip();
    ctx.drawImage(texture, 0, 0, 1, 1);
    return out;
  }
  async function artworkBlob() {
    if (!viewer) throw new Error("No result");
    const image = new Image();
    image.src = viewer.capture();
    await image.decode();
    const card = document.createElement("canvas");
    card.width = 1200;
    card.height = 1450;
    const ctx = card.getContext("2d");
    ctx.fillStyle = "#f6f4ee";
    ctx.fillRect(0, 0, card.width, card.height);
    ctx.fillStyle = "#243c89";
    ctx.font = "bold 42px Arial, sans-serif";
    ctx.fillText("art tap.", 74, 95);
    ctx.fillStyle = "#727969";
    ctx.font = "17px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("A LITTLE TOUCH. A LITTLE ART.", 1126, 89);
    const scale = Math.min(1080 / image.width, 1070 / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (1200 - w) / 2, 140 + (1070 - h) / 2, w, h);
    ctx.strokeStyle = "#d7ddcf";
    ctx.beginPath(); ctx.moveTo(74, 1240); ctx.lineTo(1126, 1240); ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#29362d";
    ctx.font = "38px 'Microsoft YaHei', sans-serif";
    ctx.fillText(`我的${names[carrier]}`, 74, 1310);
    ctx.fillStyle = "#727969";
    ctx.font = "21px 'Microsoft YaHei', sans-serif";
    ctx.fillText(`${clothState.dips} 次草木浸染 · 一布一纹，独一份的手工温柔。`, 74, 1360);
    return canvasBlob(card);
  }
  $("save-art").addEventListener("click", async () => {
    const button = $("save-art");
    button.disabled = true;
    try { downloadBlob(await artworkBlob(), `ArtTap-${carrier}-作品.png`); announce("作品收藏卡已保存为 PNG 图片。 "); }
    catch { announce("保存暂未成功，请稍后再试；也可以下载平面纹样。 "); }
    finally { button.disabled = false; }
  });
  $("download-pattern").addEventListener("click", async () => {
    try { downloadBlob(await canvasBlob(cropPattern()), `ArtTap-${carrier}-纹样.png`); announce("已保存裁切后的纹样，保留原始绘制细节。 "); }
    catch { announce("纹样导出暂未完成，请重试。 "); }
  });
  $("share-art").addEventListener("click", async () => {
    const button = $("share-art");
    button.disabled = true;
    try {
      const blob = await artworkBlob();
      const file = new File([blob], `ArtTap-${carrier}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: `我的${names[carrier]} · Art Tap` });
        announce("分享已完成。 ");
      } else {
        downloadBlob(blob, file.name);
        announce("当前浏览器不支持直接分享，已下载作品图片，可从相册分享。 ");
      }
    } catch (error) {
      if (error.name !== "AbortError") announce("暂时无法分享，请使用“保存作品”后分享图片。 ");
    } finally { button.disabled = false; }
  });

  const restartDialog = $("restart-dialog");
  function askRestart() { if (!restartDialog.open) restartDialog.showModal(); }
  $("restart-top").addEventListener("click", askRestart);
  $("new-art").addEventListener("click", askRestart);
  $("cancel-restart").addEventListener("click", () => restartDialog.close());
  $("confirm-restart").addEventListener("click", () => {
    restartDialog.close();
    generation += 1;
    cancelAnimationFrame(hotFrame);
    viewer?.destroy();
    viewer = null;
    $("viewer").hidden = true;
    $("viewer").replaceChildren();
    prep = 0; busy = false; immersed = false; rinsed = false; dewaxed = false; assembled = false; dewaxFraction = 0;
    cloth.reset();
    cloth.setCarrier(carrier);
    cloth.setBrush(Number($("brush-size").value));
    cloth.setDyeRegion("full");
    document.querySelectorAll("[data-dye-region]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.dyeRegion === "full")));
    scene.style.removeProperty("--liquid-color");
    scene.style.removeProperty("--melt-progress");
    scene.style.removeProperty("--seam-progress");
    ["prep-progress", "oxidation-progress", "rinse-progress", "dewax-progress", "assembly-progress"].forEach(id => { $(id).value = 0; });
    $("prep-action").textContent = prepLabels[0]; $("prep-action").disabled = false;
    $("prep-status").textContent = "先将蓝靛草投入染缸。";
    $("dip-action").textContent = "将布料浸入染缸";
    $("dye-status").textContent = "选择染色范围，开始第一次浸染。";
    $("rinse-action").textContent = "开始清水漂洗"; $("rinse-action").disabled = false;
    $("rinse-status").textContent = "清水已经备好。";
    $("dewax-action").textContent = "将布料放入热水"; $("dewax-action").disabled = false;
    $("dewax-status").textContent = "热水已备好，准备融蜡。";
    $("assemble-action").textContent = "开始裁布成型"; $("assemble-action").disabled = false;
    $("assembly-status").textContent = "所有纹样和染色层次都已准备好。";
    clothState = cloth.getState();
    setStep(0);
  });
  window.addEventListener("pagehide", () => { cancelAnimationFrame(hotFrame); viewer?.destroy(); });
  window.addEventListener("pageshow", event => { if (event.persisted && step === 7) showResult(); });
  setStep(0, false);
})();
