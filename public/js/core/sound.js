// ═══════════════════════════════════════════════════════════════════
// core/sound.js — 音频系统（Web Audio + ZzFXM 8-bit 音乐）
// 自包含：内部持有音频状态(soundEnabled/musicEnabled/currentTrack 等)
// 从 app.js 抽出；app.js 通过 import 调用，window 挂载由 app.js 负责
// ═══════════════════════════════════════════════════════════════════

export let soundEnabled = true;
export let audioCtx = null;

// =========================================================================
// 2a. AUDIO SYSTEM (Web Audio API, no external files)
// =========================================================================
export function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
}

// =========================================================================
// =========================================================================
// 2b. 8-BIT BACKGROUND MUSIC（ZzFXM 渲染成 AudioBuffer 循环播放，按场景切换）
// =========================================================================
export let musicEnabled = true;
export let currentTrack = null;
export let musicGainNode = null;
export let musicSrc = null;

export function getMusicSong(name) {
  if (window.MUSIC_SONGS && window.MUSIC_SONGS[name]) return window.MUSIC_SONGS[name];
  return (window.MUSIC_SONGS && window.MUSIC_SONGS.hub) || null;
}
function md() { return (typeof window !== 'undefined') ? (window.MusicDirector || null) : null; }
// 真实播放（不受双模式拦截）；由 playMusic(场景) / playManualTrack(手动) 复用
function _play(name) {
  const song = getMusicSong(name);
  if (!song) return;
  if (currentTrack === name && musicSrc) return;
  currentTrack = name;
  if (!musicEnabled) return;
  const ctx = getAudioCtx();
  try { if (ctx.state === 'suspended') ctx.resume(); } catch(e){}
  if (!musicGainNode) {
    musicGainNode = ctx.createGain();
    musicGainNode.gain.value = 0.7;
    musicGainNode.connect(ctx.destination);
  }
  if (musicSrc) { try { musicSrc.stop(); } catch(e){} musicSrc = null; }
  try {
    const data = zzfxM.apply(null, song);
    const buf = ctx.createBuffer(data.length, data[0].length, window.zzfxR);
    for (let i = 0; i < data.length; i++) buf.getChannelData(i).set(data[i]);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(musicGainNode);
    musicSrc = src;
    musicGainNode.gain.cancelScheduledValues(ctx.currentTime);
    musicGainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicGainNode.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.3);
    src.start();
  } catch(e) { /* music not critical */ }
}
// 场景触发：manual 模式下拦截（不切走用户手动选的歌）
export function playMusic(name) {
  if (md() && !md().shouldPlayAuto(name)) return;
  _play(name);
}
// 用户手动选曲：锁定 manual + 立即播放
export function playManualTrack(name) {
  if (md()) md().playManual(name);
  _play(name);
}
// 恢复跟随场景：立即按最近场景曲播放
export function followScene() {
  if (md()) md().followScene();
  const t = md() ? md().lastSceneTrack() : null;
  if (t) _play(t);
}
export function toggleMusic() {
  musicEnabled = !musicEnabled;
  try { localStorage.setItem('music_enabled', musicEnabled ? '1' : '0'); } catch(e){}
  const el = document.getElementById('musicToggle');
  if (el) el.textContent = musicEnabled ? '🎵' : '🔕';
  if (musicEnabled) {
    if (currentTrack && !musicSrc) playMusic(currentTrack);
  } else {
    if (musicSrc) { try { musicSrc.stop(); } catch(e){} musicSrc = null; }
  }
}

// 背景曲循环（首页右上角 ⏭ 切换可选曲目）
export const BG_TRACKS = ['hub','control_room','console','workshop','edge_cabinet','cloud_platform','big_screen','data_pipe','ai_lab','cafe_light','night_shift','rush_hour','calm_factory'];
export let bgIdx = 0;
export function nextMusic() {
  const avail = BG_TRACKS.filter(t => window.MUSIC_SONGS && window.MUSIC_SONGS[t]);
  if (!avail.length) return;
  let i = avail.indexOf(currentTrack);
  if (i < 0) i = bgIdx % avail.length;
  i = (i + 1) % avail.length;
  bgIdx = i;
  const t = avail[i];
  playManualTrack(t);
  window.showToast('🎵 背景曲：' + t, 'info');
}


export function playSound(type, opt) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    switch (type) {
      case 'success': {
        [523, 659, 784].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.08);
          g.gain.setValueAtTime(0.2, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
          o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.2);
        });
        break;
      }
      case 'error': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(180, now);
        o.frequency.linearRampToValueAtTime(80, now + 0.25);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        o.start(now); o.stop(now + 0.3);
        break;
      }
      case 'click': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(900, now);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        o.start(now); o.stop(now + 0.04);
        break;
      }
      case 'type': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(400 + Math.random() * 300, now);
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        o.start(now); o.stop(now + 0.03);
        break;
      }
      case 'levelup': {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.12);
          g.gain.setValueAtTime(0.25, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.4);
          o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.4);
        });
        break;
      }
      case 'boot': {
        // rapid boot sequence sounds
        for (let i = 0; i < 8; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square';
          o.frequency.setValueAtTime(100 + i * 30, now + i * 0.05);
          g.gain.setValueAtTime(0.02, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.04);
          o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.04);
        }
        break;
      }
      case 'fanfare': {
        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + i * 0.1);
          g.gain.setValueAtTime(0.22, now + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.35);
          o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.35);
        });
        break;
      }
      case 'fail': {
        [392, 330, 262, 196].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.15);
          g.gain.setValueAtTime(0.18, now + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.3);
          o.start(now + i * 0.15); o.stop(now + i * 0.15 + 0.3);
        });
        break;
      }
      case 'alarm': {
        for (let i = 0; i < 6; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square';
          o.frequency.setValueAtTime((i % 2 === 0) ? 660 : 550, now + i * 0.12);
          g.gain.setValueAtTime(0.07, now + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.1);
          o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.11);
        }
        break;
      }
      case 'tick': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.setValueAtTime(1200, now);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        o.start(now); o.stop(now + 0.05);
        break;
      }
      case 'combo': {
        const lv = Math.min(Math.max(parseInt(opt) || 1, 1), 20);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(500 + lv * 40, now);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        o.start(now); o.stop(now + 0.12);
        break;
      }
      case 'shoot': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.setValueAtTime(340, now);
        o.frequency.linearRampToValueAtTime(220, now + 0.05);
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        o.start(now); o.stop(now + 0.07);
        break;
      }
      case 'hit': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(260, now);
        o.frequency.linearRampToValueAtTime(180, now + 0.08);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        o.start(now); o.stop(now + 0.1);
        break;
      }
      case 'pickup': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(880, now);
        o.frequency.linearRampToValueAtTime(1320, now + 0.1);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        o.start(now); o.stop(now + 0.18);
        break;
      }
      case 'toggle': {
        [440, 660].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.05);
          g.gain.setValueAtTime(0.1, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.08);
          o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.08);
        });
        break;
      }
    }
  } catch(e) { /* audio not critical */ }
}

// =========================================================================
// 2b. TYPEWRITER EFFECT
// =========================================================================
// 供 app.js init 调用的便捷入口
export function loadMusicPref(){ try{ if (localStorage.getItem('music_enabled') === '0') musicEnabled = false; } catch(e){}
  // manual 模式：跨页恢复用户手动选的曲（预置 currentTrack，供 ensureMusicPlayback 播放）
  const d = md(); if (d) { const rt = d.manualTrackToRestore(); if (rt) currentTrack = rt; }
}
export function ensureMusicPlayback(){ if (musicEnabled && currentTrack && !musicSrc) playManualTrack(currentTrack); }
