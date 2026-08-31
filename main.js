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
  smoothTouch: true,
  // skip Lenis's smooth-scroll handling on anything marked
  // data-lenis-prevent (e.g. scrollable overlay content) so wheel/trackpad
  // scrolling works normally inside those elements
  prevent: node => node.closest('[data-lenis-prevent]')
})

// If stop-scroll is active (from loader in head), keep Lenis stopped
if (document.documentElement.classList.contains('stop-scroll')) {
  window.lenis.stop()
}

// Always start at the top on load/refresh, even if the browser tried
// to restore a previous scroll position — unless the URL points at a
// section (e.g. /#contact), in which case jump straight there instead
if (location.hash) {
  const targetSection = document.querySelector(location.hash)
  if (targetSection) {
    window.lenis.scrollTo(targetSection, { immediate: true })
  }
} else {
  window.lenis.scrollTo(0, { immediate: true })
}

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

// ============================================
// LOGO WALL COLUMNS (alphabetical letter groups)
// Grid/flex-wrap can't do this without leaving a gap, because every
// column in a row is forced to share that row's height. Instead we
// physically deal the letter groups into N independent column boxes
// (item 1 -> col 1, item 2 -> col 2, ... wrapping back to col 1), the
// same round-robin order as the design mockups, so each column just
// stacks its own content with no height synced to its neighbors, and
// reading row by row still goes in alphabetical order. Redone on every
// breakpoint change since the grouping itself (not just the styling)
// has to change between 3 / 2 / 1 columns.
// ============================================

function initLogoWallColumns() {
  const wrapper = document.querySelector('[data-logo-wall-groups]')
  if (!wrapper) return

  // Captured once, in original alphabetical order — every rebuild reuses
  // this same list, not whatever order the DOM happens to be in right now
  const groups = Array.from(wrapper.querySelectorAll('[data-logo-wall-group]'))
  if (!groups.length) return

  // The columns handle their own width via flex, so the wrapper should
  // never wrap a column onto a second line
  wrapper.style.flexWrap = 'nowrap'

  const rebuild = (columnCount) => {
    // Reuse the existing Designer class instead of inventing styles here —
    // padding, width per breakpoint, flex behavior all stay editable in
    // Webflow's Style panel rather than hardcoded in this script
    const columns = Array.from({ length: columnCount }, () => {
      const column = document.createElement('div')
      column.className = 'logo-wall_column-wrapper'
      return column
    })

    groups.forEach((group, i) => columns[i % columnCount].appendChild(group))

    wrapper.replaceChildren(...columns)
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
      rebuild(isDesktop ? 3 : isTablet ? 2 : 1)
    }
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogoWallColumns)
} else {
  initLogoWallColumns()
}

// ============================================
// Bunny (bunny.net) custom video setup — autoplay/click/hover handling for [data-media-init] elements
// ============================================

function initMediaSetup() {
  const mediaElements = document.querySelectorAll('[data-media-init]')
  if (!mediaElements.length) return

  const pauseDelay = 200
  const viewportOffset = 0.75
  const isHoverDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  initMediaSetup._cleanup?.forEach(fn => fn())
  const cleanupFns = []
  const rootMarginValue = viewportOffset * 100

  mediaElements.forEach(mediaEl => {
    const video = mediaEl.querySelector('[data-media-video-src]')
    if (!video) return

    const mode = mediaEl.dataset.mediaMode || 'autoplay'
    const touchMode = mediaEl.dataset.mediaTouchMode
    const resetAttr = mediaEl.dataset.mediaReset
    const pausedStatusAttr = mediaEl.dataset.mediaOnPause
    const toggleElements = [...mediaEl.querySelectorAll('[data-media-toggle]')]

    const activeMode = !isHoverDevice ? (touchMode || (mode === 'hover' ? 'autoplay' : mode)) : mode
    const shouldResetOnPause = resetAttr === 'true' ? true : resetAttr === 'false' ? false : activeMode === 'hover'
    const pausedStatus = pausedStatusAttr === 'paused' ? 'paused' : 'not-active'

    const clickTargets = toggleElements.length ? toggleElements : [mediaEl]
    const shouldUseClickToggle = activeMode === 'click' || (activeMode === 'autoplay' && toggleElements.length)

    let isInView = false
    let isHovering = false
    let hasLoaded = false
    let userPaused = false
    let userActivated = false
    let isActivated = false
    let shouldBePlaying = false
    let pauseTimer = null

    const setStatus = status => {
      mediaEl.dataset.mediaStatus = status
    }

    const clearPauseTimer = () => {
      clearTimeout(pauseTimer)
    }

    const addCleanup = fn => {
      cleanupFns.push(fn)
    }

    const on = (target, event, handler) => {
      target.addEventListener(event, handler)
      addCleanup(() => target.removeEventListener(event, handler))
    }

    const playAttempt = () => {
      video.play().then(() => {
        if (shouldBePlaying) setStatus('playing')
      }).catch(() => {})
    }

    const loadVideo = () => {
      if (hasLoaded) return

      const src = video.dataset.mediaVideoSrc
      if (!src) return

      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.setAttribute('muted', '')
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
      video.setAttribute('fetchpriority', 'high')
      video.src = src
      video.load()
      hasLoaded = true
    }

    const shouldResume = () => {
      if (!isInView || document.hidden) return false
      if (activeMode === 'autoplay') return !userPaused
      if (activeMode === 'click') return userActivated && !userPaused
      return isHovering
    }

    const playVideo = () => {
      if (!isInView || document.hidden) return

      shouldBePlaying = true
      clearPauseTimer()
      loadVideo()
      setStatus(video.readyState < 3 ? 'loading' : 'playing')
      playAttempt()
    }

    const pauseVideo = (delay = 0, reset = false) => {
      shouldBePlaying = false
      clearPauseTimer()

      pauseTimer = setTimeout(() => {
        video.pause()
        if (reset) video.currentTime = 0
      }, delay)
    }

    const handleHoverIn = () => {
      if (!isInView || document.hidden) return

      isHovering = true
      clearPauseTimer()

      if (!video.paused) {
        shouldBePlaying = true
        setStatus('playing')
        return
      }

      playVideo()
    }

    const handleHoverOut = () => {
      if (!isInView) return

      isHovering = false
      setStatus(pausedStatus)
      pauseVideo(pauseDelay, shouldResetOnPause)
    }

    const handleClick = () => {
      if (!isInView || document.hidden) return

      clearPauseTimer()

      if (video.paused) {
        userActivated = true
        userPaused = false
        playVideo()
      } else {
        userActivated = true
        userPaused = true
        setStatus(pausedStatus)
        pauseVideo(pauseDelay, shouldResetOnPause)
      }
    }

    const handleViewport = entries => {
      entries.forEach(entry => {
        if (entry.target !== mediaEl) return

        if (!isActivated && entry.isIntersecting) {
          isActivated = true

          if (shouldUseClickToggle) {
            clickTargets.forEach(toggleEl => on(toggleEl, 'click', handleClick))
          }

          if (activeMode === 'hover') {
            on(mediaEl, 'mouseenter', handleHoverIn)
            on(mediaEl, 'mouseleave', handleHoverOut)
          }
        }

        isInView = entry.isIntersecting

        if (isInView) {
          if (shouldResume()) playVideo()
        } else {
          isHovering = false

          if (!video.paused || shouldBePlaying) {
            setStatus('paused')
            pauseVideo(0, false)
          }
        }
      })
    }

    const handlePageVisibilityChange = () => {
      if (document.hidden) {
        if (!video.paused || shouldBePlaying) {
          setStatus('paused')
          pauseVideo(0, false)
        }
        return
      }
      if (shouldResume()) playVideo()
    }

    mediaEl.dataset.mediaStatus = 'not-active'

    const observer = new IntersectionObserver(handleViewport, {
      rootMargin: `${rootMarginValue}% 0px ${rootMarginValue}% 0px`,
      threshold: 0
    })

    observer.observe(mediaEl)

    on(video, 'playing', () => { if (shouldBePlaying) setStatus('playing') })
    on(video, 'waiting', () => { if (shouldBePlaying) setStatus('loading') })
    on(video, 'canplay', () => { if (shouldBePlaying && isInView && !document.hidden) playAttempt() })
    on(video, 'loadeddata', () => { if (shouldBePlaying && isInView && !document.hidden) playAttempt() })
    on(video, 'ended', () => {
      if (!shouldBePlaying || !isInView || document.hidden) return
      video.currentTime = 0
      playAttempt()
    })

    on(document, 'visibilitychange', handlePageVisibilityChange)

    addCleanup(() => observer.disconnect())
    addCleanup(() => {
      clearPauseTimer()
      shouldBePlaying = false
      video.pause()
    })
  })

  initMediaSetup._cleanup = cleanupFns
}

// Initialize Cover Media Setup (Autoplay, Click, Hover)
// main.js loads asynchronously via the fxtun/jsDelivr loader, so DOMContentLoaded
// has often already fired by the time this runs — only wait for it if needed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMediaSetup)
} else {
  initMediaSetup()
}

// ============================================
// MOBILE NAV MENU (open/close by height)
// ============================================

function initMobileNav() {
  const toggle = document.querySelector('[mobile-nav="true"]')
  const menu = document.querySelector('[mobile-links="true"]')
  if (!toggle || !menu) return

  // Webflow's padding has to collapse to 0 alongside height, or a
  // padding-sized strip lingers until the display:none snap at the end
  const basePadding = {
    top: getComputedStyle(menu).paddingTop,
    bottom: getComputedStyle(menu).paddingBottom
  }

  let isOpen = false

  const openMenu = () => {
    isOpen = true
    // padding snaps to its real value instantly, before the height is measured,
    // so the measurement below reflects the true final size
    gsap.set(menu, { display: 'flex', height: 'auto', paddingTop: basePadding.top, paddingBottom: basePadding.bottom })
    const targetHeight = menu.offsetHeight
    // handing GSAP a real number instead of the 'auto' keyword avoids the one-frame
    // flash of the fully-open (tall, rounded) shape that 'auto' resolution causes
    gsap.fromTo(menu, { height: 0 }, { height: targetHeight, duration: 0.4, ease: 'power2.out' })
  }

  const closeMenu = () => {
    isOpen = false
    gsap.to(menu, {
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => gsap.set(menu, { display: 'none' })
    })
  }

  toggle.addEventListener('click', () => {
    isOpen ? closeMenu() : openMenu()
  })

  // clicking a link closes the menu too — guarded by isOpen so a desktop
  // click (where the menu is never "open") never touches this shared element
  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (isOpen) closeMenu()
    })
  })

  // closes the menu as soon as the page starts scrolling again
  window.lenis?.on('scroll', () => {
    if (isOpen) closeMenu()
  })

  // only collapse/expand by height below the tablet breakpoint — on desktop
  // the links stay a plain row and the hamburger is hidden anyway
  gsap.matchMedia().add('(max-width: 991px)', () => {
    gsap.set(menu, { height: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' })
    return () => gsap.set(menu, { clearProps: 'height,paddingTop,paddingBottom,overflow,display' })
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileNav)
} else {
  initMobileNav()
}

// ============================================
// FLOATING NAV ON SCROLL
// ============================================

function initFloatingNav() {
  const navBar = document.querySelector('[data-nav-bar]')
  const navLogo = document.querySelector('[data-nav-logo]')
  if (!navBar) return

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top -24', // fires once the page has scrolled 24px down
    end: 99999,
    toggleClass: { targets: [navBar, navLogo].filter(Boolean), className: 'nav-scrolled' }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingNav)
} else {
  initFloatingNav()
}

// ============================================
// OVERLAY / MODAL
// Used for the Cases grid, where each CMS card renders its own trigger +
// overlay pair — so this sets each pair up independently instead of just
// grabbing the first one on the page. The overlay's own parent element is
// the CMS item wrapper it shares with its trigger, so that's used as the
// scope. If a card has no trigger of its own (some CMS items don't render
// one), its overlay simply has nothing to open it — it must NOT fall back
// to searching further up the DOM, or it ends up grabbing every other
// card's trigger too and opening on top of whichever one was clicked.
//
// data-overlay-trigger="true" opens the overlay, data-overlay-close="true"
// closes it. That close attribute lives on both the overlay background and
// the dedicated close button inside data-overlay-content, so a background
// click is only ignored when it actually landed inside the content box —
// that's what stops clicking the modal's own content from closing it,
// while still letting the close button (even via its icon) work normally.
// ============================================

function initOverlays() {
  const overlays = document.querySelectorAll('[data-overlay="true"]')

  overlays.forEach(overlay => {
    const scope = overlay.parentElement
    if (!scope) return

    const content = overlay.querySelector('[data-overlay-content="true"]')
    const openTriggers = scope.querySelectorAll('[data-overlay-trigger="true"]')
    const closeTriggers = scope.querySelectorAll('[data-overlay-close="true"]')

    // starts hidden; opening switches it to flex (matches the "hidden by
    // default, flex when shown" display setup already on the element)
    gsap.set(overlay, { display: 'none', autoAlpha: 0 })
    // overflowY here lets content taller than the max-height (set in Webflow)
    // scroll internally instead of getting clipped. data-lenis-prevent tells
    // Lenis to leave wheel/trackpad scrolling on this element alone — without
    // it Lenis swallows the scroll for its own smooth-scroll effect and the
    // content never moves, even though the scrollbar is there and draggable
    if (content) {
      gsap.set(content, { autoAlpha: 0, y: 20, overflowY: 'auto' })
      content.setAttribute('data-lenis-prevent', '')
    }

    const openOverlay = () => {
      window.lenis?.stop()
      gsap.set(overlay, { display: 'flex' })

      const tl = gsap.timeline()
      tl.to(overlay, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 0)
      if (content) tl.to(content, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.1)
    }

    const closeOverlay = () => {
      window.lenis?.start()

      const tl = gsap.timeline({ onComplete: () => gsap.set(overlay, { display: 'none' }) })
      if (content) tl.to(content, { autoAlpha: 0, y: 20, duration: 0.3, ease: 'power2.out' }, 0)
      tl.to(overlay, { autoAlpha: 0, duration: 0.3, ease: 'power2.out' }, 0.1)
    }

    openTriggers.forEach(trigger => trigger.addEventListener('click', openOverlay))

    closeTriggers.forEach(trigger => {
      trigger.addEventListener('click', e => {
        if (trigger === overlay && content?.contains(e.target)) return
        closeOverlay()
      })
    })
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOverlays)
} else {
  initOverlays()
}

// ============================================
// EXPANDING FEATURE PILLS
// A row of collapsed "pill" buttons that expand in place when clicked,
// revealing more content and syncing an optional visual panel alongside
// them. Widths/heights are measured live (off the real DOM, with the
// expanded width pulled from a CSS variable) so the animation always
// matches whatever content and breakpoint is currently showing.
// ============================================

function initExpandingFeaturePills() {
  const wraps = document.querySelectorAll('[data-feature-pills-init]')
  if (!wraps.length) return

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  wraps.forEach((wrap, wrapIdx) => {
    const items = Array.from(wrap.querySelectorAll('[data-feature-pills-item]'))
    const visuals = Array.from(wrap.querySelectorAll('[data-feature-pills-visual]'))
    const cover = wrap.querySelector('[data-feature-pills-cover]')
    const closeBtn = wrap.querySelector('[data-feature-pills-close]')
    if (!items.length) return

    if (visuals.length && visuals.length !== items.length) {
      console.warn(`[ExpandingFeaturePills] items (${items.length}) and visuals (${visuals.length}) mismatch in module #${wrapIdx}. Visual syncing uses index order.`)
    }

    const uidBase = `feature-pills-${wrapIdx}`
    const ease = 'back.out(2)'
    const animationDuration = 0.5

    const getExpandedWidth = () => getComputedStyle(wrap).getPropertyValue('--content-item-expanded').trim() || ''

    const getActiveIndex = () => {
      const active = items.find(it => it.getAttribute('data-active') === 'true')
      return active ? Number(active.getAttribute('data-feature-pills-index')) : null
    }

    const setWrapActive = isActive => {
      wrap.setAttribute('data-feature-pills-active', isActive ? 'true' : 'false')
      if (closeBtn) closeBtn.setAttribute('aria-hidden', isActive ? 'false' : 'true')
      if (cover) {
        cover.setAttribute('data-active', isActive ? 'false' : 'true')
        cover.setAttribute('aria-hidden', isActive ? 'true' : 'false')
      }
    }

    const setVisualActive = indexOrNull => {
      if (!visuals.length) return
      visuals.forEach(v => {
        const idx = Number(v.getAttribute('data-feature-pills-index'))
        const isActive = indexOrNull !== null && idx === indexOrNull
        v.setAttribute('data-active', isActive ? 'true' : 'false')
        v.setAttribute('aria-hidden', isActive ? 'false' : 'true')
      })
    }

    const setItemA11y = (item, isOpen) => {
      const btn = item.querySelector('[data-feature-pills-button]')
      const content = item.querySelector('[data-feature-pills-content]')
      if (!btn || !content) return
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
      content.setAttribute('aria-hidden', isOpen ? 'false' : 'true')
    }

    const measureButtonH = item => {
      const btn = item.querySelector('[data-feature-pills-button]')
      return btn ? Math.ceil(btn.getBoundingClientRect().height) : 0
    }

    const measureInnerH = (item, expandedW) => {
      const inner = item.querySelector('[data-feature-pills-inner]')
      if (!inner) return 0

      const mask = item.querySelector('.feature-pills__item-mask')

      const prevMaskOverflow = mask ? mask.style.overflow : null
      if (mask) mask.style.overflow = 'visible'

      const prevMaxW = inner.style.maxWidth
      if (expandedW) inner.style.maxWidth = expandedW

      const h = Math.ceil(inner.getBoundingClientRect().height)

      if (expandedW) inner.style.maxWidth = prevMaxW || ''
      if (mask) mask.style.overflow = prevMaskOverflow || ''

      return h
    }

    const getHeights = (item, expandedW) => {
      const buttonH = measureButtonH(item)
      const innerH = measureInnerH(item, expandedW)
      const openH = Math.max(buttonH, innerH)
      return { buttonH, openH }
    }

    const collapsedWidthPx = new Map()

    const captureCollapsedWidths = () => {
      items.forEach(item => {
        const prev = item.style.width
        item.style.width = ''
        collapsedWidthPx.set(item, Math.ceil(item.getBoundingClientRect().width))
        item.style.width = prev
      })
    }

    const animateBox = (el, vars) => {
      gsap.killTweensOf(el)
      if (prefersReducedMotion) {
        if (vars.height != null) el.style.height = `${vars.height}px`
        if (vars.width != null) el.style.width = typeof vars.width === 'number' ? `${vars.width}px` : vars.width
        return
      }
      gsap.to(el, { ...vars, duration: animationDuration, ease, overwrite: true })
    }

    const openItem = item => {
      const expandedW = getExpandedWidth()
      const { openH } = getHeights(item, expandedW)

      item.setAttribute('data-active', 'true')
      setItemA11y(item, true)
      setWrapActive(true)

      const targetW = expandedW || `${collapsedWidthPx.get(item) || Math.ceil(item.getBoundingClientRect().width)}px`
      animateBox(item, { height: openH, width: targetW })
    }

    const closeItem = item => {
      const expandedW = getExpandedWidth()
      const { buttonH } = getHeights(item, expandedW)

      item.setAttribute('data-active', 'false')
      setItemA11y(item, false)

      const targetW = collapsedWidthPx.get(item) || Math.ceil(item.getBoundingClientRect().width)
      animateBox(item, { height: buttonH, width: targetW })
    }

    const switchTo = nextIndex => {
      const current = getActiveIndex()
      if (current === nextIndex) return

      const nextItem = items[nextIndex]
      if (!nextItem) return

      if (current !== null) closeItem(items[current])
      openItem(nextItem)

      setVisualActive(nextIndex)
    }

    const closeAll = () => {
      const current = getActiveIndex()
      if (current === null) return
      closeItem(items[current])
      setVisualActive(null)
      setWrapActive(false)
    }

    items.forEach((item, i) => {
      item.setAttribute('data-feature-pills-index', String(i))
      if (!item.hasAttribute('data-active')) item.setAttribute('data-active', 'false')

      const btn = item.querySelector('[data-feature-pills-button]')
      const content = item.querySelector('[data-feature-pills-content]')
      if (btn) {
        btn.setAttribute('data-feature-pills-index', String(i))
        btn.type = 'button'
        const triggerId = `${uidBase}-trigger-${i}`
        if (!btn.id) btn.id = triggerId
      }
      if (content && btn) {
        content.setAttribute('data-feature-pills-index', String(i))
        const panelId = `${uidBase}-panel-${i}`
        if (!content.id) content.id = panelId
        btn.setAttribute('aria-controls', content.id)
        content.setAttribute('role', 'region')
        content.setAttribute('aria-labelledby', btn.id)
        if (!content.hasAttribute('aria-hidden')) content.setAttribute('aria-hidden', 'true')
        if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false')
      }
    })

    visuals.forEach((v, i) => v.setAttribute('data-feature-pills-index', String(i)))

    if (closeBtn) {
      closeBtn.type = 'button'
      if (!closeBtn.hasAttribute('aria-hidden')) closeBtn.setAttribute('aria-hidden', 'true')
      closeBtn.addEventListener('click', closeAll)
    }

    items.forEach(item => {
      const h = measureButtonH(item)
      item.style.height = `${h}px`
    })

    setWrapActive(false)
    setVisualActive(null)

    items.forEach((item, i) => {
      const btn = item.querySelector('[data-feature-pills-button]')
      if (!btn) return
      btn.addEventListener('click', () => switchTo(i))
    })

    wrap.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll()
    })

    const debounce = (fn, wait = 150) => {
      let t
      return (...args) => {
        clearTimeout(t)
        t = setTimeout(() => fn(...args), wait)
      }
    }

    const handleResize = () => {
      const current = getActiveIndex()

      items.forEach(item => {
        if (item.getAttribute('data-active') !== 'true') item.style.width = ''
      })

      captureCollapsedWidths()

      if (current !== null) {
        const item = items[current]
        const expandedW = getExpandedWidth()
        const { openH } = getHeights(item, expandedW)
        const targetW = expandedW || ''

        if (prefersReducedMotion) {
          item.style.height = `${openH}px`
          if (targetW) item.style.width = targetW
        } else {
          const fallbackW = `${Math.ceil(item.getBoundingClientRect().width)}px`
          const widthForActive = targetW || fallbackW

          gsap.set(item, { height: openH, width: widthForActive })
          if (targetW) item.style.width = targetW
        }
      } else {
        items.forEach(item => {
          const h = measureButtonH(item)
          item.style.height = `${h}px`
        })
      }
    }

    const debouncedResize = debounce(handleResize, 200)

    captureCollapsedWidths()
    window.addEventListener('resize', debouncedResize, { passive: true })
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExpandingFeaturePills)
} else {
  initExpandingFeaturePills()
}
