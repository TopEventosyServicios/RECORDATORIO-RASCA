(() => {
  "use strict";

  const ticket = document.getElementById("ticket");
  const scratch = document.getElementById("scratch");
  const canvas = document.getElementById("cover");
  const coin = document.getElementById("coin");
  const seal = document.getElementById("seal");
  const goldSeal = document.getElementById("gold-seal");
  const turner = document.getElementById("seal-turner");
  const or = document.getElementById("or");
  const result = document.getElementById("result");
  const response = document.getElementById("response");
  const copy = document.getElementById("result-copy");
  const finale = document.getElementById("finale");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let sequenceTimer = 0;
  let sequenceVersion = 0;
  let celebrated = false;
  const sealsReady = Promise.all([seal.decode(), goldSeal.decode()]).catch(() => {});
  let revealed = false;
  let pointer = null;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let lastCheck = 0;
  let strokes = [];
  let celebrationFrame = 0;
  const clamp = number => Math.min(1, Math.max(0, number));

  function erase(segment) {
    if (!context) return;
    const [ax, ay, bx, by] = segment;
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.lineWidth = width * .14;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(ax * width, ay * height);
    context.lineTo(bx * width, by * height);
    context.stroke();
    context.beginPath();
    context.arc(bx * width, by * height, width * .07, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function paintFoil() {
    if (!context || !width || !height) return;
    context.clearRect(0, 0, width, height);
    const foil = context.createLinearGradient(0, 0, width, height * .7);
    [[0, "#92703a"], [.17, "#ebce87"], [.35, "#b58c48"], [.52, "#ffe6ab"], [.73, "#bb904d"], [1, "#f3d899"]]
      .forEach(([offset, color]) => foil.addColorStop(offset, color));
    context.fillStyle = foil;
    context.fillRect(0, 0, width, height);
    let seed = 2027;
    for (let i = 0; i < 3400; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const x = seed / 4294967296 * width;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const y = seed / 4294967296 * height;
      context.fillStyle = i % 2 ? "#fff8dc50" : "#53331326";
      context.fillRect(x, y, 2.5, .55);
    }
    context.strokeStyle = "#fff1bfa0";
    context.lineWidth = 1;
    context.strokeRect(7, 7, width - 14, height - 14);
    context.strokeStyle = "#70511f";
    context.strokeRect(10, 10, width - 20, height - 20);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#5b3d17";
    context.font = "700 " + Math.round(width * .105) + "px Arial";
    context.fillText("RASCA AQUÍ", width / 2, height * .43);
    context.font = "14px Arial";
    context.fillText("con la moneda", width / 2, height * .57);
  }

  function resize() {
    const w = scratch.clientWidth;
    const h = scratch.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h || w === width && h === height && dpr === ratio) return;
    width = w;
    height = h;
    ratio = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFoil();
    strokes.forEach(erase);
  }

  function celebrate() {
    cancelAnimationFrame(celebrationFrame);
    const layer = document.getElementById("confetti");
    const ctx = layer.getContext("2d");
    if (!ctx || motion.matches) return;
    const w = innerWidth;
    const h = innerHeight;
    layer.width = w;
    layer.height = h;
    const particles = Array.from({ length: 52 }, (_, index) => ({
      x: w * .5, y: h * .35,
      vx: Math.cos(index * 2.4) * (85 + Math.random() * 170),
      vy: -80 - Math.random() * 220,
      size: 3 + Math.random() * 5,
      turn: Math.random() * 6
    }));
    const start = performance.now();
    function draw(now) {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      if (t > 3.4) return;
      ctx.globalAlpha = Math.min(1, (3.4 - t) * 1.7);
      particles.forEach((particle, index) => {
        ctx.save();
        ctx.translate(particle.x + particle.vx * t, particle.y + particle.vy * t + 150 * t * t);
        ctx.rotate(particle.turn + t * 3);
        ctx.fillStyle = index % 3 ? "#e9b84c" : "#fff0b3";
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 1.5);
        ctx.restore();
      });
      celebrationFrame = requestAnimationFrame(draw);
    }
    celebrationFrame = requestAnimationFrame(draw);
  }

  function releasePointer() {
    if (pointer && scratch.hasPointerCapture(pointer.id)) scratch.releasePointerCapture(pointer.id);
    pointer = null;
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    releasePointer();
    ticket.dataset.revealed = "true";
    scratch.setAttribute("aria-expanded", "true");
    seal.removeAttribute("aria-hidden");
    result.textContent = "NO PREMIADO";
    scratch.setAttribute("aria-label", "Sello descubierto. " + result.textContent);
    response.hidden = false;
    copy.textContent = "Sello plateado: NO PREMIADO.";
    document.getElementById("instruction").textContent = "Mira las dos posibilidades.";
    const bounds = scratch.getBoundingClientRect();
    const venueHeight = document.querySelector(".venue").offsetHeight;
    const top = Math.max(18, (innerHeight - venueHeight - bounds.height - 130) / 2);
    window.scrollTo({ top: Math.max(0, scrollY + bounds.top - top), behavior: motion.matches ? "auto" : "smooth" });
    const version = sequenceVersion;
    sealsReady.then(() => {
      if (revealed && sequenceVersion === version) scheduleTurn("gold", 5000);
    });
  }

  function scheduleTurn(target, delay) {
    clearTimeout(sequenceTimer);
    sequenceTimer = window.setTimeout(() => {
      turner.classList.add("turning");
      ticket.dataset.stage = "turning";
      result.textContent = "O…";
      copy.textContent = "";
      or.hidden = false;
      sequenceTimer = window.setTimeout(() => {
        const gold = target === "gold";
        seal.hidden = gold;
        goldSeal.hidden = !gold;
        seal.setAttribute("aria-hidden", String(gold));
        goldSeal.setAttribute("aria-hidden", String(!gold));
        or.hidden = true;
        ticket.dataset.stage = target;
        turner.classList.remove("turning");
        result.textContent = gold ? "¡PREMIADO!" : "NO PREMIADO";
        copy.textContent = gold ? "Sello dorado: PREMIADO." : "Sello plateado: NO PREMIADO.";
        scratch.setAttribute("aria-label", "Ejemplo de sello. " + result.textContent);
        if (gold && !celebrated) {
          celebrated = true;
          finale.hidden = false;
          celebrate();
        }
      }, motion.matches ? 850 : 1100);
    }, delay);
  }

  function checkProgress(force = false) {
    if (revealed || !context) return;
    const now = performance.now();
    if (!force && now - lastCheck < 160) return;
    lastCheck = now;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    let total = 0;
    for (let y = 0; y < canvas.height; y += 8) {
      for (let x = 0; x < canvas.width; x += 8) {
        total++;
        if (pixels[(y * canvas.width + x) * 4 + 3] < 96) cleared++;
      }
    }
    ticket.dataset.progress = (cleared / total).toFixed(3);
    if (cleared / total >= .48) reveal();
  }

  function point(event) {
    const bounds = scratch.getBoundingClientRect();
    return [clamp((event.clientX - bounds.left) / bounds.width), clamp((event.clientY - bounds.top) / bounds.height)];
  }

  function moveCoin(position) {
    coin.style.left = position[0] * 100 + "%";
    coin.style.top = position[1] * 100 + "%";
  }

  function reset() {
    clearTimeout(sequenceTimer);
    sequenceVersion++;
    celebrated = false;
    releasePointer();
    cancelAnimationFrame(celebrationFrame);
    const confetti = document.getElementById("confetti");
    confetti.width = confetti.width;
    revealed = false;
    strokes = [];
    lastCheck = 0;
    ticket.dataset.stage = "silver";
    ticket.dataset.revealed = "false";
    ticket.dataset.progress = "0";
    seal.hidden = false;
    goldSeal.hidden = true;
    goldSeal.setAttribute("aria-hidden", "true");
    or.hidden = true;
    turner.classList.remove("turning");
    seal.setAttribute("aria-hidden", "true");
    scratch.setAttribute("aria-expanded", "false");
    scratch.setAttribute("aria-label", "Rasca con la moneda. Con teclado, pulsa Enter para descubrir el sello.");
    result.textContent = "Rasca aquí";
    response.hidden = true;
    finale.hidden = true;
    document.getElementById("instruction").textContent = "Desliza la moneda sobre el rasca.";
    moveCoin([.82, .77]);
    resize();
    paintFoil();
    if (!context) reveal();
  }

  scratch.addEventListener("pointerdown", event => {
    if (revealed || pointer || event.button !== 0) return;
    event.preventDefault();
    resize();
    const position = point(event);
    pointer = { id: event.pointerId, position };
    scratch.setPointerCapture(event.pointerId);
    moveCoin(position);
    const segment = [...position, ...position];
    strokes.push(segment);
    erase(segment);
  });
  scratch.addEventListener("pointermove", event => {
    if (!pointer || pointer.id !== event.pointerId || revealed) return;
    event.preventDefault();
    const position = point(event);
    const segment = [...pointer.position, ...position];
    strokes.push(segment);
    erase(segment);
    pointer.position = position;
    moveCoin(position);
    checkProgress();
  });
  function finishStroke(event) {
    if (pointer?.id !== event.pointerId) return;
    releasePointer();
    checkProgress(true);
  }
  scratch.addEventListener("pointerup", finishStroke);
  scratch.addEventListener("pointercancel", finishStroke);
  scratch.addEventListener("lostpointercapture", () => { pointer = null; });
  scratch.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    reveal();
  });
  document.getElementById("again").addEventListener("click", () => {
    reset();
    document.getElementById("title").scrollIntoView({ block: "start", behavior: motion.matches ? "auto" : "smooth" });
    scratch.focus({ preventScroll: true });
  });
  window.addEventListener("resize", resize, { passive: true });
  new ResizeObserver(resize).observe(scratch);
  reset();
})();
