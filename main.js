/* ============================================
   CORE ANIMATION MODULE — GSAP + ScrollTrigger + Lenis
   ============================================ */

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Wait for DOM to be painted and fonts to load
 * @param {Element} scope - DOM scope to wait for
 * @returns {Promise} - Resolves when ready
 */
function afterSwapReady(scope = document) {
  return new Promise(async (resolve) => {
    await new Promise(r => requestAnimationFrame(r));
    try { await document.fonts?.ready; } catch (e) {}
    resolve();
  });
}
window.afterSwapReady = afterSwapReady;

// ============================================
// LENIS SCROLL BRIDGE
// ============================================

/**
 * Bridge Lenis smooth scroll with ScrollTrigger
 * Call once to sync smooth scrolling with GSAP animations
 */
function installLenisScrollTriggerBridge() {
  if (!window.gsap || !window.ScrollTrigger) return;
  if (installLenisScrollTriggerBridge._done) return;
  installLenisScrollTriggerBridge._done = true;

  let connectRetries = 0;
  const MAX_CONNECT_RETRIES = 100; // 5 seconds at 50ms intervals

  const connect = () => {
    if (!window.lenis) {
      if (++connectRetries > MAX_CONNECT_RETRIES) {
        console.error('❌ Lenis failed to load after 5 seconds. Scroll bridge disabled.');
        return;
      }
      setTimeout(connect, 50);
      return;
    }

    window.gsap.registerPlugin(window.ScrollTrigger);

    // Tell ST to use the page as scroller; delegate to Lenis
    window.ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value) {
        return arguments.length
          ? window.lenis.scrollTo(value, { immediate: true })
          : window.pageYOffset;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      }
    });

    // Keep them in sync
    window.lenis.on?.('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add(() => window.lenis?.raf?.(performance.now()));
    window.ScrollTrigger.addEventListener('refresh', () => window.lenis?.update?.());
    window.ScrollTrigger.refresh();
  };
  connect();
}
window.installLenisScrollTriggerBridge = installLenisScrollTriggerBridge;

// ============================================
// LENIS INITIALIZATION
// ============================================

/**
 * Initialize Lenis smooth scrolling
 * autoRaf: false because we use GSAP's ticker (via installLenisScrollTriggerBridge)
 * This prevents double RAF loops and reduces CPU usage
 */
window.lenis = new window.Lenis({
  autoRaf: false,
  lerp: 0.2,
  smoothWheel: true,
  smoothTouch: true
})

// If stop-scroll is active (from loader in head), keep Lenis stopped
if (document.documentElement.classList.contains('stop-scroll')) {
  window.lenis.stop()
}

// Always start at the top on load/refresh, even if the browser tried
// to restore a previous scroll position
window.lenis.scrollTo(0, { immediate: true })

// Wire Lenis into GSAP's ticker + ScrollTrigger (defined above)
installLenisScrollTriggerBridge()

// Configure ScrollTrigger default configuration for Webflow interactions
if (window.ScrollTrigger) {
  ScrollTrigger.defaults({
    scroller: document.body,
    preventOverlaps: true
  })
}

// Helper function to refresh ScrollTrigger when needed
function refreshScrollTrigger() {
  if (window.ScrollTrigger) {
    ScrollTrigger.refresh()
  }
}
window.refreshScrollTrigger = refreshScrollTrigger

// ============================================
// CASES GALLERY SWIPER
// ============================================

function initCasesGallerySwiper() {
  const components = document.querySelectorAll('.swiper.is-gallery')

  components.forEach((component) => {
    const wrapper = component.querySelector('.swiper-wrapper')
    const originalSlides = Array.from(wrapper.querySelectorAll('.swiper-slide'))
    const minSlidesForSeamlessLoop = 8

    if (originalSlides.length) {
      let i = 0
      while (wrapper.querySelectorAll('.swiper-slide').length < minSlidesForSeamlessLoop) {
        wrapper.appendChild(originalSlides[i % originalSlides.length].cloneNode(true))
        i++
      }
    }

    new Swiper(component, {
      loop: true,
      centeredSlides: true,
      slidesPerView: 2,
      speed: 800,
      grabCursor: true,

      navigation: {
        nextEl: document.querySelector('.swiper-next'),
        prevEl: document.querySelector('.swiper-prev'),
      },

      breakpoints: {
        320: { slidesPerView: 1.15 },
        768: { slidesPerView: 1.5 },
        992: { slidesPerView: 2 },
        1440: { slidesPerView: 2 },
      },
    })
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCasesGallerySwiper)
} else {
  initCasesGallerySwiper()
}

// ============================================
// BUNNY HLS LIGHTBOX PLAYER
// (requires hls.js, loaded separately in Webflow's before-body tag)
// ============================================

function initBunnyLightboxPlayer() {
  let player = document.querySelector('[data-bunny-lightbox-init]');
  if (!player) return;

  let wrapper = player.closest('[data-bunny-lightbox-status]');
  if (!wrapper) return;

  let video = player.querySelector('video');
  if (!video) return;

  try {
    video.pause();
  } catch (_) {}
  try {
    video.removeAttribute('src');
    video.load();
  } catch (_) {}

  // Attribute helpers (collapsed)
  function setAttr(el, name, val) {
    let str = typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val);
    if (el.getAttribute(name) !== str) el.setAttribute(name, str);
  }
  function setStatus(s) {
    setAttr(player, 'data-player-status', s);
  }
  function setMutedState(v) {
    video.muted = !!v;
    setAttr(player, 'data-player-muted', video.muted);
  }
  function setFsAttr(v) {
    setAttr(player, 'data-player-fullscreen', !!v);
  }
  function setActivated(v) {
    setAttr(player, 'data-player-activated', !!v);
  }
  if (!player.hasAttribute('data-player-activated')) setActivated(false);

  // Elements
  let timeline = player.querySelector('[data-player-timeline]');
  let progressBar = player.querySelector('[data-player-progress]');
  let bufferedBar = player.querySelector('[data-player-buffered]');
  let handle = player.querySelector('[data-player-timeline-handle]');
  let timeDurationEls = player.querySelectorAll('[data-player-time-duration]');
  let timeProgressEls = player.querySelectorAll('[data-player-time-progress]');
  let playerPlaceholderImg = player.querySelector('[data-bunny-lightbox-placeholder]');

  // Flags
  let updateSize = player.getAttribute('data-player-update-size'); // "true" | "cover" | "false" | null
  let autoplay = player.getAttribute('data-player-autoplay') === 'true';
  let initialMuted = player.getAttribute('data-player-muted') === 'true';

  let pendingPlay = false;

  video.loop = false;
  setMutedState(initialMuted);

  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.playsInline = true;
  if (typeof video.disableRemotePlayback !== 'undefined') video.disableRemotePlayback = true;
  if (autoplay) video.autoplay = false;

  let canPlayNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl');
  let preferNativeHls = canPlayNativeHls && 'ManagedMediaSource' in window;
  let canUseHlsJs = !!(window.Hls && Hls.isSupported()) && !preferNativeHls;

  // Load/attach only when opened
  let isAttached = false;
  let currentSrc = '';
  let lastPauseBy = '';
  let rafId;
  let autoStartOnReady = false;

  // Clamp setup for [data-bunny-lightbox-calc-height]
  function setupLightboxClamp(player, wrapper, video, updateSize) {
    let calcBox = wrapper.querySelector('[data-bunny-lightbox-calc-height]');
    if (!calcBox) return;

    let maxWidthPx = parseFloat(player.getAttribute('data-player-max-width')) || 0;

    function getRatio() {
      if (updateSize === 'cover') return null;

      if (updateSize === 'true') {
        if (video.videoWidth && video.videoHeight) return video.videoWidth / video.videoHeight;
        let before = player.querySelector('[data-player-before]');
        if (before && before.style && before.style.paddingTop) {
          let pct = parseFloat(before.style.paddingTop);
          if (pct > 0) return 100 / pct;
        }
        let r = player.getBoundingClientRect();
        if (r.height > 0) return r.width / r.height;
        return 16 / 9;
      }

      let beforeFalse = player.querySelector('[data-player-before]');
      if (beforeFalse && beforeFalse.style && beforeFalse.style.paddingTop) {
        let pad = parseFloat(beforeFalse.style.paddingTop);
        if (pad > 0) return 100 / pad;
      }
      let rb = player.getBoundingClientRect();
      if (rb.height > 0) return rb.width / rb.height;
      return 16 / 9;
    }

    function applyClamp() {
      if (updateSize === 'cover') {
        calcBox.style.maxWidth = '';
        calcBox.style.maxHeight = '';
        return;
      }

      let parent = wrapper;
      let cs = getComputedStyle(parent);
      let pt = parseFloat(cs.paddingTop) || 0;
      let pb = parseFloat(cs.paddingBottom) || 0;
      let pl = parseFloat(cs.paddingLeft) || 0;
      let pr = parseFloat(cs.paddingRight) || 0;

      let cw = parent.clientWidth - pl - pr;
      let ch = parent.clientHeight - pt - pb;
      if (cw <= 0 || ch <= 0) return;

      let availableWidth = maxWidthPx && cw > maxWidthPx ? maxWidthPx : cw;

      let ratio = getRatio();
      if (!ratio) {
        calcBox.style.maxWidth = '';
        calcBox.style.maxHeight = '';
        return;
      }

      let hIfFullWidth = availableWidth / ratio;

      if (hIfFullWidth <= ch) {
        calcBox.style.maxWidth = (availableWidth / cw) * 100 + '%';
        calcBox.style.maxHeight = (hIfFullWidth / ch) * 100 + '%';
      } else {
        calcBox.style.maxHeight = '100%';
        calcBox.style.maxWidth = ((ch * ratio) / cw) * 100 + '%';
      }
    }

    let rafPending = false;
    function debouncedApply() {
      if (rafPending) return;
      if (wrapper.getAttribute('data-bunny-lightbox-status') !== 'active') return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        applyClamp();
      });
    }

    let ro = new ResizeObserver(debouncedApply);
    ro.observe(wrapper);

    window.addEventListener('resize', debouncedApply);
    window.addEventListener('orientationchange', debouncedApply);

    if (updateSize === 'true') {
      video.addEventListener('loadedmetadata', debouncedApply);
      video.addEventListener('loadeddata', debouncedApply);
      video.addEventListener('playing', debouncedApply);
    }

    player._applyClamp = debouncedApply;
    debouncedApply();
  }

  setupLightboxClamp(player, wrapper, video, updateSize);

  // Unified attach pipeline
  function withAttach(src, onReady) {
    if (preferNativeHls) {
      video.preload = 'auto';
      video.src = src;
      video.addEventListener('loadedmetadata', onReady, { once: true });
      return;
    }
    if (canUseHlsJs) {
      let hls = new Hls({ maxBufferLength: 10 });
      player._hls = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        hls.loadSource(src);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        onReady();
      });
      hls.on(Hls.Events.LEVEL_LOADED, function (e, data) {
        if (data && data.details && isFinite(data.details.totalduration) && timeDurationEls.length) {
          setText(timeDurationEls, formatTime(data.details.totalduration));
        }
      });
      return;
    }
    video.preload = 'auto';
    video.src = src;
    video.addEventListener('loadedmetadata', onReady, { once: true });
  }

  function attachMediaFor(src) {
    if (currentSrc === src && isAttached) return;
    if (player._hls) {
      try {
        player._hls.destroy();
      } catch (_) {}
      player._hls = null;
    }
    if (timeDurationEls.length) setText(timeDurationEls, '00:00');

    currentSrc = src;
    isAttached = true;

    withAttach(src, function onReady() {
      readyIfIdle(player, pendingPlay);
      updateBeforeRatioIOSSafe();
      if (typeof player._applyClamp === 'function') player._applyClamp();
      if (timeDurationEls.length && video.duration) setText(timeDurationEls, formatTime(video.duration));

      if (autoStartOnReady && wrapper.getAttribute('data-bunny-lightbox-status') === 'active') {
        setStatus('loading');
        safePlay(video);
        autoStartOnReady = false;
      }
    });
  }

  function ensureOpenUI(isActive) {
    let state = isActive ? 'active' : 'not-active';
    if (wrapper.getAttribute('data-bunny-lightbox-status') !== state) {
      wrapper.setAttribute('data-bunny-lightbox-status', state);
    }
    if (isActive && typeof player._applyClamp === 'function') player._applyClamp();
  }

  // Centralized open policy
  function isSameSrc(next) {
    return currentSrc && currentSrc === next;
  }
  function planOnOpen(next) {
    let same = isSameSrc(next);
    if (!same) {
      try {
        if (!video.paused && !video.ended) video.pause();
      } catch (_) {}
      if (player._hls) {
        try {
          player._hls.destroy();
        } catch (_) {}
        player._hls = null;
      }
      isAttached = false;
      currentSrc = '';
      if (timeDurationEls.length) setText(timeDurationEls, '00:00');
      setActivated(false);
      setStatus('idle');

      attachMediaFor(next);
      autoStartOnReady = !!autoplay;
      pendingPlay = !!autoplay;
      return;
    }
    autoStartOnReady = !!autoplay;
    if (autoplay) {
      setStatus('loading');
      safePlay(video);
    } else {
      try {
        if (!video.paused && !video.ended) video.pause();
      } catch (_) {}
      setActivated(false);
      setStatus('paused');
    }
  }

  // Open/Close API
  function openLightbox(src, placeholderUrl) {
    if (!src) return;

    function activate() {
      ensureOpenUI(true);
      planOnOpen(src);
    }

    if (playerPlaceholderImg && placeholderUrl) {
      let needsSwap = playerPlaceholderImg.getAttribute('src') !== placeholderUrl;
      if (needsSwap || !playerPlaceholderImg.complete || !playerPlaceholderImg.naturalWidth) {
        playerPlaceholderImg.onload = function () {
          playerPlaceholderImg.onload = null;
          activate();
        };
        playerPlaceholderImg.onerror = function () {
          playerPlaceholderImg.onerror = null;
          activate();
        };
        if (needsSwap) playerPlaceholderImg.setAttribute('src', placeholderUrl);
        else playerPlaceholderImg.dispatchEvent(new Event('load'));
      } else {
        activate();
      }
    } else {
      activate();
    }
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      pendingPlay = true;
      lastPauseBy = '';
      setStatus('loading');
      safePlay(video);
    } else {
      lastPauseBy = 'manual';
      video.pause();
    }
  }
  function toggleMute() {
    setMutedState(!video.muted);
  }

  player.addEventListener('click', function (e) {
    let btn = e.target.closest('[data-player-control]');
    if (!btn || !player.contains(btn)) return;
    let type = btn.getAttribute('data-player-control');
    if (type === 'play' || type === 'pause' || type === 'playpause') togglePlay();
    else if (type === 'mute') toggleMute();
    else if (type === 'fullscreen') toggleFullscreen();
  });

  // Fullscreen helpers
  function isFsActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function enterFullscreen() {
    if (player.requestFullscreen) return player.requestFullscreen();
    if (video.requestFullscreen) return video.requestFullscreen();
    if (video.webkitSupportsFullscreen && typeof video.webkitEnterFullscreen === 'function') return video.webkitEnterFullscreen();
  }
  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (video.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === 'function') return video.webkitExitFullscreen();
  }
  function toggleFullscreen() {
    if (isFsActive() || video.webkitDisplayingFullscreen) exitFullscreen();
    else enterFullscreen();
  }
  document.addEventListener('fullscreenchange', function () {
    setFsAttr(isFsActive());
  });
  document.addEventListener('webkitfullscreenchange', function () {
    setFsAttr(isFsActive());
  });
  video.addEventListener('webkitbeginfullscreen', function () {
    setFsAttr(true);
  });
  video.addEventListener('webkitendfullscreen', function () {
    setFsAttr(false);
  });

  // Time text (not in rAF)
  function updateTimeTexts() {
    if (timeDurationEls.length) setText(timeDurationEls, formatTime(video.duration));
    if (timeProgressEls.length) setText(timeProgressEls, formatTime(video.currentTime));
  }
  video.addEventListener('timeupdate', updateTimeTexts);
  video.addEventListener('loadedmetadata', function () {
    updateTimeTexts();
    updateBeforeRatioIOSSafe();
  });
  video.addEventListener('loadeddata', function () {
    updateBeforeRatioIOSSafe();
  });
  video.addEventListener('playing', function () {
    updateBeforeRatioIOSSafe();
  });
  video.addEventListener('durationchange', updateTimeTexts);

  // rAF visuals (progress + handle only)
  function updateProgressVisuals() {
    if (!video.duration) return;
    let playedPct = (video.currentTime / video.duration) * 100;
    if (progressBar) progressBar.style.transform = 'translateX(' + (-100 + playedPct) + '%)';
    if (handle) handle.style.left = pctClamp(playedPct) + '%';
  }
  function pctClamp(p) {
    return p < 0 ? 0 : p > 100 ? 100 : p;
  }
  function loop() {
    updateProgressVisuals();
    if (!video.paused && !video.ended) rafId = requestAnimationFrame(loop);
  }

  // Buffered bar (not in rAF)
  function updateBufferedBar() {
    if (!bufferedBar || !video.duration || !video.buffered.length) return;
    let end = video.buffered.end(video.buffered.length - 1);
    let buffPct = (end / video.duration) * 100;
    bufferedBar.style.transform = 'translateX(' + (-100 + buffPct) + '%)';
  }
  video.addEventListener('progress', updateBufferedBar);
  video.addEventListener('loadedmetadata', updateBufferedBar);
  video.addEventListener('durationchange', updateBufferedBar);

  // Media event wiring
  video.addEventListener('play', function () {
    setActivated(true);
    cancelAnimationFrame(rafId);
    loop();
    setStatus('playing');
  });
  video.addEventListener('playing', function () {
    pendingPlay = false;
    setStatus('playing');
  });
  video.addEventListener('pause', function () {
    pendingPlay = false;
    cancelAnimationFrame(rafId);
    updateProgressVisuals();
    setStatus('paused');
  });
  video.addEventListener('waiting', function () {
    setStatus('loading');
  });
  video.addEventListener('canplay', function () {
    readyIfIdle(player, pendingPlay);
  });

  // Video ended
  video.addEventListener('ended', function () {
    pendingPlay = false;
    cancelAnimationFrame(rafId);
    updateProgressVisuals();
    setActivated(false);
    video.currentTime = 0;

    // Exit fullscreen if active
    if (document.fullscreenElement || document.webkitFullscreenElement || video.webkitDisplayingFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (video.webkitExitFullscreen) video.webkitExitFullscreen();
    }

    closeLightbox();
  });

  // Scrubbing (pointer events)
  if (timeline) {
    let dragging = false,
      wasPlaying = false,
      targetTime = 0,
      lastSeekTs = 0,
      seekThrottle = 180,
      rect = null;
    window.addEventListener('resize', function () {
      if (!dragging) rect = null;
    });
    function getFractionFromX(x) {
      if (!rect) rect = timeline.getBoundingClientRect();
      let f = (x - rect.left) / rect.width;
      if (f < 0) f = 0;
      if (f > 1) f = 1;
      return f;
    }
    function previewAtFraction(f) {
      if (!video.duration) return;
      let pct = f * 100;
      if (progressBar) progressBar.style.transform = 'translateX(' + (-100 + pct) + '%)';
      if (handle) handle.style.left = pct + '%';
      if (timeProgressEls.length) setText(timeProgressEls, formatTime(f * video.duration));
    }
    function maybeSeek(now) {
      if (!video.duration) return;
      if (now - lastSeekTs < seekThrottle) return;
      lastSeekTs = now;
      video.currentTime = targetTime;
    }
    function onPointerDown(e) {
      if (!video.duration) return;
      dragging = true;
      wasPlaying = !video.paused && !video.ended;
      if (wasPlaying) video.pause();
      player.setAttribute('data-timeline-drag', 'true');
      rect = timeline.getBoundingClientRect();
      let f = getFractionFromX(e.clientX);
      targetTime = f * video.duration;
      previewAtFraction(f);
      maybeSeek(performance.now());
      timeline.setPointerCapture && timeline.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      let f = getFractionFromX(e.clientX);
      targetTime = f * video.duration;
      previewAtFraction(f);
      maybeSeek(performance.now());
      e.preventDefault();
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      player.setAttribute('data-timeline-drag', 'false');
      rect = null;
      video.currentTime = targetTime;
      if (wasPlaying) safePlay(video);
      else {
        updateProgressVisuals();
        updateTimeTexts();
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
    timeline.addEventListener('pointerdown', onPointerDown, { passive: false });
    if (handle) handle.addEventListener('pointerdown', onPointerDown, { passive: false });
  }

  // Hover/idle detection (pointer-based)
  let hoverTimer;
  let hoverHideDelay = 3000;
  function setHover(state) {
    if (player.getAttribute('data-player-hover') !== state) {
      player.setAttribute('data-player-hover', state);
    }
  }
  function scheduleHide() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      setHover('idle');
    }, hoverHideDelay);
  }
  function wakeControls() {
    setHover('active');
    scheduleHide();
  }
  player.addEventListener('pointerdown', wakeControls);
  document.addEventListener('fullscreenchange', wakeControls);
  document.addEventListener('webkitfullscreenchange', wakeControls);
  let trackingMove = false;
  function onPointerMoveGlobal(e) {
    let r = player.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) wakeControls();
  }
  player.addEventListener('pointerenter', function () {
    wakeControls();
    if (!trackingMove) {
      trackingMove = true;
      window.addEventListener('pointermove', onPointerMoveGlobal, { passive: true });
    }
  });
  player.addEventListener('pointerleave', function () {
    setHover('idle');
    clearTimeout(hoverTimer);
    if (trackingMove) {
      trackingMove = false;
      window.removeEventListener('pointermove', onPointerMoveGlobal);
    }
  });

  // Close Function
  function closeLightbox() {
    ensureOpenUI(false);

    let hasPlayed = false;
    try {
      if (video.played && video.played.length) {
        for (let i = 0; i < video.played.length; i++) {
          if (video.played.end(i) > 0) {
            hasPlayed = true;
            break;
          }
        }
      } else {
        hasPlayed = video.currentTime > 0;
      }
    } catch (_) {}

    try {
      if (!video.paused && !video.ended) video.pause();
    } catch (_) {}

    setActivated(false);
    setStatus(hasPlayed ? 'paused' : 'idle');
  }

  // Global open/close controls + ESC
  document.addEventListener('click', function (e) {
    let openBtn = e.target.closest('[data-bunny-lightbox-control="open"]');
    if (openBtn) {
      let src = openBtn.getAttribute('data-bunny-lightbox-src') || '';
      if (!src) return;
      let imgEl = openBtn.querySelector('[data-bunny-lightbox-placeholder]');
      let placeholderUrl = imgEl ? imgEl.getAttribute('src') : '';
      openLightbox(src, placeholderUrl);
      return;
    }
    let closeBtn = e.target.closest('[data-bunny-lightbox-control="close"]');
    if (closeBtn) {
      let closeInWrapper = closeBtn.closest('[data-bunny-lightbox-status]');
      if (closeInWrapper === wrapper) closeLightbox();
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  // Helper: time/text/meta/ratio utilities
  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '00:00';
    let s = Math.floor(sec),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      r = s % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(r) : pad2(m) + ':' + pad2(r);
  }
  function setText(nodes, text) {
    nodes.forEach(function (n) {
      n.textContent = text;
    });
  }

  // Helper: Choose best HLS level by resolution
  function bestLevel(levels) {
    if (!levels || !levels.length) return null;
    return levels.reduce(function (a, b) {
      return (b.width || 0) > (a.width || 0) ? b : a;
    }, levels[0]);
  }

  // Helper: Safe programmatic play
  function safePlay(video) {
    let p = video.play();
    if (p && typeof p.then === 'function') p.catch(function () {});
  }

  // Helper: Ready status guard
  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay && player.getAttribute('data-player-activated') !== 'true' && player.getAttribute('data-player-status') === 'idle') {
      player.setAttribute('data-player-status', 'ready');
    }
  }

  // Helper: Ratio Setter
  function setBeforeRatio(player, updateSize, w, h) {
    if (updateSize !== 'true' || !w || !h) return;
    let before = player.querySelector('[data-player-before]');
    if (!before) return;
    before.style.paddingTop = (h / w) * 100 + '%';
  }
  function maybeSetRatioFromVideo(player, updateSize, video) {
    if (updateSize !== 'true') return;
    let before = player.querySelector('[data-player-before]');
    if (!before) return;
    let hasPad = before.style.paddingTop && before.style.paddingTop !== '0%';
    if (!hasPad && video.videoWidth && video.videoHeight) {
      setBeforeRatio(player, updateSize, video.videoWidth, video.videoHeight);
    }
  }

  // Helper: robust ratio setter for iOS Safari (with HLS fallback)
  function updateBeforeRatioIOSSafe() {
    if (updateSize !== 'true') return;
    let before = player.querySelector('[data-player-before]');
    if (!before) return;

    function apply(w, h) {
      if (!w || !h) return;
      before.style.paddingTop = (h / w) * 100 + '%';
      if (typeof player._applyClamp === 'function') player._applyClamp();
    }

    if (video.videoWidth && video.videoHeight) {
      apply(video.videoWidth, video.videoHeight);
      return;
    }

    if (player._hls && player._hls.levels && player._hls.levels.length) {
      let lvls = player._hls.levels;
      let best = lvls.reduce(function (a, b) {
        return (b.width || 0) > (a.width || 0) ? b : a;
      }, lvls[0]);
      if (best && best.width && best.height) {
        apply(best.width, best.height);
        return;
      }
    }

    requestAnimationFrame(function () {
      if (video.videoWidth && video.videoHeight) {
        apply(video.videoWidth, video.videoHeight);
        return;
      }

      let master = typeof currentSrc === 'string' && currentSrc ? currentSrc : '';
      if (!master || master.indexOf('blob:') === 0) {
        let attrSrc = player.getAttribute('data-bunny-lightbox-src') || player.getAttribute('data-player-src') || '';
        if (attrSrc && attrSrc.indexOf('blob:') !== 0) master = attrSrc;
      }
      if (!master || !/^https?:/i.test(master)) return;

      fetch(master, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error();
          return r.text();
        })
        .then(function (txt) {
          let lines = txt.split(/\r?\n/);
          let bestW = 0,
            bestH = 0,
            last = null;
          for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
              last = line;
            } else if (last && line && line[0] !== '#') {
              let m = /RESOLUTION=(\d+)x(\d+)/.exec(last);
              if (m) {
                let W = parseInt(m[1], 10),
                  H = parseInt(m[2], 10);
                if (W > bestW) {
                  bestW = W;
                  bestH = H;
                }
              }
              last = null;
            }
          }
          if (bestW && bestH) apply(bestW, bestH);
        })
        .catch(function () {});
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBunnyLightboxPlayer)
} else {
  initBunnyLightboxPlayer()
}

// ============================================
// LOGO FADE CAROUSEL (CMS-driven)
// How many logos show at once is read from data-logo-visible-desktop /
// -tablet / -mobile attributes on the wrapper, so a designer can tune it
// per breakpoint in Webflow without touching this file. Every slot tracks
// which logo (by pool index) it's currently showing, so the rotation can
// always pick a logo that isn't visible anywhere else right now. Each
// visual row runs its own randomly-timed, randomly-positioned rotation,
// so it reads as organic rather than a mechanical sweep.
// ============================================

function initLogoFade() {
  const fadeDuration = 0.5
  const holdTime = 2

  const wrapper = document.querySelector('[data-logo-fade-wrapper]')
  const allLogos = Array.from(document.querySelectorAll('[data-logo-fade="true"]'))
  if (!wrapper || !allLogos.length) return

  // Master list of every logo, in original CMS order — captured once so
  // it stays correct as a reference point no matter how much rotation
  // has since scrambled what each <img> element currently shows
  const pool = allLogos.map((img) => ({
    src: img.getAttribute('src'),
    srcset: img.getAttribute('srcset'),
    sizes: img.getAttribute('sizes'),
    alt: img.getAttribute('alt') || '',
  }))

  const setOrRemoveAttr = (img, name, value) => {
    if (value) img.setAttribute(name, value)
    else img.removeAttribute(name)
  }

  let activeTimeouts = []
  let activeTimelines = []
  let resumeTicking = null

  // Background tabs throttle setTimeout heavily (sometimes to a near-halt),
  // so each row's next tick falls behind while the tab is hidden. Coming
  // back would otherwise fire a backlog of overdue ticks all at once,
  // which looks like every logo fading together. Pausing on hide and
  // restarting with a fresh stagger on return avoids that pile-up.
  const stopTicking = () => {
    activeTimeouts.forEach((id) => clearTimeout(id))
    activeTimeouts = []
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTicking()
    else resumeTicking?.()
  })

  const teardown = () => {
    stopTicking()
    // .kill() the timelines themselves — killTweensOf(img) only reaches
    // the opacity tweens, not each timeline's .call() step (it has no
    // target), which could otherwise still fire later and overwrite a
    // slot we've just reset for the new breakpoint
    activeTimelines.forEach((tl) => tl.kill())
    activeTimelines = []
    allLogos.forEach((img) => {
      gsap.set(img, { opacity: 1 })
      const item = img.closest('[data-logo-fade-item]')
      if (item) item.style.display = ''
    })
  }

  const setupForBreakpoint = (visibleCount) => {
    if (allLogos.length <= visibleCount) return

    const visibleLogos = allLogos.slice(0, visibleCount)

    // Reset every slot back to its original logo first. A slot's element
    // may still be holding a rotated-in logo left over from a previous
    // breakpoint's setup (frozen in place while it was hidden), so we
    // can't trust its current src — resetting guarantees every visible
    // slot starts from a clean, unique baseline every time.
    visibleLogos.forEach((img, i) => {
      const original = pool[i]
      img.setAttribute('src', original.src)
      img.setAttribute('alt', original.alt)
      setOrRemoveAttr(img, 'srcset', original.srcset)
      setOrRemoveAttr(img, 'sizes', original.sizes)
    })

    // The extra CMS items only exist to feed the rotation pool —
    // hide their grid cells so they don't add extra slots to the layout
    allLogos.slice(visibleCount).forEach((img) => {
      const item = img.closest('[data-logo-fade-item]')
      if (item) item.style.display = 'none'
    })

    // Group visible slots into their visual rows (by on-screen top
    // position) so each row can rotate independently of the others
    const rows = []
    visibleLogos.forEach((img, slot) => {
      const top = Math.round(img.getBoundingClientRect().top)
      let row = rows.find((r) => Math.abs(r.top - top) < 2)
      if (!row) {
        row = { top, slots: [] }
        rows.push(row)
      }
      row.slots.push(slot)
    })

    const slotPoolIndex = visibleLogos.map((_, i) => i)
    let nextCandidateIndex = visibleCount

    const cycleSlot = (thisSlot) => {
      const img = visibleLogos[thisSlot]

      // Walk the pool from the logo that's waited longest, skipping
      // anything currently shown in another slot
      let candidateIndex = nextCandidateIndex % pool.length
      while (slotPoolIndex.includes(candidateIndex)) {
        candidateIndex = (candidateIndex + 1) % pool.length
      }
      const next = pool[candidateIndex]

      console.log('[logo-fade] slot', thisSlot, ':', img.getAttribute('src').split('/').pop(), '->', next.src.split('/').pop())

      // Reserve this candidate immediately (synchronously) — if we waited
      // until the .call() below, a different row's tick firing in the
      // meantime (the fade takes fadeDuration*2 to finish) would still see
      // this index as free and could pick the same logo for another slot
      slotPoolIndex[thisSlot] = candidateIndex
      nextCandidateIndex = candidateIndex + 1

      const tl = gsap.timeline({
        // Drop this timeline from the tracking list once it finishes on
        // its own, so the list only ever holds still-running timelines
        onComplete: () => {
          activeTimelines = activeTimelines.filter((t) => t !== tl)
        },
      })
      activeTimelines.push(tl)
      tl.to(img, { opacity: 0, duration: fadeDuration, ease: 'power2.out' })
        .call(() => {
          img.setAttribute('src', next.src)
          img.setAttribute('alt', next.alt)
          // srcset/sizes take priority over src in the browser, so a logo
          // with a stale srcset would keep rendering its old image
          setOrRemoveAttr(img, 'srcset', next.srcset)
          setOrRemoveAttr(img, 'sizes', next.sizes)
        })
        .to(img, { opacity: 1, duration: fadeDuration, ease: 'power2.out' })
    }

    const startTicking = () => {
      rows.forEach((row, rowIndex) => {
        let lastSlot = -1

        const pickSlot = () => {
          if (row.slots.length === 1) return row.slots[0]
          let slot
          do {
            slot = row.slots[Math.floor(Math.random() * row.slots.length)]
          } while (slot === lastSlot)
          return slot
        }

        const tick = () => {
          lastSlot = pickSlot()
          cycleSlot(lastSlot)

          // Jitter each row's own pace so the rows don't stay in lockstep
          const jitter = holdTime * 1000 * (0.7 + Math.random() * 0.6)
          activeTimeouts.push(setTimeout(tick, jitter))
        }

        // Stagger each row's start so they don't tick at the same time
        activeTimeouts.push(setTimeout(tick, (holdTime * 1000 * rowIndex) / rows.length))
      })
    }

    // Exposed so visibilitychange can restart ticking (freshly staggered,
    // not resumed mid-backlog) for whichever breakpoint is currently active
    resumeTicking = startTicking
    startTicking()
  }

  const mm = gsap.matchMedia()

  mm.add(
    {
      isDesktop: '(min-width: 992px)',
      isTablet: '(min-width: 768px) and (max-width: 991px)',
      isMobile: '(max-width: 767px)',
    },
    (context) => {
      const { isDesktop, isTablet } = context.conditions
      const attr = isDesktop ? 'data-logo-visible-desktop' : isTablet ? 'data-logo-visible-tablet' : 'data-logo-visible-mobile'
      const visibleCount = Number(wrapper.getAttribute(attr)) || allLogos.length

      setupForBreakpoint(visibleCount)

      return () => teardown()
    }
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogoFade)
} else {
  initLogoFade()
}
