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
