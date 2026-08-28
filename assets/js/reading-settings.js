// 感應區手勢:整頁都是感應區,點擊(不是滑動/選字)才會開關 #reading-settings。
// 用 pointerdown→pointerup 的移動距離判斷是 tap 還是 swipe/drag,超過門檻就
// 當成滑動、不觸發;點在既有連結/按鈕上一律放行,不攔截,讓它們照常運作。
(function () {
  const panel = document.getElementById('reading-settings');
  if (!panel) return;

  const TAP_MOVE_THRESHOLD = 10; // px,超過這個距離就不算 tap

  let startX = 0;
  let startY = 0;
  let moved = false;

  function isRealInteractive(target) {
    return !!target.closest('a, button, input, select, textarea, label');
  }

  function handleTap(target) {
    if (isRealInteractive(target)) return; // 讓連結/按鈕照常運作,不攔截

    const isInsidePanel = panel.contains(target);
    if (panel.classList.contains('is-open')) {
      if (!isInsidePanel) panel.classList.remove('is-open');
    } else if (!isInsidePanel) {
      panel.classList.add('is-open');
    }
  }

  document.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    moved = false;
  });

  document.addEventListener('pointermove', (e) => {
    if (moved) return;
    if (Math.abs(e.clientX - startX) > TAP_MOVE_THRESHOLD || Math.abs(e.clientY - startY) > TAP_MOVE_THRESHOLD) {
      moved = true;
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (!moved) handleTap(e.target);
  });
})();

// 實際的設定值:存成 CSS 變數掛在 <html> 上,.article-body 的樣式用
// var(--reading-xxx, 預設值) 讀,沒設定過就照預設值,不影響沒有 JS 的情況。
// 偏好存 localStorage,是每個訪客自己裝置上的顯示設定,不需要、也不該同步
// 到伺服器或跨裝置。
(function () {
  const SETTINGS = {
    'font-size': { cssVar: '--reading-font-size', unit: 'px', step: 1, min: 19, max: 29, default: 24, storageKey: 'reading-font-size' },
    'paragraph-spacing': { cssVar: '--reading-para-spacing', unit: 'em', step: 0.2, min: 0.8, max: 3, default: 1.6, storageKey: 'reading-para-spacing' },
  };

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
    apply(name, readStored(cfg.storageKey, cfg.default));
  });

  document.querySelectorAll('.setting-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.setting;
      const cfg = SETTINGS[name];
      if (!cfg) return;
      const current = readStored(cfg.storageKey, cfg.default);
      const delta = btn.dataset.action === 'increase' ? cfg.step : -cfg.step;
      const next = clamp(Math.round((current + delta) * 10) / 10, cfg.min, cfg.max);
      apply(name, next);
    });
  });
})();
