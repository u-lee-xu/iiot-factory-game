// ═══════════════════════════════════════════════════════════════════
// core/music-director.js — 背景音乐双模式调度（跟随场景 auto / 手动选曲 manual）
// 零依赖、普通脚本挂 window.MusicDirector；供 sound.js 与 map_proto/room 内联引擎共用
// 核心职责：决定"某次场景触发的自动切歌"是否真的生效；记录用户手动选择并跨页记忆
//   - auto 模式：进房间/开游戏自动切到对应场景曲（默认）
//   - manual 模式：用户手动选曲后锁定，场景切换不再打扰；可一键 followScene 恢复
// ═══════════════════════════════════════════════════════════════════
(function () {
  var KEY_MODE = 'music_mode';
  var KEY_TRACK = 'music_manual_track';

  var mode = 'auto';
  try { mode = (localStorage.getItem(KEY_MODE) === 'manual') ? 'manual' : 'auto'; } catch (e) {}
  var lastSceneTrack = null;   // 最近一次场景想播的曲（followScene 后立即恢复用）

  function saveMode() { try { localStorage.setItem(KEY_MODE, mode); } catch (e) {} }

  window.MusicDirector = {
    getMode: function () { return mode; },
    isAuto: function () { return mode === 'auto'; },
    // 场景触发某曲：auto 放行；manual 拦截（不切走用户手动选的歌）；顺带记录场景曲
    shouldPlayAuto: function (track) {
      if (track) lastSceneTrack = track;
      return mode === 'auto';
    },
    // 用户手动选曲：置 manual + 记忆，返回曲名
    playManual: function (track) {
      mode = 'manual';
      saveMode();
      try { localStorage.setItem(KEY_TRACK, track || ''); } catch (e) {}
      return track;
    },
    // 恢复跟随场景（回 auto）
    followScene: function () {
      mode = 'auto';
      saveMode();
    },
    // 新页初始化：manual 模式下要恢复的手动曲（无则 null）
    manualTrackToRestore: function () {
      if (mode !== 'manual') return null;
      try { return localStorage.getItem(KEY_TRACK) || null; } catch (e) { return null; }
    },
    // 最近一次场景想播的曲（供 followScene 后立即恢复）
    lastSceneTrack: function () { return lastSceneTrack; }
  };
})();
