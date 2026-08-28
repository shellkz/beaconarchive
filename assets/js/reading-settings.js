// 捲動只控制 bar 顯示/收起,不直接開設定內容(body)——就算誤觸發,
// 頂多多看到一條裝飾用的窄條,不會直接跳出整個設定面板。要打開 body
// 得另外按 bar 裡的齒輪按鈕,是明確的一次點擊,不是滑動造成的意外。
// 往下捲收起 bar 時,body 如果剛好開著也一併收掉,不留下沒有 bar 的
// 孤兒 body。用 requestAnimationFrame 節流,桌機手機共用同一套。
(function () {
  const bar = document.getElementById('reading-settings-bar');
  const settingsBody = document.getElementById('reading-settings-body');
  const toggleBtn = document.getElementById('reading-settings-toggle');
  const closeBtn = document.getElementById('reading-settings-close');
  if (!bar || !settingsBody) return;

  // bar 高度直接量 header 實際渲染出來的高度,不猜一個固定數字——header
  // 樣式以後再調,這裡不用跟著改,量出來的值永遠是對的。
  const header = document.querySelector('header');
  function syncBarHeight() {
    if (header) {
      document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    }
  }
  syncBarHeight();
  window.addEventListener('resize', syncBarHeight);

  const SCROLL_UP_THRESHOLD = 40; // px,往上捲要明顯滑動才觸發顯示 bar
  const SCROLL_DOWN_THRESHOLD = 6; // px,往下捲收起維持原本的靈敏度

  let lastScrollY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;

    if (delta < -SCROLL_UP_THRESHOLD) {
      bar.classList.add('is-visible');
      lastScrollY = currentScrollY;
    } else if (delta > SCROLL_DOWN_THRESHOLD) {
      bar.classList.remove('is-visible');
      settingsBody.classList.remove('is-open');
      lastScrollY = currentScrollY;
    }
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true }
  );

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => settingsBody.classList.toggle('is-open'));
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      bar.classList.remove('is-visible');
      settingsBody.classList.remove('is-open');
    });
  }
})();

// 實際的設定值:存成 CSS 變數掛在 <html> 上,.article-body 的樣式用
// var(--reading-xxx, 預設值) 讀,沒設定過就照預設值,不影響沒有 JS 的情況。
// 偏好存 localStorage,是每個訪客自己裝置上的顯示設定,不需要、也不該同步
// 到伺服器或跨裝置。
(function () {
  const SETTINGS = {
    'font-size': {
      cssVar: '--reading-font-size', unit: 'px', step: 1,
      min: 19, max: 29, default: 24,
      // 手機版整段範圍跟著預設一起平移,讓預設在新範圍裡維持同樣的相對位置,
      // 不是只把預設的起始值改掉、範圍不變——不然預設會卡在 max,沒辦法再往上調。
      mobileMin: 27, mobileMax: 37, mobileDefault: 32,
      storageKey: 'reading-font-size',
    },
    'paragraph-spacing': { cssVar: '--reading-para-spacing', unit: 'em', step: 0.2, min: 0.8, max: 3, default: 1.6, storageKey: 'reading-para-spacing' },
  };

  // 跟 style.css 的 @media(max-width:600px) 用同一個門檻。
  function isMobile() {
    return window.matchMedia('(max-width:600px)').matches;
  }

  function defaultFor(cfg) {
    return isMobile() && cfg.mobileDefault !== undefined ? cfg.mobileDefault : cfg.default;
  }
  function minFor(cfg) {
    return isMobile() && cfg.mobileMin !== undefined ? cfg.mobileMin : cfg.min;
  }
  function maxFor(cfg) {
    return isMobile() && cfg.mobileMax !== undefined ? cfg.mobileMax : cfg.max;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readStored(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const num = parseFloat(raw);
      return Number.isFinite(num) ? num : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function apply(name, value) {
    const cfg = SETTINGS[name];
    document.documentElement.style.setProperty(cfg.cssVar, value + cfg.unit);
    try {
      localStorage.setItem(cfg.storageKey, String(value));
    } catch (e) {
      // 存不進去(私密瀏覽/被擋)就當這次不記,不影響當下畫面已經套用的值
    }
  }

  Object.keys(SETTINGS).forEach((name) => {
    const cfg = SETTINGS[name];
    apply(name, readStored(cfg.storageKey, defaultFor(cfg)));
  });

  document.querySelectorAll('.setting-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.setting;
      const cfg = SETTINGS[name];
      if (!cfg) return;
      const current = readStored(cfg.storageKey, defaultFor(cfg));
      const delta = btn.dataset.action === 'increase' ? cfg.step : -cfg.step;
      const next = clamp(Math.round((current + delta) * 10) / 10, minFor(cfg), maxFor(cfg));
      apply(name, next);
    });
  });
})();
