/* Art Tap · linen, wax resist and spatial indigo dyeing. No dependencies. */
(function () {
  'use strict';

  var SIZE = 900;
  var FIELD = 240;
  var clamp = function (value, low, high) { return Math.max(low, Math.min(high, value)); };
  var smooth = function (value) { value = clamp(value, 0, 1); return value * value * (3 - 2 * value); };
  var carriers = {
    hanging: { name: '亚麻挂画', type: 'rect', bounds: [.1, .1, .9, .9] },
    coaster: { name: '圆形杯垫', type: 'circle', center: [.5, .5], radius: .38 },
    bag: { name: '亚麻包包', type: 'rect', bounds: [.18, .18, .82, .85] },
    shirt: { name: '亚麻上衣', type: 'polygon', points: [[.12, .21], [.32, .1], [.4, .1], [.42, .18], [.58, .18], [.6, .1], [.68, .1], [.88, .21], [.98, .42], [.79, .53], [.72, .42], [.72, .91], [.28, .91], [.28, .42], [.21, .53], [.02, .42]] }
  };

  function surface(width, height) {
    var element = document.createElement('canvas');
    element.width = width;
    element.height = height || width;
    return element;
  }

  function carrierPath(context, carrier) {
    var shape = carriers[carrier] || carriers.hanging;
    context.beginPath();
    if (shape.type === 'circle') {
      context.arc(shape.center[0] * SIZE, shape.center[1] * SIZE, shape.radius * SIZE, 0, Math.PI * 2);
    } else if (shape.type === 'rect') {
      var b = shape.bounds;
      context.rect(b[0] * SIZE, b[1] * SIZE, (b[2] - b[0]) * SIZE, (b[3] - b[1]) * SIZE);
    } else {
      shape.points.forEach(function (p, index) {
        context[index ? 'lineTo' : 'moveTo'](p[0] * SIZE, p[1] * SIZE);
      });
      context.closePath();
    }
  }

  function makeLinen() {
    var linen = surface(SIZE);
    var ctx = linen.getContext('2d');
    var seed = 31943;
    function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    ctx.fillStyle = '#e5dfcf';
    ctx.fillRect(0, 0, SIZE, SIZE);
    var glow = ctx.createRadialGradient(340, 245, 10, 450, 450, 670);
    glow.addColorStop(0, 'rgba(255,253,241,.32)');
    glow.addColorStop(1, 'rgba(104,112,85,.10)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (var i = 0; i < SIZE; i += 3) {
      ctx.strokeStyle = 'rgba(116,112,88,' + (.045 + random() * .065) + ')';
      ctx.lineWidth = .6 + random() * .8;
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + (random() - .5) * 2, SIZE); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,239,' + (.12 + random() * .13) + ')';
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(SIZE, i + (random() - .5) * 2); ctx.stroke();
    }
    for (var fiber = 0; fiber < 7000; fiber++) {
      var x = random() * SIZE, y = random() * SIZE;
      ctx.fillStyle = fiber % 3 ? 'rgba(106,104,80,.085)' : 'rgba(255,255,242,.24)';
      ctx.fillRect(x, y, fiber % 2 ? .8 : 2 + random() * 5, fiber % 2 ? 2 + random() * 6 : .7);
    }
    return linen;
  }

  function create(canvas, options) {
    options = options || {};
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.touchAction = 'none';
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', '蜡染创作布面。拖动绘蜡；键盘方向键移动蜡刀，空格切换落笔；选择局部浸染时用方向键定位。');
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('此浏览器暂不支持 Canvas 绘图。');
    var linen = makeLinen();
    var waxMask = surface(SIZE), waxArt = surface(SIZE), ink = surface(FIELD), compositeInk = surface(SIZE);
    var maskCtx = waxMask.getContext('2d'), waxCtx = waxArt.getContext('2d'), inkCtx = ink.getContext('2d'), compositeCtx = compositeInk.getContext('2d');
    var dyeCounts = new Float32Array(FIELD * FIELD);
    var image = inkCtx.createImageData(FIELD, FIELD);
    var strokes = [];
    var carrier = carriers[options.carrier] ? options.carrier : 'hanging';
    var mode = 'draw', brush = 10, wax = 100, dips = 0, region = 'full';
    var local = { x: .5, y: .5, radius: .235 };
    var cut = false, busy = false, destroyed = false, rinseAmount = 0, dewaxAmount = 0, bleed = 0;
    var pointerId = null, activeStroke = null, lastPoint = null;
    var keyboardPen = { x: .5, y: .5 }, keyboardDown = false, focused = false;
    var drawFrame = 0, animationFrame = 0, animationResolve = null, lastHint = 0;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function getState() {
      return { wax: Math.round(wax * 10) / 10, strokeCount: strokes.length, dips: dips, busy: busy, hasMarks: strokes.length > 0, region: region };
    }
    function changed() { if (!destroyed && typeof options.onChange === 'function') options.onChange(getState()); }
    function hint(message) { if (typeof options.onHint === 'function') options.onHint(message); }
    function requestRender() {
      if (drawFrame || destroyed) return;
      drawFrame = requestAnimationFrame(function () { drawFrame = 0; render(); });
    }
    function trace(context, stroke) {
      context.beginPath();
      var points = stroke.points;
      if (points.length === 1) {
        context.arc(points[0].x, points[0].y, .1, 0, Math.PI * 2);
      } else {
        context.moveTo(points[0].x, points[0].y);
        for (var p = 1; p < points.length; p++) context.lineTo(points[p].x, points[p].y);
      }
    }
    function renderWax() {
      maskCtx.clearRect(0, 0, SIZE, SIZE);
      waxCtx.clearRect(0, 0, SIZE, SIZE);
      maskCtx.lineCap = waxCtx.lineCap = 'round';
      maskCtx.lineJoin = waxCtx.lineJoin = 'round';
      strokes.forEach(function (stroke) {
        maskCtx.lineWidth = stroke.width;
        maskCtx.strokeStyle = '#fff';
        trace(maskCtx, stroke); maskCtx.stroke();
        waxCtx.lineWidth = stroke.width + 1;
        waxCtx.strokeStyle = '#be9149';
        waxCtx.shadowColor = 'rgba(119,85,37,.23)';
        waxCtx.shadowBlur = 4;
        waxCtx.shadowOffsetY = 2;
        trace(waxCtx, stroke); waxCtx.stroke();
        waxCtx.shadowBlur = 0; waxCtx.shadowOffsetY = 0;
        waxCtx.lineWidth = stroke.width * .76;
        waxCtx.strokeStyle = '#e6bf72';
        trace(waxCtx, stroke); waxCtx.stroke();
        waxCtx.save();
        waxCtx.translate(-.7, -.9);
        waxCtx.lineWidth = Math.max(1, stroke.width * .23);
        waxCtx.strokeStyle = 'rgba(255,237,180,.58)';
        trace(waxCtx, stroke); waxCtx.stroke();
        waxCtx.restore();
      });
    }

    var palette = [[229, 224, 210], [110, 151, 167], [76, 120, 150], [48, 91, 130], [34, 73, 111], [28, 60, 94], [22, 49, 78]];
    function updateInk(transition) {
      var data = image.data;
      for (var n = 0; n < dyeCounts.length; n++) {
        var count = dyeCounts[n];
        var lower = Math.floor(clamp(count, 0, 6));
        var upper = Math.min(6, lower + 1), fraction = count - lower;
        var red = palette[lower][0] * (1 - fraction) + palette[upper][0] * fraction;
        var green = palette[lower][1] * (1 - fraction) + palette[upper][1] * fraction;
        var blue = palette[lower][2] * (1 - fraction) + palette[upper][2] * fraction;
        if (transition && transition.weights[n] > 0) {
          // Oxygen reaches the boundary first and then travels across the wet cloth.
          var oxygen = smooth((transition.progress - transition.depth[n] * .28) / .72);
          var wet = transition.weights[n] * (1 - oxygen);
          var strength = Math.min(count, 5);
          red = red * (1 - wet) + (153 - strength * 6) * wet;
          green = green * (1 - wet) + (166 - strength * 5) * wet;
          blue = blue * (1 - wet) + (83 - strength * 4) * wet;
        }
        var offset = n * 4;
        data[offset] = red; data[offset + 1] = green; data[offset + 2] = blue;
        data[offset + 3] = count > 0 ? 242 : 0;
      }
      inkCtx.putImageData(image, 0, 0);
    }

    function paintCloth(target, showGuide) {
      target.save();
      if (cut && showGuide) { carrierPath(target, carrier); target.clip(); }
      target.drawImage(linen, 0, 0);
      if (dips) {
        compositeCtx.clearRect(0, 0, SIZE, SIZE);
        compositeCtx.globalCompositeOperation = 'source-over';
        compositeCtx.drawImage(ink, 0, 0, SIZE, SIZE);
        compositeCtx.globalCompositeOperation = 'destination-out';
        compositeCtx.drawImage(waxMask, 0, 0);
        compositeCtx.globalCompositeOperation = 'source-over';
        target.globalCompositeOperation = 'multiply';
        target.drawImage(compositeInk, 0, 0);
        target.globalCompositeOperation = 'source-over';
        // A very light linen overlay keeps fibers visible in the deepest indigo.
        target.globalAlpha = .065 + rinseAmount * .025;
        target.globalCompositeOperation = 'soft-light';
        target.drawImage(linen, 0, 0);
        target.globalCompositeOperation = 'source-over';
        target.globalAlpha = 1;
      }
      if (bleed > 0 && dewaxAmount > 0 && dips) {
        target.save();
        target.globalAlpha = bleed * dewaxAmount * .13;
        target.filter = 'blur(2px)';
        target.drawImage(compositeInk, 0, 0);
        target.restore();
      }
      if (dewaxAmount < 1) {
        target.globalAlpha = 1 - smooth(dewaxAmount);
        target.drawImage(waxArt, 0, 0);
        target.globalAlpha = 1;
      }
      target.restore();
      if (!showGuide || cut) return;
      target.save();
      carrierPath(target, carrier);
      target.lineWidth = 2;
      target.setLineDash([12, 10]);
      target.strokeStyle = dips ? 'rgba(242,238,218,.56)' : 'rgba(76,100,97,.43)';
      target.stroke();
      target.restore();
    }

    function render() {
      if (destroyed) return;
      ctx.clearRect(0, 0, SIZE, SIZE);
      paintCloth(ctx, true);
      if (mode === 'select' && !busy && !cut) {
        ctx.save();
        ctx.strokeStyle = 'rgba(253,247,214,.95)';
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 8]);
        ctx.fillStyle = 'rgba(57,107,133,.12)';
        ctx.beginPath();
        if (region === 'local') ctx.arc(local.x * SIZE, local.y * SIZE, local.radius * SIZE, 0, Math.PI * 2);
        else if (region === 'half') ctx.rect(0, SIZE * .5, SIZE, SIZE * .5);
        else ctx.rect(8, 8, SIZE - 16, SIZE - 16);
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (focused && mode === 'draw' && !busy) {
        var px = keyboardPen.x * SIZE, py = keyboardPen.y * SIZE;
        ctx.save();
        ctx.strokeStyle = keyboardDown ? '#fff5d6' : '#355764';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, brush * .5 + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    function pointFromEvent(event) {
      var bounds = canvas.getBoundingClientRect();
      return { x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1) * SIZE, y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1) * SIZE };
    }
    function emptyHint() {
      var now = Date.now();
      if (now - lastHint > 1800) { hint('蜡刀上的蜂蜡用尽了，请点击「沾取蜂蜡」。'); lastHint = now; }
    }
    function startStroke(point) {
      if (wax <= .05) { emptyHint(); return false; }
      activeStroke = { width: brush, points: [point], spent: Math.min(wax, .22) };
      wax = Math.max(0, wax - activeStroke.spent);
      strokes.push(activeStroke);
      lastPoint = point;
      renderWax(); requestRender(); changed();
      return true;
    }
    function continueStroke(point) {
      if (!activeStroke || !lastPoint) return;
      var dx = point.x - lastPoint.x, dy = point.y - lastPoint.y;
      var distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < .75) return;
      var cost = distance * (.013 + activeStroke.width * .0017);
      if (wax < cost) {
        var ratio = cost ? wax / cost : 0;
        point = { x: lastPoint.x + dx * ratio, y: lastPoint.y + dy * ratio };
        cost = wax;
      }
      if (cost > 0) {
        activeStroke.points.push(point);
        activeStroke.spent += cost;
        wax = Math.max(0, wax - cost);
        lastPoint = point;
        renderWax(); requestRender(); changed();
      }
      if (wax <= .05) { finishStroke(); emptyHint(); }
    }
    function finishStroke() { activeStroke = null; lastPoint = null; keyboardDown = false; }
    function selectLocal(point) {
      local.x = point.x / SIZE; local.y = point.y / SIZE;
      keyboardPen.x = local.x; keyboardPen.y = local.y;
      requestRender();
    }
    function pointerDown(event) {
      if (busy || destroyed || mode === 'display' || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
      var point = pointFromEvent(event);
      if (mode === 'select') {
        if (region === 'local') { selectLocal(point); hint('已选择局部浸染位置，可再次点击或拖动调整。'); }
      } else if (!startStroke(point)) return;
      keyboardPen.x = point.x / SIZE; keyboardPen.y = point.y / SIZE;
      pointerId = event.pointerId;
      try { canvas.setPointerCapture(pointerId); } catch (ignore) { /* Detached canvas or cancelled pointer. */ }
      event.preventDefault();
    }
    function pointerMove(event) {
      if (event.pointerId !== pointerId || busy) return;
      var point = pointFromEvent(event);
      if (mode === 'select' && region === 'local') selectLocal(point);
      if (mode === 'draw') continueStroke(point);
      event.preventDefault();
    }
    function pointerUp(event) {
      if (event.pointerId !== pointerId) return;
      finishStroke(); pointerId = null;
      changed(); requestRender();
    }
    function keyDown(event) {
      if (busy || mode === 'display') return;
      var direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (direction) {
        event.preventDefault();
        var step = event.shiftKey ? .04 : .012;
        keyboardPen.x = clamp(keyboardPen.x + direction[0] * step, .005, .995);
        keyboardPen.y = clamp(keyboardPen.y + direction[1] * step, .005, .995);
        var point = { x: keyboardPen.x * SIZE, y: keyboardPen.y * SIZE };
        if (mode === 'select' && region === 'local') selectLocal(point);
        else if (keyboardDown) continueStroke(point);
        requestRender();
      } else if (event.code === 'Space') {
        event.preventDefault();
        if (event.repeat || mode !== 'draw') return;
        if (keyboardDown) { finishStroke(); hint('蜡刀已提起，方向键可移动位置。'); }
        else { keyboardDown = startStroke({ x: keyboardPen.x * SIZE, y: keyboardPen.y * SIZE }); if (keyboardDown) hint('蜡刀已落下，用方向键绘蜡，再按空格提起。'); }
        requestRender();
      } else if (event.key === 'Escape') { finishStroke(); requestRender(); }
    }
    function focus() { focused = true; requestRender(); }
    function blur() { focused = false; finishStroke(); requestRender(); }

    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('lostpointercapture', pointerUp);
    canvas.addEventListener('keydown', keyDown);
    canvas.addEventListener('focus', focus);
    canvas.addEventListener('blur', blur);

    function cancelAnimation() {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      busy = false;
      if (animationResolve) { var resolve = animationResolve; animationResolve = null; resolve(getState()); }
    }
    function dye() {
      if (busy || destroyed) return Promise.resolve(getState());
      finishStroke();
      var weights = new Float32Array(FIELD * FIELD), depth = new Float32Array(FIELD * FIELD);
      for (var y = 0; y < FIELD; y++) {
        for (var x = 0; x < FIELD; x++) {
          var nx = (x + .5) / FIELD, ny = (y + .5) / FIELD, index = y * FIELD + x;
          var weight = 1, edgeDepth = Math.min(nx, ny, 1 - nx, 1 - ny) * 2;
          if (region === 'half') {
            weight = smooth((ny - .465) / .07);
            edgeDepth = clamp(Math.min(nx, 1 - nx, ny - .5, 1 - ny) * 4, 0, 1);
          } else if (region === 'local') {
            var distance = Math.hypot(nx - local.x, ny - local.y);
            weight = smooth((local.radius - distance) / .045);
            edgeDepth = clamp(1 - distance / local.radius, 0, 1);
          }
          weights[index] = weight; depth[index] = edgeDepth;
          dyeCounts[index] = Math.min(6, dyeCounts[index] + weight);
        }
      }
      dips++; busy = true; changed();
      hint('布料刚出缸呈黄绿色，正在接触空气、氧化成蓝。');
      var start = null, duration = reducedMotion ? 1600 : 2600;
      return new Promise(function (resolve) {
        animationResolve = resolve;
        function frame(time) {
          if (destroyed) return;
          if (start === null) start = time;
          var progress = clamp((time - start) / duration, 0, 1);
          updateInk({ weights: weights, depth: depth, progress: progress });
          render();
          if (progress < 1) animationFrame = requestAnimationFrame(frame);
          else {
            animationFrame = 0; busy = false; animationResolve = null;
            updateInk(); render(); changed();
            hint('第 ' + dips + ' 次浸染完成。可叠染加深，或进入清水漂洗。');
            resolve(getState());
          }
        }
        animationFrame = requestAnimationFrame(frame);
      });
    }

    function addMotif() {
      if (busy || mode !== 'draw') return;
      finishStroke();
      if (wax < 35) { hint('绘制这枚花纹需要较多蜂蜡，请先沾取蜂蜡。'); return; }
      var motif = [];
      function curve(points, width) { motif.push({ width: width, points: points, spent: 0 }); }
      function polar(cx, cy, radius, steps) {
        var points = [];
        for (var i = 0; i <= steps; i++) { var a = i / steps * Math.PI * 2; points.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius }); }
        return points;
      }
      var centerX = SIZE * .5, centerY = SIZE * .49;
      curve(polar(centerX, centerY, 37, 42), 10);
      curve(polar(centerX, centerY, 18, 32), 6);
      for (var petal = 0; petal < 8; petal++) {
        var angle = petal * Math.PI / 4, points = [];
        for (var t = 0; t <= 48; t++) {
          var phase = t / 48 * Math.PI * 2;
          var radial = 46 + Math.sin(phase / 2) * 124;
          var side = Math.sin(phase) * 38;
          points.push({ x: centerX + Math.cos(angle) * radial - Math.sin(angle) * side, y: centerY + Math.sin(angle) * radial + Math.cos(angle) * side });
        }
        curve(points, 9);
      }
      curve(polar(centerX, centerY, 207, 120), 5);
      for (var dot = 0; dot < 24; dot++) {
        var a = dot / 24 * Math.PI * 2;
        curve([{ x: centerX + Math.cos(a) * 231, y: centerY + Math.sin(a) * 231 }], dot % 3 ? 7 : 12);
      }
      // The optional seed motif spends wax too; it is a creative starting point.
      motif.forEach(function (stroke) { stroke.spent = 35 / motif.length; strokes.push(stroke); });
      wax -= 35;
      renderWax(); requestRender(); changed();
      hint('已落下一枚八瓣花纹，你可以继续自由添画。');
    }

    var api = {
      getState: getState,
      setCarrier: function (value) { if (carriers[value]) { carrier = value; requestRender(); } },
      setMode: function (value) { if (['draw', 'select', 'display'].indexOf(value) !== -1) { finishStroke(); mode = value; canvas.style.cursor = value === 'display' ? 'default' : 'crosshair'; requestRender(); } },
      setBrush: function (value) { brush = clamp(Number(value) || 10, 4, 22); requestRender(); },
      refillWax: function () { if (busy) return; wax = 100; changed(); hint('蜂蜡已沾满，继续把灵感留在布上。'); },
      undo: function () {
        if (busy || mode !== 'draw' || !strokes.length) return;
        finishStroke(); strokes.pop(); renderWax(); requestRender(); changed();
      },
      clearWax: function () {
        if (busy || mode !== 'draw') return;
        finishStroke(); strokes.length = 0; renderWax(); requestRender(); changed();
      },
      addMotif: addMotif,
      setDyeRegion: function (value) { if (['full', 'half', 'local'].indexOf(value) !== -1 && !busy) { region = value; requestRender(); changed(); } },
      dye: dye,
      rinse: function (progress) { rinseAmount = clamp(Number(progress) || 0, 0, 1); requestRender(); },
      dewax: function (progress, naturalBleed) { dewaxAmount = clamp(Number(progress) || 0, 0, 1); bleed = clamp(Number(naturalBleed) || 0, 0, 1); requestRender(); },
      setCut: function (value) { cut = Boolean(value); requestRender(); },
      texture: function () { var output = surface(SIZE); paintCloth(output.getContext('2d'), false); return output; },
      reset: function () {
        cancelAnimation(); finishStroke(); pointerId = null;
        strokes.length = 0; dyeCounts.fill(0); wax = 100; dips = 0; mode = 'draw'; region = 'full';
        rinseAmount = 0; dewaxAmount = 0; bleed = 0; cut = false;
        local.x = .5; local.y = .5; keyboardPen.x = .5; keyboardPen.y = .5;
        renderWax(); updateInk(); requestRender(); changed();
      },
      destroy: function () {
        cancelAnimation(); destroyed = true;
        if (drawFrame) cancelAnimationFrame(drawFrame);
        canvas.removeEventListener('pointerdown', pointerDown);
        canvas.removeEventListener('pointermove', pointerMove);
        canvas.removeEventListener('pointerup', pointerUp);
        canvas.removeEventListener('pointercancel', pointerUp);
        canvas.removeEventListener('lostpointercapture', pointerUp);
        canvas.removeEventListener('keydown', keyDown);
        canvas.removeEventListener('focus', focus);
        canvas.removeEventListener('blur', blur);
      }
    };
    updateInk(); render();
    return api;
  }

  window.ArtTapCloth = { create: create, carriers: carriers };
}());
