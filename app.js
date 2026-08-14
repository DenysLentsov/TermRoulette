(function () {
  "use strict";

  const strip = document.getElementById("roulette-strip");
  const viewport = document.querySelector(".roulette-viewport");
  const hint = document.getElementById("hint");
  const stage = document.querySelector(".stage");
  const termInfo = document.getElementById("term-info");
  const termInfoText = document.getElementById("term-info-text");

  let isSpinning = false;
  let lastTerm = null;
  let hasSpun = false;
  let currentTargetIndex = -1;
  let animationId = null;
  let infoRequestId = 0;
  let rowHeight = 88;
  let contentWidth = 0;

  function getBaseFontSize() {
    const vw = window.innerWidth;
    return Math.round(Math.min(Math.max(vw * 0.028, 24), 44));
  }

  function getRowHeight() {
    const vh = window.innerHeight;
    return Math.round(Math.min(Math.max(vh * 0.082, 72), 96));
  }

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickRandomTerm() {
    const pool =
      lastTerm === null
        ? TERMS
        : TERMS.filter((term) => term !== lastTerm);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function easeOutCinematic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function centerOffsetForIndex(index) {
    const viewportHeight = viewport.clientHeight;
    return viewportHeight / 2 - (index * rowHeight + rowHeight / 2);
  }

  function measureContentWidth() {
    const frame = document.querySelector(".glass-frame");
    const styles = getComputedStyle(frame);
    const paddingLeft = parseFloat(styles.paddingLeft);
    const paddingRight = parseFloat(styles.paddingRight);
    contentWidth = frame.clientWidth - paddingLeft - paddingRight - 8;
  }

  function fitTermText(textEl, text) {
    const container = textEl.closest(".term-item");
    const minSize = 15;
    let fontSize = getBaseFontSize();

    container.classList.remove("multi-line");
    container.classList.add("single-line");
    textEl.textContent = text;
    textEl.style.fontSize = fontSize + "px";
    textEl.style.transform = "";

    while (fontSize > minSize && textEl.scrollWidth > contentWidth) {
      fontSize -= 1;
      textEl.style.fontSize = fontSize + "px";
    }

    if (textEl.scrollWidth > contentWidth) {
      container.classList.remove("single-line");
      container.classList.add("multi-line");
      fontSize = Math.min(fontSize, 26);
      textEl.style.fontSize = fontSize + "px";

      while (fontSize > minSize) {
        const lineHeight = fontSize * 1.15;
        const lines = Math.ceil(textEl.scrollHeight / lineHeight);
        const tooWide = textEl.scrollWidth > contentWidth;
        const tooTall = lines > 2 || textEl.scrollHeight > rowHeight * 0.92;

        if (!tooWide && !tooTall) break;

        fontSize -= 1;
        textEl.style.fontSize = fontSize + "px";
      }
    }
  }

  function createTermItem(text, shouldFit) {
    const item = document.createElement("div");
    item.className = "term-item";
    item.style.height = rowHeight + "px";

    const textEl = document.createElement("span");
    textEl.className = "term-text";
    item.appendChild(textEl);

    if (shouldFit) {
      fitTermText(textEl, text);
    } else {
      textEl.textContent = text;
      let fontSize = Math.min(getBaseFontSize(), 30);
      textEl.style.fontSize = fontSize + "px";
      item.classList.add("single-line");

      if (textEl.scrollWidth > contentWidth) {
        fontSize = 18;
        textEl.style.fontSize = fontSize + "px";
      }

      if (textEl.scrollWidth > contentWidth) {
        item.classList.remove("single-line");
        item.classList.add("multi-line");
        textEl.style.fontSize = "16px";
      }
    }

    return item;
  }

  function buildReel(targetTerm) {
    const pool = TERMS.filter((term) => term !== targetTerm);
    const laps = 1 + Math.floor(Math.random() * 2);
    const reel = [];

    for (let i = 0; i < laps; i++) {
      reel.push(...shuffle(pool));
    }

    const leadIn = shuffle(pool).slice(0, Math.floor(pool.length * 0.15));
    reel.push(...leadIn, targetTerm, ...shuffle(pool).slice(0, 2));

    const targetIndex = reel.lastIndexOf(targetTerm);
    return { reel, targetIndex };
  }

  function updateDepthEffects(resting) {
    const viewportRect = viewport.getBoundingClientRect();
    const centerY = viewportRect.top + viewportRect.height / 2;
    const halfHeight = viewportRect.height / 2;
    const items = strip.querySelectorAll(".term-item");

    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(itemCenterY - centerY);
      const norm = Math.min(distance / halfHeight, 1);

      item.classList.remove("winner");

      if (resting) {
        if (norm < 0.2) {
          item.style.opacity = "1";
          item.style.filter = "none";
          item.style.transform = "scale(1)";
        } else {
          item.style.opacity = "0.04";
          item.style.filter = "blur(5px)";
          item.style.transform = "scale(0.95)";
        }
        return;
      }

      const opacity = Math.max(0.1, 1 - norm * 0.88);
      const blur = norm * 5.5;
      const scale = 1 - norm * 0.05;

      item.style.opacity = String(opacity);
      item.style.filter = blur > 0.1 ? "blur(" + blur + "px)" : "none";
      item.style.transform = "scale(" + scale + ")";
    });
  }

  function pulseWinner() {
    const viewportRect = viewport.getBoundingClientRect();
    const centerY = viewportRect.top + viewportRect.height / 2;
    const items = strip.querySelectorAll(".term-item");
    let winner = null;
    let minDist = Infinity;

    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - centerY);
      if (dist < minDist) {
        minDist = dist;
        winner = item;
      }
    });

    if (!winner) return;

    winner.classList.add("winner");
    const text = winner.querySelector(".term-text");
    text.style.transform = "scale(1.02)";

    window.setTimeout(function () {
      text.style.transform = "scale(1)";
    }, 420);
  }

  function renderReel(reel, targetIndex) {
    strip.innerHTML = "";
    strip.style.transform = "translateY(0px)";

    const fragment = document.createDocumentFragment();
    reel.forEach(function (term, index) {
      fragment.appendChild(createTermItem(term, index === targetIndex));
    });
    strip.appendChild(fragment);
  }

  function cancelAnimation() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function clearTermInfo() {
    infoRequestId += 1;
    termInfo.hidden = true;
    termInfo.classList.remove("visible", "loading", "error");
    termInfoText.textContent = "";
  }

  function showTermInfoLoading() {
    termInfo.hidden = false;
    termInfo.classList.add("loading");
    termInfo.classList.remove("error", "visible");
    termInfoText.textContent = "Loading…";
    requestAnimationFrame(function () {
      termInfo.classList.add("visible");
    });
  }

  function showTermInfoResult(text) {
    termInfo.hidden = false;
    termInfo.classList.remove("loading", "error");
    termInfoText.textContent = text;
    requestAnimationFrame(function () {
      termInfo.classList.add("visible");
    });
  }

  function showTermInfoError(message) {
    termInfo.hidden = false;
    termInfo.classList.remove("loading");
    termInfo.classList.add("error", "visible");
    termInfoText.textContent = message;
  }

  function getProxyUrl() {
    if (typeof SITE_CONFIG === "undefined") {
      return null;
    }

    const url = SITE_CONFIG.apiProxyUrl;
    if (!url || url.includes("YOUR_SUBDOMAIN")) {
      return null;
    }

    return url.replace(/\/$/, "");
  }

  async function fetchTermInfo(term) {
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
      showTermInfoError("Set apiProxyUrl in site-config.js");
      return;
    }

    const requestId = ++infoRequestId;
    showTermInfoLoading();

    try {
      const response = await fetch(proxyUrl + "/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: term }),
      });

      if (requestId !== infoRequestId) return;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error("Proxy error " + response.status + ": " + errorBody);
      }

      const data = await response.json();
      const text = data.text?.trim();

      if (!text) {
        throw new Error("Empty response from proxy");
      }

      showTermInfoResult(text);
    } catch (error) {
      if (requestId !== infoRequestId) return;
      showTermInfoError("Could not load explanation. Try again in a moment.");
      console.error(error);
    }
  }

  function spin() {
    if (isSpinning) return;

    cancelAnimation();
    clearTermInfo();
    isSpinning = true;
    stage.classList.add("spinning");
    hint.classList.add("hidden");

    rowHeight = getRowHeight();
    measureContentWidth();

    const targetTerm = pickRandomTerm();
    const built = buildReel(targetTerm);
    renderReel(built.reel, built.targetIndex);

    const endY = centerOffsetForIndex(built.targetIndex);
    const startY = centerOffsetForIndex(0);
    const duration = 2200 + Math.random() * 600;
    const startTime = performance.now();

    strip.style.transform = "translateY(" + startY + "px)";
    updateDepthEffects(false);

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOutCinematic(t);
      const currentY = startY + (endY - startY) * eased;

      strip.style.transform = "translateY(" + currentY + "px)";
      updateDepthEffects(false);

      if (t < 1) {
        animationId = requestAnimationFrame(frame);
        return;
      }

      strip.style.transform = "translateY(" + endY + "px)";
      updateDepthEffects(true);
      pulseWinner();

      lastTerm = targetTerm;
      currentTargetIndex = built.targetIndex;
      hasSpun = true;
      isSpinning = false;
      stage.classList.remove("spinning");
      animationId = null;

      fetchTermInfo(targetTerm);
    }

    frame(startTime);
  }

  function refitAllTerms() {
    rowHeight = getRowHeight();
    measureContentWidth();

    strip.querySelectorAll(".term-item").forEach(function (item) {
      item.style.height = rowHeight + "px";
      const textEl = item.querySelector(".term-text");
      fitTermText(textEl, textEl.textContent);
    });

    if (!isSpinning && hasSpun && currentTargetIndex >= 0) {
      strip.style.transform =
        "translateY(" + centerOffsetForIndex(currentTargetIndex) + "px)";
      updateDepthEffects(true);
    }
  }

  function triggerSpin() {
    if (isSpinning) return;
    spin();
  }

  window.addEventListener("keydown", function (event) {
    if (event.code !== "Space") return;
    event.preventDefault();
    triggerSpin();
  });

  document.getElementById("glass-frame").addEventListener("click", triggerSpin);

  window.addEventListener("resize", function () {
    if (isSpinning) return;
    refitAllTerms();
  });

  rowHeight = getRowHeight();
  measureContentWidth();
})();
