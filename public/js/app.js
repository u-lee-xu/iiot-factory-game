// ═══════════════════════════════════════════════════════════════════════
// 学生端主业务（原 student.html 主 script 迁出）
// ES Module：见 docs/架构设计.md
// ═══════════════════════════════════════════════════════════════════════
// BLOCK INDEX
// ═══════════════════════════════════════════════════════════════════════
//  547: 1. CONFIG & STATE       — API 封装、全局变量、session
//  673: 2. SOUND SYSTEM         — AudioContext、toggleSound、playSound
//  695: 3. ANIMATION            — typewrite 打字机效果、frame 动画
//  817: 4. TEACH TEXT           — generateTeach() 厂长教学文案生成
//  820: 5. DIRECTOR BOX         — addDirectorBox() 厂长气泡+折叠
//  855: 6. UI FX                — shakeScreen()、glowCorrect()
//  872: 7. INTERACT REGISTRY    — registerInteraction()、getInteraction()
//  921: 8. XP & PROGRESS        — getLevelTasks、taskXP、calcTotalXP、rank
// 1010: 9. FACTORY RENDER       — renderFactory() 绘制关卡网格
// 1065: 10. LEVEL & MISSION     — selectLevel()、renderMission()
// 1134: 11. TASK MODAL          — openTaskModal()、closeModal()、completeTask()
// 1194: 12. interact: terminal  — 交互式终端模拟
// 1481: 13. interact: quiz      — 选择题
// 1537: 14. interact: chain_quiz — 连环答题
// 1617: 15. interact: fill_blank — 填空选择
// 1664: 16. interact: progress_bar — 安装进度条
// 1715: 17. interact: install_wizard — 安装向导
// 1981: 18. interact: scenario_match — 场景匹配
// 2056: 19. interact: sort — 拖拽排序
// 2144: 20. interact: code_review — 代码审查
// 2198: 21. interact: ethics — 伦理决策
// 2245: 22. interact: diagnosis_tree — 诊断树
// 2301: 23. interact: drag_classify — 拖拽分类
// 2406: 24. interact: boss_fight — Boss 战
// 2511: 25. interact: config_debug — 配置排障
// 2634: 26. interact: log_forensics — 日志溯源
// 2750: 27. interact: default — 兜底渲染
// 2768: 28. COMMON UI — renderHeader、showToast、logout、checkLevelUp
// ═══════════════════════════════════════════════════════════════════════

// =========================================================================
// 1. CONFIG & STATE
// =========================================================================
const API = location.origin;

// 学生密码开关（临时暂停，先测翻牌）
const PASSWORD_ENABLED = true;
const token = sessionStorage.getItem('token');
const role = sessionStorage.getItem('role');
const myName = sessionStorage.getItem('name');

if (!token || role !== 'student') { location.href = 'index.html'; }

const RANKS = [
  { min: 0, title: '实习生', emoji: '🔰' },
  { min: 1000, title: '学徒', emoji: '🔧' },
  { min: 2500, title: '技工', emoji: '⚙️' },
  { min: 4500, title: '工程师', emoji: '🛠️' },
  { min: 7000, title: '专家', emoji: '🏆' }
];

let content = null;       // game content from API
let gameState = { check: {}, stars: {}, achievements: {}, teacherAwards: {}, hasPassword: false, newlyAwardedLogin: [] };
// 交互统计变量（部分交互复用同一组计数，需全局兜底，避免 ReferenceError）
let errors = 0;
let streak = 0;
let leaderboardCache = null;
let achQueue = [];
let lbTab = 'rank';
let currentLevelId = 1;
let currentTaskId = null;
let soundEnabled = true;
let audioCtx = null;

// =========================================================================
// 2a. AUDIO SYSTEM (Web Audio API, no external files)
// =========================================================================
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
}

// =========================================================================
// =========================================================================
// 2b. 8-BIT BACKGROUND MUSIC（ZzFXM 渲染成 AudioBuffer 循环播放，按场景切换）
// =========================================================================
let musicEnabled = true;
let currentTrack = null;
let musicGainNode = null;
let musicSrc = null;

function getMusicSong(name) {
  if (window.MUSIC_SONGS && window.MUSIC_SONGS[name]) return window.MUSIC_SONGS[name];
  return (window.MUSIC_SONGS && window.MUSIC_SONGS.hub) || null;
}
function playMusic(name) {
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
function toggleMusic() {
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
const BG_TRACKS = ['hub','control_room','console','workshop','edge_cabinet','cloud_platform','big_screen','data_pipe','ai_lab','cafe_light','night_shift','rush_hour','calm_factory'];
let bgIdx = 0;
function nextMusic() {
  const avail = BG_TRACKS.filter(t => window.MUSIC_SONGS && window.MUSIC_SONGS[t]);
  if (!avail.length) return;
  let i = avail.indexOf(currentTrack);
  if (i < 0) i = bgIdx % avail.length;
  i = (i + 1) % avail.length;
  bgIdx = i;
  const t = avail[i];
  playMusic(t);
  showToast('🎵 背景曲：' + t, 'info');
}
// ===== 区域(幕)背景音乐 & 按幕选小游戏配乐 =====
let currentAreaKey = 'hub';
function setArea(lvId) {
  const lv = content && content.levels.find(l => l.id === lvId);
  currentAreaKey = (lv && lv.factoryArea) || 'hub';
}
function playAreaMusic() { playMusic(currentAreaKey || 'hub'); }
// 按「幕 + 游戏类型」选小游戏配乐，缺省降级：类型_幕 → 类型 → match
function gameSong(type) {
  const k = type + '_L' + currentLevelId;
  if (window.MUSIC_SONGS && window.MUSIC_SONGS[k]) return k;
  // 新玩法默认配曲（可覆盖）
  const MAP = { sorter:'alarm', forge:'boss', ll:'match', pipe:'console', m3:'quick', td:'alarm', t48:'quick', maze:'workshop', hack:'console', tyc:'workshop', lzr:'match', boss:'boss' };
  const mapped = MAP[type];
  if (mapped && window.MUSIC_SONGS && window.MUSIC_SONGS[mapped]) return mapped;
  const fb = type === 'memory' ? 'match' : type;
  if (window.MUSIC_SONGS && window.MUSIC_SONGS[fb]) return fb;
  return 'match';
}

function playSound(type, opt) {
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
function typewrite(el, text, speed, cb) {
  let idx = 0;
  el.textContent = '';
  function frame() {
    const end = Math.min(idx + 2, text.length);
    while (idx < end) {
      el.textContent += text[idx];
      if (text[idx] !== ' ') playSound('type');
      idx++;
    }
    if (idx < text.length) {
      setTimeout(frame, speed || 30);
    } else {
      if (cb) cb();
    }
  }
  frame();
}

// =========================================================================
// 2c. TEACH TEXT GENERATOR
// =========================================================================
function generateTeach(task) {
  const cfg = task.config;
  const cmd = cfg.command ? (Array.isArray(cfg.command) ? cfg.command[0] : cfg.command) : '';
  const explains = {
    '1-1': 'Ubuntu Server 不装图形界面，这不代表操作受限——你可以坐在服务器前接显示器键盘敲命令，也可以在另一台电脑甚至手机上用 SSH 远程登录。工控工程师经常晚上躺床上拿手机查服务器日志——跟你在 War3 地图上操作英雄没什么区别，只不过这次你的英雄是一台 Linux。记住 Shell 是 bash，装软件用 apt install，这些都是你后面每天都要用的基本操作。',
    '1-2': '输入 uname -a 查看系统完整信息。先记住 Linux 命令的**通用格式**：`命令名 [选项] [参数]`，各部分用空格隔开。比如 uname -a：uname 是命令名，-a 是选项（显示全部信息）。选项以 - 开头，可以有好几个、还能合并写（-la = -l -a）；长选项用两个短横（如 --help）。记住这个套路，后面所有命令都是它。',
    '1-3': '想搞清楚"我这台电脑在网络里是什么身份"，就用 ip addr。先补个基础：计算机里最小的信息单位叫"比特（bit）"，一个比特只能是 0 或 1。ip addr 的输出里你会看到三样东西：网卡（设备上网的接口，比如 ens33）、IP 地址（这台设备的门牌号，比如 192.168.1.100）、MAC 地址（出厂就烧录好的"身份证"，一个网卡一个号）。记住这三个，后面翻牌、排障都靠它们。',
    '1-3b': '先把 IP 这件事说透：IP 就是网络世界的「收货地址」，数据包靠它找到你的设备。记住你其实有好几个 IP——手机连家里 WiFi 拿到的 192.168.x.x 是「内网 IP」，由路由器自动分配，只在自家网络里有效，像小区门卫发的编号；真正上网时，运营商（宽带或手机流量）还会给你一个「公网 IP」，这才是互联网上全世界唯一的对外门牌号。而且这两个 IP 都是动态的：重启光猫/路由器、手机换个基站或者开一下飞行模式，IP 常常就变了。一句话记住：内网 IP 管「小区内」，公网 IP 管「全世界」，而且都不是固定的。',
    '1-4': 'IP 地址和子网掩码是成对出现的。先说最基础的概念：信息的最小单位叫"比特"（bit），一个比特只能是 0 或 1，8 个比特 = 1 字节。一个 IPv4 地址（如 192.168.1.100）一共 32 个比特，分成 4 组数字。那怎么区分"哪些位是网络号、哪些位是主机号"？靠子网掩码——它用 32 个比特里前面连续的 1 划出网络号（一个网段共有的部分），后面 0 划出主机号（区分网段内每台设备）。255.255.255.0 就是 24 个 1 接 8 个 0，简写为 /24（这叫 CIDR 记法）。一个 /24 子网有 256 个地址，去掉网络地址和广播地址，实际可用 254 台。再记两个词：IPv4 总共只有约 43 亿个地址，早就分完，所以有了更长的 IPv6；NAT 则是让厂里很多设备共用一个公网 IP 上网的翻译官。',
    '1-5': 'OSI 七层模型从下到上：物理层（网线）、数据链路层（MAC/交换机）、网络层（IP/路由）、传输层（TCP 可靠/UDP 快速）、会话层、表示层、应用层（HTTP）。传输层两个协议记清楚：TCP 先握手再传、不丢包，适合文件传输；UDP 发出去就不管、快但有风险，视频通话和传感器高频数据常用它。理解了七层，你就能准确定位网络问题出在哪一层。',
    '1-6': '0.0.0.0 是设备出厂状态——网卡还没有被分配有效的 IP 地址。这就好比新员工还没领工牌，别人不知道你叫啥号。拿到有效 IP 之前，设备对外通信全是这个占位状态。',
    '1-7': '输入 ping -c 4 192.168.1.1——ping 发包测连通性，-c 4 控制只发 4 个。看回复率：0% 丢包线路健康，有丢包就得排查。',
    '1-8': 'ping 不通网关，按流程来：先查网线（ip link），再查本地协议栈——ping 127.0.0.1，这个 127.0.0.1 叫"回环地址"，永远代表设备自己，它通了说明本机网络协议栈没问题；然后再查路由表（ip route），路由表就是设备里"去哪个网络走哪条路"的说明书，看看有没有通往网关的默认路由。一步步排除，找到根因。',
    '1-9': 'traceroute 空格 网址（Windows 系统里这个命令叫 tracert，其实两者是同一个东西，只是平台叫法不同），它会列出数据从你电脑到目标之间经过的每一个路由器（跳）。每跳的延迟能定位瓶颈——5 跳正常，超过 15 跳说明路由绕路了。',
    '1-10': '输入 nslookup 域名，查域名对应的 IP 地址——类似数字电话本。nslookup www.baidu.com 返回百度服务器 IP。反过来从 IP 查域名叫反向解析。',
    '1-11': 'DNS 就是互联网电话本——你把 www.baidu.com 敲进去，DNS 服务器返回一个 IP 地址。域名变 IP 的过程叫"正向解析"（也就是日常说的域名解析）；反过来从 IP 地址查它对应什么域名，叫"反向解析"。两个方向别搞混。',
    '1-12': 'iptables 是 Linux 防火墙，通过规则控制数据进出。入站=外部到本机，出站=本机到外部。禁止 ping 就是加一条入站规则丢弃 ICMP 请求。',
    '1-13': '每台机器上同时跑着多种服务，全靠端口号区分，就像一栋大楼里每个公司有自己门牌号。记住这几个常用端口：SSH 远程管理用 22，网页服务 HTTP 用 80、HTTPS 用 443，DNS 域名解析用 53。看到端口就知道是哪个服务在干活，排故障时第一个念头就是"这个服务的端口通不通？"。',
    '1-14': '三种常见攻击：DDoS 用海量请求塞满带宽，ARP 欺骗伪造 MAC 截获通信，端口扫描逐个试探找突破口。知己知彼才能防住。',
    '1-hidden-0': 'traceroute 跟 IP 地址能看路由路径每一跳——加 -n 参数跳过域名解析更快。用每一跳的 IP 还能反查地理位置，知道数据都经过了哪些城市的节点。',
    '1-hidden-1': 'iptables 规则从上到下逐条匹配。先看 -A 加在哪个链：INPUT=入站（从外面进来的数据）、OUTPUT=出站（本机发出去的数据）、FORWARD=转发。再看 -p 协议、--dport 目标端口，最后 -j 动作（ACCEPT 放行 / DROP 丢弃）。这三条是：① 丢弃进来的 ping（禁 ping）→ ② 放行进来的 22 端口（开 SSH）→ ③ 其余进来的全丢弃。读规则就按这个逻辑一行行串。',
    '2-0': '输入 sudo apt install openssh-server 安装 SSH 服务。装好后要配置好系统服务——控制服务用 systemctl：sudo systemctl status ssh 看状态、sudo systemctl start ssh 启动、sudo systemctl enable ssh 设为开机自启（重启后自动运行）。再记一个数：SSH 默认走 22 端口，后面远程连接、安全组放行都靠它。装好配置好，就能从任何设备远程登录这台机器了——远程运维的基础。 但默认 22 端口最容易被扫描爆破，生产环境建议改成不常见的端口（比如 26200），再配合密钥登录更安心。',
    '2-1': 'SSH 登录格式是 ssh 用户名@IP地址。比如 ssh root@192.168.1.100。第一次连接会提示确认主机指纹，输入 yes 继续，然后输入密码就登上了。远程管理全靠这条命令。',
    '2-2': '输入 ls -la /home 查看目录所有文件。套用命令格式 `命令名 [选项] [参数]`：ls 是命令名，-la 是选项、/home 是目标参数。选项 -l 显示权限和大小（长格式）、-a 显示隐藏文件，**两个短选项合并写成 -la**（等于 -l -a）。权限如 drwxr-xr-x：d=目录，r=读，w=写，x=运行。 想随时确认自己当前在哪个目录，就用 pwd（打印工作目录），它会直接输出当前路径。',
    '2-3': 'curl 是命令行里的 HTTP 工具，相当于文字版浏览器——后面跟网站名就能访问它。ip.sb 是一个「公网 IP 查询网站」（国内可直接访问），收到请求就把你的公网 IP 返回来；myip.ipip.net 还能显示归属地。国外同类有 ifconfig.me、ifconfig.co 等，但国内访问可能慢或不通，教学优先用国内的。命令里 http:// 和 www 写不写都行（curl 会自动补全）。如果没返回，说明这台机器没有公网出口——内网设备这样很正常。',
    '2-4': '云服务器是工控系统的远程大脑。注册云服务商账号后，需要选择配置（CPU/内存/带宽）、设置密码、启动实例。有了云服务器，你的数据就能在任何地方访问了。',
    '2-5': '安全组是云服务器的防火墙，控制哪些端口对外部开放。SSH 使用 22 端口，所以要在安全组中添加入站规则放行 TCP 22，才能从外部 SSH 登录到服务器。',
    '2-6': '工业互联网的时延要求是毫秒，消费互联网秒级已经够了。更关键的是，工业网络连的是硬件设备，要考虑高温震动电磁干扰；消费网络连的是人拿手机上网。归根结底是连接的东西不同，要求也完全不同。',
    '2-hidden': 'SSH 免密登录通过密钥对实现：你在本地生成一对密钥（公钥+私钥），把公钥复制到服务器 ~/.ssh/authorized_keys 里，之后 SSH 登录就用密钥认证替代密码了。',
    '4-0': 'Node-RED 的 Function 节点用来写 JavaScript 代码处理数据。msg.payload 是消息的核心数据。这段代码模拟传感器：温度在 25-85℃ 之间随机，振动在 0-1.5 之间随机。',
    '4-1': 'Node-RED 中做条件判断用 Switch 节点。和编程语言的 switch/case 类似，你可以配置多条规则：温度 > 80 走报警分支，<= 80 走正常分支。',
    '4-2': '传感器报数会抖——比如温度 25、26、27、80、26…，那个 80 是异常毛刺。滑动均值就是「只看最近 10 个数，算个平均」：先有缓存 → 新数据来了塞进去 → 超过 10 个就把最旧那个挤掉（保持“最近 10 个”，这就是“滑动”）→ 攒满 10 个就算平均 → 输出平均值。这样输出平滑、还省流量。',
    '4-3': '边缘计算四大驱动力：省带宽（数据本地处理减少上传）、快响应（毫秒级本地决策）、稳运行（断网不影响本地控制）、密防护（敏感数据不出厂区）。',
    '4-4': '滑动均值滤波后数据量大幅减少：原始每秒 1 个采样，10 个取均值后每秒只传 0.1 个——数据量只剩原来的 1/10，减少约 90%。网络压力小多了，厂长很满意。',
    '4-5': 'OpenPLC 是一个开源软 PLC，可以在普通电脑上运行 PLC 程序。和硬 PLC 相比，它成本低、灵活高，适合学习和原型验证。编译安装后通过浏览器访问 Web 界面进行编程。',
    '4-6': '软PLC用软件模拟所有PLC功能，成本低可定制，比硬PLC灵活太多。但硬PLC有独立电路和硬实时OS，带有严格安全认证——出了故障不会因为软件崩掉反应不过来。在生命安全的场景下必须靠哪个？',
    '4-hidden': '全量数据每分钟约 60 条，筛选后每分钟约 9 条。运行 2 分钟，全量约 120 条，筛选后约 18 条。这就是边缘计算的威力——少传数据，不丢信息。',
    '5-0': 'Docker 是当前最流行的容器化技术。它把应用和依赖打包成一个标准单元，在任何 Linux 系统上都能一键运行。装 Docker 很简单，官方提供一键安装脚本。',
    '5-1': 'docker run hello-world 是 Docker 的入门命令。它会从 Docker Hub 下载 hello-world 镜像，创建容器并运行。看到 Hello from Docker 的欢迎信息，就说明 Docker 安装成功了。',
    '5-2': 'docker run -d --name mynginx -p 8080:80 nginx 命令用 Nginx 镜像启动一个 Web 服务器。-d 后台运行，--name 指定容器名，-p 8080:80 把主机的 8080 端口映射到容器的 80 端口。',
    '5-3': 'Docker 常用命令不多：docker ps 看运行中的容器，docker stop 停掉容器，docker rm 删除容器，docker pull 下载镜像。记住这四个就能上手了。',
    '5-4': '用 Docker 运行 Node-RED 可以避免与原生版本的端口冲突。Docker 版的 Node-RED 使用 1881 端口（区别于原生的 1880），这样两个版本可以同时运行对比。',
    '5-5': 'Docker 和虚拟机的核心区别：Docker 共享宿主机内核（轻量），虚拟机有独立内核（重量）。所以 Docker 启动秒级、磁盘 MB 级；虚拟机启动分钟级、磁盘 GB 级。',
    '5-6': 'Docker 容器删了就全没了——这是设计哲学不是bug。想让数据活过容器生命周期，得用Docker提供的数据卷挂载——宿主机上留一块独立区域，容器重启数据还在。',
    '5-hidden': '同时运行原生 Node-RED 和 Docker 版 Node-RED，对比它们的安装方式、隔离性、数据持久化。这是理解 Docker 价值的最佳实践。',
    '6-0': 'Node-RED Dashboard 是一个插件，在 Node-RED 的节点管理面板中搜索安装即可。装好后你会看到 ui 开头的 Dashboard 节点——Gauge（仪表盘）、Chart（趋势图）、Notification（报警通知）等。',
    '6-1': '工控大屏的三条黄金原则：一目了然（操作员 3 秒读懂当前状态）、重点突出（只显示关键指标，不堆砌数据）、可操作（发现报警后能直接操作，不是只能看）。',
    '6-2': 'Dashboard 的层级结构：Tab（页面标签）→ Group（卡片组）→ Widget（仪表盘组件）。一个 Tab 可以包含多个 Group，一个 Group 可以包含多个 Widget。',
    '6-3': 'Gauge 仪表盘的颜色分段用来表示状态：绿色=正常，黄色=预警，红色=报警。配置阈值后，指针指到不同区域会自动变色，操作员一眼就能看出设备状态。',
    '6-4': 'Chart 趋势图可以显示多条曲线。用 topic 字段来区分不同的数据源——温度数据设置 topic 为 "温度"，振动数据设置 topic 为 "振动"，图表会自动用不同颜色绘制两条曲线。',
    '6-5': 'Notification 不弹窗？先查 Switch 阈值有没有触发——数据值 85℃ 超过阈值 80℃，应该触发。触发了还没弹窗？查 Notification 节点的 level 级别，可能级别太低被忽略了。',
    '6-6': '工控看板设计有三个原则：看一眼就知道情况、只展示重要信息、点一下能做动作。这三条相辅相成，没有哪个次要——缺少任意一条看板就不好用了。',
    '6-hidden': '三屏联动是指把温度、振动、报警三个维度的数据显示在同一个 Dashboard 上。当温度异常时振动往往也会变化，三屏同时展示能让操作员看到数据的关联性。',
    '7-0': 'Mosquitto 是开源的 MQTT Broker（消息代理），负责接收和转发设备消息。在 Ubuntu 上 apt install mosquitto 就能安装。MQTT 是工业物联网中最主流的消息协议。',
    '7-1': 'mosquitto_sub 是 MQTT 的订阅命令。mosquitto_sub -h localhost -t factory/temp 订阅本地 Broker 上 factory/temp 主题的消息。有设备发布消息到这个主题，你这里就会收到。',
    '7-2': 'MQTT 主题支持通配符：+ 匹配一级（factory/+/temp 匹配任意车间温度），# 匹配多层（factory/# 匹配 factory 下所有主题）。精确主题如 factory/workshop1/temp 只匹配特定设备。',
    '7-3': '工业大数据有 4V 特征：Velocity（速度快——每秒上千采样）、Volume（数据量大——每天 500GB）、Variety（类型多——波形/频谱/图像混合）、Value（价值密度低——大量数据中只有少量有价值信号）。',
    '7-4': '完整 MQTT 链路：传感器模拟(Inject+Function) 产生数据 → MQTT 发布节点 发到 Broker → Mosquitto Broker 中转 → MQTT 订阅节点 接收 → Dashboard 显示。数据从设备到屏幕的完整旅程。',
    '7-5': 'MQTT 订阅者离线期间 Broker 不会攒数据等它回来——中间这段丢了就丢了，这是发布订阅模式天生特性。除非把 Broker 配置为持久会话。',
    '7-6': 'Modbus 是主站发问从站回答，一问一答不能乱；MQTT 是发布者-订阅者模式，设备数据发到Broker所有订阅者同时收。工控几十台设备轮询 vs 工业级上千台设备组网，选哪个？',
    '7-hidden': 'LWT（Last Will Testament，遗嘱消息）是 MQTT 的特性。设备离线时 Broker 代它发一条消息通知其他设备「我离线了」。在工业场景中，及时发现设备掉线至关重要。',
    '8-0': 'AI 编程工具正在改变工业软件开发方式。选择一款合适的 AI 工具（如 GitHub Copilot 或通义灵码），能帮你自动生成代码、解释报错、优化算法。',
    '8-1': '5G 的三大工业场景：eMBB（增强移动宽带——适合高清视频质检）、uRLLC（超低时延高可靠——适合远程控制起重机）、mMTC（海量机器通信——适合上千个传感器同时上报）。',
    '8-2': '工业 AI 的三种形态：视觉检测（用摄像头识别产品缺陷）、预测性维护（从振动数据预测轴承剩余寿命）、过程优化（通过数据分析找到最优工艺参数）。',
    '8-3': '数字孪生三级进化：以虚映实（镜像映射——实时同步设备数据）、以虚控实（远程控制——在数字世界操纵物理设备）、以虚优实（优化仿真——用 AI 模拟找出最优方案）。',
    '8-4': 'MQTT 代码常见错误：connect 成功后要处理 error 事件和 close 事件，否则连接异常断开时程序会崩溃。代码里只监听了 connect 事件，没有错误处理，这是生产环境的大忌。',
    '8-5': 'AI 预测置信度 65%——不算高但也不算低。立即停机损失 50 万，赌错了是误判；不停机可能损失 500 万，赌对了省一笔。降负荷运行 24 小时再观察是折中的合理选择。',
    '8-6': 'AI 在工厂里能做分析预警建议，但最终拍板环节必须有人。不只是安全，还有合规——工厂出事故第一责任人是工程师。AI 给你建议你来做决定，这才是工业 AI 的正确打开方式。',
    '8-hidden': '同学抄了你的代码，你怎么处理？直接举报伤害关系，默不作声纵容错误，说是一起合作不诚实。私下跟同学说这样不对，既坚持了原则又给对方留了改过的机会。',
    '2-7': '输入 ssh student@192.168.1.100。格式：ssh 用户名@IP。第一次连接会提示确认指纹——输入 yes，然后回车继续。远程登录的具体操作。',
    '2-8': 'SSH 免密登录用非对称加密——私钥存客户端，公钥存服务器。客户端的公钥就放在服务器的 ~/.ssh/authorized_keys 这个文件里（一行一个公钥）。连接时服务器读出 authorized_keys 验证你的身份，两边匹配就直接放行。要让某台机器免密登进来，就把那台机器的公钥追加进这个文件。',
    '3-7': 'Modbus TCP 读取数据用 modbus read 命令，参数依次是 IP 地址、端口号、寄存器地址。Holding Register 是最常用的寄存器类型，存储传感器当前值。',
    '3-8': 'ISA-95 标准的 L3 执行层（MES）负责生产调度与执行——安排生产计划、跟踪工单进度、管理物料。L2 监控层（SCADA）负责实时监控，L4 管理层（ERP）负责企业资源规划。',
    '4-7': 'systemctl 是 Linux 管理服务的命令。systemctl status edge-service 查看边缘服务的运行状态——是否 active、运行了多久、占多少内存。排查服务问题时第一个就用它。',
    '4-8': '数据在设备旁边直接算叫边缘计算，几百公里外算叫云计算。前者延迟低响应快，后者算力强存量大。哪些任务等不起几毫秒延迟，必须就地处理？ 工业互联网常用『云-边-端』三层架构：云端集中存储和大数据分析，终端（传感器/PLC）负责采集，边缘就在设备旁边就近计算、毫秒级响应。边缘计算说的就是中间这层——数据就地处理，不过度依赖云端。',
    '5-7': 'docker ps 查看正在运行的容器列表。显示容器 ID、使用的镜像、启动命令、创建时间、状态、端口映射、容器名。docker ps -a 还能看到已经停止的容器。',
    '5-8': 'Docker 网络模式有几种：none 无网，host 共用宿主共享IP，bridge 每个容器通过虚拟网桥独立通信。不带任何参数跑起来，默认就是其中一种——隔离性刚刚好的那种。',
    '6-7': 'curl 可以获取网页源码。curl -s http://localhost:1880/ui/dashboard 获取 Dashboard 页面的 HTML，通过管道 | head -20 只显示前 20 行，快速确认服务是否在运行。',
    '6-8': '常规的仪表盘每隔几秒刷新一次页面，过程中数据空洞。Node-RED 用 WebSocket 技术，服务端一有变化立刻主动推送到浏览器，数据是连续流动的。',
    '7-7': 'mosquitto_pub 是 MQTT 发布命令。mosquitto_pub -h localhost -t factory/temp -m 75.3 向本地 Broker 的 factory/temp 主题发布温度 75.3。订阅了这个主题的客户端会立即收到。',
    '7-8': 'MQTT 有 3 级服务质量：QoS 0 发一次拉倒（可能丢），QoS 1 至少发一次（可能重复），QoS 2 保证到达且只到达一次。核心区别在于对待丢包和重复的处理策略。',
    '8-7': 'AI 模型通过 REST API 提供推理服务。用 curl 发送 POST 请求，把传感器数据（振动、温度）以 JSON 格式发给模型，返回预测结果（剩余寿命、置信度）。这是工业 AI 的典型调用方式。',
    '8-8': '数字孪生三级形态：以虚映实（数据镜像同步）、以虚控实（远程操作设备）、以虚优实（AI 仿真优化）。最高级形态是以虚优实——在数字世界中模拟优化，然后把最优方案应用到物理世界。',
    '2-9': 'SSH 连接超时的排障思路：先 ping 看 IP 通不通，通的话检查 22 端口是否开放，不开的话检查 SSH 服务状态，没运行就启动它。端口改了就用 -p 参数。',
    '2-10': 'SSH 端口转发是高级功能：-L 本地转发（把本地端口映射到远程）、-R 远程转发（把远程端口映射到本地）、-D 动态转发（SOCKS 代理）。',
    '2-11': 'SSH 安全加固有三板斧：不要用默认端口、不要用 root 登、不要只用密码。其中有一项直接把安全风险最大的账号关了，最立竿见影。',
    '2-hidden-2': 'SSH 入侵取证三步走：查 /var/log/auth.log 看登录记录、查 authorized_keys 有没有陌生公钥、查 last 看异常登录时间。',
    '3-0': '先讲个故事：远古时人类语言统一，想合力建一座通天塔，上帝变乱了他们的语言，工人各说各话、建不成塔——这就是「巴别塔」，从此成了"语言不通、沟通混乱"的代名词。咱们车间也一样：七种设备至少用着四种协议（FANUC 私有、西门子 ProfiNet、ABB、倍福 EtherCAT、Modbus），各说各话。要解决设备"语言不通"，得靠协议转换网关（配翻译）或通用中间层（OPC UA）。理解了这个，再看 ISA-95 五层地图就更清楚了。',
    '3-1': 'ISA-95 五层从下到上：L0 现场设备层（传感器/执行器，采集数据）、L1 控制层（PLC 做逻辑控制）、L2 监控层（SCADA 看整条产线）、L3 制造运营层（MES 管订单进度）、L4 业务层（ERP 管财务采购）。一句话：设备采集→控制指挥→监控全局→运营订单→业务公司。',
    '3-2': 'Node-RED 是低代码「翻译台」——把设备数据用拖拽节点连成数据流。装它用官方一键脚本（来源要正），Web 界面跑在 1880 端口，要连 Modbus 设备就装 node-red-contrib-modbus 节点包。',
    '3-3': 'ProfiNet 是西门子的工业以太网协议，毫秒级实时。记得那句：紫色线 Profibus 是老款、绿色工业网线 ProfiNet 是新款，都是西门子家的。',
    '3-4': '协议各有个性：ProfiNet=西门子毫秒实时，EtherCAT=倍福快到极致（飞读飞写），CC-Link IE=三菱环形冗余断线不断，Modbus=最老最开放变频仪表都支持，Powerlink=贝加莱标准硬件，EtherNet/IP=罗克韦尔基于以太网。 DNP3=电力行业远动协议，电网/配电站远程监控都在用。',
    '3-5': 'Modbus 用寄存器组织数据，四种：线圈（1 位可读写，开关状态）、离散输入（1 位只读，限位开关）、保持寄存器（16 位可读写，设定值）、输入寄存器（16 位只读，测量值）。口诀：保持=设定值、输入=测量值、线圈=开关可写、离散=开关只读。',
    '3-6': 'Modbus 通信故障排查按顺序来：网线（ip link）→ ping 从站 IP → 端口（ss -tln，如 502）→ 从站 ID / 寄存器地址 → 防火墙。一步步排除，别跳步骤。',
    '3-hidden': 'QModMaster 是外部调试工具，直连 Modbus 从站验证读写。连接时填从站的 IP 地址和端口，能读到数据就说明从站和配置都对。',

    '3-9': 'Modbus 通信中断的排障流程：先确认 Server 运行，再检查端口号是否匹配，最后查防火墙有没有阻挡。一步一步来，别跳步骤。',
    '3-10': '工业协议各有千秋：ModbusTCP 简单通用适合大多数场景，ProfiNet 实时性高适合西门子生态，EtherCAT 纳秒级同步适合运动控制。',
    '3-11': 'PLC 梯形图中，两个触点串联代表与逻辑（AND），两个触点并联代表或逻辑（OR）。串联的触点必须全部接通才有输出。',
    '4-9': '网络流量突然飙升通常是某个设备异常导致。先定位哪个设备的数据量异常，然后分析原因——可能是采样频率配置错误，也可能是设备故障产生噪音数据。 压住异常尖峰、给流量瘦身有三招：降采样（只保留一部分采样，流量减半但可能漏关键）、丢弃异常（直接扔异常数据，最省流量但可能误伤关键）、阈值截断（超限就截断/报警，压住毛刺）。',
    '4-10': '边缘计算的三层架构：感知层负责数据采集，计算层负责本地处理，网络层负责上传结果到云端。每层各司其职、协同工作。',
    '4-11': '报警阈值设置的原则：正常范围下限到 80% 左右设预警，超过上限设报警。温度范围 0-80℃，65℃ 预警提示关注，80℃ 报警立即处置。',
    '5-9': 'Docker 容器集体宕机的处理流程：先查 Docker 守护进程，再查资源占用，清理不用的容器和镜像释放空间。docker system prune 一键清理。',
    '5-10': 'Docker Compose 用 YAML 文件定义多个容器的启动配置，默认文件名为 docker-compose.yml。一条 docker-compose up 就能启动整个服务栈。',
    '5-11': '减小镜像体积最常规的办法——把基础层换成 Alpine。Alpine 只有5MB，极致精简。另外编译阶段只保留最终产物，俗称多阶段构建。',
    '6-9': '监控大屏黑屏的排查步骤：先查 Node-RED 是否运行，再看 Flow 是否已部署，然后确认 WebSocket 连接有没有断开。加看门狗确保长期稳定。',
    '6-10': '监控大屏的颜色心理学：红色=危险/报警（紧急处置），黄色=预警/注意（提前干预），绿色=正常/安全（无需操作）。一目了然。',
    '6-11': '多屏联动的架构设计：车间屏实时设备数据（秒级），中控室屏综合概览（分钟级），厂长屏 KPI 报表（小时/天级）。信息分层呈现。',
    '7-9': 'MQTT 消息链路的故障排查：先检查 Broker 是否运行，再检查发布端是否正常，最后用心跳主题监控链路健康。防止消息黑洞。',
    '7-10': 'MQTT 主题命名建议用 / 分隔层级，如 factory/workshop1/temp。第一级厂区、第二级车间、第三级数据类型——清晰可扩展。',
    '7-11': 'MQTT 安全三要素：传输层加密（TLS/SSL 防窃听）、身份认证（用户名+密码防未授权）、消息签名（防数据篡改）。缺一不可。',
    '8-9': 'AI 模型漂移是输入数据分布变化导致准确率下降。解决办法：监控置信度、用新数据增量训练、建立自动重训练 Pipeline。',
    '8-10': 'AI 预测和人工检查矛盾时，降负荷运行+第三方检测最稳妥。不盲目信 AI，也不完全否定——折中策略降低风险。',
    '8-11': '工业元宇宙：AR 远程维修让专家不用到现场，数字孪生仿真投产前验证优化，区块链溯源确保产品全生命周期可追溯。这是工业互联网的终极愿景。'
  };
  if (explains[task.id]) return explains[task.id];
  // Fallback: generate from task config
  if (task.type === 'terminal') return `厂长等着你用 ${cmd} 处理问题——${cfg.prompt || '根据上面的任务提示，输入正确命令。'}`;
  if (task.type === 'quiz') return `厂长突然问：「${cfg.question}」——他在考你，车间那边就等着这个答案。`;
  if (task.type === 'fill_blank') return `厂长在终端上圈了一个位置：「把这个补齐，别填错了。」`;
  return `厂长把这个任务交给你了。机器不会等——赶紧处理。`;
}

// =========================================================================
// 2d. DIRECTOR DIALOGUE
// =========================================================================

// =========================================================================
// 2c. DIRECTOR MOOD SYSTEM (厂长情绪系统)
// =========================================================================
var directorMoodLines = {
  proud: [      // 😎 得意/赞赏 - 连续通过、0失误、解锁隐藏
    "漂亮！这波操作教科书级别",
    "不愧是我看好的人，稳！",
    "这手速、这准度，有前途",
    "厂里就缺你这种干实事的",
    "完美通过，工位升级已安排上"
  ],
  stern: [      // 😤 严肃/催促 - 连续报错、超时、用了hint还错
    "别急，先看清提示再输",
    "心静不下来，命令输不对",
    "车间设备不等人，重新来过",
    "基础不牢，地动山摇啊",
    "再仔细看一遍厂长说的"
  ],
  awkward: [    // 😅 尴尬/吐槽 - 输错关卡类型的命令、输无关命令
    "兄弟，这是装 SSH 的关卡不是查目录…",
    "命令输对了，但关卡搞错了呀",
    "你这是在给服务器按摩吗？",
    "厂长看着你乱输挺心累的",
    "建议先收起教学再动手"
  ],
  thinking: [   // 🤔 思考/提示 - 初次进关卡、收起教学后、请求hint
    "卡住了？看看上面的提示栏",
    "第一步通常是最关键的",
    "不用急，厂长给你留着灯",
    "回想一下上一关咋过的"
  ],
  neutral: [    // 默认/兜底
    "厂长把这个任务交给你了",
    "机器不会等——赶紧处理",
    "按部就班来，稳住"
  ]
};

function getRandomMoodLine(mood) {
  var pool = directorMoodLines[mood] || directorMoodLines.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getDirectorMood(task, context) {
  // context: { streak, errors, hintUsed, firstTime, wrongCmdType }
  if (!context) return 'neutral';
  
  // 优先级：尴尬(输错类型) > 严肃(连续错/用hint还错) > 得意(连胜/0失误) > 思考(初次/请求hint) > 中性
  if (context.wrongCmdType) return 'awkward';
  if (context.errors >= 2 || (context.hintUsed && context.errors >= 1)) return 'stern';
  if (context.streak >= 3 && context.errors === 0) return 'proud';
  if (context.firstTime || context.hintUsed) return 'thinking';
  return 'neutral';
}


function addDirectorBox(container, text, cb, mood) {
  const m = mood || 'neutral';
  const moodLine = getRandomMoodLine(m);
  const moodEmoji = { proud: '😎', stern: '😤', awkward: '😅', thinking: '🤔', neutral: '👨‍💼' }[m];
  
  const box = document.createElement('div');
  box.className = 'director-box director-mood-' + m;
  box.innerHTML = `
    <div class="director-portrait">${moodEmoji}</div>
    <div class="director-bubble">
      <div class="director-name">厂长</div>
      <div class="director-mood-line" style="font-size:13px;color:var(--accent);margin-bottom:4px;font-style:italic">${moodLine}</div>
      <div class="director-text"></div>
      <div style="margin-top:6px;font-size: 14px;color:var(--dim);cursor:pointer;display:none" class="teach-toggle">△ 收起教学</div>
    </div>
  `;
  container.prepend(box);
  const textEl = box.querySelector('.director-text');
  typewrite(textEl, String(text || '').replace(/^厂长[:：]\s*/, ''), 25, () => {
    const toggle = box.querySelector('.teach-toggle');
    if (toggle) {
      toggle.style.display = 'block';
      toggle.onclick = () => {
        const textEl2 = box.querySelector('.director-text');
        const nameEl = box.querySelector('.director-name');
        const moodLineEl = box.querySelector('.director-mood-line');
        const isHidden = textEl2.style.display === 'none';
        textEl2.style.display = isHidden ? '' : 'none';
        nameEl.style.display = isHidden ? '' : 'none';
        if (moodLineEl) moodLineEl.style.display = isHidden ? '' : 'none';
        toggle.textContent = isHidden ? '△ 收起教学' : '▽ 展开教学';
        toggle.style.marginTop = isHidden ? '6px' : '0';
      };
    }
    if (cb) cb();
  });
  return box;
}

// =========================================================================
// 2d. SCREEN EFFECTS
// =========================================================================
function shakeScreen() {
  const overlay = document.getElementById('modalOverlay');
  overlay.style.animation = 'none';
  overlay.offsetHeight;
  overlay.style.animation = 'shake 0.3s ease';
  playSound('error');
}

function glowCorrect(el) {
  el.classList.remove('glow-correct');
  el.offsetHeight;
  el.classList.add('glow-correct');
  playSound('success');
}

// =========================================================================
// 2. INTERACTION REGISTRY (plugin system)
// =========================================================================
const interactions = {};

function registerInteraction(type, handler) {
  interactions[type] = handler;
}

function getInteraction(type) {
  return interactions[type] || interactions['default'];
}

// =========================================================================
// 3. API HELPERS
// =========================================================================
async function api(path, options) {
  const headers = {'Content-Type':'application/json','Authorization':'Bearer '+token};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(API + path, { signal: controller.signal, headers: { ...headers, ...(options?.headers || {}) }, ...options });
    clearTimeout(timer);
    if (r.status === 401) { sessionStorage.clear(); location.href = 'index.html'; return null; }
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') showToast('请求超时', 'error');
    else if (!e.message?.includes('sessionStorage')) showToast('网络请求失败', 'error');
    return null;
  }
}

async function loadGameContent() {
  const result = await api('/api/game/content');
  if (result && result.ok) content = result.data;
}

// Knowledge tags lookup
window.KNOWLEDGE_TAGS = {};
async function loadKnowledgeTags() {
  try {
    const tagsRes = await fetch('/data/knowledge-tags.json');
    const tagsData = await tagsRes.json();
    tagsData.tags.forEach(t => { window.KNOWLEDGE_TAGS[t.id] = t; });
  } catch (e) {
    console.warn('Failed to load knowledge tags', e);
  }
}
loadKnowledgeTags();

// =========================================================================
// 4. STATE MANAGEMENT
// =========================================================================
async function loadState() {
  const res = await api('/api/student/me');
  if (res && res.ok) {
    gameState.check = res.data.check || {};
    gameState.stars = res.data.stars || {};
    gameState.achievements = res.data.achievements || {};
    gameState.teacherAwards = res.data.teacherAwards || {};
    gameState.newlyAwardedLogin = res.data.newlyAwardedLogin || [];
    gameState.hasPassword = !!res.data.hasPassword;
    gameState.coins = res.data.coins || 0;
    gameState.inventory = res.data.inventory || {};
    gameState.salaryInfo = res.data.salaryInfo || {};
    if (res.data.salaryInfo && res.data.salaryInfo.justClaimed) {
      setTimeout(() => showToast('💰 上班打卡 +' + res.data.salaryInfo.rate + ' 金币（今日工资）', 'success'), 1200);
    }
  }
}

async function saveState() {
  await api('/api/student/me', {
    method: 'PUT',
    body: JSON.stringify({ check: gameState.check, stars: gameState.stars, achievements: gameState.achievements })
  });
}

// =========================================================================
// 5. COMPUTED
// =========================================================================
function getLevelTasks(levelId) {
  const lv = content.levels.find(l => l.id === levelId);
  return lv ? lv.tasks : [];
}

function taskKey(taskId) {
  return '' + taskId;
}

function isTaskDone(taskId) {
  return !!gameState.check[taskKey(taskId)];
}

function taskXP(task) {
  if (task.hidden) return 300;
  if (task.type === 'quiz' && task.xp <= 50) return 50;
  if (task.xp === 0) return 0;
  return task.xp || 100;
}

function calcTotalXP() {
  if (!content) return 0;
  let xp = 0;
  content.levels.forEach(lv => {
    lv.tasks.forEach(t => {
      const c = gameState.check[taskKey(t.id)];
      if (c) xp += (c && c.half) ? Math.floor(taskXP(t) / 2) : taskXP(t);
    });
  });
  return xp;
}

function getRank(xp) {
  let r = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].min) { r = RANKS[i]; break; }
  }
  return r;
}

function levelProgress(lvId) {
  const tasks = getLevelTasks(lvId);
  let done = 0, total = 0;
  tasks.forEach(t => {
    if (t.auto) return;
    total++;
    if (isTaskDone(t.id)) done++;
  });
  return { done, total, pct: total ? Math.round(done / total * 100) : 0, completed: done >= total && total > 0 };
}

function areaStars(lvId) {
  const s = gameState.stars[lvId];
  if (!s) return 0;
  return Math.round((s.self * 0.3 + s.peer * 0.3 + s.teacher * 0.4) * 10) / 10;
}

function starStr(v) {
  if (v <= 0) return '';
  const f = Math.floor(v);
  let s = '';
  for (let i = 0; i < f; i++) s += '★';
  for (let i = f; i < 5; i++) s += '☆';
  return s;
}

// =========================================================================
// 6. RENDER: FACTORY VIEW
// =========================================================================
function renderFactory() {
  if (!content) return;
  const container = document.getElementById('factoryContainer');
  container.innerHTML = '';

  content.factory.rows.forEach((row, ri) => {
    // area row
    const rowDiv = document.createElement('div');
    rowDiv.className = 'factory-row';
    row.areas.forEach(areaKey => {
      const lv = content.levels.find(l => l.factoryArea === areaKey);
      if (!lv) return;
      const prog = levelProgress(lv.id);
      const prevLv = content.levels.find(l => l.id === lv.id - 1);
      const canAccess = lv.id === 1 || (prevLv && levelProgress(prevLv.id).completed);
      let cls = 'area locked';
      if (prog.completed) cls = 'area completed';
      else if (canAccess) cls = 'area active';
      if (lv.id === currentLevelId) cls += ' current';

      const div = document.createElement('div');
      div.className = cls;
      div.style.setProperty('--color', lv.color || '#00bcd4');
      div.onclick = () => selectLevel(lv.id);
      div.innerHTML = `
        <span class="lock-icon">${canAccess || prog.completed ? '' : '🔒'}</span>
        <span class="icon">${lv.areaIcon}</span>
        <span class="a-name">${lv.areaName}</span>
        <span class="a-stars">${starStr(areaStars(lv.id))}</span>
      `;
      rowDiv.appendChild(div);
    });
    container.appendChild(rowDiv);

    // pipe row (between factory rows)
    if (ri < content.factory.rows.length - 1) {
      const pipeDiv = document.createElement('div');
      pipeDiv.className = 'pipe-row';
      for (let i = 0; i < 4; i++) {
        const cell = document.createElement('div');
        cell.className = 'pipe-cell';
        const a1 = row.areas[i];
        const a2 = content.factory.rows[ri + 1].areas[i];
        const lv1 = content.levels.find(l => l.factoryArea === a1);
        const done = lv1 && levelProgress(lv1.id).completed;
        cell.innerHTML = `<div class="h-line ${done ? 'done' : ''}"></div><div class="v-line ${done ? 'done' : ''}"></div><div class="arrow ${done ? 'done' : ''}"></div>`;
        pipeDiv.appendChild(cell);
      }
      container.appendChild(pipeDiv);
    }
  });
}

// =========================================================================
// 7. RENDER: MISSION PANEL
// =========================================================================
function selectLevel(lvId, skipIntro) {
  const lv = content.levels.find(l => l.id === lvId);
  if (!lv) return;
  currentLevelId = lvId;
  setArea(lvId); playAreaMusic();
  const renderAll = () => { renderFactory(); renderMission(); renderHeader(); };
  // 直接从厂区地图进入某个任务时跳过“幕intro”（任务前言会单独讲解），
  // 避免与蓝色任务前言两个弹窗叠加；进入关卡本身仍保留幕intro
  if (skipIntro) { renderAll(); return; }
  // 幕intro 也排进登录弹窗队列，保证全局一次只弹一个（不与成就/欢迎/前言叠加）
  enqueueLoginPopup(done => showLevelIntro(lv, () => { renderAll(); done(); }));
}

function renderMission() {
  const lv = content.levels.find(l => l.id === currentLevelId);
  if (!lv) return;

  const title = document.getElementById('missionTitle');
  title.innerHTML = `<span class="lv-tag">L${lv.id}</span> ${lv.name}`;

  const story = document.getElementById('missionStory');
  const prog = levelProgress(lv.id);
  if (!prog.completed) {
    story.style.display = 'block';
    story.textContent = lv.narrative.intro;
    story.style.borderLeftColor = lv.color || '#00bcd4';
    story.style.setProperty('--color', lv.color || '#00bcd4');
  } else if (lv.narrative.complete) {
    story.style.display = 'block';
    story.textContent = '✅ ' + lv.narrative.complete;
    story.style.borderLeftColor = 'var(--green)';
    
    // Check if just completed (was not completed before this render)
    const wasCompleted = sessionStorage.getItem('levelCompleteShown_' + lv.id) === 'true';
    if (!wasCompleted) {
      sessionStorage.setItem('levelCompleteShown_' + lv.id, 'true');
      pendingLevelComplete = lv;
    }
  } else {
    story.style.display = 'none';
  }

  document.getElementById('taskProgress').textContent = `进度 ${prog.done}/${prog.total}`;

  const list = document.getElementById('taskList');
  list.innerHTML = '';
  // 构建"块最后一个任务 -> 复习翻牌"映射
  const tl = getTermLevel(lv.id);
  const reviewAfter = {};
  if (tl) tl.warmups.forEach(w => {
    const last = w.blockTasks[w.blockTasks.length - 1];
    if (last) {
      if (!reviewAfter[last]) reviewAfter[last] = [];
      reviewAfter[last].push(w);
    }
  });
  lv.tasks.forEach(t => {
    const done = isTaskDone(t.id);
    const _ck = gameState.check[taskKey(t.id)];
    const isHalf = done && _ck && _ck.half;
    const li = document.createElement('li');
    li.className = 'task-item' + (done ? ' done' : '') + (t.auto ? ' auto' : '') + (t.hidden ? ' hidden' : '');
    li.innerHTML = `
      <span class="cb">${done ? '✓' : ''}</span>
      <span class="task-title">${t.title}</span>
      <span class="task-xp">${taskXP(t) > 0 ? '+' + taskXP(t) + 'XP' : ''}</span>
      ${isHalf ? '<span class="task-half" title="经验减半，点任务可重刷拿满分">⚡</span>' : ''}
      ${done ? '<span class="task-ops"><span class="task-redo" title="重做本关拿满分">↻</span><span class="task-undo" title="撤销完成">✕</span></span>' : ''}
      <div class="task-tags">${(t.tags || []).map(tagId => {
        const tag = window.KNOWLEDGE_TAGS?.[tagId];
        return tag ? `<span class="task-tag category-${tag.category}">${tag.label}</span>` : '';
      }).join('')}</div>
    `;
    if (!t.auto) {
      li.onclick = () => {
        if (t.hidden && !done) {
          // check if all non-hidden tasks are done
          const nonHidden = lv.tasks.filter(x => !x.hidden);
          const allDone = nonHidden.every(x => isTaskDone(x.id));
          if (!allDone) { showToast('先完成所有普通任务再挑战隐藏', 'info'); return; }
        }
        // 已完成的任务点击 = 重做（重刷拿满分），未完成 = 直接做
        openTaskModal(currentLevelId, t.id);
      };
      const redo = li.querySelector('.task-redo');
      if (redo) redo.onclick = (e) => { e.stopPropagation(); openTaskModal(currentLevelId, t.id); };
      const undo = li.querySelector('.task-undo');
      if (undo) undo.onclick = (e) => { e.stopPropagation(); toggleTask(t.id); };
    }
    list.appendChild(li);
    // 块最后一个任务后，紧跟一行对应的复习翻牌
    if (reviewAfter[t.id]) {
      reviewAfter[t.id].forEach(w => {
      const unlocked = w.blockTasks.every(tid => isTaskDone(tid));
      const wType = w.type || 'memory';
      const isQuick = wType === 'quick';
      const isMatch = wType === 'match';
      const isStorm = wType === 'storm';
      const isAlarm = wType === 'alarm';
      const isTyping = wType === 'typing';
      const isShooter = wType === 'shooter';
      const isRacing = wType === 'racing';
      const isSnake = wType === 'snake', isFlappy = wType === 'flappy', isMole = wType === 'mole';
      const isPacman = wType === 'pacman', isTank = wType === 'tank', isBreakout = wType === 'breakout';
      const isSorter = wType === 'sorter';
      const isForge = wType === 'forge';
      const isLl = wType === 'll';
      const isPipe = wType === 'pipe';
      const isM3 = wType === 'm3';
      const isTd = wType === 'td';
      const isT48 = wType === 't48';
      const isMaze = wType === 'maze';
      const isHack = wType === 'hack';
      const isTyc = wType === 'tyc';
      const isLzr = wType === 'lzr';
      const isBossS = wType === 'boss';
      const row = document.createElement('li');
      row.className = 'review-inline' + (unlocked ? ' unlocked' : ' locked') + (isTyping ? ' ty-only-desktop' : '') + (isShooter && w.advanced ? ' pc-only' : '');
      const _emoji = isQuick ? '⚡' : isMatch ? '🔗' : isStorm ? '🌪️' : isAlarm ? '🚨' : isTyping ? '🔫' : isShooter ? '🛸' : isRacing ? '🏎️' : isSnake ? '🐍' : isFlappy ? '🦅' : isMole ? '🔨' : isPacman ? '👾' : isTank ? '🎯' : isBreakout ? '🧱' : isSorter ? '📦' : isForge ? '🔥' : isLl ? '🔗' : isPipe ? '🔧' : isM3 ? '🍬' : isTd ? '🛡️' : isT48 ? '🔢' : isMaze ? '🌐' : isHack ? '🕹️' : isTyc ? '🏭' : isLzr ? '🔦' : isBossS ? '🎯' : '🃏';
      const _special = isQuick || isMatch || isStorm || isAlarm || isTyping || isShooter || isRacing || isSnake || isFlappy || isMole || isPacman || isTank || isBreakout || isSorter || isForge || isLl || isPipe || isM3 || isTd || isT48 || isMaze || isHack || isTyc || isLzr || isBossS;
      const _name = _special ? escHtml(w.name) : '翻牌 · ' + escHtml(w.name);
      let _meta;
      if (isQuick) _meta = w.size + ' 题';
      else if (isMatch) _meta = w.size + ' 组';
      else if (isStorm) _meta = (w.waves || 0) + ' 波';
      else if (isAlarm) _meta = (w.devices || 0) + ' 台';
      else if (isTyping) _meta = (w.words ? w.words.length : 0) + ' 词';
      else if (isShooter) _meta = (w.waves || 4) + ' 波编队' + (w.advanced ? ' · 进阶' : '');
      else if (isRacing) _meta = '坚持 45s 通关';
      else if (isSnake) _meta = '吃网络三件套';
      else if (isFlappy) _meta = '躲断线黑洞';
      else if (isMole) _meta = '点掉异常数据';
      else if (isPacman) _meta = '吃镜像层';
      else if (isTank) _meta = '守卫 Broker';
      else if (isBreakout) _meta = '消设备故障';
      else if (isSorter) _meta = (w.waves || 3) + ' 波分类';
      else if (isForge) _meta = '合成' + (w.target||'TB');
      else if (isLl) _meta = (w.pairs||[]).length + ' 组配对';
      else if (isPipe) _meta = (w.cols||4) + '×' + (w.rows||4) + ' 管道';
      else if (isM3) _meta = (w.waves||3) + ' 波消消乐';
      else if (isTd) _meta = (w.waves||3) + ' 波防线';
      else if (isT48) _meta = '合成' + (w.target||'TB');
      else if (isMaze) _meta = '迷宫寻路';
      else if (isHack) _meta = (w.nodes||[]).length + ' 个节点';
      else if (isTyc) _meta = '目标' + (w.target||50000);
      else if (isLzr) _meta = '光束路由';
      else if (isBossS) _meta = (w.shots||5) + ' 发';
      else if (w.rounds) _meta = w.rounds.map(function(r){return r * 2;}).join('→') + ' 张';
      else _meta = (w.size * 2) + ' 张';
      row.innerHTML = '<span class="ri-emoji">' + (unlocked ? _emoji : '🔒') + '</span><span class="ri-name">' + _name + miniTierBadge(w.id) + '</span><span class="ri-meta">' + _meta + ' · ' + (unlocked ? '可玩' : '完成本块任务解锁') + '</span>';
      row.onclick = () => {
        if (!unlocked) { showToast('还没有解锁，先完成对应任务', 'error'); return; }
        if (isQuick) openQuickMatch(w, (win)=>{ gzAfter(win,'⚡ 快打完成'); });
        else if (isMatch) openMatchGame(w, (win)=>{ gzAfter(win,'🔗 连线完成'); });
        else if (isStorm) openStormDefense(w, (win)=>{ gzAfter(win,'🌪️ 数据风暴守住了'); });
        else if (isAlarm) openAlarmRush(w, (win)=>{ gzAfter(win,'🚨 产线守住了'); });
        else if (isTyping) openTypingDefense(w, (win)=>{ gzAfter(win,'🔫 术语防线守住了'); });
        else if (isShooter) openShooter(w, (win)=>{ gzAfter(win,'🛸 数据蜂群清空！'); });
        else if (isRacing) openDataRacing(w, (win)=>{ gzAfter(win,'🏎️ 数据狂飙通关！'); });
        else if (isSnake) openSnake(w, (win)=>{ gzAfter(win,'🐍 网线畅通！'); });
        else if (isFlappy) openFlappy(w, (win)=>{ gzAfter(win,'🦅 云端到达！'); });
        else if (isMole) openMole(w, (win)=>{ gzAfter(win,'🔨 异常全清！'); });
        else if (isPacman) openPacman(w, (win)=>{ gzAfter(win,'👾 镜像吃光！'); });
        else if (isTank) openTank(w, (win)=>{ gzAfter(win,'🎯 Broker 保住了！'); });
        else if (isBreakout) openBreakout(w, (win)=>{ gzAfter(win,'🧱 故障全消！'); });
        else if (isSorter) openSorter(w, (win)=>{ gzAfter(win,'📦 全部归位！'); });
        else if (isForge) openForge(w, (win)=>{ gzAfter(win,'🔥 合成成功！'); });
        else if (isLl) openLianLian(w, (win)=>{ gzAfter(win,'🔗 全部配对！'); });
        else if (isPipe) openPipe(w, (win)=>{ gzAfter(win,'🔧 数据通路接通！'); });
        else if (isM3) openMatch3(w, (win)=>{ gzAfter(win,'🍬 三连清场！'); });
        else if (isTd) openTowerDefense(w, (win)=>{ gzAfter(win,'🛡️ 车间防线守住！'); });
        else if (isT48) openTile2048(w, (win)=>{ gzAfter(win,'🔢 合成'+ (w.target||'TB') +'！'); });
        else if (isMaze) openMaze(w, (win)=>{ gzAfter(win,'🌐 数据包送达！'); });
        else if (isHack) openHacknet(w, (win)=>{ gzAfter(win,'🕹️ 全网络拿下！'); });
        else if (isTyc) openTycoon(w, (win)=>{ gzAfter(win,'🏭 产值达标！'); });
        else if (isLzr) openLaser(w, (win)=>{ gzAfter(win,'🔦 光束连通！'); });
        else if (isBossS) openBoss(w, (win)=>{ gzAfter(win,'🎯 故障砸掉了！'); });
        else openMemoryMatch(w, (win)=>{ gzAfter(win,'🧠 翻牌完成'); });
      };
      list.appendChild(row);
      });
    }
  });
  // 番外：记忆大师挑战（本关通关后解锁，放在列表最后）
  if (tl && tl.bonus) {
    const lvDone = levelProgress(lv.id).completed;
    const row = document.createElement('li');
    row.className = 'review-inline review-bonus' + (lvDone ? ' unlocked' : ' locked');
    row.innerHTML = '<span class="ri-emoji">' + (lvDone ? '🏆' : '🔒') + '</span><span class="ri-name">记忆大师挑战 · 5 层递进</span><span class="ri-meta">' + (lvDone ? '可玩' : '通关本关解锁') + '</span>';
    row.onclick = () => {
      if (!lvDone) { showToast('通关本关后才能挑战记忆大师', 'error'); return; }
      openMemoryMatch(tl.bonus, (win)=>{ gzAfter(win,'🏆 记忆大师完成！'); });
    };
    list.appendChild(row);
  }
}

// =========================================================================
// 8. TASK INTERACTION SYSTEM
// =========================================================================
// 自带讲解的类型（内部已调用generateTeach + addDirectorBox）
var selfTeachTypes = ['terminal', 'quiz', 'chain_quiz', 'fill_blank', 'drag_classify', 'install_wizard', 'progress_bar'];

function openTaskModal(lvId, taskId, onOpen) {
  const lv = content.levels.find(l => l.id === lvId);
  if (!lv) return;
  const task = lv.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentTaskId = taskId;

  // 任务主题色（用于全屏任务页背景光晕）
  const _overlay = document.getElementById('modalOverlay');
  const _taskColor = lv.color || '#00bcd4';
  _overlay.style.setProperty('--task-color', _taskColor);
  try {
    const _rgb = [parseInt(_taskColor.slice(1,3),16), parseInt(_taskColor.slice(3,5),16), parseInt(_taskColor.slice(5,7),16)];
    _overlay.style.setProperty('--task-rgb', _rgb.join(','));
  } catch(e){}
  const _subEl = document.getElementById('modalSub');
  if (_subEl) _subEl.textContent = (lv.areaName||'') + (lv.name ? ' · '+lv.name : '');

  // Show task preface dialogue first, then open modal with interaction
  showTaskPreface(task, () => {
    const overlay = document.getElementById('modalOverlay');
    overlay.style.display = '';
    overlay.classList.remove('show');
    document.getElementById('modalTitle').textContent = task.title;
    const body = document.getElementById('modalBody');
    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim)">加载中…</div>';
    document.getElementById('modalFoot').innerHTML = '';
    overlay.classList.add('show');

    // 如果该类型自带讲解则直接委托渲染
    if (selfTeachTypes.indexOf(task.type) >= 0) {
      const handler = getInteraction(task.type);
      if (handler) {
        handler.render(body, task);
      }
    } else {
      // 通用模式：直接渲染交互（教学已在前置弹窗完成）
      const handler = getInteraction(task.type);
      if (!handler) {
        body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--dim)">⚠️ 未知任务类型: ' + task.type + '</div>';
        if (typeof onOpen === 'function') onOpen();
        return;
      }
      handler.render(body, task);
    }
    // 任务道具（商城买的：提示卡 / 免错金牌）
    window.__passActive = false;
    addTaskItemBar(task);
    if (typeof onOpen === 'function') onOpen();
  });
}

function closeModal() {
  const el = document.getElementById('modalOverlay');
  if (!el) return;
  el.classList.remove('show');
  currentTaskId = null;
  playAreaMusic();
}
/* 右上角 ✕：叉掉任务。若从厂区地图进入任务，则带过场返回厂区（autoLogin 凭 mapRoom 自动重开刚才的房间），不再停留空白过渡页 */
function closeTaskModal(){
  closeModal();
  if (sessionStorage.getItem('mapFlow') === '1') { goMap(); }
}

window.__closeOverlay = function(el){ var o = el.closest('.mm-overlay'); if (o) o.remove(); };
function findTaskAnswer(task) {
  var cfg = task.config || {}, parts = [];
  if (cfg.command) parts.push('命令：' + (Array.isArray(cfg.command) ? cfg.command.join(' 或 ') : cfg.command));
  function pick(opts, ans){
    var idxs = (ans === undefined) ? [] : (Array.isArray(ans) ? ans : [ans]);
    idxs.forEach(function(i){ var o = opts[Number(i)]; if (o === undefined) return; parts.push(typeof o === 'string' ? o : (o.text || o.label || '')); });
  }
  function pickCorrect(opts){ opts.forEach(function(o){ if (o && typeof o === 'object' && o.correct) parts.push((o.label ? o.label + '：' : '') + (o.text || '')); }); }
  if (Array.isArray(cfg.options)) {
    if (cfg.answer !== undefined) pick(cfg.options, cfg.answer);
    else pickCorrect(cfg.options);
  }
  if (Array.isArray(cfg.questions)) cfg.questions.forEach(function(q){
    var opts = q.options || [];
    if (q.answer !== undefined || q.answers !== undefined) pick(opts, q.answer !== undefined ? q.answer : q.answers);
    else pickCorrect(opts);
  });
  if (cfg.answer !== undefined && !Array.isArray(cfg.options)) parts.push('答案：' + (Array.isArray(cfg.answer) ? cfg.answer.join(' / ') : cfg.answer));
  if (cfg.answers !== undefined) parts.push('答案：' + (Array.isArray(cfg.answers) ? cfg.answers.join(' / ') : cfg.answers));
  if (Array.isArray(cfg.steps)) cfg.steps.forEach(function(st){
    var opts = st.options || [];
    if (st.answer !== undefined || st.correctNumber) pick(opts, st.answer !== undefined ? st.answer : st.correctNumber);
    else pickCorrect(opts);
    if (st.correctNumber && !Array.isArray(opts)) parts.push(st.title + '：' + st.correctNumber.join(' / '));
  });
  return parts.filter(Boolean).join('\n');
}
function showTaskHintPopup(msg) {
  var ov = document.createElement('div');
  ov.className = 'mm-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9600;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div class="mm-box" style="width:min(480px,92vw);max-height:80vh"><div class="mm-head"><div><div class="mm-title">📝 提示卡</div><div class="mm-sub">厂长再讲一遍，别急</div></div><div class="mm-close" onclick="__closeOverlay(this)">✕</div></div><div class="pd-body" style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:var(--text)">' + escHtml(msg) + '</div><div style="text-align:center;padding:14px"><button class="mm-btn primary" onclick="__closeOverlay(this)">知道了</button></div></div>';
  document.body.appendChild(ov);
}
function useTaskHint(task) {
  var inv = gameState.inventory || {};
  if (!(inv['hint_card'] > 0)) return;
  api('/api/student/consume-item', { method:'POST', body:JSON.stringify({itemId:'hint_card'}) }).then(function(r){
    if (r && r.ok) {
      gameState.inventory['hint_card']--; if (gameState.inventory['hint_card'] <= 0) delete gameState.inventory['hint_card'];
      renderHeader();
      var ans = findTaskAnswer(task);
      var teach = generateTeach(task) || '厂长：再想想，答案在任务标题和提示里。';
      showTaskHintPopup(teach + (ans ? '\n\n✅ 答案参考：\n' + ans : ''));
      var btn = document.getElementById('taskHintBtn'); if (btn) { btn.style.opacity = '.4'; btn.disabled = true; }
    } else showToast((r && r.error) || '使用失败', 'error');
  });
}
function useTaskPass() {
  var inv = gameState.inventory || {};
  if (!(inv['pass_card'] > 0)) return;
  api('/api/student/consume-item', { method:'POST', body:JSON.stringify({itemId:'pass_card'}) }).then(function(r){
    if (r && r.ok) {
      gameState.inventory['pass_card']--; if (gameState.inventory['pass_card'] <= 0) delete gameState.inventory['pass_card'];
      renderHeader();
      window.__passActive = true;
      var btn = document.getElementById('taskPassBtn'); if (btn) { btn.style.opacity = '.4'; btn.disabled = true; }
      showToast('🛡 免错金牌已启用：本关答错也拿满经验', 'success');
    } else showToast((r && r.error) || '使用失败', 'error');
  });
}
function addTaskItemBar(task) {
  var inv = gameState.inventory || {};
  var hasHint = (inv['hint_card'] || 0) > 0;
  var hasPass = (inv['pass_card'] || 0) > 0;
  if (!hasHint && !hasPass) return;
  var foot = document.getElementById('modalFoot');
  if (!foot) return;
  var bar = document.createElement('div');
  bar.style.cssText = 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap';
  if (hasHint) bar.innerHTML += '<button class="btn" id="taskHintBtn" title="消耗1张：显示答案参考">📝 提示卡×' + inv['hint_card'] + '</button>';
  if (hasPass) bar.innerHTML += '<button class="btn" id="taskPassBtn" title="本关答错也按满经验结算">🛡 免错金牌×' + inv['pass_card'] + '</button>';
  foot.appendChild(bar);
  if (hasHint) document.getElementById('taskHintBtn').onclick = function(){ useTaskHint(task); };
  if (hasPass) document.getElementById('taskPassBtn').onclick = function(){ useTaskPass(); };
}
function completeTask(taskId, xp) {
  try {
    // 经验减半：命令猜错多次时 xp 低于满值，存 half 标记（影响实际总分，可重刷拿满分）
    const tFull = (content.levels.find(l => l.tasks.some(t => t.id === taskId)) || {}).tasks;
    const tFullXp = tFull ? taskXP(tFull.find(t => t.id === taskId)) : xp;
    if (window.__passActive && xp < tFullXp) { window.__passActive = false; xp = tFullXp; }   // 免错金牌：答错也拿满经验
    if (xp < tFullXp) gameState.check[taskId] = { half: true };
    else gameState.check[taskId] = true;
    closeModal();
    renderFactory();
    renderMission();
    renderHeader();
    showToast('+' + xp + 'XP', 'success');
    checkLevelUp();
    saveState();
    evaluateAchievements(true);
    refreshLeaderboard().then(() => evaluateAchievements(true));
    // 记录最近完成的任务（回厂区地图弹庆祝 toast）
    try {
      const _lv = content.levels.find(l => l.tasks.some(t => t.id === taskId));
      const _t = _lv && _lv.tasks.find(t => t.id === taskId);
      sessionStorage.setItem('lastCompleted', JSON.stringify({ title: (_t&&_t.title)||'', xp }));
    } catch(e){}
    // 地图流程：本层全部打完 → 立刻弹通关庆祝 + 回厂区
    if (sessionStorage.getItem('mapFlow') === '1') {
      const lv = content.levels.find(l => l.tasks.some(t => t.id === taskId));
      if (lv && levelProgress(lv.id).completed) showLevelComplete(lv, null);
    }
  } catch (e) {
    console.error('completeTask error:', e);
    showToast('保存失败，请重试', 'error');
  }
}

function toggleTask(taskId) {
  delete gameState.check[taskId];
  renderFactory();
  renderMission();
  renderHeader();
  saveState();
}

// =========================================================================
// 8a. INTERACTION: TERMINAL (OVERHAULED - Real Terminal Feel)
// =========================================================================
registerInteraction('terminal', {
  render(container, task) {
    const cfg = task.config;
    renderTypeTerminal(container, task, cfg);
  }
});

function renderTypeTerminal(container, task, cfg) {
  let attempts = 0;
  let streak = 0;          // 连续正确次数
  let errors = 0;          // 连续错误次数
  let hintUsed = false;    // 是否用过提示
  const hints = cfg.hints || ['再试一次，看看任务标题', '命令格式错了，检查空格和参数', '正确答案: ' + cfg.command];
  const cmdHistory = [];
  let historyIdx = -1;

  const bootMsgs = [
    '[    BIOS] 正在启动系统自检…',
    '[      OK] CPU: 4核 Intel Xeon @ 2.4GHz',
    '[      OK] 内存: 8192MB 已检测',
    '[  NETDEV] 正在初始化网络接口…',
    '[      OK] ens33: 链路已建立 (192.168.1.100)',
    '[  SYSTEM] 锐智工控系统 v3.2 准备就绪',
    ''
  ];

  const teachText = generateTeach(task);

  container.innerHTML = `
    <div id="termTeachArea"></div>
    <div class="term-root" id="termRoot" style="display:none">
      <div class="term-header">
        <span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span>
        <span>锐智终端 v2.0</span>
        <span id="termStatus">就绪</span>
      </div>
      <div class="term-task-title" id="termTaskTitle">${escHtml(cfg.prompt || '输入命令完成任务')}</div>
      <div class="term-body" id="termBody">
        <div class="term-line term-info" id="bootMsgs"></div>
        <div id="termHistory"></div>
        <div class="term-line" id="termCursorLine"><span class="term-prompt">root@锐智:~$ </span><span class="term-cursor-blink"></span></div>
      </div>
      <div class="term-input-row" id="termInputRow" style="display:none">
        <span class="prompt">root@锐智:~$</span>
        <input type="text" id="termInput" spellcheck="false" autocomplete="off" placeholder="输入命令">
      </div>
    </div>
    <div style="font-size: 14px;color:var(--dim);margin-top:6px" id="termHint"></div>
  `;

  const teachArea = document.getElementById('termTeachArea');
  document.getElementById('modalFoot').innerHTML = `
    <button class="btn" onclick="closeModal()">取消</button>
  `;
  // 初始 mood：首次进关卡 -> thinking
  const initialMood = getDirectorMood(task, { firstTime: true });
  addDirectorBox(teachArea, teachText, () => startBoot(), initialMood);

  function startBoot() {
  document.getElementById('termRoot').style.display = 'block';

  const body = document.getElementById('termBody');
  const history = document.getElementById('termHistory');
  const cursorLine = document.getElementById('termCursorLine');
  const input = document.getElementById('termInput');
  const inputRow = document.getElementById('termInputRow');
  const hint = document.getElementById('termHint');
  const bootEl = document.getElementById('bootMsgs');

  // Boot sequence
  playSound('boot');
  let bIdx = 0;
  bootEl.textContent = '';
  function bootTick() {
    if (bIdx < bootMsgs.length) {
      bootEl.textContent += bootMsgs[bIdx] + '\n';
      body.scrollTop = body.scrollHeight;
      bIdx++;
      setTimeout(bootTick, 120);
    } else {
      errors++;
      streak = 0;
      // Boot complete - show prompt as permanent hint
      hint.textContent = cfg.prompt || '输入命令开始…';
      hint.style.color = 'var(--amber)';
      cursorLine.style.display = 'none';
      inputRow.style.display = 'flex';
      input.focus();
    }
  }
  bootTick();

  function appendOutput(html) {
    history.innerHTML += `<div class="term-line">${html}</div>`;
    body.scrollTop = body.scrollHeight;
  }

  function doCheck() {
    const cmd = input.value.trim();
    if (!cmd) return;
    playSound('click');
    attempts++;
    cmdHistory.push(cmd);
    historyIdx = cmdHistory.length;

    // Echo the command
    cursorLine.style.display = 'none';
    appendOutput(`<span class="term-prompt">root@锐智:~$ </span><span class="term-cmd">${cmd.replace(/</g,'&lt;')}</span>`);

    const expected = Array.isArray(cfg.command) ? cfg.command : [cfg.command];
    const match = expected.some(e => cmd.toLowerCase() === e.toLowerCase() || cmd.toLowerCase().replace(/\s+/g,' ') === e.toLowerCase().replace(/\s+/g,' '));

    if (match) {
      streak++;
      errors = 0;
      // Fade in output character by character
      const outputLines = (cfg.output || '命令执行成功').split('\n');
      let lineIdx = 0;
      function showLine() {
        if (lineIdx < outputLines.length) {
          const line = outputLines[lineIdx];
          const cls = line.includes('ping statistics') || line.includes('packets transmitted') || line.includes('OK)')
            ? 'term-success' : 'term-out';
          appendOutput(`<span class="${cls}">${line}</span>`);
          lineIdx++;
          setTimeout(showLine, lineIdx === 1 ? 200 : 60);
        } else {
      errors++;
      streak = 0;
          // Done
          appendOutput('');
          playSound('success');
          input.disabled = true;
          input.style.display = 'none';
          inputRow.style.display = 'none';

          // Show the claim button
          const foot = document.getElementById('modalFoot');
          foot.innerHTML = '';
          const claimBtn = document.createElement('button');
          claimBtn.className = 'btn btn-success';
          claimBtn.textContent = '✓ 领取 XP +' + taskXP(task);
          foot.appendChild(claimBtn);
          claimBtn.addEventListener('click', function(ev) {
            ev.preventDefault();
            completeTask(task.id, taskXP(task));
          });

          showToast('命令正确！', 'success');
        }
      }
      showLine();
    } else {
      errors++;
      streak = 0;
      // Check for intermediate commands (same base cmd, wrong args, or --help)
      const baseCmd = cmd.split(' ')[0];
      const expectedBases = expected.map(e => e.split(' ')[0]);
      const isRelated = expectedBases.includes(baseCmd);
      const wantsHelp = cmd.includes('--help') || cmd === baseCmd + ' -h' || cmd === baseCmd + ' --h' || cmd === baseCmd + ' -?';

      if (isRelated && wantsHelp) {
        // Realistic help text by command
        const helpMap = {
          'uname': `用法：uname [选项]...\n显示系统信息。\n\n选项：\n  -a, --all                显示所有信息\n  -s, --kernel-name        显示内核名称\n  -n, --nodename           显示网络节点主机名\n  -r, --kernel-release     显示内核发行版\n  -v, --kernel-version     显示内核版本\n  -m, --machine            显示机器硬件架构\n  -p, --processor          显示处理器类型\n  -i, --hardware-platform  显示硬件平台\n  -o, --operating-system   显示操作系统\n      --help               显示此帮助信息`,
          'ip': `用法：ip [选项] 对象 [命令]\n       ip address {show|add|del} [dev 设备名]\n\n对象：\n  address      网络设备地址\n  link         网络设备\n  route        路由表\n\nip address show 选项：\n  -s, -stats   显示统计信息\n  -4           仅 IPv4\n  -6           仅 IPv6`,
          'ping': `用法：ping [选项] 目标主机\n\n选项：\n  -c <次数>    发送指定次数的报文后停止\n  -i <间隔>    每次发送间隔（秒）\n  -s <大小>    发送的数据包大小\n  -t <TTL>     设置 TTL 值\n  -4           仅使用 IPv4\n  -6           仅使用 IPv6`,
          'traceroute': `用法：traceroute [选项] 目标 [跳数]\n\n选项：\n  -n            不解析域名到 IP\n  -q <查询数>   每跳查询次数\n  -w <超时>     等待响应时间（秒）\n  -4            仅 IPv4\n  -6            仅 IPv6`,
          'nslookup': `用法：nslookup [域名] [DNS服务器]\n\n示例：\n  nslookup www.baidu.com\n  nslookup www.baidu.com 8.8.8.8`,
          'ssh': `用法：ssh [选项] 用户名@主机地址\n\n选项：\n  -p <端口>    指定端口号\n  -i <密钥>    使用指定密钥文件\n  -v           详细模式（调试用）\n\n示例：\n  ssh root@192.168.1.100\n  ssh -p 2222 admin@10.0.0.1`,
          'curl': `用法：curl [选项] URL\n\n选项：\n  -o <文件>    输出到文件\n  -s           静默模式\n  -I           仅显示响应头\n  -H <头>      自定义请求头\n\n示例：\n  curl ifconfig.me\n  curl -I https://baidu.com`,
          'docker': `用法：docker [命令] [选项]\n\n常用命令：\n  run         运行容器\n  ps          查看容器列表\n  stop        停止容器\n  rm          删除容器\n  pull        下载镜像`,
          'mosquitto_sub': `用法：mosquitto_sub [选项]\n\n选项：\n  -h <主机>    Broker 地址\n  -p <端口>    Broker 端口\n  -t <主题>    订阅主题\n  -v          显示消息详情`,
          'mosquitto_pub': `用法：mosquitto_pub [选项]\n\n选项：\n  -h <主机>    Broker 地址\n  -p <端口>    Broker 端口\n  -t <主题>    发布主题\n  -m <消息>    消息内容`,
          'systemctl': `用法：systemctl [命令] [服务名]\n\n常用命令：\n  status       查看服务状态\n  start        启动服务\n  stop         停止服务\n  restart      重启服务\n  enable       设置开机自启\n\n示例：\n  systemctl status edge-service\n  systemctl restart ssh`,
          'ss': `用法：ss [选项]\n\n选项：\n  -t  仅显示 TCP\n  -l  仅显示监听（LISTEN）端口\n  -n  不解析服务名，显示数字端口\n  -p  显示使用该端口的进程\n\n示例：\n  ss -tlnp            列出所有 TCP 监听端口\n  ss -tln | grep 502  只看 502 端口`
        };
        const helpText = helpMap[baseCmd] || `${baseCmd}: 试试 ${expected[0]} 看看效果`;
        // Type out help line by line
        const helpLines = helpText.split('\n');
        let hIdx = 0;
        function showHelpLine() {
          if (hIdx < helpLines.length) {
            const line = helpLines[hIdx];
            const cls = line.startsWith('用法') ? 'term-info' : line.startsWith('  -') ? 'term-success' : 'term-out';
            appendOutput(`<span class="${cls}">${line}</span>`);
            hIdx++;
            setTimeout(showHelpLine, 30);
          } else {
      errors++;
      streak = 0;
            const idx = Math.min(attempts - 1, hints.length - 1);
            hintUsed = true;
            hint.textContent = '💡 ' + hints[idx];
            hint.style.color = 'var(--amber)';
            playSound('click');
            input.value = '';
            input.focus();
          }
        }
        showHelpLine();
      } else if (isRelated && cmd.split(' ').length < 2) {
        // Base command without arguments - show realistic output
        const baseOutputs = {
          'uname': 'Linux',
          'ip': 'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\n       ip [ -force ] -batch filename\n\nwhere  OBJECT := { link | address | route | neigh | ... }',
          'ping': 'ping: usage error: Destination address required',
          'traceroute': 'traceroute: usage error: No destination specified',
          'nslookup': '> （进入交互模式，输入 exit 返回）',
          'ssh': 'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address] [-c cipher_spec] [-D [bind_address:]port] [-E log_file] [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file] [-J [user@]host[:port]] [-L address] [-l login_name] [-m mac_spec] [-O ctl_cmd] [-o option] [-p port] [-Q query_option] [-R address] [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]] destination [command]',
          'curl': 'curl: try \'curl --help\' or \'curl --manual\' for more information',
          'docker': 'Usage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\nCommon Commands:\n  run         Create and run a new container from an image\n  ps          List containers\n  pull        Download an image from a registry\n  --help      Print usage',
          'mosquitto_sub': 'mosquitto_sub: error: need a topic to subscribe to\nUse mosquitto_sub --help to see usage.',
          'mosquitto_pub': 'mosquitto_pub: error: need a topic and a message\nUse mosquitto_pub --help to see usage.',
          'systemctl': 'Usage: systemctl [OPTIONS...] COMMAND [UNIT...]\n\nQuery or send control commands to the system manager.\n\nCommands:\n  status UNIT    Show runtime status of a unit\n  start UNIT     Start (activate) one or more units\n  stop UNIT      Stop (deactivate) one or more units\n  restart UNIT   Restart one or more units\n  enable UNIT    Enable one or more unit files'
        };
        const realOutput = baseOutputs[baseCmd] || `${baseCmd}: 需要指定参数，试试 ${expected[0]}`;
        const outLines = realOutput.split('\n');
        outLines.forEach((line, li) => {
          appendOutput(`<span class="${li === 0 ? 'term-warn' : 'term-out'}">${line}</span>`);
        });
        const idx = Math.min(attempts - 1, hints.length - 1);
        hint.textContent = '💡 ' + hints[idx];
        hint.style.color = 'var(--amber)';
        input.value = '';
        input.focus();
      } else {
      errors++;
      streak = 0;
        appendOutput(`<span class="term-error">bash: ${cmd}: 命令未找到</span>`);
        const idx = Math.min(attempts - 1, hints.length - 1);
        hint.textContent = '💡 ' + hints[idx];
        hint.style.color = 'var(--amber)';
        shakeScreen();
        input.value = '';
        input.focus();
      }
    }
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      doCheck();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        historyIdx = Math.max(0, historyIdx - 1);
        input.value = cmdHistory[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        input.value = cmdHistory[historyIdx];
      } else {
      errors++;
      streak = 0;
        historyIdx = cmdHistory.length;
        input.value = '';
      }
    }
  });

  setTimeout(() => input.focus(), 200);
  } // end startBoot
} // end renderTypeTerminal

// =========================================================================
// 8b. INTERACTION: QUIZ
// =========================================================================
registerInteraction('quiz', {
  render(container, task) {
    const cfg = task.config;
    let streak = 0;
    let errors = 0;
    const teachText = generateTeach(task);
    container.innerHTML = `
      <div class="quiz-question" id="quizQ" style="opacity:0.3;font-size:15px;color:var(--fg);padding:6px 0;font-weight:600;transition:opacity .5s"></div>
      <div class="quiz-options" id="quizOpts" style="opacity:0.3;margin-top:0;transition:opacity .5s"></div>
    `;
    document.getElementById("quizQ").textContent = cfg.question;
    const initialMood = getDirectorMood(task, { firstTime: true });
    addDirectorBox(container, teachText, () => {
      document.getElementById('quizQ').style.opacity = '1';
      document.getElementById('quizOpts').style.opacity = '1';
    }, initialMood);
    const opts = document.getElementById('quizOpts');
    cfg.options.forEach((opt, i) => {
      const div = document.createElement('div');
      div.className = 'quiz-opt';
      div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
      div.onclick = () => {
        opts.querySelectorAll('.quiz-opt').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        const correct = i === cfg.answer;
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitQuiz(${i})">提交</button>
        `;
      };
      opts.appendChild(div);
    });
    window.submitQuiz = (choice) => {
      const optsEl = document.getElementById('quizOpts');
      const allOpts = optsEl.querySelectorAll('.quiz-opt');
      allOpts.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === cfg.answer) el.classList.add('correct');
        if (i === choice && choice !== cfg.answer) el.classList.add('wrong');
      });
      if (choice === cfg.answer) {
        streak++;
        errors = 0;
        glowCorrect(allOpts[cfg.answer]);
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
        errors++;
        streak = 0;
        shakeScreen();
        playSound('error');
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">关闭</button> <button class="btn btn-primary" onclick="resetQuiz()">重试</button>`;
        showToast('操作错误，设备报警了——再试', 'error');
      }
    };
    window.resetQuiz = () => {
      const lv = content.levels.find(l => l.id === currentLevelId);
      const t = lv.tasks.find(x => x.id === currentTaskId);
      if (t) openTaskModal(currentLevelId, currentTaskId);
    };
  }
});

// =========================================================================
// 8b2. INTERACTION: CHAIN_QUIZ (linked multi-question)
// =========================================================================
registerInteraction('chain_quiz', {
  render(container, task) {
    const cfg = task.config;
    const questions = cfg.questions || [];
    let currentQ = 0;
    let streak = 0;
    let errors = 0;
    const teachText = generateTeach(task);

    container.innerHTML = '';
    const initialMood = getDirectorMood(task, { firstTime: true });
    addDirectorBox(container, teachText, () => showQ(), initialMood);

    function showQ() {
      if (currentQ >= questions.length) {
        const old = container.querySelector('#chainArea');
        if (old) old.remove();
        const done = document.createElement('div');
        done.id = 'chainArea';
        done.style.cssText = 'text-align:center;padding:20px;color:var(--green)';
        done.textContent = '✅ 全部答对！';
        container.appendChild(done);
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
        return;
      }
      const q = questions[currentQ];
      const old = container.querySelector('#chainArea');
      if (old) old.remove();
      const area = document.createElement('div');
      area.id = 'chainArea';
      area.innerHTML = `
        ${q.teach ? '<div style="background:rgba(0,188,212,.08);border-left:3px solid var(--cyan);padding:10px 12px;border-radius:4px;margin:8px 0 10px;font-size:14px;line-height:1.7;color:var(--text)"><span style="color:var(--cyan);font-weight:bold">🤔 厂长：</span>' + escHtml(q.teach) + '</div>' : ''}
        <div style="font-size:15px;font-weight:bold;color:var(--text);margin:6px 0 4px">第 ${currentQ + 1}/${questions.length} 题</div>
        <div style="font-size:14px;color:var(--text);margin:0 0 10px;line-height:1.7">${escHtml(q.question)}</div>
        <div class="quiz-options" id="chainOpts" style="opacity:0.3;transition:opacity .5s"></div>
      `;
      container.appendChild(area);
      setTimeout(() => { document.getElementById('chainOpts').style.opacity = '1'; }, 100);
      const opts = document.getElementById('chainOpts');
      q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        div.onclick = () => {
          opts.querySelectorAll('.quiz-opt').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
          document.getElementById('modalFoot').innerHTML = `
            <button class="btn" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitChain(${i})">提交</button>
          `;
        };
        opts.appendChild(div);
      });
      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">取消</button>`;
    }

    window.submitChain = (choice) => {
      const q = questions[currentQ];
      const allOpts = document.getElementById('chainOpts').querySelectorAll('.quiz-opt');
      allOpts.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === q.answer) el.classList.add('correct');
        if (i === choice && choice !== q.answer) el.classList.add('wrong');
      });
      if (choice === q.answer) {
        glowCorrect(allOpts[q.answer]);
        playSound('success');
        currentQ++;
        setTimeout(showQ, 600);
      } else {
      errors++;
      streak = 0;
        shakeScreen();
        playSound('error');
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">关闭</button> <button class="btn btn-primary" onclick="retryChain()">重试</button>`;
        showToast(q.hint || '设备报警了——再试', 'error');
      }
    };
    window.retryChain = () => { openTaskModal(currentLevelId, currentTaskId); };

    showQ();
  }
});

// =========================================================================
// 8c. INTERACTION: FILL_BLANK
// =========================================================================
registerInteraction('fill_blank', {
  render(container, task) {
    const cfg = task.config;
    const teachText = generateTeach(task);
    const question = cfg.prompt.replace(/.*?[：:]/,'').replace(/[「」""【】]/g,'');
    container.innerHTML = `
      <div class="fill-blank" id="fillBlankArea" style="margin-top:0">
        <p>${question.replace(/____/g, '<span class="highlight">____</span>')}</p>
        <div style="margin-top:12px">
          <select id="fillSelect">
            <option value="">请选择…</option>
            ${cfg.options.map((o, i) => `<option value="${i}">${o}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    const initialMood = getDirectorMood(task, { firstTime: true });
    addDirectorBox(container, teachText, () => {
      document.getElementById('fillBlankArea').style.opacity = '1';
    }, initialMood);
    document.getElementById('fillBlankArea').style.opacity = '0.3';
    document.getElementById('fillBlankArea').style.transition = 'opacity .5s';

    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="fillSubmitBtn">提交</button>
    `;
    document.getElementById('fillSubmitBtn').onclick = () => {
      const sel = document.getElementById('fillSelect');
      const idx = parseInt(sel.value);
      if (isNaN(idx)) { showToast('机器等着你的答案——先选一个', 'error'); return; }
      const correct = cfg.options[idx] === cfg.answer || idx === cfg.answer;
      if (correct) {
        glowCorrect(document.getElementById('fillSelect'));
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      errors++;
      streak = 0;
        shakeScreen();
        playSound('error');
        showToast('报警灯亮了！重新填写', 'error');
      }
    };
  }
});

// =========================================================================
// 8d. INTERACTION: PROGRESS_BAR
// =========================================================================
registerInteraction('progress_bar', {
  render(container, task) {
    const cfg = task.config;
    let step = 0;
    // 兼容两种结构：steps 数组，或 steps 数字 + labels 数组
    const steps = Array.isArray(cfg.steps) ? cfg.steps : (cfg.labels || []);
    container.innerHTML = `
      <div class="progress-steps" id="progSteps">
        ${steps.map((s, i) => `<div class="prog-step" data-idx="${i}"><span class="step-num">${i + 1}</span>${s}</div>`).join('')}
      </div>
      <div class="prog-bar-bg"><div class="prog-bar-fill" id="progBarFill"></div></div>
      <div style="text-align:center;font-size: 14px;color:var(--dim)" id="progStatus">点击开始</div>
    `;
    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="progBtn">▶ 开始安装</button>
    `;

    const barFill = document.getElementById('progBarFill');
    const status = document.getElementById('progStatus');

    document.getElementById('progBtn').onclick = () => {
      const btn = document.getElementById('progBtn');
      btn.disabled = true;
      btn.textContent = '安装中…';
      doStep();
    };

    function doStep() {
      if (step >= steps.length) {
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 完成</button>`;
        document.getElementById('progStatus').textContent = '✅ 安装完成！';
        return;
      }
      if (step === 0) playSound('click');
      const all = document.querySelectorAll('.prog-step');
      all.forEach((el, i) => {
        el.classList.toggle('done', i < step);
        el.classList.toggle('active', i === step);
      });
      barFill.style.width = (step / steps.length * 100) + '%';
      document.getElementById('progStatus').textContent = steps[step] + '…';
      setTimeout(() => { step++; doStep(); }, 800);
    }
  }
});

// =========================================================================

// 8d2. INTERACTION: INSTALL_WIZARD (interactive setup wizard)
// =========================================================================
registerInteraction('install_wizard', {
  render(container, task) {
    const cfg = task.config;
    const steps = cfg.steps || [];
    let current = 0;
    let multiSelected = new Set();
    let cmdErrorCount = 0;   // 命令被"给答案"的次数（>0 表示曾连续猜错）
    let cmdHintGiven = {};   // 每个命令步骤是否已给过功能提示

    container.innerHTML = `
      <div id="wizardBar">
        <div class="wizard-steps" id="wizardSteps"></div>
        <div class="prog-bar-bg"><div class="prog-bar-fill" id="wizardFill"></div></div>
      </div>
      <div id="wizardStage" style="margin-top:12px"></div>
    `;

    function updateProgress() {
      const pct = current / steps.length * 100;
      document.getElementById('wizardFill').style.width = pct + '%';
      const stepsEl = document.getElementById('wizardSteps');
      stepsEl.innerHTML = steps.map((s, i) => {
        let cls = 'wiz-dot';
        if (i < current) cls += ' done';
        if (i === current) cls += ' active';
        return '<span class="' + cls + '" title="' + s.title + '">' + (i + 1) + '</span>';
      }).join('');
    }

    function renderStep() {
      if (current >= steps.length) {
        var passSaved = (cmdErrorCount > 0 && window.__passActive);
        if (passSaved) window.__passActive = false;   // 用了免错金牌
        var finalXP = (cmdErrorCount > 0 && !passSaved) ? Math.floor(taskXP(task) / 2) : taskXP(task);
        var halfNote = cmdErrorCount > 0
          ? '<div style="font-size: 13px;color:var(--amber);margin-top:6px">经验减半 · 实得 +'+ finalXP +' XP</div>'
          : '<div style="font-size: 13px;color:var(--dim);margin-top:6px">全对完成 · 经验满额</div>';
        document.getElementById('wizardStage').innerHTML = '<div style="text-align:center;padding:20px"><div style="font-size:28px;margin-bottom:8px">\ud83d\udda5\ufe0f</div><div style="color:var(--green);font-size:14px">\u2705 工位搭建完成！</div>' + halfNote + '</div>';
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-success" onclick="completeTask(\'' + task.id + '\', ' + finalXP + ')">\u2713 领取 XP</button>';
        updateProgress();
        playSound('success');
        return;
      }
      updateProgress();
      const step = steps[current];
      const stage = document.getElementById('wizardStage');
      var _narr = String(step.narrative || '').replace(/^厂长[:：]\s*/, '');
      var html = '<div class="wizard-narrative"><span class="wiz-narr-icon">\ud83d\udc68\u200d\ud83d\udcbc</span> <span class="wiz-narr-label">厂长：</span>' + _narr + '</div>';
      html += '<div class="wizard-question">' + step.question + '</div>';
      if (step.inputType === 'number') {
        html += '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size: 15px"><input type="number" id="wizNum" placeholder="输入数字" style="width:80px;background:#0a0a10;border:1px solid var(--border);color:var(--text);padding:8px;font-size:14px" min="0" max="32"><span style="color:var(--dim)">GB</span></div>';
      } else if (step.inputType === 'command') {
        html += '<div class="term-root" style="margin-top:8px"><div class="term-header"><span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span><span>终端</span></div><div class="term-body"><input type="text" id="wizCmd" placeholder="输入命令…" spellcheck="false" autocomplete="off" style="width:94%;background:transparent;border:none;color:var(--green);font:inherit;font-size: 15px;outline:none;padding:8px"></div></div>';
      } else if (step.multiSelect) {
        html += '<div id="wizMultiOpts" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>';
      } else if (step.options) {
        html += '<div id="wizOpts" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>';
      }
      stage.innerHTML = html;
      if (step.options && !step.multiSelect) {
        var optsEl = document.getElementById('wizOpts');
        step.options.forEach(function(opt, i) {
          var div = document.createElement('div');
          div.className = 'quiz-opt';
          div.innerHTML = '<span style="font-size: 14px;color:var(--dim);margin-right:6px">' + (opt.label || String.fromCharCode(65 + i)) + '</span>' + opt.text;
          div.onclick = function() {
            document.getElementById('wizOpts').querySelectorAll('.quiz-opt').forEach(function(el) { el.classList.remove('selected'); });
            div.classList.add('selected');
            document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button><button class="btn btn-primary" id="wizSubmitBtn">\u2713 确认</button>';
            document.getElementById('wizSubmitBtn').onclick = function() { submitWizard(i); };
          };
          optsEl.appendChild(div);
        });
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button>';
      } else if (step.multiSelect) {
        multiSelected = new Set();
        var mOptsEl = document.getElementById('wizMultiOpts');
        step.options.forEach(function(opt, i) {
          var div = document.createElement('div');
          div.className = 'quiz-opt';
          div.id = 'wizMultiOpt_' + i;
          div.innerHTML = '<span class="wiz-checkbox" style="display:inline-block;width:18px;height:18px;border:2px solid var(--border);margin-right:8px;font-size: 14px;line-height:18px;text-align:center;vertical-align:middle"></span><span>' + opt.text + '</span>';
          div.onclick = function() {
            if (multiSelected.has(i)) {
              multiSelected.delete(i);
              div.querySelector('.wiz-checkbox').textContent = '';
              div.querySelector('.wiz-checkbox').style.borderColor = 'var(--border)';
              div.style.borderColor = 'var(--border)';
            } else {
      errors++;
      streak = 0;
              multiSelected.add(i);
              div.querySelector('.wiz-checkbox').textContent = '\u2713';
              div.querySelector('.wiz-checkbox').style.color = 'var(--green)';
              div.querySelector('.wiz-checkbox').style.borderColor = 'var(--green)';
              div.style.borderColor = 'var(--amber)';
            }
            var sbEmpty = multiSelected.size === 0;
            document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button><button class="btn btn-primary" id="wizSubmitBtn"' + (sbEmpty ? ' disabled' : '') + '>\u2713 确认选择</button>';
            var sb = document.getElementById('wizSubmitBtn');
            if (sb) { sb.onclick = function() { submitWizardMulti(); }; }
          };
          mOptsEl.appendChild(div);
        });
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button>';
      } else if (step.inputType) {
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button><button class="btn btn-primary" id="wizSubmitBtn">\u2713 确认</button>';
        document.getElementById('wizSubmitBtn').onclick = function() {
          if (step.inputType === 'number') {
            var val = parseInt(document.getElementById('wizNum').value);
            if (isNaN(val)) { showToast('你得输入一个数字机器才认', 'error'); return; }
            submitWizard(val);
          } else if (step.inputType === 'command') {
            var inp = document.getElementById('wizCmd');
            if (!inp) return;
            var val = inp.value.trim();
            if (!val) { showToast('终端还等着你的命令', 'error'); return; }
            submitWizard(val);
          }
        };
        // Enter key binding
        setTimeout(function() {
          if (step.inputType === 'number') {
            var el = document.getElementById('wizNum');
            if (el) el.onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('wizSubmitBtn').click(); };
          } else if (step.inputType === 'command') {
            var el = document.getElementById('wizCmd');
            if (el) { el.onkeydown = function(e) { if (e.key === 'Enter') document.getElementById('wizSubmitBtn').click(); }; el.focus(); }
          }
        }, 100);
      }
    }

    window.submitWizard = function(answer) {
      var step = steps[current];
      if (step.inputType === 'command') {
        runTerminalSim(answer);
        return;
      }
      var correct = false;
      if (step.inputType === 'number') {
        correct = step.correctNumber.includes(answer);
      } else {
      errors++;
      streak = 0;
        correct = step.options[answer].correct;
      }
      handleStepResult(correct);
    };

    function runTerminalSim(cmd) {
      var step = steps[current];
      // → 立即验证命令，不正确的直接报错，不跑动画
      var normalized = cmd.toLowerCase().replace(/\s+/g, ' ');
      var commands = [step.correctCommand.toLowerCase()].concat((step.aliases || []).map(function(a) { return a.toLowerCase(); }));
      var ok = commands.some(function(c) { return normalized === c || normalized.startsWith(c); });
      
      var stage = document.getElementById('wizardStage');
      var termRoot = stage.querySelector('.term-root');
      document.getElementById('modalFoot').innerHTML = '';

      if (!ok) {
        // 渐进提示：若配置了 hints 数组则逐步给出答案片段，全部用完再给完整答案（标记经验减半）
        var tries = cmdHintGiven[current] || 0;
        var hintList = (step.hints && step.hints.length) ? step.hints : null;
        var hintText;
        if (hintList) {
          if (tries < hintList.length) {
            hintText = '💡 提示 ' + (tries + 1) + '/' + hintList.length + ': ' + String(hintList[tries]).replace(/</g,'&lt;');
            cmdHintGiven[current] = tries + 1;
          } else {
            hintText = '📖 答案是: ' + String(step.correctCommand).replace(/</g,'&lt;');
            cmdErrorCount++;
          }
        } else {
          if (tries === 0) {
            hintText = '💡 提示: ' + String(step.errorHint || '再看看厂长刚才教的，命令格式要对').replace(/</g,'&lt;');
            cmdHintGiven[current] = 1;
          } else {
            hintText = '📖 答案是: ' + String(step.correctCommand).replace(/</g,'&lt;');
            cmdErrorCount++;
          }
        }
        if (termRoot) {
          var termBody = termRoot.querySelector('.term-body');
          var input = document.getElementById('wizCmd');
          if (termBody && input) {
            var box = document.createElement('div');
            box.style.cssText = 'padding:4px 0';
            box.innerHTML = '<div style="color:var(--cyan)">$ ' + String(cmd).replace(/</g,'&lt;') + '</div>' +
              '<div style="color:var(--red)">bash: ' + String(cmd).split(' ')[0].replace(/</g,'&lt;') + ': 命令未找到，或参数不正确</div>' +
              '<div style="color:var(--amber);margin-top:4px">' + hintText + '</div>';
            termBody.insertBefore(box, input);
            input.onkeydown = function(e) { if (e.key === 'Enter') { var v = input.value.trim(); if (v) submitWizard(v); } };
            input.focus();
          }
        }
        playSound('error');
        shakeScreen();
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button>';
        return;
      }

      // 正确命令 → 替换为输出区并播放动画
      if (termRoot) {
        termRoot.innerHTML = '<div class="term-header"><span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span><span>\u7aef</span></div><div class="term-body" id="wizTermOut" style="padding:8px;font-size: 14px;font-family:inherit;max-height:180px;overflow-y:auto;color:var(--dim)"></div>';
      }
      var out = document.getElementById('wizTermOut');
      if (!out) return;
      
      var lines = step.outputLines
        ? [{text: '$ ' + cmd, color: 'cyan', delay: 200}].concat(step.outputLines)
        : [
        {text: '$ ' + cmd, color: 'cyan', delay: 200},
        {text: 'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease', color: '', delay: 300},
        {text: 'Get:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]', color: '', delay: 250},
        {text: 'Reading package lists... Done', color: 'dim', delay: 400},
        {text: 'Building dependency tree... Done', color: 'dim', delay: 300},
        {text: 'Calculating upgrade... Done', color: 'dim', delay: 300},
        {text: 'The following packages will be upgraded:', color: 'dim', delay: 200},
        {text: '  openssh-server libc6 systemd base-files ...', color: 'dim', delay: 200},
        {text: 'Need to get 12.3 MB of archives.', color: 'dim', delay: 200},
        {text: 'Get:1 openssh-server 1:9.6p1 [380 kB]', color: '', delay: 300},
        {text: 'Get:2 libc6 2.39-0ubuntu9 [2.1 MB]', color: '', delay: 300},
        {text: 'Fetched 12.3 MB in 5s (2.46 MB/s)', color: 'dim', delay: 400},
        {text: 'Preconfiguring packages ... Done', color: 'dim', delay: 200},
        {text: 'Setting up packages ... Done', color: 'dim', delay: 200},
        {text: 'Processing triggers for libc-bin ...', color: 'dim', delay: 200},
        {text: '', color: '', delay: 100}
      ];

      var i = 0;
      function nextLine() {
        if (i >= lines.length) {
          setTimeout(function() {
            var normalized = cmd.toLowerCase().replace(/\s+/g, ' ');
            var commands = [step.correctCommand.toLowerCase()].concat((step.aliases || []).map(function(a) { return a.toLowerCase(); }));
            var ok = commands.some(function(c) { return normalized === c || normalized.startsWith(c); });
            if (ok) {
              var okDiv = document.createElement('div');
              okDiv.textContent = step.successText || '\u2705 系统更新完成，所有软件包已是最新版本！';
              okDiv.style.color = 'var(--green)';
              okDiv.style.marginTop = '6px';
              out.appendChild(okDiv);
              playSound('success');
              // 厂长解读终端输出含义（如有 explain 字段）
              if (step.explain) {
                var ex = document.createElement('div');
                ex.className = 'wiz-explain';
                ex.innerHTML = '<span style="color:var(--amber);font-weight:bold">厂长解读：</span>' + String(step.explain).replace(/</g,'&lt;');
                out.appendChild(ex);
                out.scrollTop = out.scrollHeight;
              }
              // 不自动跳转：看完结果点“确认”再进下一步
              document.getElementById('modalFoot').innerHTML =
                '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button>' +
                '<button class="btn btn-primary" onclick="window.wizNext()">\u2713 确认，下一步</button>';
              window.wizNext = function() {
                current++;
                multiSelected = new Set();
                renderStep();
                stage.style.opacity = '1';
              };
            } else {
      errors++;
      streak = 0;
              var errDiv = document.createElement('div');
              errDiv.textContent = '\u274c 输入错误——终端拒绝了这条命令。厂长提示：apt update && apt upgrade';
              errDiv.style.color = 'var(--red)';
              errDiv.style.marginTop = '6px';
              out.appendChild(errDiv);
              playSound('error');
              shakeScreen();
              document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="window.wizRetry()">\uD83D\uDD04 重试</button>';
            }
          }, 400);
          return;
        }
        var line = lines[i];
        var div = document.createElement('div');
        div.textContent = line.text;
        if (line.color === 'dim') div.style.color = 'var(--dim)';
        else if (line.color === 'cyan') div.style.color = 'var(--cyan)';
        else if (line.color === 'green') div.style.color = 'var(--green)';
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
        i++;
        setTimeout(nextLine, line.delay);
      }
      nextLine();
    }


    window.submitWizardMulti = function() {
      var step = steps[current];
      var selectedArr = Array.from(multiSelected);
      var correctIndices = [];
      step.options.forEach(function(opt, i) { if (opt.correct) correctIndices.push(i); });
      var allSelectedCorrect = selectedArr.length === correctIndices.length && selectedArr.every(function(i) { return step.options[i].correct; });
      handleStepResult(allSelectedCorrect);
    };

    function handleStepResult(correct) {
      if (correct) {
        playSound('success');
        current++;
        multiSelected = new Set();
        var stage = document.getElementById('wizardStage');
        stage.style.transition = 'opacity .2s';
        stage.style.opacity = '0';
        setTimeout(function() { renderStep(); stage.style.opacity = '1'; }, 250);
      } else {
      errors++;
      streak = 0;
        shakeScreen();
        playSound('error');
        var step = steps[current];
        var hint = '机器不认这个输入——再试一次';
        if (step.options) {
          var correctOpt = step.options.find(function(o) { return o.correct; });
          if (correctOpt && correctOpt.hint) hint = correctOpt.hint;
        }
        showToast(hint, 'error');
        if (step.options && !step.multiSelect) {
          document.querySelectorAll('#wizOpts .quiz-opt').forEach(function(el, i) {
            el.style.pointerEvents = 'none';
            if (step.options[i].correct) el.classList.add('correct');
          });
          setTimeout(function() {
            document.querySelectorAll('#wizOpts .quiz-opt').forEach(function(el) { el.style.pointerEvents = ''; el.classList.remove('correct', 'selected'); });
            document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button>';
          }, 1200);
        }
        document.getElementById('modalFoot').innerHTML = '<button class="btn btn-wiz-cancel" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="window.wizRetry()">\ud83d\udd04 重试</button>';
      }
    }

    window.wizRetry = function() {
      // 只重做当前这一步（命令输错就重新输入，选择题答错就重新选），不重头再来
      renderStep();
    };

    renderStep();
  }
});

// 8e. INTERACTION: SCENARIO_MATCH
// =========================================================================
registerInteraction('scenario_match', {
  render(container, task) {
    const cfg = task.config;
    const pairs = cfg.pairs || [];
    const items = pairs.map((p, i) => ({ text: p.item, pairIdx: i, side: 'left' }));
    const matches = pairs.map((p, i) => ({ text: p.match, pairIdx: i, side: 'right' }));
    // shuffle
    for (let i = matches.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matches[i], matches[j]] = [matches[j], matches[i]];
    }

    let selectedItem = null;
    let matchedCount = 0;
    const matched = new Set();

    container.innerHTML = `
      <div style="font-size: 14px;color:var(--dim);margin-bottom:10px">点击左侧条目，再点击对应的右侧条目进行匹配：</div>
      <div class="match-area">
        <div class="match-col"><h4>概念 / 场景</h4><div id="matchLeft"></div></div>
        <div class="match-col"><h4>匹配项</h4><div id="matchRight"></div></div>
      </div>
    `;

    const leftEl = document.getElementById('matchLeft');
    const rightEl = document.getElementById('matchRight');

    function renderItems() {
      leftEl.innerHTML = '';
      rightEl.innerHTML = '';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-item' + (matched.has(item.pairIdx) ? ' matched' : '') + (selectedItem === item ? ' selected' : '');
        div.textContent = item.text;
        if (!matched.has(item.pairIdx)) {
          div.onclick = () => { selectedItem = item; renderItems(); };
        }
        leftEl.appendChild(div);
      });
      matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'match-item' + (matched.has(item.pairIdx) ? ' matched' : '');
        div.textContent = item.text;
        if (!matched.has(item.pairIdx) && selectedItem) {
          div.onclick = () => {
              if (selectedItem.pairIdx === item.pairIdx) {
                matched.add(item.pairIdx);
                matchedCount++;
                selectedItem = null;
                renderItems();
                if (matchedCount >= pairs.length) {
                  playSound('success');
                  glowCorrect(document.getElementById('matchRight'));
                  document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
                }
              } else {
      errors++;
      streak = 0;
                div.classList.add('wrong');
                shakeScreen();
                playSound('error');
                setTimeout(() => div.classList.remove('wrong'), 300);
              }
          };
        }
        rightEl.appendChild(div);
      });
    }
    renderItems();

    document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">取消</button>`;
  }
});

// =========================================================================
// 8f. INTERACTION: SORT
// =========================================================================
registerInteraction('sort', {
  render(container, task) {
    const cfg = task.config;
    const items = [...cfg.items];
    // shuffle
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    container.innerHTML = `
      <div class="wizard-narrative" id="sortTeach" style="margin-bottom:10px"></div>
      <div style="font-size: 14px;color:var(--dim);margin-bottom:10px">拖拽排序：将下列项目按正确顺序排列</div>
      <div class="sort-area" id="sortArea"></div>
    `;
    // 题面上方内嵌教学（sort 本身不带讲解，这里补上）
    try{
      const _teach = generateTeach(task);
      if (_teach) document.getElementById('sortTeach').innerHTML = '<span class="wiz-narr-label">厂长：</span>' + escHtml(_teach);
    }catch(e){}

    const area = document.getElementById('sortArea');
    let dragSrc = null;

    shuffled.forEach(text => {
      const div = document.createElement('div');
      div.className = 'sort-item';
      div.textContent = text;
      div.draggable = true;

      div.addEventListener('dragstart', e => {
        dragSrc = div;
        div.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        dragSrc = null;
      });

      div.addEventListener('dragover', e => {
        e.preventDefault();
        div.classList.add('drag-over');
      });

      div.addEventListener('dragleave', () => {
        div.classList.remove('drag-over');
      });

      div.addEventListener('drop', e => {
        e.preventDefault();
        div.classList.remove('drag-over');
        if (dragSrc && dragSrc !== div) {
          const parent = area;
          const idx1 = Array.from(parent.children).indexOf(dragSrc);
          const idx2 = Array.from(parent.children).indexOf(div);
          if (idx1 < idx2) {
            parent.insertBefore(dragSrc, div.nextSibling);
          } else {
      errors++;
      streak = 0;
            parent.insertBefore(dragSrc, div);
          }
        }
      });

      area.appendChild(div);
    });

    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitSort()">检查顺序</button>
    `;

    window.submitSort = () => {
      const children = area.querySelectorAll('.sort-item');
      const order = Array.from(children).map(el => el.textContent);
      const correct = cfg.answer.every((targetIdx, pos) => order[pos] === cfg.items[targetIdx]);
      if (correct) {
        glowCorrect(area);
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      errors++;
      streak = 0;
        shakeScreen();
        playSound('error');
        showToast('排错了——车间设备全红了！重新排序', 'error');
      }
    };
  }
});

// =========================================================================
// 8g. INTERACTION: CODE_REVIEW
// =========================================================================
registerInteraction('code_review', {
  render(container, task) {
    const cfg = task.config;
    const codeLines = (cfg.code || '').replace(/\\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
    const codeHtml = codeLines.map((l, i) =>
      '<div class="code-line"><span class="code-no">' + (i + 1) + '</span><span class="code-text">' + l + '</span></div>'
    ).join('');
    container.innerHTML = `
      <div style="font-size: 14px;color:var(--dim);margin-bottom:6px">阅读以下代码（每条一行）：</div>
      <div class="code-block">${codeHtml}</div>
      <div style="font-size: 14px;margin-bottom:10px;color:var(--amber)">${cfg.hint || '找出问题：'}</div>
      <div style="font-size: 15px;margin-bottom:10px">${cfg.question}</div>
      <div class="quiz-options" id="codeOpts"></div>
    `;
    const opts = document.getElementById('codeOpts');
    cfg.options.forEach((opt, i) => {
      const div = document.createElement('div');
      div.className = 'quiz-opt';
      div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
      div.onclick = () => {
        opts.querySelectorAll('.quiz-opt').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitCodeReview(${i}, ${cfg.answer})">提交</button>
        `;
      };
      opts.appendChild(div);
    });
    window.submitCodeReview = (choice, answer) => {
      const els = document.getElementById('codeOpts').querySelectorAll('.quiz-opt');
      els.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === answer) el.classList.add('correct');
        if (i === choice && choice !== answer) el.classList.add('wrong');
      });
      if (choice === answer) {
        glowCorrect(els[answer]);
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      errors++;
      streak = 0;
        shakeScreen();
        playSound('error');
        window.resetQuiz = () => {
          const lv = content.levels.find(l => l.id === currentLevelId);
          const t = lv.tasks.find(x => x.id === currentTaskId);
          if (t) openTaskModal(currentLevelId, currentTaskId);
        };
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">关闭</button> <button class="btn btn-primary" onclick="resetQuiz()">重试</button>`;
        showToast('终端报错了！仔细看代码缺了什么', 'error');
      }
    };
  }
});

// =========================================================================
// 8h. INTERACTION: ETHICS
// =========================================================================
registerInteraction('ethics', {
  render(container, task) {
    const cfg = task.config;
    container.innerHTML = `
      <div class="ethics-scenario">${cfg.scenario}</div>
      <div class="ethics-choices" id="ethicsChoices"></div>
      <div class="ethics-consequence" id="ethicsCons"></div>
    `;
    const choices = document.getElementById('ethicsChoices');
    cfg.choices.forEach((text, i) => {
      const div = document.createElement('div');
      div.className = 'ethics-choice';
      div.textContent = String.fromCharCode(65 + i) + '. ' + text;
      div.onclick = () => {
        choices.querySelectorAll('.ethics-choice').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitEthics(${i})">提交选择</button>
        `;
      };
      choices.appendChild(div);
    });
    window.submitEthics = (choice) => {
      const allChoices = choices.querySelectorAll('.ethics-choice');
      allChoices.forEach((el, i) => {
        el.style.pointerEvents = 'none';
        if (i === cfg.best) el.classList.add('revealed-best');
        else el.classList.add('revealed');
      });
      const cons = document.getElementById('ethicsCons');
      cons.className = 'ethics-consequence show ' + (choice === cfg.best ? 'good' : 'ok');
      cons.textContent = '结果：' + cfg.consequences[choice];
      if (choice === cfg.best) {
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      errors++;
      streak = 0;
        playSound('click');
        document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">关闭</button>`;
      }
    };
  }
});

// =========================================================================
// 8i. INTERACTION: DIAGNOSIS_TREE
// =========================================================================
registerInteraction('diagnosis_tree', {
  render(container, task) {
    const cfg = task.config;
    let stepIdx = 0;
    const steps = cfg.steps || [];

    function renderStep() {
      if (stepIdx >= steps.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--green)">✅ 故障排除成功！</div>';
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
        return;
      }
      const s = steps[stepIdx];
      container.innerHTML = `
        <div style="margin-bottom:6px;font-size: 14px;color:var(--dim)">场景：${cfg.scenario}</div>
        <div class="diag-progress">步骤 ${stepIdx + 1} / ${steps.length}</div>
        <div class="diag-question">${s.question}</div>
        <div class="diag-options" id="diagOpts"></div>
      `;
      const opts = document.getElementById('diagOpts');
      s.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'diag-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        div.onclick = () => {
          opts.querySelectorAll('.diag-opt').forEach(el => el.style.pointerEvents = 'none');
          if (i === s.correct) {
            div.classList.add('correct');
            playSound('click');
            stepIdx++;
            setTimeout(renderStep, 800);
          } else {
      errors++;
      streak = 0;
            div.classList.add('wrong');
            shakeScreen();
            playSound('error');
            showToast('方向走错了——设备指示灯没变化，换个排查思路', 'error');
            setTimeout(() => {
              opts.querySelectorAll('.diag-opt').forEach(el => {
                el.style.pointerEvents = 'auto';
                el.classList.remove('wrong');
              });
            }, 800);
          }
        };
        opts.appendChild(div);
      });
      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">取消</button>`;
    }
    renderStep();
  }
});

// =========================================================================
// 8j. INTERACTION: DRAG_CLASSIFY
// =========================================================================
registerInteraction('drag_classify', {
  render(container, task) {
    const cfg = task.config;
    const items = [...cfg.items];
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const placed = {};  // itemName -> categoryName
    let streak = 0;
    let errors = 0;
    const teachText = generateTeach(task);

    container.innerHTML = `
      <div id="dragClassifyArea" style="opacity:0.3;transition:opacity .5s">
        <div style="font-size: 14px;color:var(--dim);margin-bottom:10px">将设备/概念拖到对应的分类中：</div>
        <div class="classify-area">
          <div class="classify-pool"><h4>待分类</h4><div id="classifyPool"></div></div>
          <div class="classify-cats"><h4>分类</h4><div id="classifyCats"></div></div>
        </div>
      </div>
    `;

    const initialMood = getDirectorMood(task, { firstTime: true });
    addDirectorBox(container, teachText, () => {
      document.getElementById('dragClassifyArea').style.opacity = '1';
    }, initialMood);

    const pool = document.getElementById('classifyPool');
    const cats = document.getElementById('classifyCats');

    // 待分类区支持拖回：已放置的项可拖回此处取消放置，重新分类
    pool.addEventListener('dragover', e => e.preventDefault());
    pool.addEventListener('drop', e => {
      e.preventDefault();
      const name = e.dataTransfer.getData('text/plain');
      if (name && placed[name]) {
        delete placed[name];
        renderClassify();
      }
    });

    cfg.categories.forEach(catName => {
      const catDiv = document.createElement('div');
      catDiv.className = 'classify-cat';
      catDiv.dataset.cat = catName;
      catDiv.innerHTML = `<span class="cat-label">${catName}</span>`;
      catDiv.addEventListener('dragover', e => e.preventDefault());
      catDiv.addEventListener('drop', e => {
        e.preventDefault();
        const name = e.dataTransfer.getData('text/plain');
        if (!name) return;
        placed[name] = catName;
        renderClassify();
      });
      cats.appendChild(catDiv);
    });

    function renderClassify() {
      pool.innerHTML = '';
      shuffled.forEach(name => {
        if (placed[name]) return;
        const div = document.createElement('div');
        div.className = 'classify-item';
        div.textContent = name;
        div.draggable = true;
        div.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', name);
          e.dataTransfer.effectAllowed = 'move';
        });
        pool.appendChild(div);
      });

      cats.querySelectorAll('.classify-cat').forEach(catDiv => {
        const catName = catDiv.dataset.cat;
        // remove old placed items
        catDiv.querySelectorAll('.placed-item').forEach(el => el.remove());
        Object.entries(placed).forEach(([name, cat]) => {
          if (cat === catName) {
            const span = document.createElement('span');
            span.className = 'placed-item';
            span.textContent = name;
            span.draggable = true;
            span.addEventListener('dragstart', e => {
              e.dataTransfer.setData('text/plain', name);
              e.dataTransfer.effectAllowed = 'move';
              span.style.opacity = '0.4';
            });
            span.addEventListener('dragend', () => { span.style.opacity = ''; });
            catDiv.appendChild(span);
          }
        });
      });

      const allPlaced = shuffled.every(name => placed[name]);
      if (allPlaced) {
        document.getElementById('modalFoot').innerHTML = `
          <button class="btn" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="submitClassify()">确认分类</button>
        `;
      }
    }

    window.submitClassify = () => {
      const answers = cfg.answer || [];
      let correct = true;
      shuffled.forEach((name) => {
        const origIdx = cfg.items.indexOf(name);
        const expectedCatIdx = parseInt(answers[origIdx]);
        const expectedCat = cfg.categories[expectedCatIdx];
        if (placed[name] !== expectedCat) correct = false;
      });
      if (correct) {
        glowCorrect(document.getElementById('classifyCats'));
        playSound('success');
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
      } else {
      errors++;
      streak = 0;
        shakeScreen();
        playSound('error');
        showToast('分类错误——设备重新报警了！再分类', 'error');
      }
    };

    renderClassify();
    document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">取消</button>`;
  }
});

// =========================================================================
// 8k. INTERACTION: BOSS_FIGHT (epic boss battle with HP system)
// =========================================================================
registerInteraction('boss_fight', {
  render(container, task) {
    const cfg = task.config;
    playMusic('boss');
    let phase = 0;
    let qIdx = 0;
    let bossHP = 100;
    let playerHP = 3;
    const maxBossHP = 100;
    let bossDefeated = false;

    function renderBoss() {
      if (bossDefeated) {
        container.innerHTML = `<div style="text-align:center;padding:30px">
          <div style="font-size:64px;animation:levelUpAnim .5s ease-out">🏆</div>
          <div style="color:var(--green);font-size:18px;font-weight:bold;margin:12px 0">${cfg.bossName} 已被击败！</div>
          <div style="font-size: 14px;color:var(--dim)">厂长拍了拍你：「干得漂亮！」</div>
        </div>`;
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 领取 XP</button>`;
        playSound('levelup');
        return;
      }
      if (playerHP <= 0) {
        container.innerHTML = `<div style="text-align:center;padding:30px">
          <div style="font-size:48px">💀</div>
          <div style="color:var(--red);font-size:16px;margin:12px 0">Boss 太强了，重整旗鼓再战！</div>
        </div>`;
        document.getElementById('modalFoot').innerHTML = `<button class="btn btn-primary" onclick="resetBattle()">🔄 重新挑战</button>`;
        return;
      }

      const p = cfg.phases[phase];
      if (!p) { bossDefeated = true; renderBoss(); return; }
      const q = p.questions[qIdx];
      if (!q) { bossDefeated = true; renderBoss(); return; }

      container.innerHTML = `
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size: 14px">
            <span>${cfg.bossEmoji || '👾'} <strong>${cfg.bossName}</strong></span>
            <span>${'❤️'.repeat(playerHP)}${'🖤'.repeat(Math.max(0,3-playerHP))}</span>
          </div>
          <div class="boss-hp-bg">
            <div class="boss-hp-fill" id="bossHPFill" style="width:${Math.round(bossHP/maxBossHP*100)}%"></div>
            <span class="boss-hp-label">${cfg.bossName} HP ${bossHP}/${maxBossHP}</span>
          </div>
          <div style="font-size: 14px;color:var(--dim);margin-top:4px;display:flex;justify-content:space-between">
            <span>阶段 ${phase+1}/${cfg.phases.length}: ${p.name}</span>
            <span>${qIdx+1}/${p.questions.length}</span>
          </div>
        </div>
        <div style="font-size: 15px;margin:12px 0;color:var(--amber)">⚔️ ${q.question}</div>
        <div class="quiz-options" id="bossOpts"></div>
      `;

      const opts = document.getElementById('bossOpts');
      q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-opt';
        div.textContent = String.fromCharCode(65 + i) + '. ' + opt;
        div.onclick = () => {
          opts.querySelectorAll('.quiz-opt').forEach(el => el.style.pointerEvents = 'none');
          if (i === q.answer) {
            div.classList.add('correct');
            glowCorrect(div);
            playSound('success');
            const damage = Math.ceil(maxBossHP / (p.questions.length * cfg.phases.length));
            bossHP = Math.max(0, bossHP - damage);
            document.getElementById('bossHPFill').style.width = Math.round(bossHP/maxBossHP*100) + '%';
            qIdx++;
            if (qIdx >= p.questions.length) {
              qIdx = 0;
              phase++;
              if (phase >= cfg.phases.length) bossDefeated = true;
            }
            setTimeout(renderBoss, 600);
          } else {
      errors++;
      streak = 0;
            div.classList.add('wrong');
            shakeScreen();
            playSound('error');
            playerHP--;
            setTimeout(renderBoss, 800);
          }
        };
        opts.appendChild(div);
      });

      document.getElementById('modalFoot').innerHTML = `<button class="btn" onclick="closeModal()">取消</button>`;
    }

    window.resetBattle = () => {
      phase = 0; qIdx = 0; bossHP = cfg.phases[0].bossHP; playerHP = 3; bossDefeated = false;
      renderBoss();
    };

    renderBoss();
  }
});

// =========================================================================
// 8z. DEFAULT INTERACTION
// =========================================================================

// =========================================================================
// NEW: config_debug - 给破损配置文件，学生修复后运行验证
// =========================================================================
registerInteraction('config_debug', {
  render(container, task) {
    const cfg = task.config;
    const brokenConfig = cfg.brokenConfig || '# 配置文件加载失败';
    const expectedOutput = cfg.expectedOutput || '';
    const hints = cfg.hints || ['检查语法', '对照示例修正', '运行验证'];
    let editorContent = brokenConfig;
    let executed = false;

    container.innerHTML = `
      <div style="margin-bottom:10px;font-size: 14px;color:var(--dim)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>🛠 修复配置文件</span>
          <span id="cfgStatus" style="font-size: 14px;color:var(--amber)">待修复</span>
        </div>
        ${cfg.description ? '<div style="font-size: 14px;color:var(--text);margin-bottom:8px">' + cfg.description + '</div>' : ''}
      </div>
      <div class="term-root" style="height:320px;display:flex;flex-direction:column">
        <div class="term-header">
          <span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span>
          <span>${cfg.fileName || 'config.yaml'}</span>
          <span id="cfgStatus2"></span>
        </div>
        <div class="term-body" style="flex:1;overflow:auto;position:relative">
          <textarea id="cfgEditor" spellcheck="false" style="
            width:100%;height:100%;background:#0a0a10;color:var(--text);
            border:none;outline:none;font-family:inherit;font-size: 14px;line-height:1.5;
            padding:10px;resize:none;tab-size:2"
          ></textarea>
        </div>
        <div class="term-body" id="cfgOutputArea" style="min-height:60px;max-height:120px;overflow:auto;display:none;border-top:1px solid var(--border);background:#0a0a10">
          <div style="padding:8px;font-size: 14px;color:var(--dim)">▼ 运行输出</div>
          <pre id="cfgOutput" style="padding:0 8px 8px;font-family:inherit;font-size: 14px;line-height:1.5;white-space:pre-wrap;color:var(--green)"></pre>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="cfgRunBtn">▶ 运行验证</button>
        <button class="btn" id="cfgHintBtn">💡 提示 (${hints.length})</button>
        <button class="btn" id="cfgResetBtn">↺ 重置</button>
      </div>
    `;

    const editor = document.getElementById('cfgEditor');
    editor.value = brokenConfig;

    let hintIdx = 0;
    document.getElementById('cfgRunBtn').onclick = async () => {
      if (executed) return;
      const userConfig = editor.value;
      document.getElementById('cfgOutputArea').style.display = 'block';
      document.getElementById('cfgRunBtn').textContent = '⏳ 运行中...';
      document.getElementById('cfgRunBtn').disabled = true;

      // Simulate validation - in real impl, could POST to backend sandbox
      await new Promise(r => setTimeout(r, 500));
      
      // Simple validation: check if key fixes are present
      const checks = cfg.validationChecks || [];
      let passed = true;
      let output = '';
      
      if (checks.length > 0) {
        output = '=== 验证结果 ===\n';
        checks.forEach((check, i) => {
          const ok = check.test(userConfig);
          output += ok ? ` ✅ ${check.desc}\n` : ` ❌ ${check.desc}\n`;
          if (!ok) passed = false;
        });
      } else {
      errors++;
      streak = 0;
        // Fallback: compare with expected output keywords
        const keywords = (cfg.keywords || []).filter(k => userConfig.includes(k));
        passed = keywords.length === (cfg.keywords || []).length;
        output = passed 
          ? '✅ 配置验证通过！\n' + (expectedOutput || '预期输出匹配')
          : '❌ 配置仍有问题，请检查关键字段';
      }

      document.getElementById('cfgOutput').textContent = output;
      document.getElementById('cfgStatus').textContent = passed ? '✅ 通过' : '❌ 失败';
      document.getElementById('cfgStatus').style.color = passed ? 'var(--green)' : 'var(--red)';
      document.getElementById('cfgStatus2').textContent = passed ? '✅ 验证通过' : '❌ 验证失败';
      document.getElementById('cfgRunBtn').textContent = passed ? '✅ 完成' : '🔄 重新运行';
      document.getElementById('cfgRunBtn').classList.toggle('btn-success', passed);
      document.getElementById('cfgRunBtn').classList.toggle('btn-primary', !passed);
      document.getElementById('cfgRunBtn').disabled = false;
      executed = passed;

      if (passed) {
        playSound('success');
        setTimeout(() => completeTask(task.id, taskXP(task)), 800);
      } else {
      errors++;
      streak = 0;
        playSound('error');
      }
    };

    document.getElementById('cfgHintBtn').onclick = () => {
      if (hintIdx < hints.length) {
        showToast(hints[hintIdx], 'info');
        hintIdx++;
      } else {
      errors++;
      streak = 0;
        showToast('厂长摇头——最后一条提示也给你了', 'info');
      }
    };

    document.getElementById('cfgResetBtn').onclick = () => {
      editor.value = brokenConfig;
      document.getElementById('cfgOutputArea').style.display = 'none';
      document.getElementById('cfgStatus').textContent = '待修复';
      document.getElementById('cfgStatus').style.color = 'var(--amber)';
      document.getElementById('cfgStatus2').textContent = '';
      document.getElementById('cfgRunBtn').textContent = '▶ 运行验证';
      document.getElementById('cfgRunBtn').classList.remove('btn-success');
      document.getElementById('cfgRunBtn').classList.add('btn-primary');
      document.getElementById('cfgRunBtn').disabled = false;
      executed = false;
      hintIdx = 0;
    };
  }
});

// =========================================================================
// NEW: log_forensics - 给日志片段，学生定位根因（多选/拖拽排序）
// =========================================================================
registerInteraction('log_forensics', {
  render(container, task) {
    const cfg = task.config;
    const logs = cfg.logs || ['日志加载失败'];
    const options = cfg.options || []; // [{id, text, correct, explanation}]
    const allowMulti = cfg.multiSelect !== false;
    let selected = new Set();

    container.innerHTML = `
      <div style="margin-bottom:10px">
        <div style="font-size: 15px;margin-bottom:8px;color:var(--text)">${cfg.scenario || '分析以下日志，定位故障根因'}</div>
        <div class="term-root" style="max-height:200px;overflow:auto;margin-bottom:12px;border:1px solid var(--border);background:#0a0a10">
          <div class="term-header" style="position:sticky;top:0;background:#0a0a10;z-index:1">
            <span class="term-dots"><span class="term-dot red"></span><span class="term-dot yellow"></span><span class="term-dot green"></span></span>
            <span>📋 系统日志</span>
          </div>
          <pre id="forensicsLog" style="padding:10px;margin:0;font-family:inherit;font-size: 14px;line-height:1.5;color:var(--dim);white-space:pre-wrap"></pre>
        </div>
      </div>
      <div style="font-size: 14px;color:var(--dim);margin-bottom:8px">
        ${allowMulti ? '可多选，点击选项切换' : '单选，点击选择答案'}
      </div>
      <div id="forensicsOptions" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="forensicsExplanation" style="margin-top:12px;padding:10px;background:#1a1a24;border:1px solid var(--border);display:none"></div>
    `;

    document.getElementById('forensicsLog').textContent = logs.join('\n');

    const optContainer = document.getElementById('forensicsOptions');
    options.forEach((opt, i) => {
      const el = document.createElement('div');
      el.className = 'forensics-opt';
      el.style.cssText = 'padding:10px 12px;background:#12121a;border:2px solid var(--border);border-radius:4px;cursor:pointer;transition:all .2s;font-size: 14px';
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <span class="opt-mark" style="width:18px;height:18px;border:2px solid var(--border);border-radius:${allowMulti ? '2px' : '50%'};display:flex;align-items:center;justify-content:center;font-size: 14px;color:var(--green)"></span>
          <span>${opt.text}</span>
        </div>
      `;
      el.onclick = () => {
        if (allowMulti) {
          if (selected.has(opt.id)) selected.delete(opt.id);
          else selected.add(opt.id);
        } else {
      errors++;
      streak = 0;
          selected.clear();
          selected.add(opt.id);
        }
        renderOptions();
      };
      optContainer.appendChild(el);
    });

    function renderOptions() {
      document.querySelectorAll('.forensics-opt').forEach((el, i) => {
        const opt = options[i];
        const mark = el.querySelector('.opt-mark');
        const isSel = selected.has(opt.id);
        if (isSel) {
          el.style.borderColor = 'var(--green)';
          el.style.background = 'rgba(0,230,118,.1)';
          mark.textContent = allowMulti ? '✓' : '●';
          mark.style.borderColor = 'var(--green)';
          mark.style.background = 'var(--green)';
          mark.style.color = '#000';
        } else {
      errors++;
      streak = 0;
          el.style.borderColor = 'var(--border)';
          el.style.background = '#12121a';
          mark.textContent = '';
          mark.style.borderColor = 'var(--border)';
          mark.style.background = 'transparent';
        }
      });
    }

    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="forensicsSubmit" disabled>✓ 提交分析</button>
    `;

    // Enable submit when at least one selected
    const obs = new MutationObserver(() => {
      document.getElementById('forensicsSubmit').disabled = selected.size === 0;
    });
    obs.observe(optContainer, { childList: true, subtree: true, attributes: true });

    document.getElementById('forensicsSubmit').onclick = () => {
      const correctIds = options.filter(o => o.correct).map(o => o.id);
      const isCorrect = allowMulti
        ? selected.size === correctIds.length && [...selected].every(id => correctIds.includes(id))
        : correctIds.includes([...selected][0]);

      const expl = document.getElementById('forensicsExplanation');
      expl.style.display = 'block';
      
      if (isCorrect) {
        expl.innerHTML = `<div style="color:var(--green)">✅ 分析正确！</div>${options.filter(o => correctIds.includes(o.id)).map(o => `<div style="margin-top:6px;color:var(--text)"><strong>${o.text}</strong>: ${o.explanation || ''}</div>`).join('')}`;
        playSound('success');
        setTimeout(() => completeTask(task.id, taskXP(task)), 800);
      } else {
      errors++;
      streak = 0;
        expl.innerHTML = `<div style="color:var(--red)">❌ 分析有误，请重新排查</div>${options.filter(o => selected.has(o.id) && !o.correct).map(o => `<div style="margin-top:6px;color:var(--amber)">⚠ ${o.text}: ${o.explanation || '这不是根因'}</div>`).join('')}`;
        playSound('error');
      }
      document.getElementById('forensicsSubmit').disabled = true;
      document.getElementById('forensicsSubmit').textContent = isCorrect ? '✅ 完成' : '🔄 重新分析';
      if (!isCorrect) {
        setTimeout(() => {
          document.getElementById('forensicsSubmit').disabled = false;
          document.getElementById('forensicsSubmit').textContent = '✓ 提交分析';
          expl.style.display = 'none';
        }, 1500);
      }
    };
  }
});


registerInteraction('default', {
  render(container, task) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--dim)">
        <div style="font-size:32px;margin-bottom:12px">📋</div>
        <div style="font-size: 15px;margin-bottom:8px">${task.title}</div>
        <div style="font-size: 14px">在教材中完成此任务后，点击下方按钮确认</div>
      </div>
    `;
    document.getElementById('modalFoot').innerHTML = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-success" onclick="completeTask('${task.id}', ${taskXP(task)})">✓ 确认完成</button>
    `;
  }
});

// =========================================================================
// 9. HEADER
// =========================================================================
function renderHeader() {
  const xp = calcTotalXP();
  const rank = getRank(xp);
  const nextRank = RANKS.find(r => r.min > xp);
  const maxXP = nextRank ? nextRank.min : 8000;
  const minXP = rank.min;
  const pct = nextRank ? Math.round((xp - minXP) / (nextRank.min - minXP) * 100) : 100;

  document.getElementById('playerDisplay').textContent = myName;
  document.getElementById('rankDisplay').textContent = rank.title;
  document.getElementById('xpFill').style.width = Math.min(pct, 100) + '%';
  document.getElementById('xpLabel').textContent = xp + ' / ' + (nextRank ? nextRank.min + '' : 'MAX');
  var _wa = document.getElementById('walletAmt');
  if (_wa) _wa.textContent = (gameState.coins || 0);
  
  // Update director mini-avatar mood
  updateDirectorAvatar();
}

// =========================================================================
// 9b. 工资 & 商城（钱包）
// =========================================================================
let SHOP_CACHE = null;
function loadShop() {
  if (SHOP_CACHE) return Promise.resolve(SHOP_CACHE);
  return api('/api/student/shop').then(r => { SHOP_CACHE = (r && r.ok) ? r.data : []; return SHOP_CACHE; }).catch(() => []);
}
function walletRank(xp) {
  var R=[{min:0,t:'实习生',e:'🔰'},{min:1000,t:'学徒',e:'🔧'},{min:2500,t:'技工',e:'⚙️'},{min:4500,t:'工程师',e:'🛠️'},{min:7000,t:'专家',e:'🏆'}];
  var r=R[0]; for (var i=0;i<R.length;i++) if (xp>=R[i].min) r=R[i];
  return r;
}
function buildWallet() {
  if (document.getElementById('walletOverlay')) return;
  var ov=document.createElement('div');
  ov.className='gz-overlay'; ov.id='walletOverlay';
  ov.innerHTML='<div class="gz-box"><div class="pd-head"><div><div class="pd-title">💰 工资与商城</div><div class="pd-sub">上班打卡领工资 · 金币买道具</div></div><div class="pd-close" onclick="closeWallet()">✕</div></div><div class="pd-body" id="walletBody"></div></div>';
  document.body.appendChild(ov);
}
function openWallet(){ buildWallet(); renderWallet(); document.getElementById('walletOverlay').classList.add('show'); }
function closeWallet(){ if (_mapFlowFeature) { goMap(); return; } var o=document.getElementById('walletOverlay'); if(o) o.classList.remove('show'); }
function renderWallet() {
  var body=document.getElementById('walletBody'); if(!body) return;
  var si=gameState.salaryInfo||{}, inv=gameState.inventory||{}, coins=gameState.coins||0;
  var rank=walletRank(si.xp||0), rate=si.rate||100;
  loadShop().then(function(items){
    var html='';
    html+='<div class="gz-section">📅 上班打卡</div>';
    html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji">'+rank.e+'</span><span class="gz-name">'+rank.t+' · 日薪 <b style="color:var(--amber)">'+rate+'</b> 金币</span><span class="gz-meta">本月累计 <b style="color:var(--amber)">'+(si.monthTotal||0)+'</b></span></div>';
    if (si.claimedToday) html+='<div class="gz-row" style="cursor:default;border-color:var(--green)"><span class="gz-emoji">✅</span><span class="gz-name">今日工资已领（'+rate+' 金币）</span></div>';
    else html+='<div class="gz-row" onclick="claimSalaryNow()"><span class="gz-emoji">🕐</span><span class="gz-name">今日还没打卡领工资</span><span class="gz-meta"><button class="mm-btn primary" onclick="event.stopPropagation();claimSalaryNow()">打卡 +'+rate+'</button></span></div>';
    html+='<div class="gz-section">🛒 商城 · 余额 <b style="color:var(--amber)">'+coins+'</b> 💰</div>';
    (items||[]).forEach(function(it){
      var afford=coins>=it.price;
      var owned=(inv[it.id]||0)>0 && (it.type==='skin'||it.type==='title') ? '已拥有' : '';
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji">'+it.emoji+'</span><span class="gz-name">'+escHtml(it.name)+' <span style="font-size:12px;color:var(--dim)">'+escHtml(it.desc)+'</span></span><span class="gz-meta">'+it.price+'💰 '+(owned?owned+' · ':'')+'</span><span><button class="mm-btn'+(afford?' primary':'')+'" data-id="'+it.id+'" '+(afford?'onclick="buyItem(this.dataset.id)"':'disabled style="opacity:.4"')+'>购买</button></span></div>';
    });
    var ownedList=Object.keys(inv).filter(function(k){return inv[k]>0;});
    html+='<div class="gz-section">🎒 背包</div>';
    if (!ownedList.length) html+='<div class="gz-row" style="cursor:default"><span class="gz-name" style="color:var(--dim)">背包空空，去商城买点道具吧</span></div>';
    else {
      ownedList.forEach(function(id){
        var it=null; (items||[]).forEach(function(x){ if(x.id===id) it=x; });
        var usable=(it && (it.type==='shooter'||it.type==='task'));
        html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji">'+(it?it.emoji:'🎁')+'</span><span class="gz-name">'+escHtml(it?it.name:id)+' ×'+inv[id]+'</span><span class="gz-meta">'+(usable?'进游戏时可用':'永久生效')+'</span></div>';
      });
    }
    // 外观
    html+='<div class="gz-section">🎨 外观（装备皮肤，永久）</div>';
    html+='<div class="gz-row" style="cursor:default;background:none"><span class="gz-name" style="font-size:13px;color:var(--cyan)">✈️ 飞机皮肤</span></div>';
    Object.keys(PLANE_SKINS).forEach(function(id){
      var sk=PLANE_SKINS[id], owned=(id==='default')||(inv[id]>0), eq=getEquippedSkin('plane')===id;
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji" style="background:'+sk.col+';width:18px;height:18px;border-radius:4px;display:inline-block"></span><span class="gz-name">'+sk.name+'</span><span class="gz-meta">'+(eq?'已装备':(owned?'已拥有':'未拥有'))+'</span><span>'+(owned&&!eq?'<button class="mm-btn" data-type="plane" data-id="'+id+'" onclick="equipSkin(this.dataset.type,this.dataset.id)">装备</button>':'')+'</span></div>';
    });
    html+='<div class="gz-row" style="cursor:default;background:none"><span class="gz-name" style="font-size:13px;color:var(--cyan)">👾 敌人皮肤</span></div>';
    Object.keys(ENEMY_SKIN_COLORS).forEach(function(id){
      var sk=ENEMY_SKIN_COLORS[id], owned=(id==='default')||(inv[id]>0), eq=getEquippedSkin('enemy')===id;
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji" style="background:'+sk.col+';width:18px;height:18px;border-radius:4px;display:inline-block"></span><span class="gz-name">'+sk.name+'</span><span class="gz-meta">'+(eq?'已装备':(owned?'已拥有':'未拥有'))+'</span><span>'+(owned&&!eq?'<button class="mm-btn" data-type="enemy" data-id="'+id+'" onclick="equipSkin(this.dataset.type,this.dataset.id)">装备</button>':'')+'</span></div>';
    });
    body.innerHTML=html;
  });
}
function claimSalaryNow() {
  api('/api/student/claim-salary', { method:'POST', body:'{}' }).then(function(r){
    if (r && r.ok) {
      gameState.coins=r.data.coins;
      gameState.salaryInfo=Object.assign({}, gameState.salaryInfo, { monthTotal:r.data.monthTotal, rate:r.data.rate, claimedToday:true });
      showToast('💰 打卡成功 +'+r.data.gained+' 金币','success');
      renderWallet(); renderHeader();
    } else showToast((r&&r.error)||'打卡失败','error');
  });
}
function buyItem(itemId) {
  api('/api/student/buy', { method:'POST', body:JSON.stringify({itemId:itemId}) }).then(function(r){
    if (r && r.ok) {
      gameState.coins=r.data.coins; gameState.inventory=r.data.inventory;
      showToast('🛒 购买成功！','success');
      renderWallet(); renderHeader();
    } else showToast((r&&r.error)||'购买失败','error');
  });
}
// ===== 皮肤系统 =====
const PLANE_SKINS = {
  default:      { name:'翠绿战机', col:'#00e676', ck:'#aaffcc' },
  plane_skin:   { name:'黄金战机', col:'#ffb300', ck:'#ffe9a8' },
  plane_red:    { name:'烈焰红',   col:'#ff5252', ck:'#ffd0d0' },
  plane_blue:   { name:'冰晶蓝',   col:'#40c4ff', ck:'#d6f5ff' },
  plane_purple: { name:'紫电',     col:'#b388ff', ck:'#ecdfff' },
  plane_neon:   { name:'霓虹',     col:'#ff6ec7', ck:'#ffe0f3' }
};
const ENEMY_SKIN_COLORS = {
  default:      { name:'网络蓝', col:'#00bcd4' },
  enemy_night:  { name:'夜战迷彩', col:'#5c6bc0' },
  enemy_matrix: { name:'矩阵绿', col:'#00c853' },
  enemy_lava:   { name:'岩浆橙', col:'#ff7043' },
  enemy_ice:    { name:'寒冰蓝', col:'#4fc3f7' },
  enemy_void:   { name:'紫雾', col:'#ab6cff' }
};
function getEquippedSkin(type){ try{ return localStorage.getItem('skin_'+type) || 'default'; }catch(e){ return 'default'; } }
function equippedEnemySkin(){ var m=ENEMY_SKIN_COLORS[getEquippedSkin('enemy')]; return m ? m.col : null; }
function equipSkin(type, id){
  var inv=gameState.inventory||{};
  if (id!=='default' && !(inv[id]>0)) { showToast('还没有这个皮肤，先去商城买', 'error'); return; }
  try{ localStorage.setItem('skin_'+type, id); }catch(e){}
  var nm = type==='plane' ? ((PLANE_SKINS[id]||{}).name) : ((ENEMY_SKIN_COLORS[id]||{}).name);
  showToast('🎨 已装备：'+(nm||id), 'success');
  renderWallet();
}

// Director mini-avatar mood sync
let directorMood = 'neutral';
function updateDirectorAvatar(mood) {
  if (mood) directorMood = mood;
  const avatar = document.getElementById('directorAvatar');
  if (!avatar) return;
  const emojiMap = { proud: '😎', stern: '😤', awkward: '😅', thinking: '🤔', neutral: '👨‍💼' };
  avatar.textContent = emojiMap[directorMood] || '👨‍💼';
  avatar.className = 'director-avatar director-mood-' + directorMood;
  // Auto-reset to neutral after 3s
  clearTimeout(avatar._resetTimer);
  avatar._resetTimer = setTimeout(() => {
    directorMood = 'neutral';
    avatar.textContent = '👨‍💼';
    avatar.className = 'director-avatar director-mood-neutral';
  }, 3000);
}

// =========================================================================
// 9b. LEADERBOARD & ACHIEVEMENTS
// =========================================================================
function escHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

const ACHIEVEMENTS = [
  { id: 'first_task', name: '第一滴汗', desc: '完成第 1 个任务', emoji: '💧', test: c => c.doneCount >= 1 },
  { id: 'task_10', name: '小试牛刀', desc: '累计完成 10 个任务', emoji: '🔟', test: c => c.doneCount >= 10 },
  { id: 'task_30', name: '熟练工', desc: '累计完成 30 个任务', emoji: '🔧', test: c => c.doneCount >= 30 },
  { id: 'task_60', name: '产线骨干', desc: '累计完成 60 个任务', emoji: '🏅', test: c => c.doneCount >= 60 },
  { id: 'task_all', name: '全勤王', desc: '完成全部任务', emoji: '👑', test: c => c.allDone },
  { id: 'lv_1', name: '数字工位落成', desc: '完成第 1 关', emoji: '🖥️', test: c => !!c.levelDone['1'] },
  { id: 'lv_2', name: '正式入职', desc: '完成第 2 关', emoji: '🎛️', test: c => !!c.levelDone['2'] },
  { id: 'lv_3', name: '设备联网成功', desc: '完成第 3 关', emoji: '🌐', test: c => !!c.levelDone['3'] },
  { id: 'lv_4', name: '边缘计算大师', desc: '完成第 4 关', emoji: '📦', test: c => !!c.levelDone['4'] },
  { id: 'lv_5', name: '云端漫步', desc: '完成第 5 关', emoji: '☁️', test: c => !!c.levelDone['5'] },
  { id: 'lv_6', name: '驾驶舱落成', desc: '完成第 6 关', emoji: '📊', test: c => !!c.levelDone['6'] },
  { id: 'lv_7', name: '数据大贯通', desc: '完成第 7 关', emoji: '🧲', test: c => !!c.levelDone['7'] },
  { id: 'lv_8', name: 'AI 实验室点亮', desc: '完成第 8 关', emoji: '🤖', test: c => !!c.levelDone['8'] },
  { id: 'factory_all', name: '全厂灯火通明', desc: '8 个区域全部点亮', emoji: '🏭', test: c => c.allLevels },
  { id: 'pioneer', name: '开路先锋', desc: '成为某一关的班级首位完成者', emoji: '🚩', test: c => c.isPioneer },
  { id: 'xp_1000', name: '第一桶金', desc: '累计获得 1000 XP', emoji: '💰', test: c => c.xp >= 1000 },
  { id: 'xp_2500', name: '技工出师', desc: '累计获得 2500 XP', emoji: '⚒️', test: c => c.xp >= 2500 },
  { id: 'xp_4500', name: '高级工程师', desc: '累计获得 4500 XP', emoji: '🛠️', test: c => c.xp >= 4500 },
  { id: 'star_3', name: '三星好评', desc: '某一关综合星数达到 3 星', emoji: '⭐', test: c => c.anyLevel3Star },
  { id: 'star_5', name: '满星传说', desc: '某一关综合星数达到 5 星', emoji: '🌟', test: c => c.anyLevel5Star },
  { id: 'mm_streak', name: '翻牌连对王', desc: '某次翻牌连续配对成功 5 次（不失误）', emoji: '🔥', test: c => c.mmStreak >= 5 },
  { id: 'qk_combo', name: '快打连击王', desc: '快打最高连击达到 5', emoji: '⚡', test: c => c.qkCombo >= 5 },
  { id: 'game_win1', name: '小游戏初体验', desc: '完成 1 个小游戏', emoji: '🎮', test: c => c.gamesWin >= 1 },
  { id: 'game_win3', name: '小游戏新兵', desc: '完成 3 个小游戏', emoji: '🎲', test: c => c.gamesWin >= 3 },
  { id: 'game_win8', name: '小游戏达人', desc: '完成 8 个小游戏', emoji: '🥇', test: c => c.gamesWin >= 8 },
  { id: 'mm_matched', name: '翻牌收藏家', desc: '累计配对成功 30 次', emoji: '🗂️', test: c => c.mmMatched >= 30 },
  // —— 小游戏·分类累计 ——
  { id: 'mm_win3', name: '翻牌新生', desc: '累计完成 3 次翻牌游戏', emoji: '🃏', test: c => c.mmWins >= 3 },
  { id: 'mm_win8', name: '翻牌熟练工', desc: '累计完成 8 次翻牌游戏', emoji: '🧩', test: c => c.mmWins >= 8 },
  { id: 'qk_win5', name: '快打熟练工', desc: '累计完成 5 次快打', emoji: '🖊️', test: c => c.qkWins >= 5 },
  { id: 'qk_win12', name: '快打大师', desc: '累计完成 12 次快打', emoji: '🎓', test: c => c.qkWins >= 12 },
  { id: 'match_win3', name: '连线小能手', desc: '累计完成 3 次连线配对', emoji: '🔗', test: c => c.matchWins >= 3 },
  { id: 'all_types', name: '全能选手', desc: '翻牌、快打、连线三类小游戏都完成过', emoji: '🏟️', test: c => c.mmWins >= 1 && c.qkWins >= 1 && c.matchWins >= 1 },
  // —— 小游戏·单关重复（鼓励反复玩、加深记忆）——
  { id: 'l1_flip3', name: '首关翻牌·三顾', desc: '第 1 关翻牌游戏累计完成 3 次', emoji: '🧠', test: c => (c.lvlWins['1'] || 0) >= 3 },
  { id: 'l1_flip5', name: '首关翻牌·常客', desc: '第 1 关翻牌游戏累计完成 5 次', emoji: '🎩', test: c => (c.lvlWins['1'] || 0) >= 5 },
  { id: 'l2_quick5', name: '二关快打·老手', desc: '第 2 关快打游戏累计完成 5 次', emoji: '🐇', test: c => (c.lvlWins['2'] || 0) >= 5 },
  { id: 'l3_flip3', name: '三关翻牌·熟客', desc: '第 3 关翻牌游戏累计完成 3 次', emoji: '🔬', test: c => (c.lvlWins['3'] || 0) >= 3 },
  // —— 小游戏·累计 ——
  { id: 'game_20', name: '游戏厅常客', desc: '累计完成 20 个小游戏', emoji: '🕹️', test: c => c.gamesWin >= 20 },
  { id: 'sorter_1', name: '分拣新手', desc: '数据分类大师通关 1 次', emoji: '📦', test: c => (c.sorterWins||0) >= 1 },
  { id: 'sorter_3', name: '分拣熟手', desc: '数据分类大师通关 3 次', emoji: '📦', test: c => (c.sorterWins||0) >= 3 },
  { id: 'sorter_5', name: '分拣大师', desc: '数据分类大师通关 5 次', emoji: '🏅', test: c => (c.sorterWins||0) >= 5 },
  { id: 'sorter_combo', name: '连对如飞', desc: '数据分类大师单局连击 20', emoji: '⚡', test: c => (c.sorterCombo||0) >= 20 },
  { id: 'sorter_score', name: '高分分拣', desc: '数据分类大师单局得分 1500', emoji: '💯', test: c => (c.sorterBest||0) >= 1500 },
  { id: 'forge_1', name: '炼出第一炉', desc: '数据熔炉通关 1 次', emoji: '🔥', test: c => (c.forgeWins||0) >= 1 },
  { id: 'forge_3', name: '熔炉熟手', desc: '数据熔炉通关 3 次', emoji: '🔥', test: c => (c.forgeWins||0) >= 3 },
  { id: 'forge_combo', name: '连炉高手', desc: '数据熔炉单局连击 15', emoji: '⚙️', test: c => (c.forgeCombo||0) >= 15 },
  { id: 'forge_score', name: '炼金术士', desc: '数据熔炉单局得分 3000', emoji: '💰', test: c => (c.forgeBest||0) >= 3000 },
  { id: 'll_1', name: '连连看首秀', desc: '连连看通关 1 次', emoji: '🔗', test: c => (c.llWins||0) >= 1 },
  { id: 'll_3', name: '连线熟手', desc: '连连看通关 3 次', emoji: '🔗', test: c => (c.llWins||0) >= 3 },
  { id: 'll_score', name: '路径大师', desc: '连连看单局得分 6000', emoji: '🧭', test: c => (c.llBest||0) >= 6000 },
  { id: 'pipe_1', name: '首次接通', desc: '管道工通关 1 次', emoji: '🔧', test: c => (c.pipeWins||0) >= 1 },
  { id: 'pipe_3', name: '管道工', desc: '管道工通关 3 次', emoji: '🔧', test: c => (c.pipeWins||0) >= 3 },
  { id: 'pipe_score', name: '无瑕管线', desc: '管道工单局得分 1500', emoji: '📶', test: c => (c.pipeBest||0) >= 1500 },
  { id: 'm3_1', name: '首消三连', desc: '消消乐通关 1 次', emoji: '🍬', test: c => (c.m3Wins||0) >= 1 },
  { id: 'm3_3', name: '连消熟手', desc: '消消乐通关 3 次', emoji: '🍬', test: c => (c.m3Wins||0) >= 3 },
  { id: 'm3_score', name: '清场大师', desc: '消消乐单局得分 3000', emoji: '✨', test: c => (c.m3Best||0) >= 3000 },
  { id: 'td_1', name: '第一道防线', desc: '车间防线通关 1 次', emoji: '🛡️', test: c => (c.tdWins||0) >= 1 },
  { id: 'td_3', name: '防线工事', desc: '车间防线通关 3 次', emoji: '🛡️', test: c => (c.tdWins||0) >= 3 },
  { id: 'td_waves', name: '坚不可摧', desc: '车间防线单局守到第 5 波', emoji: '🏰', test: c => (c.tdBest||0) >= 5 },
  { id: 't48_1', name: '融合初体验', desc: '2048 数据融合通关 1 次', emoji: '🔢', test: c => (c.t48Wins||0) >= 1 },
  { id: 't48_3', name: '融合熟手', desc: '2048 数据融合通关 3 次', emoji: '🔢', test: c => (c.t48Wins||0) >= 3 },
  { id: 't48_score', name: '数据炼金师', desc: '2048 数据融合单局得分 5000', emoji: '🧪', test: c => (c.t48Best||0) >= 5000 },
  { id: 'maze_1', name: '首达彼岸', desc: '数据迷宫通关 1 次', emoji: '🌐', test: c => (c.mazeWins||0) >= 1 },
  { id: 'maze_3', name: '迷宫老手', desc: '数据迷宫通关 3 次', emoji: '🌐', test: c => (c.mazeWins||0) >= 3 },
  { id: 'hack_1', name: '黑客初体验', desc: '黑客终端通关 1 次', emoji: '🕹️', test: c => (c.hackWins||0) >= 1 },
  { id: 'hack_3', name: '网络黑客', desc: '黑客终端通关 3 次', emoji: '🕹️', test: c => (c.hackWins||0) >= 3 },
  { id: 'tyc_1', name: '工厂主', desc: '工厂大亨通关 1 次', emoji: '🏭', test: c => (c.tycWins||0) >= 1 },
  { id: 'tyc_3', name: '工业巨头', desc: '工厂大亨通关 3 次', emoji: '🏭', test: c => (c.tycWins||0) >= 3 },
  { id: 'lzr_1', name: '点亮通路', desc: '激光反射通关 1 次', emoji: '🔦', test: c => (c.lzrWins||0) >= 1 },
  { id: 'lzr_3', name: '光束大师', desc: '激光反射通关 3 次', emoji: '🔦', test: c => (c.lzrWins||0) >= 3 },
  { id: 'boss_1', name: '一击命中', desc: '弹射排障通关 1 次', emoji: '🎯', test: c => (c.bossWins||0) >= 1 },
  { id: 'boss_3', name: '排障炮手', desc: '弹射排障通关 3 次', emoji: '🎯', test: c => (c.bossWins||0) >= 3 },
  // —— 图鉴收藏 ——
  { id: 'pedia_20', name: '图鉴小成', desc: '术语图鉴收集 20 个', emoji: '📖', test: c => c.pediaCount >= 20 },
  { id: 'pedia_40', name: '图鉴达人', desc: '术语图鉴收集 40 个', emoji: '📚', test: c => c.pediaCount >= 40 },
  { id: 'pedia_70', name: '图鉴收藏家', desc: '术语图鉴收集 70 个', emoji: '🏛️', test: c => c.pediaCount >= 70 },
  // —— 技术流（零失误 / 满贯）——
  { id: 'mm_streak6', name: '翻牌零失误', desc: '某次翻牌连续配对成功 6 次（一次不失误）', emoji: '💯', test: c => c.mmStreak >= 6 },
  { id: 'qk_full', name: '快打满贯', desc: '快打最高连击达到 6（一次不错）', emoji: '🎯', test: c => c.qkCombo >= 6 },
  // —— 登录签到（系统自动发放，教师也可手动补发）——
  { id: 'login_first', name: '初次报到', desc: '完成人生第一次登录', emoji: '👋', test: () => false },
  { id: 'login_3', name: '三日坚持', desc: '连续登录 3 天', emoji: '📆', test: () => false },
  { id: 'login_7', name: '七日打卡', desc: '连续登录 7 天', emoji: '🗓️', test: () => false },
  { id: 'login_14', name: '半月全勤', desc: '连续登录 14 天', emoji: '📅', test: () => false },
  { id: 'login_30', name: '满月老友', desc: '连续登录 30 天', emoji: '🌕', test: () => false },
  // —— 反馈 BUG · 抓虫有奖（教师手动发放，按反馈次数递进）——
  { id: 'bug_1', name: '火眼金睛', desc: '反馈 1 个 Bug，眼睛真尖', emoji: '👁️', test: () => false },
  { id: 'bug_3', name: '找茬学徒', desc: '反馈 3 个 Bug，正式入门', emoji: '🔍', test: () => false },
  { id: 'bug_5', name: '质检员', desc: '反馈 5 个 Bug，领到质检工牌', emoji: '🧐', test: () => false },
  { id: 'bug_8', name: 'Bug 猎手', desc: '反馈 8 个 Bug，一抓一个准', emoji: '🕵️', test: () => false },
  { id: 'bug_12', name: '质检组长', desc: '反馈 12 个 Bug，能带找茬小队', emoji: '📋', test: () => false },
  { id: 'bug_20', name: '质量工程师', desc: '反馈 20 个 Bug，产线质量你说了算', emoji: '🧪', test: () => false },
  { id: 'bug_30', name: '质控总监', desc: '反馈 30 个 Bug，全厂质量大权在握', emoji: '📜', test: () => false },
  { id: 'bug_50', name: 'Bug 终结者', desc: '反馈 50 个 Bug，让 Bug 无处可逃', emoji: '💣', test: () => false },
  // —— 术语防御战（打字炮台）——
  { id: 'ty_1', name: '首战告捷', desc: '完成 1 次术语防御战', emoji: '🔫', test: c => c.typingWins >= 1 },
  { id: 'ty_2', name: '二连击落', desc: '完成 2 次术语防御战', emoji: '⌨️', test: c => c.typingWins >= 2 },
  { id: 'ty_5', name: '键盘杀手', desc: '完成 5 次术语防御战', emoji: '🖱️', test: c => c.typingWins >= 5 },
  { id: 'ty_10', name: '打字大师', desc: '完成 10 次术语防御战', emoji: '🎹', test: c => c.typingWins >= 10 },
  { id: 'ty_20', name: '术语终结者', desc: '完成 20 次术语防御战', emoji: '🥷', test: c => c.typingWins >= 20 },
  // —— 数据蜂群（小蜜蜂式射击）——
  { id: 'sh_1', name: '首战清空', desc: '通关 1 次数据蜂群', emoji: '🛸', test: c => c.shooterWins >= 1 },
  { id: 'sh_3', name: '蜂群杀手', desc: '通关 3 次数据蜂群', emoji: '🐝', test: c => c.shooterWins >= 3 },
  { id: 'sh_5', name: '王牌炮手', desc: '通关 5 次数据蜂群', emoji: '💥', test: c => c.shooterWins >= 5 },
  { id: 'sh_lv3', name: '火力全开', desc: '数据蜂群中火力升到 3 级', emoji: '🚀', test: c => (c.shooterMaxLevel||0) >= 3 },
  { id: 'sh_pk20', name: '拾荒高手', desc: '数据蜂群累计拾取 20 个道具', emoji: '🎁', test: c => (c.shooterPickups||0) >= 20 },
  // —— 解锁小游戏类型 ——
  { id: 'gt_1', name: '游戏开张', desc: '解锁 1 种小游戏类型', emoji: '🎈', test: c => c.gameTypes >= 1 },
  { id: 'gt_3', name: '渐入佳境', desc: '解锁 3 种小游戏类型', emoji: '🎪', test: c => c.gameTypes >= 3 },
  { id: 'gt_5', name: '游戏老玩家', desc: '解锁 5 种小游戏类型', emoji: '🏆', test: c => c.gameTypes >= 5 },
  { id: 'gt_all', name: '全类型制霸', desc: '解锁全部小游戏类型', emoji: '👾', test: c => c.gameTypes >= 7 }
];

// 小游戏表现统计（localStorage，本地记录）
function getGameStats() {
  try { return JSON.parse(localStorage.getItem('game_stats') || '{}'); } catch (e) { return {}; }
}
function saveGameStats(s) { localStorage.setItem('game_stats', JSON.stringify(s)); }
function bumpGameStats(patch) {
  const s = getGameStats();
  Object.assign(s, patch);
  saveGameStats(s);
}
// ===== 小游戏周目：通关次数 → 二周目(加难) / 三周目(无限战) =====
function miniTier(id) { if (!id) return 0; try { return parseInt(localStorage.getItem('mini_clear_' + id) || '0', 10); } catch (e) { return 0; } }
function miniMarkClear(id) { if (!id) return; try { var n = miniTier(id); localStorage.setItem('mini_clear_' + id, String(n + 1)); } catch (e) {} }
function miniTierBadge(id) {
  var t = miniTier(id);
  if (t >= 2) return ' <span style="color:var(--cyan)">∞ 无限战</span>';
  if (t === 1) return ' <span style="color:var(--green)">✓ 已通关</span>';
  return '';
}
function applyMiniTier(cfg) {
  if (!cfg) return cfg;
  var t = miniTier(cfg.id);
  cfg._tier = t;
  cfg._hard = t >= 1;      // 二周目：加难
  cfg._endless = t >= 2;   // 三周目：不限时无限战
  return cfg;
}

// 小游戏完成：+1 完成数（按类型/关卡累计）并触发成就判定
// type: 'mm'(翻牌) | 'qk'(快打) | 'match'(连线) | 'other'
// =========================================================================
// 9f. TYPING DEFENSE — 术语防御战（打字炮台）
// 关键词从上往下掉，底部炮台。输入完整命令→炮台发射打爆关键词；输错重新开始。
// =========================================================================
function focusResultPrimary(overlay){ setTimeout(function(){ var b=overlay&&overlay.querySelector('.mm-btn.primary'); if(b) b.focus(); }, 50); }
// 命令 → 作用/解释（打爆关键词时在爆炸中心展示）
const TY_HINTS = {
  'ping':'测网络通不通','ip':'查看 IP/网卡','ls':'列出目录文件','cat':'查看文件内容','cd':'切换目录',
  'sudo':'管理员权限执行','uname':'查看系统信息','hostname':'查看主机名','apt':'安装/管理软件包',
  'curl':'命令行访问网站','nslookup':'查域名对应 IP','traceroute':'追踪路由路径','iptables':'配置防火墙规则',
  'ss':'查看端口监听','grep':'搜索/过滤文本','nc':'测试端口连接','route':'查看路由表','ssh':'远程登录服务器',
  'nano':'命令行文本编辑器','whoami':'查看当前用户名','reboot':'重启系统','docker':'容器化部署工具','systemctl':'管理系统服务'
};
function openTypingDefense(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('typing')) { showTypingTutorial(cfg, function(){ openTypingDefense(cfg, onComplete); }); return; }
  playMusic(gameSong('typing') || 'match');
  const words = (cfg.words || []).filter(Boolean).map(String);
  if (!words.length) { showToast('没有可用的关键词', 'error'); return; }
  // 难度随游玩次数递进：新手(首玩必能通) → 进阶 → 高手
  const _tw = (getGameStats().typingWins || 0);
  const _diff = cfg._hard ? 2 : Math.min(_tw, 2);   // 二周目直接上高手场
  const switchEnabled = _diff >= 1;   // 进阶/高手场开放 TAB 切词
  const LV = [
    { name:'新手场', waves:2, perWave:3, lives:6, wt:20, spd:5, acc:0.12, max:18, s0:3300, smin:1200 },
    { name:'进阶场', waves:3, perWave:4, lives:5, wt:18, spd:6, acc:0.16, max:22, s0:3000, smin:1000 },
    { name:'高手场', waves:4, perWave:5, lives:5, wt:15, spd:7, acc:0.2,  max:26, s0:2800, smin:850  }
  ][_diff];
  const LIVES = LV.lives;
  const WAVES = LV.waves;
  const WAVE_TIME = LV.wt;             // 每波秒数
  const BASE_SPEED = LV.spd, ACCEL = LV.acc, SPAWN0 = LV.s0, SPAWN_MIN = LV.smin, MAX_SPEED = LV.max;

  function tier(text){ const n=text.length; const mul=Math.max(0.8, Math.min(1.2, 1.25 - (n-3)*0.05)); return {mul:mul, pt:n>=8?14:n>=5?10:8}; }   // 越长掉得越慢（短词快、长词慢，好打字）
  const bossPool = words.filter(w=>w.length>=7).length>=3 ? words.filter(w=>w.length>=7) : words.slice().sort((a,b)=>b.length-a.length).slice(0, Math.min(6, words.length));

  let lives = LIVES, score = 0, combo = 0, win = false;
  let wave = 1, waveLeft = 0, bossActive = false;
  let elapsed = 0;   // 通关计时（秒），不做限时
  let paused = false, ended = false;
  let typed = '';
  let typedWord = null;   // 锁定目标：一旦开打某个词就只跟它比
  let active = [];
  let spawnTimer = null, loopTimer = null, t0 = Date.now();
  let field = null;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="ty-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🔫 术语防御战 · <span id="tyDiff" style="color:#8b91a6;font-size:15px">${LV.name}</span></div>
          <div class="mm-sub">${escHtml(cfg.name || '')} —— 分波防守，只记通关用时；Boss 要打两遍${switchEnabled ? '；TAB 切换目标词' : ''}</div>
        </div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="ty-stats">
        <span>❤️ <b id="tyLives">${LIVES}</b></span>
        <span>🌊 第 <b id="tyWave">1</b>/${WAVES} 波</span>
        <span>剩 <b id="tyLeft">0</b></span>
        <span>⏱ <b id="tyTime">0</b>s</span>
        <span>🎯 <b id="tyScore">0</b></span>
        <span>⌨️ <b id="tyTyped" style="color:var(--amber)">…</b></span>
        <span>🔥 <b id="tyCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="ty-field" id="tyField"></div>
      <div class="ty-cannon" id="tyCannon">🔫</div>
      <input id="tyInput" autocomplete="off" spellcheck="false" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none">
    </div>
  `;
  document.body.appendChild(overlay);
  const box = overlay.querySelector('.ty-box');
  field = document.getElementById('tyField');
  function showWordHint(x, y, text){
    if(!text) return;
    const d=document.createElement('div');
    d.className='ty-word-hint';
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    field.appendChild(d);
    setTimeout(()=>{ try{ d.remove(); }catch(e){} }, 1700);
  }
  const input = document.getElementById('tyInput');
  const livesEl = document.getElementById('tyLives');
  const scoreEl = document.getElementById('tyScore');
  const timeEl = document.getElementById('tyTime');
  const typedEl = document.getElementById('tyTyped');
  const comboEl = document.getElementById('tyCombo');
  const waveEl = document.getElementById('tyWave');
  const leftEl = document.getElementById('tyLeft');
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  box.addEventListener('mousedown', e => e.preventDefault());

  function waveNeed(w){ return LV.perWave + w - 1; }
  function waveSpeedMul(){ return 1 + (wave - 1) * 0.08; }
  function wordSpeed(){ const el=(Date.now()-t0)/1000; return Math.min(BASE_SPEED + ACCEL*el, MAX_SPEED) * waveSpeedMul(); }

  // 爆炸特效
  function boomEffect(x, y, big){
    const chars=['💥','✦','✧','⭐','💫'];
    const n = big ? 14 : 9;
    for(let i=0;i<n;i++){
      const s=document.createElement('span');
      s.className='ty-boom-p'+(big?' big':'');
      s.textContent=chars[i%chars.length];
      s.style.left=x+'px'; s.style.top=y+'px';
      s.style.setProperty('--dx', (Math.random()*90-45)+'px');
      s.style.setProperty('--dy', (Math.random()*-80-10)+'px');
      field.appendChild(s);
      setTimeout(()=>s.remove(), 650);
    }
  }

  function spawnWord() {
    if (ended || paused) return;
    // 场上已有同名词（含 BOSS、含正在录入的词）则重抽，避免同时出现两个一样的词
    let text = null;
    for (let _g = 0; _g < 30; _g++) {
      const c = words[Math.floor(Math.random() * words.length)];
      if (!active.some(function(w){ return w.text === c; })) { text = c; break; }
    }
    if (!text) { spawnTimer = setTimeout(spawnWord, 700); return; }   // 场上全被占用，稍后再试
    const t = tier(text);
    const el = document.createElement('div');
    el.className = 'ty-word';
    el.textContent = text;
    const maxX = Math.max(10, field.clientWidth - 140);
    el.style.left = (10 + Math.random() * maxX) + 'px';
    el.style.top = '0px';
    field.appendChild(el);
    active.push({ text, y:0, el, disp: text, speed: wordSpeed() * t.mul * (0.95 + Math.random()*0.1), pt: t.pt, boss:false });
    const gap = Math.max(SPAWN_MIN, SPAWN0 - (wave-1)*120);
    spawnTimer = setTimeout(spawnWord, gap);
  }
  function spawnBoss() {
    bossActive = true;
    const text = bossPool[Math.floor(Math.random()*bossPool.length)];
    // 场上若有同名普通词，先清掉——只留 BOSS 这一个，锁词不会打错目标
    const _dups = active.filter(function(w){ return !w.boss && w.text === text; });
    _dups.forEach(function(w){ try{ w.el.remove(); }catch(e){} var i=active.indexOf(w); if(i>=0) active.splice(i,1); });
    const el = document.createElement('div');
    el.className = 'ty-word ty-boss';
    el.textContent = '👑 ' + text;
    const maxX = Math.max(10, field.clientWidth - 190);
    el.style.left = (10 + Math.random() * maxX) + 'px';
    el.style.top = '0px';
    field.appendChild(el);
    active.push({ text, y:0, el, disp: '👑 ' + text, speed: wordSpeed() * 0.55, pt: 30, boss:true, hp:2, hit:0 });
    leftEl.textContent = '👑';
    // 无超时限制，继续计通关用时
    playSound('alarm');
    // 暂停 + 提示
    paused = true;
    clearTimeout(spawnTimer);
    const tip = document.createElement('div');
    tip.className = 'ty-boss-tip';
    tip.innerHTML = '👑 <b>BOSS 来袭！</b>它很硬，要<u>打两遍</u>——打一遍会受伤，再打一遍才打爆！<button class="mm-btn primary" id="bossGo" style="margin-top:8px">开打！</button>';
    field.appendChild(tip);
    var _bg = document.getElementById('bossGo');
    _bg.onclick = () => { tip.remove(); paused = false; spawnTimer = setTimeout(spawnWord, 1400); input.focus(); };
    _bg.focus();   // 聚焦按钮：回车/空格 = 明确开打，不再是误触
  }

  function clearScreen() {
    active.forEach(w => { try{ w.el.remove(); }catch(e){} });
    active = [];
    clearTimeout(spawnTimer);
    if (typedWord) { typed = ''; if (typedEl) typedEl.textContent = '…'; typedWord = null; }
  }

  function fireCannon(w, hit) {
    // 命中判定：boss 2 血
    if (w.boss && w.hit === 0) {
      w.hit = 1;
      w.el.classList.add('ty-boss-hit');
      boomEffect(w.el.offsetLeft + w.el.offsetWidth/2, w.el.offsetTop + w.el.offsetHeight/2, true);
      playSound('error');
      combo = 0; if(comboEl) comboEl.textContent='';
      showToast('💥 BOSS 中招！再打一遍！', 'error');
      return;
    }
    // 打爆（含 boss 第二下）
    const cannonEl = document.getElementById('tyCannon');
    const cb = cannonEl.getBoundingClientRect(), fb = field.getBoundingClientRect();
    const cx = cb.left + cb.width/2 - fb.left, cy = cb.top - fb.top - 6;
    const bullet = document.createElement('div');
    bullet.className = 'ty-bullet';
    bullet.style.left = cx + 'px'; bullet.style.top = cy + 'px';
    field.appendChild(bullet);
    const tx = w.el.offsetLeft + w.el.offsetWidth/2, ty = w.el.offsetTop + w.el.offsetHeight/2;
    requestAnimationFrame(() => { bullet.style.transform = 'translate('+(tx-cx)+'px,'+(ty-cy)+'px)'; });
    setTimeout(() => {
      bullet.remove();
      boomEffect(tx, ty, !!w.boss);
      showWordHint(tx, ty - 14, TY_HINTS[w.text] || w.text);   // 爆炸中心显示该命令的作用
      w.el.classList.add('ty-boom');
      setTimeout(() => { w.el.remove(); const idx=active.indexOf(w); if(idx>=0) active.splice(idx,1); }, 180);
      combo++;
      const gain = w.pt + (combo>=6?10 : combo>=3?5 : 0);
      score += gain; scoreEl.textContent = score;
      comboEl.textContent = combo>=2 ? 'x'+combo : '';
      playSound('success');
      // —— 打爆飘字：得分 + 连击提示 ——
      try{
        const s2=document.createElement('div');
        s2.className='ty-score-float';
        s2.textContent = '+'+gain;
        s2.style.cssText='left:'+(tx)+'px;top:'+(ty-8)+'px';
        field.appendChild(s2);
        setTimeout(()=>{ try{s2.remove();}catch(e){} }, 800);
        if(combo>=3){
          const c2=document.createElement('div');
          c2.className='ty-combo-float';
          c2.textContent = '🔥 连击 x'+combo;
          c2.style.cssText='left:'+(tx)+'px;top:'+(ty-30)+'px';
          field.appendChild(c2);
          setTimeout(()=>{ try{c2.remove();}catch(e){} }, 900);
        }
      }catch(e3){}
      if (w.boss) {
        // 清屏 → 下一波 / 通关
        clearScreen();
        if (wave >= WAVES && !cfg._endless) { endGame(true); return; }   // 无限战：不结算继续
        wave++; bossActive = false; waveLeft = waveNeed(wave);
        waveEl.textContent = wave; leftEl.textContent = waveLeft;
        showToast('🌊 第 '+wave+' 波！清屏加速', 'success');
        spawnTimer = setTimeout(spawnWord, 800);
      } else {
        waveLeft--; leftEl.textContent = Math.max(0, waveLeft);
        if (waveLeft <= 0 && !bossActive) { spawnBoss(); }
      }
    }, 240);
  }

  function leakWord(w) {
    if (w.leaked) return;
    if (typedWord === w) { typed = ''; if (typedEl) typedEl.textContent = '…'; typedWord = null; }
    w.leaked = true; combo = 0; if(comboEl) comboEl.textContent='';
    w.el.classList.add('ty-leak');
    setTimeout(() => { w.el.remove(); const idx=active.indexOf(w); if(idx>=0) active.splice(idx,1); }, 200);
    lives--; livesEl.textContent = lives;
    field.classList.remove('ty-hit'); void field.offsetWidth; field.classList.add('ty-hit');
    playSound('error');
    if (lives <= 0) endGame(false);
  }

  function resetWordDisp(w) { if (w && w.el) w.el.innerHTML = escHtml(w.disp || w.text); }
  function switchTarget() {           // 进阶/高手场：TAB 在候选词里切换目标
    if (!switchEnabled || ended || paused) return;
    const cands = active.filter(w => w.text.indexOf(typed) === 0);
    if (cands.length < 2) return;
    const cur = typedWord ? cands.indexOf(typedWord) : -1;
    const next = cands[(cur + 1) % cands.length];
    if (typedWord && typedWord !== next) {
      typedWord.el.classList.remove('ty-target');
      resetWordDisp(typedWord);
    }
    typedWord = next;
    if (typed) {
      typedWord.el.classList.remove('ty-target');
      typedWord.el.innerHTML = '<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(typedWord.text.slice(typed.length));
    } else {
      typedWord.el.classList.add('ty-target');
    }
    playSound('click');
  }
  function clearTyped() {
    typed = ''; typedEl.textContent = '…';
    if (typedWord) { typedWord.el.classList.remove('ty-target'); resetWordDisp(typedWord); typedWord = null; }
  }
  function onKey(ch) {
    if (ended || paused) return;
    playSound('type');
    if (typedWord) {
      // 已锁定目标：只跟它比，打错就清空重来（不会悄悄切到别的词）
      if (typedWord.text.indexOf(typed + ch) === 0) {
        typed += ch; typedEl.textContent = typed;
        typedWord.el.classList.remove('ty-target');
        typedWord.el.innerHTML = '<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(typedWord.text.slice(typed.length));
        if (typed === typedWord.text) { const w = typedWord; clearTyped(); fireCannon(w); }
      } else {
        clearTyped();
        combo = 0; if (comboEl) comboEl.textContent = '';
        field.classList.remove('ty-err'); void field.offsetWidth; field.classList.add('ty-err');
      }
      return;
    }
    // 新开一个词：锁定到「最靠近炮台」的匹配词
    const cands = active.filter(w => w.text.indexOf(ch) === 0);
    if (!cands.length) {
      combo = 0; if (comboEl) comboEl.textContent = '';
      field.classList.remove('ty-err'); void field.offsetWidth; field.classList.add('ty-err');
      return;
    }
    typedWord = cands.reduce((a, b) => (b.y > a.y ? b : a));
    typed = ch; typedEl.textContent = typed;
    typedWord.el.innerHTML = '<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(typedWord.text.slice(typed.length));
    if (typed === typedWord.text) { const w = typedWord; clearTyped(); fireCannon(w); }
  }
  input.addEventListener('keydown', e => {
    e.preventDefault();
    if (e.key === 'Escape') { closeGame(false); return; }
    if (e.key === 'Tab') { switchTarget(); return; }
    if (e.key.length === 1) onKey(e.key);
  });
  overlay.addEventListener('click', () => input.focus());
  input.focus();

  function tick() {
    if (ended || paused) return;
    const bottom = field.clientHeight - 42;
    active.forEach(w => {
      if (w.leaked) return;
      w.y += w.speed * 0.225;
      w.el.style.top = w.y + 'px';
      if (w.y > bottom) leakWord(w);
    });
    elapsed += 0.1;
    timeEl.textContent = Math.max(0, Math.ceil(elapsed));
  }
  loopTimer = setInterval(tick, 100);

  function endGame(isWin) {
    if (ended) return;
    ended = true; win = isWin;
    clearInterval(loopTimer); clearTimeout(spawnTimer);
    try{
      const _gs = getGameStats();
      _gs.typingPlays = (_gs.typingPlays||0) + 1;
      _gs.typingBest = Math.max(_gs.typingBest||0, score);
      _gs.typingWaves = Math.max(_gs.typingWaves||0, wave);
      _gs.typingCombo = Math.max(_gs.typingCombo||0, combo);
      _gs.typingTime = Math.max(_gs.typingTime||0, Math.round((Date.now()-t0)/1000));
      saveGameStats(_gs);
    }catch(e){}
    if (win) { recordGameWin('typing'); miniMarkClear(cfg.id); playSound('success'); }
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML =
        '<div style="font-size:46px;line-height:1">'+(win?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(win?'var(--green)':'var(--red)')+';margin-top:8px">'+(win?'全部防线守住！':'防线失守')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">击落 <b style="color:var(--amber)">'+score+'</b> · 打到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波 · 剩余 ❤️ '+Math.max(0,lives)+' · 用时 <b style="color:var(--amber)">'+Math.ceil(elapsed)+'</b>s</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">'+
          '<button class="mm-btn" onclick="window.tyAgain()">🔁 再玩一次</button>'+
          '<button class="mm-btn primary" onclick="window.tyDone()">收下奖励</button>'+
        '</div>';
      focusResultPrimary(overlay);
      overlay.innerHTML = '';
      overlay.appendChild(res);
    }, 300);
  }
  window.tyAgain = () => { overlay.remove(); openTypingDefense(cfg, onComplete); };
  window.tyDone = () => { if (onComplete) onComplete(win); overlay.remove(); };

  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(loopTimer); clearTimeout(spawnTimer);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  // 开波
  waveLeft = waveNeed(1); leftEl.textContent = waveLeft;
  spawnWord();
}

function recordGameWin(type) {
  const t = type || 'mm';
  const gs = getGameStats();
  gs.gamesWin = (gs.gamesWin || 0) + 1;
  if (t === 'mm') gs.mmWins = (gs.mmWins || 0) + 1;
  else if (t === 'qk') gs.qkWins = (gs.qkWins || 0) + 1;
  else if (t === 'match') gs.matchWins = (gs.matchWins || 0) + 1;
  else if (t === 'typing') gs.typingWins = (gs.typingWins || 0) + 1;
  else if (t === 'shooter') gs.shooterWins = (gs.shooterWins || 0) + 1;
  else if (t === 'racing') gs.racingWins = (gs.racingWins || 0) + 1;
  else if (t === 'snake') gs.snakeWins = (gs.snakeWins || 0) + 1;
  else if (t === 'flappy') gs.flappyWins = (gs.flappyWins || 0) + 1;
  else if (t === 'mole') gs.moleWins = (gs.moleWins || 0) + 1;
  else if (t === 'pacman') gs.pacmanWins = (gs.pacmanWins || 0) + 1;
  else if (t === 'tank') gs.tankWins = (gs.tankWins || 0) + 1;
  else if (t === 'breakout') gs.breakoutWins = (gs.breakoutWins || 0) + 1;
  else if (t === 'sorter') gs.sorterWins = (gs.sorterWins || 0) + 1;
  else if (t === 'forge') gs.forgeWins = (gs.forgeWins || 0) + 1;
  else if (t === 'll') gs.llWins = (gs.llWins || 0) + 1;
  else if (t === 'pipe') gs.pipeWins = (gs.pipeWins || 0) + 1;
  else if (t === 'm3') gs.m3Wins = (gs.m3Wins || 0) + 1;
  else if (t === 'td') gs.tdWins = (gs.tdWins || 0) + 1;
  else if (t === 't48') gs.t48Wins = (gs.t48Wins || 0) + 1;
  else if (t === 'maze') gs.mazeWins = (gs.mazeWins || 0) + 1;
  else if (t === 'hack') gs.hackWins = (gs.hackWins || 0) + 1;
  else if (t === 'tyc') gs.tycWins = (gs.tycWins || 0) + 1;
  else if (t === 'lzr') gs.lzrWins = (gs.lzrWins || 0) + 1;
  else if (t === 'boss') gs.bossWins = (gs.bossWins || 0) + 1;
  const lv = currentLevelId;
  if (lv) {
    gs.lvlWins = gs.lvlWins || {};
    const k = '' + lv;
    gs.lvlWins[k] = (gs.lvlWins[k] || 0) + 1;
  }
  saveGameStats(gs);
  evaluateAchievements(true);
}

function achievementContext() {
  const ctx = {
    doneCount: 0, total: 0, levelDone: {}, allLevels: true,
    xp: calcTotalXP(), isPioneer: false, anyLevel3Star: false, anyLevel5Star: false
  };
  // 小游戏表现统计
  const gs = getGameStats();
  ctx.mmStreak = gs.mmStreak || 0;
  ctx.qkCombo = gs.qkCombo || 0;
  ctx.gamesWin = gs.gamesWin || 0;
  ctx.mmMatched = gs.mmMatched || 0;
  ctx.mmWins = gs.mmWins || 0;
  ctx.qkWins = gs.qkWins || 0;
  ctx.matchWins = gs.matchWins || 0;
  ctx.typingWins = gs.typingWins || 0;
  ctx.shooterWins = gs.shooterWins || 0;
  ctx.shooterMaxLevel = gs.shooterMaxLevel || 0;
  ctx.shooterPickups = gs.shooterPickups || 0;
  ctx.sorterWins = gs.sorterWins || 0;
  ctx.sorterCombo = gs.sorterCombo || 0;
  ctx.sorterBest = gs.sorterBest || 0;
  ctx.forgeWins = gs.forgeWins || 0;
  ctx.forgeBest = gs.forgeBest || 0;
  ctx.forgeCombo = gs.forgeCombo || 0;
  ctx.llWins = gs.llWins || 0;
  ctx.llBest = gs.llBest || 0;
  ctx.pipeWins = gs.pipeWins || 0;
  ctx.pipeBest = gs.pipeBest || 0;
  ctx.m3Wins = gs.m3Wins || 0;
  ctx.m3Best = gs.m3Best || 0;
  ctx.tdWins = gs.tdWins || 0;
  ctx.tdBest = gs.tdBest || 0;
  ctx.t48Wins = gs.t48Wins || 0;
  ctx.t48Best = gs.t48Best || 0;
  ctx.mazeWins = gs.mazeWins || 0;
  ctx.mazeBest = gs.mazeBest || 0;
  ctx.hackWins = gs.hackWins || 0;
  ctx.hackBest = gs.hackBest || 0;
  ctx.tycWins = gs.tycWins || 0;
  ctx.tycBest = gs.tycBest || 0;
  ctx.lzrWins = gs.lzrWins || 0;
  ctx.lzrBest = gs.lzrBest || 0;
  ctx.bossWins = gs.bossWins || 0;
  ctx.bossBest = gs.bossBest || 0;
  ctx.gameTypes = countUnlockedGameTypes();
  ctx.lvlWins = gs.lvlWins || {};
  ctx.pediaCount = getPediaCount();
  content.levels.forEach(lv => {
    const prog = levelProgress(lv.id);
    ctx.doneCount += prog.done;
    ctx.total += prog.total;
    ctx.levelDone[lv.id] = prog.completed;
    if (!prog.completed) ctx.allLevels = false;
  });
  if (leaderboardCache && leaderboardCache.pioneers) {
    ctx.isPioneer = Object.values(leaderboardCache.pioneers).indexOf(myName) >= 0;
  }
  Object.keys(gameState.stars || {}).forEach(lvId => {
    const v = areaStars(lvId);
    if (v >= 3) ctx.anyLevel3Star = true;
    if (v >= 4.5) ctx.anyLevel5Star = true;
  });
  return ctx;
}

function evaluateAchievements(showPopups) {
  if (!content) return;
  const ctx = achievementContext();
  const newly = [];
  ACHIEVEMENTS.forEach(a => {
    if (!gameState.achievements[a.id] && a.test(ctx)) {
      gameState.achievements[a.id] = new Date().toISOString();
      newly.push(a);
    }
  });
  if (PASSWORD_ENABLED) document.getElementById('passwordBtn').style.display = '';
  if (newly.length) {
    renderAchBar();
    saveState();
    setSeenAch(gameState.achievements);
    if (showPopups) {
      achQueue = achQueue.concat(newly);
      drainAchQueue();
    }
  }
  return newly;
}

// ===== 登录弹窗队列：一次只弹一个、顺序弹出；重复弹窗默认每天一次 =====
let loginPopQueue = [];
let loginPopActive = false;
let pendingLevelComplete = null;
function dstr(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function popupShownToday(t){ try{ return localStorage.getItem('popup_day_'+t)===dstr(); }catch(e){ return false; } }
function markPopupToday(t){ try{ localStorage.setItem('popup_day_'+t, dstr()); }catch(e){} }
function enqueueLoginPopup(job){ loginPopQueue.push(job); drainLoginPopups(); }
function drainLoginPopups(){
  if (loginPopActive) return;
  const job = loginPopQueue.shift();
  if (!job) return;
  loginPopActive = true;
  job(function(){ loginPopActive = false; setTimeout(drainLoginPopups, 300); });
}
// 成就动画作为一个队列任务：排完当前成就再放行下一个弹窗
let achShowing = false;
function enqueueAchievementsJob(){
  enqueueLoginPopup(function(done){
    let lastEmptyAt = 0;
    function settle(){
      if (achQueue.length === 0 && !achShowing) {
        if (!lastEmptyAt) lastEmptyAt = Date.now();
        if (Date.now() - lastEmptyAt > 1000) return done();
      } else { lastEmptyAt = 0; }
      setTimeout(settle, 250);
    }
    settle();
    drainAchQueue();
  });
}

let achDraining = false;
function drainAchQueue(onAllDone) {
  // 串行：同一时刻只弹一个成就，防止多处 evaluateAchievements 并发 drain 造成成就叠弹
  if (achDraining) return;
  if (achQueue.length === 0) { if (onAllDone) onAllDone(); return; }
  achDraining = true;
  const a = achQueue.shift();
  showAchievementUnlock(a, () => { achDraining = false; setTimeout(() => drainAchQueue(onAllDone), 300); }, a.__source);
}

// —— 已看过的成就快照（登录后识别“老师新发/系统新发”的成就）——
const ACH_SEEN_KEY = 'ach_seen_v1';
function getSeenAch(){ try{ return JSON.parse(localStorage.getItem(ACH_SEEN_KEY)||'{}'); }catch(e){ return {}; } }
function setSeenAch(o){ try{ localStorage.setItem(ACH_SEEN_KEY, JSON.stringify(o||{})); }catch(e){} }
function detectNewServerAchievements(){
  const seen = getSeenAch();
  const fresh = [];
  // 教师手动发放的成就（teacherAwards）
  Object.keys(gameState.teacherAwards || {}).forEach(id => { if (!seen[id]) fresh.push({ id, source: 'teacher' }); });
  // 系统自动发放的登录签到成就（login_*）：只提示“服务端当天新授予”的，
  // 不再遍历所有历史 login 成就——避免 seen 快照丢失(换设备/清缓存)后每次进入都重复弹窗
  (gameState.newlyAwardedLogin || []).forEach(id => { if (!seen[id]) fresh.push({ id, source: 'auto' }); });
  // 快照：所有成就（含教师发放）
  const snap = Object.assign({}, gameState.achievements || {}, gameState.teacherAwards || {});
  setSeenAch(snap);
  if (!fresh.length) return;
  achQueue = achQueue.concat(fresh.map(f => {
    const a = ACHIEVEMENTS.find(x => x.id === f.id);
    return a ? Object.assign({}, a, { __source: f.source }) : null;
  }).filter(Boolean));
  drainAchQueue();
}

function showAchievementUnlock(ach, cb, source) {
  playSound('levelup');
  const isTeacher = source === 'teacher';
  const srcLabel = isTeacher ? '🎁 老师发放的成就' : source === 'auto' ? '📅 登录签到成就' : '🎖️ 成就解锁';
  const accent = isTeacher ? '#ffd27d' : 'var(--amber)';
  const glow = isTeacher ? 'rgba(255,210,125,.38)' : 'rgba(255,176,0,.28)';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:10001;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid ' + accent + ';border-radius:14px;padding:34px 48px;max-width:430px;width:90%;text-align:center;box-shadow:0 0 80px ' + glow + ';animation:achPop .45s ease;position:relative;overflow:hidden';
  let sparks = '';
  const sc = ['✦','✧','✨','⭐'];
  for (let i = 0; i < 12; i++) {
    sparks += '<span style="position:absolute;left:' + (6 + Math.random() * 88).toFixed(1) + '%;top:' + (4 + Math.random() * 90).toFixed(1) + '%;font-size:' + (10 + Math.random() * 14).toFixed(1) + 'px;color:#ffd27d;opacity:0;animation:achSpark 1.3s ease-out ' + (Math.random() * .5).toFixed(2) + 's;pointer-events:none">' + sc[i % 4] + '</span>';
  }
  box.innerHTML = sparks + '<div style="font-size:64px;line-height:1;animation:achBounce .6s ease">' + ach.emoji + '</div>' +
    '<div style="font-size:13px;color:' + accent + ';margin:14px 0 6px;letter-spacing:2px;font-weight:bold">' + srcLabel + '</div>' +
    '<div style="font-size:24px;font-weight:bold;color:var(--text)">' + ach.name + '</div>' +
    '<div style="font-size:13px;color:var(--dim);margin-top:8px;line-height:1.6">' + ach.desc + '</div>' +
    '<div style="font-size:11px;color:#3a3a48;margin-top:14px">锐智工厂 · 已点亮 ' + Object.keys(gameState.achievements || {}).length + '/' + ACHIEVEMENTS.length + ' 枚徽章</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  achShowing = true;
  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => {
      playAreaMusic(); overlay.remove(); achShowing = false;
      // 登录签到成就：提示一次后标记服务端已提示，确保换设备/清缓存也不再重复弹
      if (source === 'auto' && ach && ach.id) {
        try { fetch(API + '/api/student/notify-login-ach', { method: 'POST', headers: {'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({ ids: [ach.id] }) }); } catch(e){}
      }
      if (cb) cb();
    }, 300);
  }, 2500);
}

function renderAchBar() {
  const bar = document.getElementById('achBar');
  if (!bar) return;
  const gotList = ACHIEVEMENTS.filter(a => gameState.achievements[a.id]);
  if (!gotList.length) {
    bar.innerHTML = '<span class="ach-bar-label">🎖️ 暂无徽章 — 完成任务，点亮工厂的同时点亮徽章</span>';
    return;
  }
  bar.innerHTML = '<span class="ach-bar-label">🎖️ 已点亮 ' + gotList.length + '/' + ACHIEVEMENTS.length + ' 枚徽章</span> '
    + gotList.map(a => '<span class="ach-bar-emoji" title="' + a.name + ((gameState.teacherAwards && gameState.teacherAwards[a.id]) ? '（老师发放）' : '') + '">' + a.emoji + '</span>').join('');
}

async function refreshLeaderboard() {
  try {
    const res = await api('/api/game/leaderboard');
    if (res && res.ok) leaderboardCache = res.data;
  } catch (e) { /* 网络失败静默，打开面板时重试 */ }
}


// 📊 我的战绩
function openGameRecords(){ document.getElementById('recBody').innerHTML = renderGameRecords(); document.getElementById('recOverlay').classList.add('show'); }
function closeGameRecords(){ document.getElementById('recOverlay').classList.remove('show'); }
function renderGameRecords(){
  const gs = getGameStats() || {};
  const s = (k,d)=>(k in gs ? gs[k] : d);
  let h = '';
  h += '<div class="rec-card"><div class="rc-name">🔫 术语防御战</div>'+
    '<div class="rc-row">游玩 <b>'+s('typingPlays',0)+'</b> 次 · 通关 <b>'+s('typingWins',0)+'</b> 次</div>'+
    '<div class="rc-row">最高分 <b>'+s('typingBest',0)+'</b> · 最远到第 <b>'+s('typingWaves',0)+'</b> 波</div>'+
    '<div class="rc-row">坚持最长 <b>'+s('typingTime',0)+'</b> 秒 · 最高连击 <b>'+s('typingCombo',0)+'</b></div></div>';
  h += '<div class="rec-card"><div class="rc-name">🃏 翻牌</div>'+
    '<div class="rc-row">完成 <b>'+s('mmWins',0)+'</b> 次 · 最高连对 <b>'+s('mmStreak',0)+'</b></div>'+
    '<div class="rc-row">累计配对 <b>'+s('mmMatched',0)+'</b> 对</div></div>';
  h += '<div class="rec-card"><div class="rc-name">⚡ 快打</div>'+
    '<div class="rc-row">完成 <b>'+s('qkWins',0)+'</b> 次 · 最高连击 <b>'+s('qkCombo',0)+'</b></div></div>';
  h += '<div class="rec-card"><div class="rc-name">🔗 连线</div>'+
    '<div class="rc-row">完成 <b>'+s('matchWins',0)+'</b> 次</div></div>';
  h += '<div class="rec-card"><div class="rc-name">🛸 数据蜂群</div>'+
    '<div class="rc-row">游玩 <b>'+s('shooterPlays',0)+'</b> 次 · 通关 <b>'+s('shooterWins',0)+'</b> 次</div>'+
    '<div class="rc-row">🚀 最强火力 <b>'+s('shooterMaxLevel',1)+'</b> 级 · 拾取道具 <b>'+s('shooterPickups',0)+'</b> 个</div>'+
    '<div class="rc-row">最高分 <b>'+s('shooterBest',0)+'</b> · 最远到第 <b>'+s('shooterWaves',0)+'</b> 波</div></div>';
  h += '<div class="rec-card"><div class="rc-name">🎮 小游戏总计</div>'+
    '<div class="rc-row">累计完成 <b>'+s('gamesWin',0)+'</b> 个小游戏</div></div>';
  return h;
}

function openLeaderboard() {
  document.getElementById('lbOverlay').classList.add('show');
  if (!leaderboardCache) refreshLeaderboard();
  switchLbTab('rank');
}

function openAchievements() {
  document.getElementById('lbOverlay').classList.add('show');
  switchLbTab('ach');
}

function closeLb() {
  if (_mapFlowFeature) { goMap(); return; }
  document.getElementById('lbOverlay').classList.remove('show');
}

function switchLbTab(tab) {
  lbTab = tab;
  document.getElementById('tabRank').classList.toggle('active', tab === 'rank');
  document.getElementById('tabAch').classList.toggle('active', tab === 'ach');
  if (tab === 'ach') renderAchievements(document.getElementById('lbBody'));
  else renderLeaderboard(document.getElementById('lbBody'));
}

function _fmtTime(iso){
  try{
    const d=new Date(iso); if(isNaN(d.getTime())) return String(iso||'');
    const p=n=>String(n).padStart(2,'0');
    return (d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }catch(e){ return String(iso||''); }
}
function renderLeaderboard(body) {
  const d = leaderboardCache;
  if (!d || !content) { body.innerHTML = '<div class="lb-empty">加载中…</div>'; return; }
  let html = `
    <div class="lb-summary">
      <div>班级完成率 <b>${d.classCompletion}%</b></div>
      <div>我的名次 <b>${d.myRank > 0 ? d.myRank : '—'}</b> / ${d.rows.length}</div>
      <div>班级人数 <b>${d.rows.length}</b></div>
    </div>
    <div class="lb-list">`;
  d.rows.forEach((r, i) => {
    const rank = getRank(r.xp);
    const isMe = r.name === myName;
    const pioneerLvs = Object.keys(d.pioneers).filter(k => d.pioneers[k] === r.name);
    html += `
      <div class="lb-row${isMe ? ' me' : ''}">
        <div class="lb-no">${i + 1}</div>
        <div class="lb-name">${escHtml(r.name)}${((r.name===myName) && (gameState.inventory||{}).title_badge>0) ? '<span class="lb-pioneer" title="厂级先锋称号"> 🏅</span>' : ''}${pioneerLvs.length ? '<span class="lb-pioneer" title="先锋：第' + pioneerLvs.join('、第') + '关"> 🚩</span>' : ''}</div>
        <div class="lb-rank">${rank.emoji} ${rank.title}</div>
        <div class="lb-xp">${r.xp} XP</div>
        <div class="lb-bar"><div class="lb-bar-fill" style="width:${r.completion}%"></div><span>${r.completion}%</span></div>
      </div>`;
  });
  html += '</div>';
  // ⏱ 我的通关记录（每关首通时间）
  const _me = d.rows.find(r => r.name === myName);
  const _mf = _me ? (_me.levelFinish || {}) : {};
  html += '<div class="lb-pioneers"><div class="lb-pioneers-title">⏱ 我的通关记录（首通时间）</div>';
  (content.levels || []).forEach(lv => {
    const t = _mf[lv.id];
    html += '<div class="lb-pioneer-line">第 ' + lv.id + ' 关 ' + escHtml(lv.areaName || '') + '：<b>' + (t ? _fmtTime(t) : '未通关') + '</b></div>';
  });
  html += '</div>';
  const pioneerKeys = Object.keys(d.pioneers);
  if (pioneerKeys.length && content.levels) {
    html += '<div class="lb-pioneers"><div class="lb-pioneers-title">🚩 关卡先锋（班级首位完成）</div>';
    content.levels.forEach(lv => {
      const pp = d.pioneers[lv.id];
      html += `<div class="lb-pioneer-line">第 ${lv.id} 关 ${escHtml(lv.areaName || '')}：<b>${pp ? escHtml(pp) : '—'}</b>${pp === myName ? ' <span style="color:var(--amber)">(我!)</span>' : ''}</div>`;
    });
    html += '</div>';
  }
  body.innerHTML = html;
}

function renderAchievements(body) {
  const ctx = achievementContext();
  let html = '<div class="ach-grid">';
  ACHIEVEMENTS.forEach(a => {
    const got = !!gameState.achievements[a.id];
    const can = a.test(ctx);
    html += `
      <div class="ach-cell ${got ? 'got' : (can ? 'can' : '')}">
        <div class="ach-emoji">${got ? a.emoji : '🔒'}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        ${got ? '<div class="ach-tag">已解锁</div>' : (can ? '<div class="ach-tag can">可解锁</div>' : '')}
    ${gameState.teacherAwards && gameState.teacherAwards[a.id] ? '<div class="ach-tag" style="color:#ffd27d">🎁 老师发放</div>' : ''}
      </div>`;
  });
  html += '</div>';
  body.innerHTML = html;
}

// =========================================================================
// 9c. PASSWORD SETTINGS
// =========================================================================
function openPasswordModal() {
  const hasPw = !!gameState.hasPassword;
  document.getElementById('pwTitle').textContent = hasPw ? '修改登录密码' : '设置登录密码';
  document.getElementById('pwOldField').style.display = hasPw ? 'block' : 'none';
  document.getElementById('pwOld').value = '';
  document.getElementById('pwNew').value = '';
  document.getElementById('pwNew2').value = '';
  document.getElementById('pwErr').textContent = '';
  document.getElementById('pwOverlay').classList.add('show');
  setTimeout(() => document.getElementById('pwNew').focus(), 50);
}

function closePasswordModal() {
  document.getElementById('pwOverlay').classList.remove('show');
}

async function savePassword() {
  const oldPassword = document.getElementById('pwOld').value;
  const pw1 = document.getElementById('pwNew').value;
  const pw2 = document.getElementById('pwNew2').value;
  const err = document.getElementById('pwErr');
  if (!pw1 || pw1.length < 4) { err.textContent = '新密码至少 4 位'; return; }
  if (pw1 !== pw2) { err.textContent = '两次输入的新密码不一致'; return; }
  const btn = document.getElementById('pwSaveBtn');
  btn.disabled = true; btn.textContent = '保存中…';
  const res = await api('/api/student/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword: pw1 })
  });
  btn.disabled = false; btn.textContent = '确认';
  if (!res || !res.ok) {
    err.textContent = (res && res.error) || '保存失败，请重试';
    return;
  }
  gameState.hasPassword = true;
  closePasswordModal();
  showToast('密码已设置，下次登录需输入', 'success');
}

// 登录后未设置密码时的引导提示
function showPasswordPrompt(done) {
  if (!PASSWORD_ENABLED) { if (done) setTimeout(done, 50); return; }
  if (gameState.hasPassword) { if (done) setTimeout(done, 50); return; }
  if (document.getElementById('pwPromptOverlay')) { if (done) setTimeout(done, 50); return; }
  const overlay = document.createElement('div');
  overlay.id = 'pwPromptOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--amber);border-radius:10px;padding:24px 30px;max-width:430px;width:90%;box-shadow:0 0 40px rgba(255,176,0,.15)';
  box.innerHTML = `
    <div style="font-size:18px;color:var(--amber);font-weight:bold;margin-bottom:12px">🔑 建议修改初始密码</div>
    <div style="font-size:14px;line-height:1.8;color:var(--text);margin-bottom:20px">你的账号还在使用初始密码 123456，任何知道你姓名的人都能用这个密码登录。设置一个自己的密码更安心。</div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button id="pwPromptGo" style="padding:9px 24px;background:var(--amber);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit">去设置</button>
      <button id="pwPromptLater" style="padding:9px 24px;background:none;color:var(--dim);border:1px solid var(--border);border-radius:4px;font-size:15px;cursor:pointer;font-family:inherit">稍后再说</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('#pwPromptGo').onclick = () => { playAreaMusic(); overlay.remove(); if (done) setTimeout(done, 50); openPasswordModal(); };
  box.querySelector('#pwPromptLater').onclick = () => { playAreaMusic(); overlay.remove(); if (done) setTimeout(done, 50); };
}

// =========================================================================
// 9d. MINI GAMES — memory_match（术语翻牌热身）
// =========================================================================
const miniGames = {};
function registerMiniGame(type, handler) {
  miniGames[type] = handler;
}

function loadTermCards() {
  return fetch('/data/term-cards.json').then(r => r.json()).then(d => {
    window.TERM_CARDS = d;
    try { if (typeof evaluateAchievements === 'function') evaluateAchievements(false); } catch (e) {}
  }).catch(() => { window.TERM_CARDS = null; });
}
// 提前发起加载并保存 promise，init 里 await 后再渲染关卡（避免首次刷新小游戏不显示）
const termCardsPromise = loadTermCards();

function getTermLevel(levelId) {
  if (!window.TERM_CARDS) return null;
  return window.TERM_CARDS.levels.find(l => l.levelId === levelId) || null;
}
function termWarmupDone(key) { return localStorage.getItem('term_' + key) === '1'; }
function markTermWarmupDone(key) { localStorage.setItem('term_' + key, '1'); }
// 统计当前已解锁的小游戏类型数（按任务块完成判定）
function countUnlockedGameTypes() {
  try {
    if (!window.TERM_CARDS || !window.TERM_CARDS.levels) return 0;
    const set = new Set();
    window.TERM_CARDS.levels.forEach(lv => {
      (lv.warmups || []).forEach(w => {
        const bt = w.blockTasks;
        if (Array.isArray(bt) && bt.length && bt.every(tid => isTaskDone(tid))) set.add(w.type || 'memory');
      });
    });
    return set.size;
  } catch (e) { return 0; }
}
// ===== 游戏专区：解锁后直接选玩 =====
let gzList = [];
let _mapFlowFeature = null;   // 本次由厂区地图 ?open=xxx 进入的功能（关闭时回地图，避免露旧界面）
function gzEmoji(w) {
  const t = w.type || 'memory';
  return t==='quick'?'⚡':t==='match'?'🔗':t==='storm'?'🌪️':t==='alarm'?'🚨':t==='typing'?'🔫':t==='shooter'?'🛸':t==='racing'?'🏎️':t==='snake'?'🐍':t==='flappy'?'🦅':t==='mole'?'🔨':t==='pacman'?'👾':t==='tank'?'🎯':t==='breakout'?'🧱':t==='sorter'?'📦':t==='forge'?'🔥':t==='ll'?'🔗':t==='pipe'?'🔧':t==='m3'?'🍬':t==='td'?'🛡️':t==='t48'?'🔢':t==='maze'?'🌐':t==='hack'?'🕹️':t==='tyc'?'🏭':t==='lzr'?'🔦':t==='boss'?'🎯':'🃏';
}
function gzMeta(w) {
  const t = w.type || 'memory';
  if (t==='quick') return (w.size||0) + ' 题';
  if (t==='match') return (w.size||0) + ' 组';
  if (t==='storm') return (w.waves||0) + ' 波';
  if (t==='alarm') return (w.devices||0) + ' 台';
  if (t==='typing') return ((w.words||[]).length) + ' 词';
  if (t==='shooter') return (w.waves||4) + ' 波编队';
  if (t==='racing') return '坚持 45s 通关';
  if (t==='snake') return '吃网络三件套';
  if (t==='flappy') return '躲断线黑洞';
  if (t==='mole') return '点掉异常数据';
  if (t==='pacman') return '吃镜像层';
  if (t==='tank') return '守卫 Broker';
  if (t==='breakout') return '消设备故障';
  if (t==='sorter') return (w.waves||3) + ' 波分类';
  if (t==='forge') return '合成' + (w.target||'TB');
  if (t==='ll') return ((w.pairs||[]).length) + ' 组配对';
  if (t==='pipe') return (w.cols||4) + '×' + (w.rows||4) + ' 管道';
  if (t==='m3') return (w.waves||3) + ' 波消消乐';
  if (t==='td') return (w.waves||3) + ' 波防线';
  if (t==='t48') return '合成' + (w.target||'TB');
  if (t==='maze') return '迷宫寻路';
  if (t==='hack') return ((w.nodes||[]).length) + ' 个节点';
  if (t==='tyc') return '目标' + (w.target||50000);
  if (t==='lzr') return '光束路由';
  if (t==='boss') return (w.shots||5) + ' 发';
  if (w.rounds) return w.rounds.map(r=>r*2).join('→') + ' 张';
  return (w.size*2) + ' 张';
}
function gzName(w) {
  const t = w.type || 'memory';
  const special = t==='quick'||t==='match'||t==='storm'||t==='alarm'||t==='typing'||t==='shooter'||t==='racing'||t==='snake'||t==='flappy'||t==='mole'||t==='pacman'||t==='tank'||t==='breakout'||t==='sorter'||t==='forge'||t==='ll'||t==='pipe'||t==='m3'||t==='td'||t==='t48'||t==='maze'||t==='hack'||t==='tyc'||t==='lzr'||t==='boss';
  return special ? escHtml(w.name) : '翻牌 · ' + escHtml(w.name);
}
function renderGameZone(body) {
  if (!window.TERM_CARDS || !content) { body.innerHTML = '<div class="lb-empty">加载中…</div>'; return; }
  gzList = [];
  // 按游戏类型分组排序：同一类型排一起，方便按类型测试、不重不漏
  const TYPE_ORDER = [
    ['memory','🧠','翻牌配对'],
    ['quick','⚡','快打'],
    ['typing','🔫','术语防御战'],
    ['shooter','🛸','数据蜂群'],
    ['td','🛡️','车间防线'],
    ['snake','🐍','网线贪吃蛇'],
    ['pacman','👾','容器吃豆人'],
    ['ll','🔗','连连看'],
    ['match','🔗','连线匹配'],
    ['sorter','📦','数据分类'],
    ['forge','🔥','数据熔炉'],
    ['t48','🔢','2048·数据融合'],
    ['racing','🏎️','数据狂飙'],
    ['flappy','🦅','云端跳跃'],
    ['mole','🔨','边缘打地鼠'],
    ['storm','🌪️','数据风暴'],
    ['alarm','🚨','值班抢险'],
    ['maze','🌐','数据迷宫'],
    ['hack','🕹️','黑客终端'],
    ['tyc','🏭','工厂大亨'],
    ['pipe','🔧','管道工'],
    ['lzr','🔦','激光反射'],
    ['tank','🎯','消息守卫'],
    ['breakout','🧱','AI打砖块'],
    ['m3','🍬','消消乐'],
    ['boss','💥','厂长Boss战']
  ];
  // 先收集: 类型 -> [游戏]
  const byType = {};
  content.levels.forEach(lv => {
    const tl = getTermLevel(lv.id);
    if (!tl) return;
    (tl.warmups || []).forEach(w => {
      const t = w.type || 'memory';
      if (!byType[t]) byType[t] = [];
      byType[t].push({ lvId: lv.id, w: w });
    });
    if (tl.bonus) {
      const t='memory';
      if (!byType['__bonus']) byType['__bonus'] = [];
      byType['__bonus'].push({ lvId: lv.id, bonus: true });
    }
  });
  let html = '';
  // 遍历固定类型顺序（未列出的类型放最后）
  const ordered = TYPE_ORDER.map(x=>x[0]).filter(t=>byType[t]);
  const rest = Object.keys(byType).filter(t=>t!=='__bonus' && !ordered.includes(t)).sort();
  const allTypes = ordered.concat(rest);
  allTypes.forEach(t => {
    const items = byType[t] || [];
    const label = (TYPE_ORDER.find(x=>x[0]===t) || [t, gzEmoji(byType[t]&&byType[t][0]?byType[t][0].w:{}), t])[2];
    const emoji = (TYPE_ORDER.find(x=>x[0]===t) || [t,'🎮',t])[1];
    const rows = [];
    items.forEach(it => {
      const idx = gzList.length;
      gzList.push(it);
      if (it.bonus) {
        const lvDone = levelProgress(it.lvId).completed;
        rows.push('<div class="gz-row' + (lvDone ? '' : ' locked') + '" data-idx="' + idx + '" onclick="gzPlay(' + idx + ')">' +
          '<span class="gz-emoji">' + (lvDone ? '🏆' : '🔒') + '</span>' +
          '<span class="gz-name">记忆大师挑战 · 5 层递进</span>' +
          '<span class="gz-meta">第'+it.lvId+'幕 · ' + (lvDone ? '可玩' : '通关本关解锁') + '</span></div>');
        return;
      }
      const w = it.w;
      const unlocked = Array.isArray(w.blockTasks) && w.blockTasks.length && w.blockTasks.every(tid => isTaskDone(tid));
      const advTag = w.advanced ? ' · <span style="color:var(--cyan)">进阶</span>' : '';
      const tBadge = miniTierBadge(w.id);
      rows.push('<div class="gz-row' + (unlocked ? '' : ' locked') + (w.advanced ? ' pc-only' : '') + '" data-idx="' + idx + '" onclick="gzPlay(' + idx + ')">' +
        '<span class="gz-emoji">' + (unlocked ? gzEmoji(w) : '🔒') + '</span>' +
        '<span class="gz-name">' + gzName(w) + tBadge + '</span>' +
        '<span class="gz-meta">第'+it.lvId+'幕' + advTag + ' · ' + (unlocked ? (w._tier>=1?'可挑战':'可玩') : '未解锁') + '</span></div>');
    });
    if (!rows.length) return;
    html += '<div class="gz-section">' + emoji + ' ' + label + ' <span class="sec-count">' + rows.length + '</span></div>' + rows.join('');
  });
  // 记忆大师挑战统一放最后
  if (byType['__bonus']) {
    const rows=[];
    byType['__bonus'].forEach(it=>{
      const idx = gzList.length; gzList.push(it);
      const lvDone = levelProgress(it.lvId).completed;
      rows.push('<div class="gz-row' + (lvDone ? '' : ' locked') + '" data-idx="' + idx + '" onclick="gzPlay(' + idx + ')">' +
        '<span class="gz-emoji">' + (lvDone ? '🏆' : '🔒') + '</span>' +
        '<span class="gz-name">记忆大师挑战 · 5 层递进</span>' +
        '<span class="gz-meta">第'+it.lvId+'幕 · ' + (lvDone ? '可玩' : '通关本关解锁') + '</span></div>');
    });
    if (rows.length) html += '<div class="gz-section">🏆 记忆大师挑战 <span class="sec-count">'+rows.length+'</span></div>' + rows.join('');
  }
  body.innerHTML = html || '<div class="lb-empty">还没有可玩的小游戏，先去闯关吧！</div>';
}
function gzPlay(idx) {
  const it = gzList[idx];
  if (!it) return;
  if (it.bonus) {
    const tl = getTermLevel(it.lvId);
    if (!tl || !tl.bonus) return;
    if (!levelProgress(it.lvId).completed) { showToast('通关本关后才能挑战记忆大师', 'error'); return; }
    openMemoryMatch(tl.bonus, (win)=>{ gzAfter(win,'🏆 记忆大师完成！'); });
    return;
  }
  const w = it.w;
  if (!(Array.isArray(w.blockTasks) && w.blockTasks.length && w.blockTasks.every(tid => isTaskDone(tid)))) {
    showToast('先完成对应任务解锁这个小游戏', 'error'); return;
  }
  const t = w.type || 'memory';
  if (t==='quick') openQuickMatch(w, (win)=>{ gzAfter(win,'⚡ 快打完成'); });
  else if (t==='match') openMatchGame(w, (win)=>{ gzAfter(win,'🔗 连线完成'); });
  else if (t==='storm') openStormDefense(w, (win)=>{ gzAfter(win,'🌪️ 数据风暴守住了'); });
  else if (t==='alarm') openAlarmRush(w, (win)=>{ gzAfter(win,'🚨 产线守住了'); });
  else if (t==='typing') openTypingDefense(w, (win)=>{ gzAfter(win,'🔫 术语防线守住了'); });
  else if (t==='shooter') openShooter(w, (win)=>{ gzAfter(win,'🛸 数据蜂群清空！'); });
  else if (t==='racing') openDataRacing(w, (win)=>{ gzAfter(win,'🏎️ 数据狂飙通关！'); });
  else if (t==='snake') openSnake(w, (win)=>{ gzAfter(win,'🐍 网线畅通！'); });
  else if (t==='flappy') openFlappy(w, (win)=>{ gzAfter(win,'🦅 云端到达！'); });
  else if (t==='mole') openMole(w, (win)=>{ gzAfter(win,'🔨 异常全清！'); });
  else if (t==='pacman') openPacman(w, (win)=>{ gzAfter(win,'👾 镜像吃光！'); });
  else if (t==='tank') openTank(w, (win)=>{ gzAfter(win,'🎯 Broker 保住了！'); });
  else if (t==='breakout') openBreakout(w, (win)=>{ gzAfter(win,'🧱 故障全消！'); });
  else if (t==='sorter') openSorter(w, (win)=>{ gzAfter(win,'📦 全部归位！'); });
  else if (t==='forge') openForge(w, (win)=>{ gzAfter(win,'🔥 合成成功！'); });
  else if (t==='ll') openLianLian(w, (win)=>{ gzAfter(win,'🔗 全部配对！'); });
  else if (t==='pipe') openPipe(w, (win)=>{ gzAfter(win,'🔧 数据通路接通！'); });
  else if (t==='m3') openMatch3(w, (win)=>{ gzAfter(win,'🍬 三连清场！'); });
  else if (t==='td') openTowerDefense(w, (win)=>{ gzAfter(win,'🛡️ 车间防线守住！'); });
  else if (t==='t48') openTile2048(w, (win)=>{ gzAfter(win,'🔢 合成'+ (w.target||'TB') +'！'); });
  else if (t==='maze') openMaze(w, (win)=>{ gzAfter(win,'🌐 数据包送达！'); });
  else if (t==='hack') openHacknet(w, (win)=>{ gzAfter(win,'🕹️ 全网络拿下！'); });
  else if (t==='tyc') openTycoon(w, (win)=>{ gzAfter(win,'🏭 产值达标！'); });
  else if (t==='lzr') openLaser(w, (win)=>{ gzAfter(win,'🔦 光束连通！'); });
  else if (t==='boss') openBoss(w, (win)=>{ gzAfter(win,'🎯 故障砸掉了！'); });
  else openMemoryMatch(w, (win)=>{ gzAfter(win,'🧠 翻牌完成'); });
}

function refreshGameZone() {
  // 过关后立即重绘游戏专区列表，让「✓ 已通关/∞ 无限战」标记即时出现，无需刷新
  const ov = document.getElementById('gzOverlay');
  const body = document.getElementById('gzBody');
  if (ov && body && ov.classList.contains('show')) {
    renderGameZone(body);
  }
}
// 统一结算回调：提示 + 刷新专区列表 & 关卡内嵌小游戏行
function gzAfter(win, msg) {
  if (win) showToast(msg, 'success');
  refreshGameZone();
  try {
    // 关卡页里嵌的小游戏行（复习翻牌等）也要即时更新「已通关」标记
    if (typeof renderMission === 'function' && document.getElementById('taskList')) renderMission();
  } catch (e) {}
}

function buildGameZone() {
  if (document.getElementById('gzOverlay')) return;
  const ov = document.createElement('div');
  ov.className = 'gz-overlay';
  ov.id = 'gzOverlay';
  ov.innerHTML = `
    <div class="gz-box">
      <div class="pd-head">
        <div><div class="pd-title">🎮 游戏专区</div><div class="pd-sub">解锁后直接来玩，通关的也能反复刷分</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="mm-btn" onclick="closeGameZone()" style="font-size:12px;padding:6px 12px">🗺️ 返回厂区地图</button>
          <div class="pd-close" onclick="closeGameZone()">✕</div>
        </div>
      </div>
      <div class="pd-body" id="gzBody"></div>
    </div>`;
  document.body.appendChild(ov);
}
function openGameZone() {
  buildGameZone();
  renderGameZone(document.getElementById('gzBody'));
  document.getElementById('gzOverlay').classList.add('show');
}
function closeGameZone() {
  // 地图流程：关闭=回厂区地图，避免露出旧版页面
  if (_mapFlowFeature) { goMap(); return; }
  const ov = document.getElementById('gzOverlay');
  if (ov) ov.classList.remove('show');
}

// 打开翻牌小游戏（memory_match）

// ===== 小游戏首次引导 =====
function tutSeen(t){ try{ return localStorage.getItem('game_tut_'+t)==='1'; }catch(e){ return false; } }
function tutMark(t){ try{ localStorage.setItem('game_tut_'+t,'1'); }catch(e){} }
function showGameTutorial(type, title, steps, onDone){
  const ov=document.createElement('div');
  ov.className='mm-overlay';
  ov.innerHTML='<div class="tut-box"><div class="tut-title">'+title+'</div>'+
    steps.map(s=>'<div class="tut-step">'+s+'</div>').join('')+
    // （去掉“仅首次显示”提示）
    '<button class="mm-btn primary" id="tutStart" style="margin-top:14px;font-size:16px">开始游戏 →</button></div>';
  document.body.appendChild(ov);
  ov.querySelector('#tutStart').onclick=()=>{ ov.remove(); tutMark(type); onDone(); };
}
// 打字游戏引导：慢速掉一个词→提示打字→打爆→正式开战
function showTypingTutorial(cfg, onDone){
  const words=(cfg.words||[]).filter(Boolean); const word=String(words[Math.floor(Math.random()*words.length)]||'ping');
  const ov=document.createElement('div');
  ov.className='mm-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  ov.innerHTML='<div class="ty-box">'+
    '<div class="mm-head"><div><div class="mm-title">🔫 术语防御战 · 新手上路</div><div class="mm-sub">关键词往下掉，敲出完整命令把它打下来！先试一个，跟着打：</div></div>'+
    '<div class="mm-close" id="tutX">✕</div></div>'+
    '<div class="ty-stats"><span>⌨️ 请打出：<b style="color:var(--amber)">'+escHtml(word)+'</b></span></div>'+
    '<div class="ty-field" id="tutField" style="min-height:180px"></div>'+
    '<div class="ty-cannon">🔫</div>'+
    '<input id="tutInput" autocomplete="off" spellcheck="false" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"></div>';
  document.body.appendChild(ov);
  const field=ov.querySelector('#tutField'); const input=ov.querySelector('#tutInput');
  const el=document.createElement('div'); el.className='ty-word'; el.textContent=word;
  el.style.left='30%'; el.style.top='24px'; field.appendChild(el);
  input.focus();
  let typed='';
  ov.querySelector('#tutX').onclick=()=>{ ov.remove(); tutMark('typing'); onDone(); };
  input.addEventListener('keydown', function(e){
    e.preventDefault(); if(e.key.length!==1) return; playSound('type');
    if(word.indexOf(typed+e.key)===0){
      typed+=e.key;
      el.innerHTML='<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(word.slice(typed.length));
      if(typed===word){
        playSound('success'); el.classList.add('ty-boom');
        setTimeout(function(){
          ov.innerHTML='<div class="ty-result"><div style="font-size:46px">🎉</div>'+
            '<div style="font-size:20px;color:var(--green);font-weight:bold;margin-top:8px">太棒了！打爆一个</div>'+
            '<div style="font-size:15px;color:var(--dim);margin-top:6px;line-height:1.7">接下来正式开战：词会越来越快<br>记住——输错就重新开始</div>'+
            '<button class="mm-btn primary" id="tutGo" style="margin-top:16px;font-size:16px">正式开战 →</button></div>';
          ov.querySelector('#tutGo').onclick=function(){ ov.remove(); tutMark('typing'); onDone(); };
        }, 700);
      }
    } else {
      typed=''; el.innerHTML=escHtml(word); playSound('error');
    }
  });
}

// =========================================================================
// 9g. SHOOTER — 数据蜂群 · 保卫工厂（小蜜蜂/Galaxian 风格）
// =========================================================================
let shooterBuff = null;   // 商城道具·本局开局加成
let _shooterSkipLoadout = false;   // 本局已选择“不用道具”，不再弹装备窗
function showShooterLoadout(cfg, onComplete) {
  const inv = gameState.inventory || {};
  const opts = [];
  if ((inv['power_card']||0) > 0) opts.push({id:'power_card', e:'🚀', name:'火力礼包', desc:'开局直接 2 级火力', key:'pLevel'});
  if ((inv['shield_card']||0) > 0) opts.push({id:'shield_card', e:'❤️', name:'开局护盾', desc:'开局 +1 命', key:'lives'});
  if ((inv['slow_card']||0) > 0) opts.push({id:'slow_card', e:'⏳', name:'慢速卡', desc:'敌人全场缓速 8 秒', key:'slow'});
  const ov=document.createElement('div');
  ov.className='mm-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9550;display:flex;align-items:center;justify-content:center';
  let boxes='';
  opts.forEach(function(o,i){ boxes+='<label class="gz-row" style="cursor:pointer;flex:1;min-width:130px;margin:0"><input type="checkbox" id="lod_'+i+'" checked> <span class="gz-emoji">'+o.e+'</span> <span class="gz-name">'+o.name+'<span style="display:block;font-size:12px;color:var(--dim)">'+o.desc+'</span></span></label>'; });
  ov.innerHTML='<div class="mm-box mm-fill" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🎒 装备道具</div><div class="mm-sub">开局选商城买的一次性道具，更顺手</div></div></div><div class="mm-stats" style="margin-bottom:10px;flex-wrap:wrap">'+boxes+'</div><div style="display:flex;gap:10px;justify-content:center;margin-top:6px"><button class="mm-btn" onclick="window.__lodSkip()">不用道具</button><button class="mm-btn primary" onclick="window.__lodStart()">开始游戏</button></div></div>';
  document.body.appendChild(ov);
  window.__lodCfg=cfg; window.__lodDone=onComplete;
  window.__lodStart=function(){
    const use=[];
    opts.forEach(function(o,i){ const cb=document.getElementById('lod_'+i); if(cb && cb.checked) use.push(o); });
    const buff={lives:0,pLevel:0,slow:0};
    use.forEach(function(o){
      api('/api/student/consume-item',{method:'POST',body:JSON.stringify({itemId:o.id})}).then(function(r){
        if (r && r.ok && gameState.inventory[o.id]) {
          gameState.inventory[o.id]--;
          if (gameState.inventory[o.id]<=0) delete gameState.inventory[o.id];
        }
      });
      if (o.key==='lives') buff.lives=1;
      else if (o.key==='pLevel') buff.pLevel=1;
      else if (o.key==='slow') buff.slow=1;
    });
    shooterBuff=buff;
    _shooterSkipLoadout=true;
    ov.remove();
    renderHeader();
    openShooter(cfg, onComplete);
  };
  window.__lodSkip=function(){ _shooterSkipLoadout=true; ov.remove(); openShooter(cfg, onComplete); };
}
function openShooter(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  const advanced = !!cfg.advanced;
  const tutKey = advanced ? 'shooter_adv' : 'shooter';
  if (!tutSeen(tutKey)) {
    showGameTutorial(tutKey, advanced ? '🛸 数据蜂群 · 进阶' : '🛸 数据蜂群', [
      advanced
        ? '你的<b>飞机下面写着炮口文字</b>（一条解释），只有炮口<b>对应名词</b>的数据包才打得动，其余穿透'
        : '你的<b>飞机下面写着一条解释</b>，去找到<b>对应名词</b>的数据包打',
      advanced
        ? '<b>↑/↓</b> 切换炮口名词——想打哪个敌人，就把炮口切到<b>和它相同的名词</b>；匹配上才打得动，否则子弹穿透不扣血'
        : '只有<b>配对</b>的数据包才打得动；非配对的会被子弹穿透、不用管',
      '<b>←/→</b> 移动（自动开火）；手机：<b>拖动</b>移动（自动开火）',
      '初始火力弱，一个数据包要打 <b>3 下</b>才掉；多捡 ⚡ 道具升火力，越打越猛',
      '打掉配对会<b>随机掉落</b>：⚡ 火力、❤ 回命、☄ 全屏爆破、⏳ 缓速、💎 财宝',
      '配对命中 +10、连击加分；被子弹打中 -1 命，清空编队进下一波'
    ], function(){ openShooter(cfg, onComplete); });
    return;
  }
  const __inv = gameState.inventory || {};
  if (!_shooterSkipLoadout && (((__inv['power_card']||0) > 0) || ((__inv['shield_card']||0) > 0) || ((__inv['slow_card']||0) > 0))) {
    showShooterLoadout(cfg, onComplete);
    return;
  }
  _shooterSkipLoadout = false;   // 本局装备/跳过已处理，之后从菜单再进时重新询问
  playMusic(gameSong('shooter') || 'boss');
  // 词库：pairs = [{term 名词, hint 解释}]
  const pairs = (cfg.pairs || []).filter(Boolean);
  if (!pairs.length) { showToast('没有可用的配对词库', 'error'); return; }
  const terms = pairs.map(p => p.term);
  const hintOf = {}; pairs.forEach(p => hintOf[p.term] = p.hint);
  const WAVES = (cfg.waves || 4) + (cfg._hard ? 2 : 0);   // 二周目：多 2 波
  const WAVE_LABEL = cfg._endless ? '∞' : WAVES;
  const LIVES = cfg.lives || 5;
  const COLS = cfg.cols || 6, ROWS = cfg.rows || 4;

  let lives = LIVES + ((shooterBuff && shooterBuff.lives) || 0), score = 0, combo = 0, wave = 1, win = false, ended = false;
  let keys = { left:false, right:false };
  const W = 840, H = 560;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="sh-box">
      <div class="mm-head">
        <div><div class="mm-title">🛸 数据蜂群</div><div class="mm-sub">${escHtml(cfg.name||'')} —— ${advanced ? '↑/↓ 切换炮口文字，打对应的名词' : '看飞机上的解释，打对应的名词'}</div></div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="sh-stats">
        <span>❤️ <b id="shLives">${LIVES}</b></span>
        <span>🌊 第 <b id="shWave">1</b>/${WAVE_LABEL} 波</span>
        ${advanced ? '<span>🎯 炮口 <b id="shTerm" style="color:#7ee8fa">—</b></span>' : ''}
        <span>🎯 <b id="shScore">0</b></span>
        <span>🚀 <b id="shPower" style="color:#7ee8fa">x1</b></span>
        <span>🔥 <b id="shCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(ellipse at 50% 20%, #101a2e, #06070d);cursor:crosshair;touch-action:none"><canvas id="shCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">${advanced ? '↑/↓ 切换炮口名词，匹配到敌人名词才打得动 · ←/→ 移动 · 自动开火' : '看飞机上的解释 → 打对应名词（非配对自动穿透） · ←/→移动 自动开火'}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('shCanvas');
  const ctx = cv.getContext('2d');
  const cw = cv.clientWidth || W, ch = cv.clientHeight || H;
  const sfx = cw / W, sfy = ch / H;
  const livesEl = document.getElementById('shLives');
  const scoreEl = document.getElementById('shScore');
  const waveEl = document.getElementById('shWave');
  const comboEl = document.getElementById('shCombo');
  const powerEl = document.getElementById('shPower');
  const termEl = advanced ? document.getElementById('shTerm') : null;

  let player = { x: W/2, w: 34, h: 18 };
  let bullets = [], ebullets = [], booms = [], drops = [], floatTexts = [];
  let enemies = [], targetTerm = terms[0];
  const XSP = 96, EW = 78;                                  // 编队列间距 / 敌人宽度（让编队左右摆动而非贴边速降）
  let formX = 50, formY = 44, formDir = 1, formStep = 6;   // 下压步进放缓
  let fireCd = 0, efireCd = 0, invuln = 0, muzzle = 0;
  let pLevel = (shooterBuff && shooterBuff.pLevel) ? 1 : 0, picked = 0;   // 火力等级 0..3（显示 x1..x4）、本局拾取道具数
  let termList = [], termIdx = 0;   // 进阶模式：可切换的炮口术语列表
  const MAX_LVL = 3;
  const BULLET_LVLS = [
    { cd: 0.50, dmg: 1, vxs: [0],              col: '#ffe066', w: 4, h: 10, fx: 0 },
    { cd: 0.42, dmg: 2, vxs: [-9, 9],          col: '#7ee8fa', w: 4, h: 10, fx: 1 },
    { cd: 0.34, dmg: 3, vxs: [0, -62, 62],     col: '#7dff9e', w: 5, h: 12, fx: 2 },
    { cd: 0.27, dmg: 4, vxs: [0, -42, 42, -108, 108], col: '#ff8fd8', w: 5, h: 12, fx: 3 }
  ];
  const ROW_PITCH = 46;          // 行距加大，行间留空放术语
  const ENEMY_SKINS = [          // 敌人皮肤：每波换一套（后续可在商城购买更多）
    { col: '#00bcd4' },          // 网络蓝
    { col: '#ff7043' },          // 高温橙
    { col: '#ab6cff' }           // 协议紫
  ];
  let slowT = (shooterBuff && shooterBuff.slow) ? 8 : 0, lasers = [], skin = ENEMY_SKINS[0];

  function pickNextTarget(){
    const avail = {};
    enemies.forEach(e => { if (e.active) avail[e.term] = 1; });
    const list = Object.keys(avail);
    return list.length ? list[0] : null;
  }
  function cycleTerm(dir) {          // 进阶模式：↑/↓ 切换炮口
    if (!termList.length) return;
    termIdx = (termIdx + dir + termList.length) % termList.length;
    targetTerm = termList[termIdx];
    if (termEl) termEl.textContent = targetTerm;
    playSound('click');
    floatTexts.push({ x: player.x, y: H-96, txt: '🎯 ' + targetTerm, t: 0, col: '#7ee8fa' });
  }
  function nextActiveTerm() {        // 找一个还有敌人的其它名词
    const avail = [];
    enemies.forEach(e => { if (e.active && e.term !== targetTerm && avail.indexOf(e.term) < 0) avail.push(e.term); });
    return avail.length ? avail[0] : null;
  }
  function makeWave() {
    enemies = [];
    formX = 50; formY = 44; formDir = 1;   // 每波都从原点出发
    var _esCol = equippedEnemySkin();
    skin = _esCol ? { col: _esCol } : ENEMY_SKINS[(wave - 1) % ENEMY_SKINS.length];   // 装备的敌人皮肤优先，否则每波轮换
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        enemies.push({ r, c, x: formX + c*XSP, y: formY + r*ROW_PITCH, w: EW, h: 26,
          term: terms[(r*COLS+c) % terms.length], active:true, hp:3, maxHp:3, flash:0 });
      }
    }
    if (advanced) {
      const set = new Set();
      enemies.forEach(e => set.add(e.term));
      termList = Array.from(set);
      termIdx = 0;
      targetTerm = termList.length ? termList[0] : null;
      if (termEl) termEl.textContent = targetTerm || '—';
    } else {
      targetTerm = pickNextTarget();
    }
  }
  function fire() {
    if (fireCd > 0) return;
    const L = BULLET_LVLS[pLevel];
    fireCd = L.cd;
    muzzle = 0.08;
    L.vxs.forEach(vx => {
      bullets.push({ x: player.x, y: H-50, vx, vy: -500, dmg: L.dmg, w: L.w, h: L.h, col: L.col, fx: L.fx, t: 0 });
    });
    if (pLevel >= MAX_LVL) {   // 满级：机头同时射出激光
      lasers.push({ x: player.x, t: 0, dur: 0.42, dmgT: 0 });
    }
    playSound('shoot');
  }
  function hitEnemy(e, b) {
    e.hp -= b.dmg;
    e.flash = 0.12;
    if (e.hp > 0) {            // 没打死：闪白 + 火花，子弹消失（要再打几下）
      playSound('hit');
      booms.push({ x: b.x, y: b.y, t: 0, big: false, small: true });
      return;
    }
    booms.push({ x: e.x + e.w/2, y: e.y + e.h/2, t: 0, big: true });
    combo++;
    let gain = 10;
    if (combo >= 5) gain += 5;
    score += gain; scoreEl.textContent = score;
    comboEl.textContent = combo >= 2 ? 'x'+combo : '';
    playSound('success');
    // —— 击碎粒子 + 得分飘字 ——
    try{
      for(let k=0;k<10;k++){
        const ang=Math.random()*Math.PI*2, sp=80+Math.random()*140;
        floatTexts.push({ x: e.x+e.w/2, y: e.y+e.h/2, t: 0, txt: '✦', col:'#7ee8fa', vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp-40 });
      }
      floatTexts.push({ x: e.x+e.w/2, y: e.y+e.h/2-10, t: 0, txt: '+' + gain, col:'#ffd700' });
      if(combo>=2) floatTexts.push({ x: e.x+e.w/2, y: e.y+e.h/2-28, t: 0, txt: '🔥 x'+combo, col:'#ff7a00' });
    }catch(e2){}
    e.active = false;
    spawnDrop(e);
    if (!enemies.some(x => x.active && x.term === targetTerm)) {
      if (advanced) {
        const nt = nextActiveTerm();
        if (nt) {
          targetTerm = nt;
          termIdx = Math.max(0, termList.indexOf(nt));
          if (termEl) termEl.textContent = nt;
          showToast('🎯 炮口已切换 → ' + nt, 'info');
          playSound('click');
        }
      } else {
        targetTerm = pickNextTarget();
      }
    }
  }
  function spawnDrop(e) {
    if (Math.random() > 0.18) return;
    const roll = Math.random();
    let type = 'P';
    if (roll < 0.12) type = '☄';
    else if (roll < 0.27) type = '⏳';
    else if (roll < 0.40) type = '💎';
    else if (roll < 0.62) type = '❤';
    drops.push({ x: e.x + e.w/2, y: e.y + e.h/2, type, vy: 75 + Math.random()*35, t: 0, consumed: false });
  }
  function collectDrop(d) {
    d.consumed = true;
    picked++;
    playSound('pickup');
    if (d.type === 'P') {
      if (pLevel < MAX_LVL) {
        pLevel++;
        powerEl.textContent = 'x' + (pLevel+1);
        playSound('levelup');
        floatTexts.push({ x: player.x, y: H-64, txt: '🚀 火力 ' + (pLevel+1) + ' 级！', t: 0, col: '#7ee8fa' });
      } else {
        score += 20; scoreEl.textContent = score;
        floatTexts.push({ x: player.x, y: H-64, txt: '+20 火力已满', t: 0, col: '#ffe066' });
      }
    } else if (d.type === '❤') {
      lives = Math.min(LIVES + 2, lives + 1);
      livesEl.textContent = lives;
      playSound('levelup');
      floatTexts.push({ x: player.x, y: H-64, txt: '❤ +1 命', t: 0, col: '#ff7a7a' });
    } else if (d.type === '⏳') {
      slowT = 8;
      playSound('levelup');
      floatTexts.push({ x: player.x, y: H-64, txt: '⏳ 全场缓速 8 秒', t: 0, col: '#7ec8ff' });
    } else if (d.type === '💎') {
      score += 50; scoreEl.textContent = score;
      playSound('levelup');
      floatTexts.push({ x: player.x, y: H-64, txt: '💎 财宝 +50', t: 0, col: '#c9a6ff' });
    } else { // ☄ 全屏爆破
      let cleared = 0;
      enemies.forEach(e => {
        if (!e.active) return;
        e.active = false; cleared++;
        score += 10;
        booms.push({ x: e.x + e.w/2, y: e.y + e.h/2, t: 0, big: true });
      });
      scoreEl.textContent = score;
      playSound('fanfare');
      targetTerm = pickNextTarget();
      floatTexts.push({ x: player.x, y: H-64, txt: '☄ 全屏爆破 +' + (cleared*10), t: 0, col: '#ffb000' });
    }
  }
  function loseLife() {
    if (invuln > 0) return;
    lives--; livesEl.textContent = lives;
    invuln = 2;
    booms.push({ x: player.x, y: H-26, t: 0, big: true });
    playSound('error');
    if (lives <= 0) { endGame(false); }
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true; win = isWin;
    if (win) { recordGameWin('shooter'); miniMarkClear(cfg.id); playSound('success'); }
    try{
      const gs = getGameStats();
      gs.shooterPlays = (gs.shooterPlays||0)+1;
      gs.shooterBest = Math.max(gs.shooterBest||0, score);
      gs.shooterWaves = Math.max(gs.shooterWaves||0, wave);
      gs.shooterCombo = Math.max(gs.shooterCombo||0, combo);
      gs.shooterMaxLevel = Math.max(gs.shooterMaxLevel||0, pLevel+1);
      gs.shooterPickups = (gs.shooterPickups||0) + picked;
      saveGameStats(gs);
    }catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML =
        '<div style="font-size:46px;line-height:1">'+(win?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(win?'var(--green)':'var(--red)')+';margin-top:8px">'+(win?'编队全清！工厂安全！':'防线被突破')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">配对命中 <b style="color:var(--amber)">'+score+'</b> 分 · 打到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">'+
          '<button class="mm-btn" onclick="window.shAgain()">🔁 再玩一次</button>'+
          '<button class="mm-btn primary" onclick="window.shDone()">收下奖励</button>'+
        '</div>';
      focusResultPrimary(overlay);
      overlay.innerHTML = '';
      overlay.appendChild(res);
    }, 300);
  }
  window.shAgain = () => { overlay.remove(); openShooter(cfg, onComplete); };
  window.shDone = () => { if (onComplete) onComplete(win); overlay.remove(); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }

  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  function kd(e){
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    else if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    else if (advanced && (e.key === 'ArrowUp' || e.key === 'w')) { e.preventDefault(); cycleTerm(1); }
    else if (advanced && (e.key === 'ArrowDown' || e.key === 's')) { e.preventDefault(); cycleTerm(-1); }
    else if (e.key === ' ') { e.preventDefault(); fire(); }
    else if (e.key === 'Escape') { closeGame(false); }
  }
  function ku(e){ if (e.key==='ArrowLeft'||e.key==='a') keys.left=false; else if (e.key==='ArrowRight'||e.key==='d') keys.right=false; }
  let dragging = false;
  cv.addEventListener('pointerdown', e => { dragging = true; e.preventDefault(); });
  cv.addEventListener('pointermove', e => { if (dragging) { const r=cv.getBoundingClientRect(); player.x = Math.max(20, Math.min(W-20, (e.clientX-r.left)/sfx)); } });
  cv.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('pointercancel', () => { dragging = false; });

  function update(dt) {
    if (ended) return;
    if (invuln > 0) invuln -= dt;
    // 自动开火（一直打，降低难度）
    fireCd -= dt;
    if (fireCd <= 0) fire();
    if (muzzle > 0) muzzle -= dt;
    // 移动
    const spd = 300;
    if (keys.left) player.x -= spd*dt;
    if (keys.right) player.x += spd*dt;
    player.x = Math.max(20, Math.min(W-20, player.x));
    // 全场缓速计时
    if (slowT > 0) slowT -= dt;
    // 编队移动（更慢：第 1 波最慢，逐波加快；缓速时更慢）
    const fMul = slowT > 0 ? 0.55 : 1;
    formX += formDir * (9 + wave*2) * fMul * dt;
    if (formX > W - COLS*118 - 20) { formDir = -1; formY += formStep; }
    if (formX < 30) { formDir = 1; formY += formStep; }
    enemies.forEach(e => {
      if (!e.active) return;
      e.x = formX + e.c*118;
      e.y = formY + e.r*ROW_PITCH;
      if (e.flash > 0) e.flash -= dt;
      if (e.y > H - 60) { loseLife(); e.active=false; }
    });
    // 我方子弹（含横向速度 + 拖尾计时）
    bullets.forEach(b => { b.x += b.vx*dt; b.y += b.vy*dt; b.t += dt; });
    bullets = bullets.filter(b => b.y > -20);
    // 激光：持续光束，对光束内的配对目标持续伤害
    lasers.forEach(l => {
      l.t += dt; l.dmgT += dt;
      if (l.dmgT >= 0.12) {
        l.dmgT = 0;
        enemies.forEach(e => {
          if (!e.active || e.term !== targetTerm) return;
          if (l.x > e.x - 10 && l.x < e.x + e.w + 10) hitEnemy(e, { dmg: 2 });
        });
      }
    });
    lasers = lasers.filter(l => l.t < l.dur);
    // 道具：下落 → 底部停留 → 拾取
    drops.forEach(d => { if (d.y < H - 36) d.y += d.vy*dt; d.t += dt; });
    drops.forEach(d => { if (d.y > H - 60 && Math.abs(d.x - player.x) < 28) collectDrop(d); });
    drops = drops.filter(d => !d.consumed && d.t < 9);
    // 敌方子弹（第 1 波不打，第 2 波起更慢更少）
    if (wave >= 2) {
      efireCd -= dt;
      if (efireCd <= 0) {
        efireCd = Math.max(1.6, 3.4 - wave*0.2) * (slowT > 0 ? 1.5 : 1);
        const shooters = enemies.filter(e=>e.active && e.r === ROWS-1);
        if (shooters.length) {
          const s = shooters[Math.floor(Math.random()*shooters.length)];
          ebullets.push({ x: s.x + s.w/2, y: s.y + s.h, vy: 120 + wave*8, w:4, h:10 });
        }
      }
    }
    ebullets.forEach(b => { b.y += b.vy*dt; });
    ebullets = ebullets.filter(b => b.y < H+20);
    // 碰撞
    bullets.forEach(b => {
      enemies.forEach(e => {
        if (!e.active) return;
        if (b.x > e.x && b.x < e.x+e.w && b.y > e.y && b.y < e.y+e.h) {
          if (e.term === targetTerm) { b.hit = true; hitEnemy(e, b); }
          else { booms.push({ x: b.x, y: b.y, t: 0, big: false, small: true }); }
        }
      });
    });
    bullets = bullets.filter(b => !b.hit);
    ebullets.forEach(b => {
      if (b.x > player.x-17 && b.x < player.x+17 && b.y > H-52 && b.y < H-24) { b.hit = true; loseLife(); }
    });
    ebullets = ebullets.filter(b => !b.hit);
    booms.forEach(b => b.t += dt);
    booms = booms.filter(b => b.t < 0.5);
    floatTexts.forEach(f => f.t += dt);
    floatTexts = floatTexts.filter(f => f.t < 1.3);
    if (enemies.every(e => !e.active)) {
      if (wave >= WAVES && !cfg._endless) { endGame(true); return; }   // 无限战：不结算，继续
      wave++; waveEl.textContent = wave;
      makeWave();
      showToast('🌊 第 '+wave+' 波编队来袭！', 'success');
    }
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    const sf = Math.max(0.6, cw / W);   // 显示缩放（手机端字也跟着变大）
    // 背景网格
    ctx.strokeStyle = 'rgba(0,188,212,.12)';
    ctx.lineWidth = 1;
    for(let i=0;i<W;i+=40){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for(let j=0;j<H;j+=40){ ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }
    // 敌人（名词）：进阶模式全部显示名词标签+血量，靠玩家主动匹配炮口；基础模式只高亮配对目标
    enemies.forEach(e => {
      if (!e.active) return;
      const match = e.term === targetTerm;
      if (advanced) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = skin.col;
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.lineWidth = 1;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.strokeRect(e.x, e.y, e.w, e.h);
        const label = e.term;
        const fs = Math.max(8, Math.min(13, Math.floor(86 / Math.max(1, label.length) * 1.5)));
        ctx.font = 'bold ' + Math.round(fs/sf) + 'px "Courier New", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillText(label, e.x + e.w/2 + 1, e.y - 9 + 1);
        ctx.fillStyle = '#fff7d6';
        ctx.fillText(label, e.x + e.w/2, e.y - 9);
        const pw = 40, px = e.x + e.w/2 - pw/2, py = e.y + e.h - 7;
        for (let i=0;i<e.maxHp;i++) {
          const on = i < e.hp;
          ctx.fillStyle = on ? (e.hp === 1 ? '#ff5f57' : '#ffd27d') : 'rgba(255,255,255,.12)';
          ctx.fillRect(px + i*(pw/e.maxHp + 3), py, pw/e.maxHp, 4);
        }
      } else {
        if (!match) ctx.globalAlpha = 0.4;
        ctx.fillStyle = match ? '#ffb000' : skin.col;
        ctx.strokeStyle = match ? '#fff' : 'rgba(0,0,0,.6)';
        ctx.lineWidth = match ? 2 : 1;
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.strokeRect(e.x, e.y, e.w, e.h);
        if (match) {
          const label = e.term;
          const fs = Math.max(8, Math.min(13, Math.floor(86 / Math.max(1, label.length) * 1.5)));
          ctx.font = 'bold ' + Math.round(fs/sf) + 'px "Courier New", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillText(label, e.x + e.w/2 + 1, e.y - 9 + 1);
          ctx.fillStyle = '#fff7d6';
          ctx.fillText(label, e.x + e.w/2, e.y - 9);
          const pw = 40, px = e.x + e.w/2 - pw/2, py = e.y + e.h - 7;
          for (let i=0;i<e.maxHp;i++) {
            const on = i < e.hp;
            ctx.fillStyle = on ? (e.hp === 1 ? '#ff5f57' : '#ffd27d') : 'rgba(255,255,255,.12)';
            ctx.fillRect(px + i*(pw/e.maxHp + 3), py, pw/e.maxHp, 4);
          }
        }
      }
      // 命中闪白
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(1, e.flash/0.12) * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(e.x, e.y, e.w, e.h);
      }
      ctx.globalAlpha = 1;
    });
    // 玩家（飞机带解释，火力高时带光环）
    if (invuln <= 0 || Math.floor(invuln*8)%2===0) {
      if (pLevel >= 2) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffb000';
        ctx.beginPath(); ctx.arc(player.x, H-48, 10 + pLevel*2, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      var _ps = PLANE_SKINS[getEquippedSkin('plane')] || PLANE_SKINS.default;
      ctx.fillStyle = _ps.col;
      ctx.beginPath();
      ctx.moveTo(player.x, H-50); ctx.lineTo(player.x-18, H-26); ctx.lineTo(player.x+18, H-26);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = _ps.ck;
      ctx.fillRect(player.x-3, H-44, 6, 8);
      // 火力 ≥1：机尾喷焰
      if (pLevel >= 1) {
        ctx.fillStyle = BULLET_LVLS[pLevel].col;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(player.x, H-24, 3 + pLevel, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // 枪口闪光
    if (muzzle > 0) {
      ctx.globalAlpha = muzzle/0.08;
      ctx.fillStyle = BULLET_LVLS[pLevel].col;
      ctx.beginPath(); ctx.arc(player.x, H-51, 6, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 进阶：飞机炮口标签（当前装载的名词，要主动匹配敌人）显示在机头上方
    if (advanced && targetTerm) {
      const tag = '🎯 ' + targetTerm;
      ctx.font = 'bold ' + Math.round(12/sf) + 'px "Courier New", monospace';
      const tw = ctx.measureText(tag).width + 14;
      const ty = H - 64;
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.strokeStyle = '#7ee8fa';
      ctx.lineWidth = 1.5;
      ctx.fillRect(player.x - tw/2, ty - 14, tw, 18);
      ctx.strokeRect(player.x - tw/2, ty - 14, tw, 18);
      ctx.fillStyle = '#7ee8fa';
      ctx.textAlign = 'center';
      ctx.fillText(tag, player.x, ty - 1);
    }
    // 飞机下的解释（配对线索）
    const hint = hintOf[targetTerm] || targetTerm;
    ctx.fillStyle = '#ffd27d';
    ctx.font = 'bold ' + Math.round(14/sf) + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🧩 ' + hint, player.x, H - 4);
    // 激光束（满级武器）
    lasers.forEach(l => {
      const a = Math.max(0, 1 - l.t/l.dur);
      ctx.globalAlpha = 0.9*a;
      ctx.fillStyle = '#ff8fd8';
      ctx.fillRect(l.x - 5, 0, 10, H - 50);
      ctx.globalAlpha = 0.35*a;
      ctx.fillRect(l.x - 11, 0, 22, H - 50);
      ctx.globalAlpha = 1;
    });
    // 子弹（按火力等级带不同特效：拖尾/光晕/加宽）
    bullets.forEach(b => {
      ctx.save();
      if (b.fx >= 1) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = b.col;
        ctx.lineWidth = b.w + 4;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx*0.02, b.y - b.vy*0.02); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = b.col;
      if (b.fx >= 2) {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(b.x - b.w/2 - 2, b.y - b.h/2 - 2, b.w + 4, b.h + 4);
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h);
      ctx.restore();
    });
    ctx.fillStyle = '#ff5555';
    ebullets.forEach(b => ctx.fillRect(b.x-2, b.y-5, 4, 10));
    // 道具掉落（P 火力 / ❤ 回命 / ☄ 爆破）
    drops.forEach(d => {
      const y = Math.min(d.y, H - 38);
      const bob = Math.sin(d.t*4) * 2;
      const alpha = (d.y > H - 38 && d.t > 7.5) ? Math.max(0.2, 1 - (d.t - 7.5)) : 1;
      ctx.globalAlpha = alpha;
      const col = d.type === 'P' ? '#7ee8fa' : d.type === '❤' ? '#ff7a7a' : d.type === '⏳' ? '#5ac8ff' : d.type === '💎' ? '#c9a6ff' : '#ffb000';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(d.x, y + bob, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#061018';
      ctx.font = 'bold ' + Math.round(12/sf) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.type, d.x, y + bob + 1);
      ctx.globalAlpha = 1;
    });
    // 拾取飘字
    floatTexts.forEach(f => {
      // 粒子型(带vx/vy)：做抛物线飘散
      if (f.vx) { f.x += f.vx*dt; f.y += f.vy*dt; f.vy += 220*dt; }
      ctx.globalAlpha = Math.max(0, 1 - f.t/1.2);
      ctx.fillStyle = f.col;
      ctx.font = 'bold ' + Math.round(15/sf) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.txt, f.x, f.y - (f.vx ? 0 : f.t*42));
      ctx.globalAlpha = 1;
    });
    // 爆炸
    booms.forEach(b => {
      const a = 1 - b.t/0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = b.big ? '#ffb000' : '#ff7a00';
      const r = 8 + b.t*60;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    // 缓速指示
    if (slowT > 0) {
      ctx.globalAlpha = Math.min(1, slowT);
      ctx.fillStyle = '#7ec8ff';
      ctx.font = 'bold ' + Math.round(13/sf) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⏳ 全场缓速 ' + slowT.toFixed(1) + 's', 10, 22);
      ctx.globalAlpha = 1;
    }
  }

  let last = performance.now();
  function loop(now) {
    if (ended) return;
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  let raf;
  shooterBuff = null;   // 已应用，清掉本次加成
  makeWave();
  raf = requestAnimationFrame(loop);
}

function openDataRacing(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('racing')) {
    showGameTutorial('racing', '🏎️ 数据狂飙', [
      '你的<b>数据车</b>在监控管道里狂飙，用 <b>←/→</b>（手机<b>点屏幕两侧</b>）切换车道',
      '<b>躲开</b>红色异常块（超温🔥/爆振⚡/超压💢）——撞上 -1 命',
      '<b>吃</b>绿色正常数据 +10 分，连吃有连击加成；金色 🎁 是随机道具',
      '越跑越快，直到跟不上为止；坚持越久分越高'
    ], function(){ openDataRacing(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('racing') || 'boss');
  const metric=cfg.metric||'温度', unit=cfg.unit||'', mx=cfg.max||80;   // 数值判断：读数>上限=异常
  const LANES = cfg.lanes || 4;
  const LIVES = (cfg.lives || 3) + ((shooterBuff && shooterBuff.lives) || 0);   // 商城护盾 +1 命
  const W = 840, H = 560;
  const baseSpeed = (cfg._hard ? 250 : 185);
  const accel = cfg._hard ? 6.5 : 4.5;

  let lives = LIVES, score = 0, combo = 0, ended = false, survived = 0, clearedMarked = false;
  let speed = baseSpeed, elapsed = 0, bgScroll = 0;
  let lane = Math.floor(LANES / 2), carX = 0, invuln = 0, shield = false;
  let items = [], spawnTimer = 0, particles = [], trail = [];
  let keys = { left:false, right:false };
  const laneW = W / LANES;
  carX = laneW*lane + laneW/2;   // 初始车在中间道

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="sh-box">
      <div class="mm-head">
        <div><div class="mm-title">🏎️ 数据狂飙</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 躲异常、吃正常、越跑越快</div></div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="sh-stats">
        <span>❤️ <b id="rrLives">${LIVES}</b></span>
        <span>🌡️ 正常 ≤<b id="rrMax">${mx}</b>${unit}</span>
        <span>⚡ <b id="rrSpeed" style="color:#7ee8fa">0</b></span>
        <span>🎯 <b id="rrScore">0</b></span>
        <span>🔥 <b id="rrCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(ellipse at 50% 10%, #0a1428, #04060c);cursor:pointer;touch-action:none"><canvas id="rrCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">←/→ 或 点屏幕两侧切换车道 · 读数 ≤${mx}${unit} 才吃 · 超限躲开</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('rrCanvas');
  const ctx = cv.getContext('2d');
  const cw = cv.clientWidth || W, ch = cv.clientHeight || H;
  const sfx = cw / W;
  const livesEl=document.getElementById('rrLives'), scoreEl=document.getElementById('rrScore'), comboEl=document.getElementById('rrCombo'), speedEl=document.getElementById('rrSpeed');

  function goLane(d){ lane = Math.max(0, Math.min(LANES-1, lane + d)); playSound('click'); }
  document.addEventListener('keydown', kd);
  document.addEventListener('keyup', ku);
  function kd(e){
    if (e.key==='ArrowLeft'||e.key==='a') keys.left=true;
    else if (e.key==='ArrowRight'||e.key==='d') keys.right=true;
    else if (e.key==='Escape') closeGame(false);
  }
  function ku(e){ if(e.key==='ArrowLeft'||e.key==='a')keys.left=false; else if(e.key==='ArrowRight'||e.key==='d')keys.right=false; }
  cv.addEventListener('pointerdown', e => {
    const r=cv.getBoundingClientRect(); const x=e.clientX-r.left;
    goLane(x < r.width/2 ? -1 : 1);
  });

  function addParticles(x,y,c){ for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220-40,t:0,color:c}); }
  function spawnItem(){
    const l = Math.floor(Math.random()*LANES);
    const x = laneW*l + laneW/2;
    const rr = Math.random();
    let type='good';
    if (rr < 0.46) type='bad';
    else if (rr < 0.53) type='drop';
    const val = 15 + Math.floor(Math.random()*(mx*1.5));
    let label = metric+' '+val+unit;
    if (type==='drop') label='🎁';
    else type = (val <= mx) ? 'good' : 'bad';   // 读数判断：超上限=异常
    items.push({ x, y:-30, type, label, vy: speed, val });   // vy 仅作初始值，下落统一按当前 speed
  }

  function update(dt){
    if (ended) return;
    elapsed += dt; survived += dt;
    if (!clearedMarked && survived >= 45) { clearedMarked = true; miniMarkClear(cfg.id); showToast('🏆 坚持 45 秒，达成通关！','success'); }
    speed = Math.min(950, baseSpeed + elapsed*accel);
    speedEl.textContent = Math.round(speed);
    if (invuln>0) invuln-=dt;
    if (keys.left) goLane(-1);
    if (keys.right) goLane(1);
    spawnTimer -= dt;
    if (spawnTimer <= 0){ spawnItem(); spawnTimer = Math.max(0.25, 0.85 - elapsed*0.004); }
    items.forEach(it => { it.y += speed*dt; });           // 障碍随当前车速下落（与速度读数一致）
    items = items.filter(it => it.y < H+40);
    const targetX = laneW*lane + laneW/2;
    carX += (targetX - carX) * Math.min(1, dt*9);          // 平滑变道
    const px = carX, py = H-70;
    items.forEach(it => {
      if (it.hit) return;
      if (Math.abs(it.x-px) < 36 && Math.abs(it.y-py) < 36) {
        it.hit = true;
        if (it.type==='good') {
          combo++; score += 10 + (combo>=5?5:combo>=3?3:0);
          scoreEl.textContent=score; comboEl.textContent = combo>=2?'x'+combo:'';
          addParticles(it.x, it.y, '#00e676'); playSound('success');
        } else if (it.type==='bad') {
          combo=0; if(comboEl)comboEl.textContent='';
          if (shield){ shield=false; addParticles(it.x,it.y,'#7ee8fa'); showToast('🛡 护盾挡下一次撞击！','info'); }
          else if (invuln<=0){ lives--; livesEl.textContent=lives; invuln=1.2; addParticles(it.x,it.y,'#ff5252'); playSound('error'); if(lives<=0){ endGame(false); return; } }
        } else {
          const roll=Math.random();
          if (roll<0.5){ if(invuln<=0){ shield=true; showToast('🛡 护盾就绪','info'); } else { score+=20; scoreEl.textContent=score; } }
          else if (roll<0.8){ lives=Math.min(LIVES+2, lives+1); livesEl.textContent=lives; showToast('❤ +1 命','info'); }
          else { score+=50; scoreEl.textContent=score; playSound('fanfare'); }
          playSound('pickup');
        }
      }
    });
    items = items.filter(it => !it.hit);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    const sf = Math.max(0.6, cw/W);
    ctx.strokeStyle='rgba(0,188,212,.15)'; ctx.lineWidth=1;
    for(let i=1;i<LANES;i++){ ctx.beginPath(); ctx.moveTo(i*laneW,0); ctx.lineTo(i*laneW,H); ctx.stroke(); }
    ctx.fillStyle='rgba(0,188,212,.07)';
    bgScroll += speed*dt;                                 // 路面随车速滚动
    for(let j=0;j<14;j++){ const yy=((j*60 + bgScroll*0.9)%H); ctx.fillRect(0,yy,W,2); }
    const px = carX, py = H-70;
    if (invuln<=0 || Math.floor(invuln*8)%2===0) {
      ctx.fillStyle='#00e676';
      ctx.fillRect(px-22, py-16, 44, 30);
      ctx.fillStyle='#aaffcc'; ctx.fillRect(px-5, py-22, 10, 8);
      ctx.fillStyle='#00e676'; ctx.beginPath(); ctx.moveTo(px-28,py+14); ctx.lineTo(px,py+28); ctx.lineTo(px+28,py+14); ctx.fill();
    }
    if (shield){ ctx.strokeStyle='#7ee8fa'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px, py, 34, 0, Math.PI*2); ctx.stroke(); }
    // 车尾焰
    trail.push({x:px,y:py+26,t:0}); trail.forEach(tr=>tr.t+=dt*2);
    trail=trail.filter(tr=>tr.t<1);
    trail.forEach(tr=>{ ctx.globalAlpha=Math.max(0,1-tr.t); ctx.fillStyle='#7ee8fa'; ctx.fillRect(tr.x-3, tr.y+(tr.t*20), 6, 8); });
    ctx.globalAlpha=1;
    items.forEach(it => {
      ctx.save();
      if (it.type==='good'){ ctx.fillStyle='#00c853'; ctx.strokeStyle='#b2ffce'; }
      else if (it.type==='bad'){ ctx.fillStyle='#ff5252'; ctx.strokeStyle='#ffd0d0'; }
      else { ctx.fillStyle='#ffb300'; ctx.strokeStyle='#ffe9a8'; }
      ctx.lineWidth=2;
      const r = it.type==='drop'?20:28;
      ctx.beginPath(); ctx.arc(it.x, it.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#061018';
      ctx.font='bold ' + Math.round(12/sf) + 'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const t = it.label.length>6 ? it.label.slice(0,6)+'…' : it.label;
      ctx.fillText(t, it.x, it.y);
      ctx.restore();
    });
    // 粒子
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }

  function endGame(isWin){
    if (ended) return;
    ended = true;
    if (isWin) { recordGameWin('racing'); miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML =
        '<div style="font-size:46px;line-height:1">🏁</div>'+
        '<div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">数据狂飙结束</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">坚持 <b style="color:var(--amber)">'+Math.floor(survived)+'</b> 秒 · 得分 <b style="color:var(--amber)">'+score+'</b> · 最高连击 <b style="color:var(--amber)">'+combo+'</b></div>'+
        '<div style="font-size:13px;color:var(--dim);margin-top:4px">'+(survived>=45?'🏆 已通关，下次挑战二周目/无限战！':'坚持 45 秒即可通关')+'</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">'+
          '<button class="mm-btn" onclick="window.rrAgain()">🔁 再飙一次</button>'+
          '<button class="mm-btn primary" onclick="window.rrDone()">收下奖励</button>'+
        '</div>';
      focusResultPrimary(overlay);
      overlay.innerHTML='';
      overlay.appendChild(res);
    }, 300);
  }
  window.rrAgain = () => { overlay.remove(); openDataRacing(cfg, onComplete); };
  window.rrDone = () => { if (onComplete) onComplete(ended && survived>=45 ? true : false); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){
    if (ended) return;
    ended=true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual){ if(onComplete) onComplete(false); playAreaMusic(); }
  }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}

function openSnake(cfg, onComplete) {
  // ================= 难度与配置 =================
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('snake')) {
    showGameTutorial('snake', '🐍 网线贪吃蛇', [
      '用 <b>←/→/↑/↓</b>（手机<b>滑动</b>）控制蛇，撞墙/撞自己 -1 命',
      '<b>吃蓝色术语</b>（如「网关」）带着它，头顶会显示当前带的词',
      '再吃<b>黄色解释</b>——<b>匹配</b>当前术语就配对成功 +25 连击；吃错解释会清掉带的词',
      '配对 <b>6 对</b> 通关；每 3 对厂长会出题，答对给奖励'
    ], function(){ openSnake(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('snake') || 'hub');

  // ---- 词库 & 配对表 ----
  const pairs = (cfg.pairs || []).map(function(p){ return {id:p.id||'', t:String(p.t||''), h:String(p.h||'')}; }).filter(function(p){ return p.t && p.h; });
  const terms = pairs.map(p=>p.t), hints = pairs.map(p=>p.h);
  const hintOf = {}, idOf = {};
  pairs.forEach(p=>{ hintOf[p.t]=p.h; idOf[p.t]=p.id; });
  const WIN = cfg.win || 6;

  // ---- 画布 / 网格（文字整体放大）----
  const W = 840, H = 560, cell = 30, COLS = Math.floor(W/cell), ROWS = Math.floor(H/cell);
  const F_FOOD = 15, F_FLOAT = 19;      // 屏上字号(px)：旧版 8/13 过小，明显放大

  // ---- 游戏状态 ----
  let lives = 3, score = 0, combo = 0, paired = 0, ended = false, quizLock = false;
  let currentTerm = '';
  let snake = [{x:6,y:6},{x:5,y:6},{x:4,y:6}], dir = {x:1,y:0}, nextDir = {x:1,y:0};
  let speed = 4, timer = 0, invuln = 0, spawnTimer = 0;
  let foods = [], particles = [], floats = [];

  // ================= 界面 =================
  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🐍 网线贪吃蛇</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 吃术语，配对解释</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats">
        <span>❤️ <b id="snLives">3</b></span>
        <span>🧩 带词 <b id="snTerm" style="color:#7ee8fa">—</b></span>
        <span>✅ <b id="snPair">0</b>/${WIN}</span>
        <span>🎯 <b id="snScore">0</b></span>
        <span>🔥 <b id="snCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#050a12;touch-action:none"><canvas id="snCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">吃蓝色术语带着它 → 吃黄色解释配对 · 每3对厂长出题</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('snCanvas'), ctx = cv.getContext('2d');
  const cw = cv.clientWidth || W; const sf = Math.max(0.6, cw/W);
  const livesEl=document.getElementById('snLives'), scoreEl=document.getElementById('snScore'), termEl=document.getElementById('snTerm'), pairEl=document.getElementById('snPair'), comboEl=document.getElementById('snCombo');

  // ================= 输入 =================
  function kd(e){
    if (quizLock) return;
    if(e.key==='ArrowUp'||e.key==='w'){nextDir={x:0,y:-1};e.preventDefault();}
    else if(e.key==='ArrowDown'||e.key==='s'){nextDir={x:0,y:1};e.preventDefault();}
    else if(e.key==='ArrowLeft'||e.key==='a'){nextDir={x:-1,y:0};e.preventDefault();}
    else if(e.key==='ArrowRight'||e.key==='d'){nextDir={x:1,y:0};e.preventDefault();}
    else if(e.key==='Escape') closeGame(false);
  }
  document.addEventListener('keydown', kd);
  let swipeStart=null;
  cv.addEventListener('pointerdown', e=>{ if(quizLock) return; swipeStart={x:e.clientX,y:e.clientY}; });
  cv.addEventListener('pointerup', e=>{ if(!swipeStart) return; const dx=e.clientX-swipeStart.x, dy=e.clientY-swipeStart.y; if(Math.abs(dx)>Math.abs(dy)) nextDir={x:Math.sign(dx),y:0}; else if(dy!==0) nextDir={x:0,y:Math.sign(dy)}; swipeStart=null; });

  // ================= 食物 =================
  function isOnSnake(x,y){ return snake.some(s=>s.x===x&&s.y===y); }
  function spawnFood(kind){
    // 找一个空位（避开蛇身和已有食物），最多试 60 次
    // 避开边缘 2 格：食物上方的文字不会被顶部/两侧裁掉
    const X_MIN=2, X_MAX=COLS-3, Y_MIN=1, Y_MAX=ROWS-2;
    let x,y,tries=0;
    do { x=X_MIN+Math.floor(Math.random()*(X_MAX-X_MIN+1)); y=Y_MIN+Math.floor(Math.random()*(Y_MAX-Y_MIN+1)); tries++; }
    // 避开蛇身、已有食物、以及与已有食物文字重叠（x/y 至少隔 2 格，文字在上方不打架）
    while((isOnSnake(x,y) || foods.some(f=>f.x===x&&f.y===y) || foods.some(f=>Math.abs(f.x-x)<2&&Math.abs(f.y-y)<2)) && tries<90);
    // 场上不要出现两个一样的词/解释，避免配对歧义
    const busy = {}; foods.forEach(f=>{ busy[f.label]=true; });
    if(kind==='term'){
      const pool = terms.filter(t=>!busy[t]);
      const t = pool.length ? pool[Math.floor(Math.random()*pool.length)] : terms[Math.floor(Math.random()*terms.length)];
      foods.push({x,y,kind:'term',label:t});
    } else {
      // 优先放"场上已有术语对应的解释"，保证蓝黄能配对
      const fieldTerm = foods.find(f=>f.kind==='term');
      let h = null;
      if(fieldTerm && !busy[hintOf[fieldTerm.label]]) h = hintOf[fieldTerm.label];
      if(!h){
        // 否则从场上所有术语的解释里选一个还没在场的
        const fieldHints = foods.filter(f=>f.kind==='term').map(f=>hintOf[f.label]).filter(hh=>!busy[hh]);
        if(fieldHints.length) h = fieldHints[Math.floor(Math.random()*fieldHints.length)];
      }
      if(!h){ const pool = hints.filter(hh=>!busy[hh]); h = pool.length ? pool[Math.floor(Math.random()*pool.length)] : hints[Math.floor(Math.random()*hints.length)]; }
      foods.push({x,y,kind:'hint',label:h});
    }
  }
  function ensureFoods(){
    if(!foods.some(f=>f.kind==='term')) spawnFood('term');
    if(!foods.some(f=>f.kind==='hint')) spawnFood('hint');
    // 若玩家正带着词，确保场上出现它对应的解释（能完成配对）
    if(currentTerm && !foods.some(f=>f.kind==='hint' && f.label===hintOf[currentTerm])){
      const busy={}; foods.forEach(f=>{busy[f.label]=true;});
      if(!busy[hintOf[currentTerm]]) spawnFood('hint');
    }
    while(foods.length<5){
      // 补位时也优先凑可配对的一对（蓝+对应黄）
      const ft=foods.find(f=>f.kind==='term');
      const hasMatch = ft && foods.some(f=>f.kind==='hint'&&f.label===hintOf[ft.label]);
      if(ft && !hasMatch) spawnFood('hint');
      else spawnFood(Math.random()<0.5?'term':'hint');
    }
  }
  function addParticles(x,y,c){ for(let i=0;i<14;i++)particles.push({x:x*cell+cell/2,y:y*cell+cell/2,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,t:0,color:c}); }
  // 飘字：注意参数是 txt，对象里写 txt:txt（旧版误写 txt:t → 吃食物即 ReferenceError 死机）
  function float(x,y,txt,c){ floats.push({x:x*cell+cell/2,y:y*cell+cell/2,txt:txt,color:c,t:0}); }

  // ================= 厂长问答（每 3 对）=================
  function askFactoryQuiz(){
    if(ended) return;
    quizLock = true;
    const q = pairs[Math.floor(Math.random()*pairs.length)];
    const pool = pairs.filter(p=>p.t!==q.t).map(p=>p.h);
    const opts = [q.h].concat(pool.slice(0,3));
    for(let i=opts.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }
    const ov=document.createElement('div');
    ov.className='mm-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9700;display:flex;align-items:center;justify-content:center';
    ov.innerHTML='<div class="mm-box" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🤔 厂长提问</div><div class="mm-sub">答对额外 +1 命 / +30 分</div></div></div><div class="pd-body"><div style="font-size:16px;font-weight:bold;color:var(--amber);margin-bottom:10px">「'+escHtml(q.t)+'」是什么意思？</div><div style="display:flex;flex-direction:column;gap:8px" id="snqOpts"></div></div></div>';
    document.body.appendChild(ov);
    const box=ov.querySelector('#snqOpts');
    opts.forEach(function(h){
      const b=document.createElement('button'); b.className='mm-btn'; b.style.cssText='text-align:left;white-space:normal;height:auto;line-height:1.4;padding:10px 14px';
      b.textContent=h;
      b.onclick=function(){
        ov.remove(); quizLock=false;
        if(h===q.h){ lives=Math.min(6,lives+1); livesEl.textContent=lives; score+=30; scoreEl.textContent=score; playSound('fanfare'); float(snake[0].x,snake[0].y,'✅ 答对 +1命/+30！','#00e676'); }
        else { playSound('click'); float(snake[0].x,snake[0].y,'厂长：再想想，是「'+hintOf[q.t]+'」','#ffd27d'); }
      };
      box.appendChild(b);
    });
  }

  // ================= 吃食物 / 配对 =================
  function eat(f){
    if(f.kind==='term'){
      // 吃蓝色术语：带着它（若已带别的词则换带）
      const prev = currentTerm;
      currentTerm=f.label; termEl.textContent=f.label; termEl.style.color='#7ee8fa';
      score+=5; scoreEl.textContent=score; playSound('click');
      float(f.x,f.y, prev ? '换带「'+f.label+'」' : '带着「'+f.label+'」，去找解释', '#7ee8fa');
    } else if(currentTerm && hintOf[currentTerm]===f.label){
      // 配对成功
      combo++; score += 25 + (combo>=5?10:combo>=3?5:0); paired++;
      scoreEl.textContent=score; comboEl.textContent=combo>=2?'x'+combo:''; pairEl.textContent=paired;
      addParticles(f.x,f.y,'#00e676'); float(f.x,f.y,'✅ '+currentTerm+'='+hintOf[currentTerm],'#00e676');
      playSound('success');
      if(idOf[currentTerm]) unlockPedia(currentLevelId, [idOf[currentTerm]]);   // 收录图鉴
      currentTerm=''; termEl.textContent='—'; termEl.style.color='#7ee8fa';
      if(paired>=WIN){ endGame(true); return; }
      if(paired%3===0) setTimeout(askFactoryQuiz, 350);   // 特效播完再出题，避免打断
    } else if(currentTerm){
      // 吃错解释：清掉带的词
      score+=2; scoreEl.textContent=score; combo=0; if(comboEl)comboEl.textContent='';
      float(f.x,f.y,'❌ 不是「'+currentTerm+'」的解释','#ff5252'); playSound('error');
      currentTerm=''; termEl.textContent='—';
    } else {
      score+=2; scoreEl.textContent=score; float(f.x,f.y,'先吃蓝色术语，再吃解释','#ffd27d');
    }
  }

  // ================= 移动 / 碰撞 =================
  function loseLife(){
    playSound('error'); invuln=1.5; lives--; livesEl.textContent=lives; addParticles(snake[0].x,snake[0].y,'#ff5252');
    if(lives<=0){ endGame(false); return; }
    snake=snake.slice(0,3); currentTerm=''; termEl.textContent='—';
  }
  function step(){
    const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS){ loseLife(); return; }
    if(snake.some(s=>s.x===head.x&&s.y===head.y)){ loseLife(); return; }
    snake.unshift(head);
    let ate=null;
    for(let i=0;i<foods.length;i++){ const f=foods[i]; if(!f.hit && f.x===head.x && f.y===head.y){ f.hit=true; ate=f; break; } }
    if(ate){ eat(ate); if(ended) return; }
    foods=foods.filter(f=>!f.hit);
    if(!ate) snake.pop();
    // 补充食物
    spawnTimer-=dt; if(spawnTimer<=0){ ensureFoods(); spawnTimer=0.6; }
    if(cfg._endless && paired>0 && paired%10===0) speed = 1.9 + paired*0.2;   // 无限战略快
  }
  function update(dt){
    if(ended || quizLock) return;
    if(invuln>0) invuln-=dt;
    if(!(nextDir.x===-dir.x && nextDir.y===-dir.y)) dir=nextDir;
    speed = 1.9 + paired*0.1; timer += dt; const stepT=1/speed;
    if(timer<stepT) return; timer-=stepT;
    step();
  }

  // ================= 渲染 =================
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='rgba(0,188,212,.06)'; ctx.lineWidth=1;
    for(let x=0;x<=W;x+=cell){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=cell){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // 底部网格微光
    ctx.fillStyle='rgba(0,188,212,.03)'; ctx.fillRect(0,0,W,H);
    // 食物：蓝=术语 / 黄=解释，圆点 + 上方完整文字（深色描边便于阅读）
    foods.forEach(function(f){
      const fx=f.x*cell+cell/2, fy=f.y*cell+cell/2;
      const isTerm = f.kind==='term';
      const pulse = 1 + 0.12*Math.sin(performance.now()/260 + f.x*1.7 + f.y*2.3);
      const rad = 12*pulse;
      // 外发光环
      ctx.fillStyle = isTerm ? 'rgba(33,150,243,.22)' : 'rgba(255,179,0,.22)';
      ctx.beginPath(); ctx.arc(fx,fy,rad+7,0,Math.PI*2); ctx.fill();
      // 主体
      ctx.fillStyle = isTerm ? '#2196f3' : '#ffb300';
      ctx.shadowColor = isTerm ? '#2196f3' : '#ffb300'; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(fx,fy,rad,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      // 高光
      ctx.fillStyle='rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(fx-rad*0.3,fy-rad*0.35,rad*0.28,0,Math.PI*2); ctx.fill();
      ctx.font='bold '+Math.round(F_FOOD/sf)+'px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.88)';
      ctx.strokeText(f.label, fx, fy-20);
      ctx.fillStyle='#fff'; ctx.fillText(f.label, fx, fy-20);
    });
    // 蛇身：卡通圆润——身体用带内高光的圆角胶囊，尾部渐细，蛇头大圆+大眼睛+腮红+小舌头
    const segN=snake.length;
    // 身体关节：为让身体连贯，取每段中心画圆角胶囊
    const drawSeg = function(s,i){
      const isHead = (i===0);
      const cx=s.x*cell+cell/2, cy=s.y*cell+cell/2;
      const tailT = Math.max(0.35, 1 - i/segN);           // 尾部略小
      const r = isHead ? cell*0.5 : cell*0.38*tailT;
      // 前一节（用于连接圆角）
      const prev = snake[i+1];
      const bodyColor = isHead ? (currentTerm?'#00e5ff':'#8cff5e') : 'rgba(0,205,102,'+(0.4+0.6*tailT).toFixed(2)+')';
      ctx.fillStyle = bodyColor;
      if(isHead && currentTerm){ ctx.shadowColor='#4dd0e1'; ctx.shadowBlur=16; }
      if(prev){
        // 在两节之间画一个胶囊（连接相邻节，使身体连续）
        const pcx=prev.x*cell+cell/2, pcy=prev.y*cell+cell/2;
        const ang=Math.atan2(cy-pcy, cx-pcx);
        const len=Math.hypot(cx-pcx, cy-pcy);
        const rr=r*0.8;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(ang+Math.PI/2)*rr, cy+Math.sin(ang+Math.PI/2)*rr);
        ctx.lineTo(pcx+Math.cos(ang+Math.PI/2)*rr, pcy+Math.sin(ang+Math.PI/2)*rr);
        ctx.lineTo(pcx+Math.cos(ang-Math.PI/2)*rr, pcy+Math.sin(ang-Math.PI/2)*rr);
        ctx.lineTo(cx+Math.cos(ang-Math.PI/2)*rr, cy+Math.sin(ang-Math.PI/2)*rr);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      // 内高光（顶部小圆）卡通质感
      ctx.fillStyle='rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(cx-r*0.28, cy-r*0.32, r*0.32, 0, Math.PI*2); ctx.fill();
      if(isHead){
        ctx.shadowBlur=0;
        const ex = dir.x, ey = dir.y;
        const eo = cell*0.30, er = 4.2;
        // 大眼睛（两个，朝方向偏移）
        [[-0.5,0.6],[0.5,0.6]].forEach(function(off){
          const exx = ex*eo + off[0]*cell*0.26;
          const eyy = ey*eo + off[1]*cell*0.26;
          const eX=cx+exx, eY=cy+eyy;
          ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(eX,eY,er,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#123'; ctx.beginPath(); ctx.arc(eX+ex*1.2,eY+ey*1.2,er*0.62,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(eX+ex*2.2-eY*0+ex*0.4,eY+ey*2.2-2,1.4,0,Math.PI*2); ctx.fill();
        });
        // 腮红
        ctx.fillStyle='rgba(255,120,120,.4)';
        ctx.beginPath(); ctx.arc(cx - cell*0.42, cy+cell*0.34, 3.4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cell*0.42, cy+cell*0.34, 3.4, 0, Math.PI*2); ctx.fill();
        // 小舌头（朝方向）
        ctx.strokeStyle='#ff5a5a'; ctx.lineWidth=2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(cx+ex*cell*0.42, cy+ey*cell*0.42);
        ctx.lineTo(cx+ex*cell*0.62, cy+ey*cell*0.62); ctx.stroke();
        // 头顶呆毛
        ctx.strokeStyle='rgba(140,255,94,.9)'; ctx.lineWidth=2.4; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(cx - cell*0.15, cy - cell*0.5);
        ctx.quadraticCurveTo(cx - cell*0.28, cy - cell*0.72, cx - cell*0.05, cy - cell*0.6); ctx.stroke();
      }
      ctx.shadowBlur=0;
    };
    for(let i=0;i<segN;i++){ const s=snake[i]; drawSeg(s,i); }
    // 粒子
    particles.forEach(function(p){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(function(p){return p.t<0.5;});
    // 飘字（放大）
    floats.forEach(function(f){ f.t+=dt; ctx.globalAlpha=Math.max(0,1-f.t/1.3); ctx.fillStyle=f.color; ctx.font='bold '+Math.round(F_FLOAT/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText(f.txt, f.x, f.y-f.t*40); });
    ctx.globalAlpha=1; floats=floats.filter(function(f){return f.t<1.3;});
  }

  // ================= 结算 =================
  function endGame(isWin){
    if(ended) return; ended=true;
    if(isWin){ recordGameWin('snake'); miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(function(){
      const res=document.createElement('div'); res.className='ty-result';
      res.innerHTML='<div style="font-size:46px;line-height:1">🐍</div><div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'网络三件套配对完成！':'网线断了，重接一下')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">配对 <b style="color:var(--amber)">'+paired+'</b> 对 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="font-size:13px;color:var(--dim);margin-top:4px">'+'记住的术语已收录图鉴'+(isWin?'':'，配对 '+WIN+' 对即通关')+'</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.snAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.snDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    },300);
  }
  function cleanup(){ document.removeEventListener('keydown', kd); }
  window.snAgain=function(){ cleanup(); overlay.remove(); openSnake(cfg,onComplete); };
  window.snDone=function(){ cleanup(); if(onComplete)onComplete(paired>=WIN); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){ if(ended) return; ended=true; cancelAnimationFrame(raf); cleanup(); overlay.remove(); if(manual){ if(onComplete)onComplete(false); playAreaMusic(); } }

  // ================= 主循环（try/catch 防御：单点异常不再死机）=================
  ensureFoods();
  let last=performance.now(), dt=0;
  function loop(now){
    dt=Math.min(0.05,(now-last)/1000); last=now;
    try { update(dt); draw(); }
    catch(e){ console.error('[网线贪吃蛇] 循环异常：', e); }
    raf=requestAnimationFrame(loop);
  }
  let raf; raf=requestAnimationFrame(loop);
}

function openFlappy(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('flappy')) {
    showGameTutorial('flappy', '🦅 云端跳跃 · 命令三选一', [
      '每根云柱是一道<b>命令选择题</b>：题目在上方，3 条飞行道各标一个选项',
      '三条道<b>都能穿过</b>，但只有<b>答案正确那条道</b>是安全的——飞错道会撞上隐形云墙 <b>-1 命</b>',
      '<b>点击/空格/↑</b> 起飞；先读题、再选道，安全穿过 +10'
    ], function(){ openFlappy(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('flappy') || 'hub');
  const questions=(cfg.questions||[{q:'SSH 登录命令是？',opts:['ssh user@ip','apt install','nslookup'],ans:0}]).map(function(q){return {q:String(q.q||''),opts:(q.opts||[]).map(String),ans:Number(q.ans)||0};});
  const W=840,H=560;
  const laneYs=[H*0.25, H*0.5, H*0.75];
  const gapHalf=58;
  let lives=3, score=0, ended=false;
  let py=H/2, vy=0, rot=0;
  let pipes=[], timer=0, speed=130;
  let particles=[];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🦅 云端跳跃</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 看题，飞到正确命令的道</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="fpLives">3</b></span><span>🎯 <b id="fpScore">0</b></span><span>⚡ <b id="fpSpeed">0</b></span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(#7ec8ff,#cfe9ff);touch-action:none"><canvas id="fpCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">点击/空格/↑ 起飞 · 先读题，飞进答案正确那条道 · 飞错道撞隐形云墙-1命</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('fpCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('fpLives'), scoreEl=document.getElementById('fpScore'), speedEl=document.getElementById('fpSpeed');
  function flap(){ vy=-170; playSound('type'); }
  document.addEventListener('keydown', e=>{ if(e.key===' '||e.key==='ArrowUp'||e.key==='w'){e.preventDefault();flap();} else if(e.key==='Escape')closeGame(false); });
  cv.addEventListener('pointerdown', e=>{ e.preventDefault(); flap(); });
  function addParticles(x,y,c){ for(let i=0;i<8;i++)particles.push({x,y,vx:(Math.random()-.5)*100,vy:(Math.random()-.5)*100,t:0,color:c}); }
  function spawnPipe(){
    const q=questions[Math.floor(Math.random()*questions.length)];
    pipes.push({x:W+60, q, ans:q.ans, scored:false, hitDone:false});
  }
  function update(dt){
    if(ended)return;
    speed = 130 + score*2.5; speedEl.textContent=Math.round(speed);
    vy += 380*dt; py += vy*dt; rot = Math.max(-0.5, Math.min(1, vy/600));
    timer -= dt;
    if(timer<=0){ spawnPipe(); timer = Math.max(1.2, 1.7 - score*0.02); }
    pipes.forEach(p=>p.x -= speed*dt);
    pipes = pipes.filter(p=>p.x>-70);
    const cy = py+13;
    pipes.forEach(p=>{
      // 整根管道安全通过小鸟位置 → +10
      if(!p.scored && p.x+60 < 70){ p.scored=true; score+=10; scoreEl.textContent=score; playSound('success'); addParticles(70, cy, '#fff'); }
      // 管道覆盖小鸟位置：只有在「正确选项那道」的空隙才安全，其余都是隐形云墙（每根只判一次）
      if(!p.hitDone && p.x < 70 && p.x+60 > 70){
        let inOpen = Math.abs(cy - laneYs[p.ans]) < gapHalf;
        if(!inOpen){ p.hitDone=true; hit(); }
      }
    });
    if(py<-10||py>H-10){ hit(); }
  }
  function hit(){
    if(ended)return;
    playSound('error'); lives--; livesEl.textContent=lives; addParticles(70, py, '#ff5252');
    if(lives<=0){ endGame(false); return; }
    py=H/2; vy=0;
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<6;i++){ const cx=((i*160 - (performance.now()/20)%160)%W), cy=40+i*90; ctx.fillStyle='rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.arc(cx+20,cy-8,18,0,Math.PI*2); ctx.arc(cx+40,cy,22,0,Math.PI*2); ctx.fill(); }
    pipes.forEach(p=>{
      // 三条云道都画成「可穿过」的缺口，不暴露答案——只有答对的选项那道才真正安全
      ctx.fillStyle='rgba(76,175,80,.35)';
      for(let i=0;i<3;i++){
        const y0=laneYs[i]-gapHalf, y1=laneYs[i]+gapHalf;
        ctx.fillRect(p.x, y0-3, 60, 6);                       // 道上沿
        ctx.fillRect(p.x, y1-3, 60, 6);                       // 道下沿
        // 道内：半透明云（可穿过）
        ctx.fillStyle='rgba(255,255,255,.10)';
        ctx.fillRect(p.x, y0+3, 60, (y1-y0)-6);
        ctx.fillStyle='rgba(76,175,80,.35)';
      }
      // 每条道左侧标选项
      p.q.opts.forEach(function(o,i){
        ctx.fillStyle='#1b5e20';
        ctx.font='bold '+Math.round(11/sf)+'px sans-serif'; ctx.textAlign='right';
        ctx.fillText(o, p.x-12, laneYs[i]+4);
      });
      // 题目显示在云柱上方
      ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=2;
      ctx.font='bold '+Math.round(13/sf)+'px sans-serif'; ctx.textAlign='center';
      ctx.strokeText('❓ '+p.q.q, p.x+30, 22); ctx.fillText('❓ '+p.q.q, p.x+30, 22);
    });
    ctx.save(); ctx.translate(70,py); ctx.rotate(rot);
    ctx.fillStyle='#00bcd4'; ctx.beginPath(); ctx.moveTo(26,0); ctx.lineTo(-18,-12); ctx.lineTo(-8,0); ctx.lineTo(-18,12); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#b2ebf2'; ctx.fillRect(-4,-3,8,6);
    ctx.restore();
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,4,4); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){
    if(ended)return; ended=true;
    if(isWin){ recordGameWin('flappy'); miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🦅</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">掉进断线黑洞了</div><div style="font-size:15px;color:var(--dim);margin-top:6px">穿过 <b style="color:var(--amber)">'+score/10+'</b> 道命令题</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.fpAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.fpDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300);
  }
  window.fpAgain=()=>{ overlay.remove(); openFlappy(cfg,onComplete); };
  window.fpDone=()=>{ if(onComplete)onComplete(score>=50); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}

function openMole(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('mole')) {
    showGameTutorial('mole', '🔨 边缘打地鼠', [
      '传感器不断<b>冒出异常数据</b>（超温/爆振/毛刺），<b>点掉</b>它们 = 边缘过滤',
      '看准了再点：冒出的是<b>正常数据</b>就别点，点错 -1 命',
      '<b>⭐ 金色包</b>是奖励，点它 +50 分、直接算 2 个异常；连点有连击加分',
      '难度会提升：同时冒出更多、消失更快；点掉 20 个异常即通关'
    ], function(){ openMole(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('mole') || 'hub');
  const metric=cfg.metric||'温度', unit=cfg.unit||'', thr=cfg.threshold||80;   // 阈值判断：读数>阈值=异常
  const W=840,H=560, COLS=4, ROWS=3;
  const hw=160, hh=150;   // 每格大小
  const ox=(W-COLS*hw)/2, oy=(H-ROWS*hh)/2;
  let lives=3, score=0, combo=0, killed=0, ended=false;
  let moles=[], spawnTimer=0.2, speed=1, particles=[];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🔨 边缘打地鼠</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 点掉异常，别点正常</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="moLives">3</b></span><span>🌡️ 正常 ≤<b id="moThr">${thr}</b>${unit}</span><span>🎯 <b id="moScore">0</b></span><span>🔨 <b id="moKill">0</b>/20</span><span>🔥 <b id="moCombo" style="color:#ff7a00"></b></span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#0a0f16;cursor:pointer;touch-action:none"><canvas id="moCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">读数 <b>超过阈值</b>(${thr}${unit})就点掉 · 范围内别点 · ⭐金包必点 · 越冒越快</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('moCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('moLives'), scoreEl=document.getElementById('moScore'), killEl=document.getElementById('moKill'), comboEl=document.getElementById('moCombo');
  function centerOf(i){ return { x: ox + hw*(i%COLS) + hw/2, y: oy + hh*Math.floor(i/COLS) + hh/2 }; }
  function freeSpot(i){ return !moles.some(m=>m.i===i); }
  function spawn(){
    // 难度：越往后同时冒得越多（2~3 个），消失更快
    const maxSim = speed >= 2.4 ? 3 : speed >= 1.6 ? 2 : 1;
    if (moles.length >= maxSim) return;
    let tries=0, i=Math.floor(Math.random()*(COLS*ROWS));
    while (!freeSpot(i) && tries<20){ i=Math.floor(Math.random()*(COLS*ROWS)); tries++; }
    if (!freeSpot(i)) return;
    const c=centerOf(i);
    const isGold = Math.random() < 0.10;                      // ⭐ 金色奖励包
    let isGood=false, val=0;
    if (!isGold) { val = 5 + Math.floor(Math.random()*(thr*1.5)); isGood = val <= thr; }
    moles.push({ i, x:c.x, y:c.y, isGood, isGold, val, t:0, dur: Math.max(0.6, 1.5 - speed*0.16), label: isGold ? '⭐ 奖励' : (metric+' '+val+unit) });
  }
  function addParticles(x,y,c){ for(let k=0;k<12;k++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220-60,t:0,color:c}); }
  cv.addEventListener('pointerdown', e=>{
    if(ended)return;
    const r=cv.getBoundingClientRect(); const x=(e.clientX-r.left)/sf, y=(e.clientY-r.top)/sf;
    let hitMole=null;
    for (const m of moles) if (Math.abs(x-m.x)<46 && Math.abs(y-m.y)<46){ hitMole=m; break; }
    if (!hitMole) return;
    if (hitMole.isGold) {
      combo++; score+=50; killed+=2;
      scoreEl.textContent=score; killEl.textContent=killed; comboEl.textContent=combo>=2?'x'+combo:'';
      playSound('fanfare'); addParticles(hitMole.x,hitMole.y,'#ffd700');
      moles = moles.filter(m=>m!==hitMole);
      if (killed>=20){ endGame(true); return; }
      return;
    }
    if(hitMole.isGood){ lives--; livesEl.textContent=lives; playSound('error'); addParticles(hitMole.x,hitMole.y,'#ff5252'); if(lives<=0){endGame(false);return;} }
    else { combo++; score+=10+(combo>=5?5:combo>=3?3:0); killed++; scoreEl.textContent=score; killEl.textContent=killed; comboEl.textContent=combo>=2?'x'+combo:''; playSound('success'); addParticles(hitMole.x,hitMole.y,'#ffb000'); if(killed>=20){endGame(true);return;} }
    moles = moles.filter(m=>m!==hitMole);
  });
  function update(dt){
    if(ended)return;
    spawnTimer-=dt;
    if(spawnTimer<=0){ spawn(); spawnTimer = Math.max(0.28, 0.6 - speed*0.06); }
    moles.forEach(m=>{ m.t+=dt; });
    const before=moles.length;
    moles = moles.filter(m=>m.t<m.dur);
    if (moles.length < before) { combo=0; if(comboEl)comboEl.textContent=''; }   // 消失=漏掉，断连击
    speed = 1 + (killed*0.07);
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(0,188,212,.06)';
    for(let i=0;i<COLS*ROWS;i++){ const c=centerOf(i); ctx.beginPath(); ctx.arc(c.x,c.y,46,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(0,188,212,.25)'; ctx.stroke(); }
    moles.forEach(active=>{
      const a = Math.sin(active.t*10)*0.12+0.9;
      ctx.globalAlpha=a;
      ctx.fillStyle = active.isGold ? 'rgba(255,193,7,.5)' : 'rgba(255,152,0,.5)';
      ctx.strokeStyle = active.isGold ? 'rgba(255,215,0,.9)' : active.isGood ? 'rgba(0,200,83,.6)' : 'rgba(255,82,82,.7)';
      ctx.lineWidth=3; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(active.x, active.y, 42, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(16/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(active.label, active.x, active.y-4);
      ctx.fillStyle= active.isGold ? '#ffd700' : '#ffd27d'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif';
      ctx.fillText(active.isGold ? '+50 算2个' : (active.isGood ? '正常' : '异常?'), active.x, active.y+16);
      ctx.globalAlpha=1;
    });
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){
    if(ended)return; ended=true;
    if(isWin){ recordGameWin('mole'); miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🔨</div><div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'边缘过滤完成！':'被正常数据骗了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">点掉异常 <b style="color:var(--amber)">'+killed+'</b> 个 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.moAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.moDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300);
  }
  window.moAgain=()=>{ overlay.remove(); openMole(cfg,onComplete); };
  window.moDone=()=>{ if(onComplete)onComplete(killed>=20); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}

function openPacman(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('pacman')) {
    showGameTutorial('pacman', '👾 容器吃豆人', [
      '在迷宫吃<b>镜像层</b>，<b>←/→/↑/↓</b> 或 <b>滑动</b> 移动',
      '躲开<b>清理进程</b>幽灵——碰到 -1 命',
      '吃 <b>端口映射</b>能量点后，幽灵变蓝，可以反吃它们 +50',
      '吃光全部镜像层过关，下一关更快'
    ], function(){ openPacman(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('pacman') || 'hub');
  const pairs=(cfg.pairs||[{t:'docker run',h:'启动一个容器'}]).map(function(p){return {t:String(p.t),h:String(p.h)};});
  const hintOf={}; pairs.forEach(function(p){hintOf[p.t]=p.h;});
  const ghostsN=(cfg.ghosts||['清理进程','镜像冲突','端口占用']).map(String);
  const W=840,H=560, COLS=19, ROWS=15, cell=Math.floor(Math.min(W,H)/Math.max(COLS,ROWS));
  // 迷宫 1=墙（简化：更开阔，避免复杂走廊）
  const base=[
    "1111111111111111111","1000000000000000001","1000000000000000001","1000011111111000001",
    "1000000000000000001","1000000000000000001","1000000000000000001","1000000000000000001",
    "1000000000000000001","1000000000000000001","1000011111111000001","1000000000000000001",
    "1000000000000000001","1000000000000000001","1111111111111111111"
  ];
  let map=[], dots=0, level=1, lives=3, score=0, ended=false;
  let px,py,pdir={x:1,y:0}, nextDir={x:1,y:0}, mouth=0;
  let moveTimer=0, ghostTimer=0, gameTime=0;   // 移动节奏计时器（降低速度）+ 已游玩秒数
  let ghosts=[], power=0;
  let particles=[], floats=[];
  let currentCmd='', specials=[], paired=0;
  function build(){
    map=[]; dots=0; specials=[]; currentCmd=''; paired=0;
    base.forEach((row,r)=>{ const arr=[]; for(let c=0;c<row.length;c++){ const ch=row[c]; arr.push(ch); if(ch==='0') dots++; } map.push(arr); });
    // 放 2 对命令×动作配对卡
    var cands=[];
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++) if(map[r]&&map[r][c]==='0') cands.push([c,r]);
    function place(kind,cmd,label){ if(!cands.length)return; const i=Math.floor(Math.random()*cands.length); const a=cands.splice(i,1)[0]; map[a[1]][a[0]]=' '; dots--; specials.push({x:a[0],y:a[1],kind:kind,cmd:cmd,label:label}); }
    pairs.slice(0,2).forEach(function(p){ place('cmd', p.t, p.t); place('act', p.t, p.h); });
    px=1; py=1; pdir={x:1,y:0}; nextDir={x:1,y:0};
    // 只 1 个幽灵，藏在中心，15s 后释放（给玩家熟悉迷宫的时间）
    ghosts=[{x:9,y:7,dir:{x:0,y:0},flee:false,n:ghostsN[0],sleep:15}];
    power=0;
  }
  build();
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">👾 容器吃豆人</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 吃镜像层，躲清理进程</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="pcLives">3</b></span><span>🧩 带命令 <b id="pcCmd" style="color:#7ee8fa">—</b></span><span>🎯 <b id="pcScore">0</b></span><span>🏆 第 <b id="pcLevel">1</b> 关</span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#04060c;touch-action:none"><canvas id="pcCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">←/→/↑/↓ 或 滑动 · 吃蓝色命令带着 → 吃对应黄色动作配对</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('pcCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('pcLives'), scoreEl=document.getElementById('pcScore'), levelEl=document.getElementById('pcLevel'), termEl=document.getElementById('pcCmd');
  document.addEventListener('keydown', e=>{
    const k=e.key; e.preventDefault();
    if(k==='ArrowUp'||k==='w')nextDir={x:0,y:-1}; else if(k==='ArrowDown'||k==='s')nextDir={x:0,y:1};
    else if(k==='ArrowLeft'||k==='a')nextDir={x:-1,y:0}; else if(k==='ArrowRight'||k==='d')nextDir={x:1,y:0};
    else if(k==='Escape')closeGame(false);
  });
  let sw=null;
  const swipeDist=22;   // 滑动判定阈值（px）
  cv.addEventListener('pointerdown',e=>{ sw={x:e.clientX,y:e.clientY}; try{ cv.setPointerCapture&&cv.setPointerCapture(e.pointerId); }catch(_){ } });
  cv.addEventListener('pointermove',e=>{ if(!sw)return; const dx=e.clientX-sw.x,dy=e.clientY-sw.y; if(Math.abs(dx)<swipeDist&&Math.abs(dy)<swipeDist)return; if(Math.abs(dx)>Math.abs(dy)) nextDir={x:Math.sign(dx),y:0}; else if(dy!==0) nextDir={x:0,y:Math.sign(dy)}; sw=null; });
  cv.addEventListener('pointerup',e=>{ if(!sw)return; const dx=e.clientX-sw.x,dy=e.clientY-sw.y; if(Math.abs(dx)>swipeDist||Math.abs(dy)>swipeDist){ if(Math.abs(dx)>Math.abs(dy))nextDir={x:Math.sign(dx),y:0}; else nextDir={x:0,y:Math.sign(dy)}; } sw=null; });
  function addParticles(cx,cy,c){ for(let i=0;i<10;i++)particles.push({x:cx,y:cy,vx:(Math.random()-.5)*140,vy:(Math.random()-.5)*140,t:0,color:c}); }
  function update(dt){
    if(ended)return;
    mouth+=dt*6;
    if(power>0)power-=dt;
    gameTime+=dt;   // 已游玩秒数（用于幽灵延迟出场）
    // 幽灵延迟出场：前 15s 待在中心屋，不出动
    ghosts.forEach(function(g){ if(g.sleep>0){ g.sleep-=dt; if(g.sleep<=0){ g.dir={x:0,y:0}; } } });
    // 移动（计时器控制节奏：初始间隔 0.16s，随关卡略快）
    moveTimer-=dt;
    if(moveTimer<=0){
      moveTimer = Math.max(0.10, 0.16 - level*0.008);
      if(!(nextDir.x===-pdir.x&&nextDir.y===-pdir.y)) pdir=nextDir;
      const nx=px+pdir.x, ny=py+pdir.y;
      if(map[ny] && map[ny][nx]!=='1'){ px=nx; py=ny; }
      else { pdir={x:0,y:0}; }
    }
    // 吃镜像层
    if(map[py] && map[py][px]==='0'){ map[py][px]=' '; dots--; score+=5; scoreEl.textContent=score; playSound('success');
      if((px+py)%13===0){ power=6; playSound('levelup'); }   // 能量点（端口映射）
    }
    // 配对卡：命令 / 动作
    var sp = specials.filter(function(x){return x.x===px&&x.y===py;})[0];
    if(sp){
      specials=specials.filter(function(x){return x!==sp;});
      if(sp.kind==='cmd'){ currentCmd=sp.cmd; score+=5; scoreEl.textContent=score; if(termEl)termEl.textContent=sp.label; playSound('click'); floats.push({x:px*cell+cell/2,y:py*cell+cell/2,txt:'带命令：'+sp.label,t:0,col:'#2196f3'}); }
      else {
        if(currentCmd && hintOf[currentCmd]===sp.label){ paired++; score+=25; scoreEl.textContent=score; currentCmd=''; if(termEl)termEl.textContent='—'; playSound('success'); addParticles(px*cell+cell/2,py*cell+cell/2,'#00e676'); floats.push({x:px*cell+cell/2,y:py*cell+cell/2,txt:'✅ '+hintOf[currentCmd===sp.cmd?sp.cmd:currentCmd]+' 配对成功',t:0,col:'#00e676'}); if(paired>=pairs.length){ power=6; playSound('levelup'); } }
        else { score=Math.max(0,score-5); scoreEl.textContent=score; currentCmd=''; if(termEl)termEl.textContent='—'; playSound('error'); floats.push({x:px*cell+cell/2,y:py*cell+cell/2,txt:'❌ 命令不匹配',t:0,col:'#ff5252'}); }
      }
    }
    // 幽灵移动（计时器控制，速度比玩家慢，简化 AI）
    ghostTimer-=dt;
    if(ghostTimer>0){ } else {
    ghosts.forEach(g=>{
      if(g.sleep>0) return;   // 未到出场时间：静止在屋
      if(g.flee && power<=0) g.flee=false;
      if(power>0 && !g.flee){ // 朝远离玩家走
        const opts=[]; [[0,-1],[0,1],[-1,0],[1,0]].forEach(d=>{ const nx2=g.x+d[0],ny2=g.y+d[1]; if(map[ny2]&&map[ny2][nx2]!=='1') opts.push(d); });
        let best=opts[Math.floor(Math.random()*opts.length)]; g.dir=best||g.dir;
      } else {
        const opts=[]; [[0,-1],[0,1],[-1,0],[1,0]].forEach(d=>{ const nx2=g.x+d[0],ny2=g.y+d[1]; if(map[ny2]&&map[ny2][nx2]!=='1') opts.push(d); });
        if(Math.random()<0.12 && opts.length) g.dir=opts[Math.floor(Math.random()*opts.length)];
        else { const dx=px-g.x, dy=py-g.y; const cands=opts.filter(d=>Math.abs(d[0]*dy)>=0 && Math.abs(d[1]*dx)>=0); if(cands.length) g.dir=cands[Math.floor(Math.random()*cands.length)]; }
      }
      const gx=g.x+g.dir[0], gy=g.y+g.dir[1];
      if(map[gy] && map[gy][gx]!=='1'){ g.x=gx; g.y=gy; }
    });
    ghostTimer = Math.max(0.16, 0.26 - level*0.01);
    }
    // 碰撞
    ghosts.forEach(g=>{
      if(g.sleep>0) return;   // 未出场不碰撞
      if(g.x===px&&g.y===py){
        if(power>0 && !g.flee){ score+=50; g.flee=true; playSound('fanfare'); addParticles(px*cell+cell/2,py*cell+cell/2,'#7ee8fa'); }
        else if(!g.flee){ lives--; livesEl.textContent=lives; playSound('error'); addParticles(px*cell+cell/2,py*cell+cell/2,'#ff5252');
          if(lives<=0){ endGame(false); return; } px=1;py=1; pdir={x:1,y:0}; nextDir={x:1,y:0}; }
      }
    });
    // 过关
    if(dots<=0 && specials.length===0){ level++; levelEl.textContent=level; score+=level*50; playSound('fanfare'); build(); }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    const c=cell;
    for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
      const ch=map[r]&&map[r][col];
      if(ch==='1'){ ctx.fillStyle='#0d47a1'; ctx.fillRect(col*c,r*c,c,c); }
      else if(ch==='0'){ ctx.fillStyle='#ffd27d'; ctx.beginPath(); ctx.arc(col*c+c/2,r*c+c/2,4,0,Math.PI*2); ctx.fill(); }
    }
    // 吃豆人
    const cxp=px*c+c/2, cyp=py*c+c/2;
    ctx.fillStyle='#ffb300'; ctx.beginPath(); ctx.arc(cxp,cyp,c/2-2, mouth*0.8, Math.PI*2-mouth*0.8); ctx.lineTo(cxp,cyp); ctx.fill();
    // 幽灵
    ghosts.forEach(g=>{ const gx=g.x*c+c/2, gy=g.y*c+c/2;
      if(g.sleep>0){   // 待机：半透明灰，头顶显示倒计时
        ctx.globalAlpha=0.5;
        ctx.fillStyle='#9aa3bd';
        ctx.beginPath(); ctx.arc(gx,gy-3,c/2-2,Math.PI,0); ctx.lineTo(gx+c/2-2,gy+c/2-2); ctx.lineTo(gx-c/2+2,gy+c/2-2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('⏱ '+Math.ceil(g.sleep), gx, gy-2);
        ctx.globalAlpha=1;
        return;
      }
      ctx.fillStyle = (power>0&&!g.flee) ? '#64b5f6' : g.flee ? '#bdbdbd' : '#ff5252';
      ctx.beginPath(); ctx.arc(gx,gy-3,c/2-2,Math.PI,0); ctx.lineTo(gx+c/2-2,gy+c/2-2); ctx.lineTo(gx-c/2+2,gy+c/2-2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(9/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(g.n.length>2?g.n[0]:g.n, gx, gy-2);
    });
    // 配对卡
    specials.forEach(sp=>{ const sx=sp.x*cell+cell/2, sy=sp.y*cell+cell/2;
      ctx.fillStyle = sp.kind==='cmd' ? '#2196f3' : '#ffb300';
      ctx.shadowColor = sp.kind==='cmd' ? '#2196f3' : '#ffb300'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(sx,sy,9,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(7/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(sp.label.length>3?sp.label.slice(0,3)+'…':sp.label, sx, sy);
    });
    // 能量点状态
    if(power>0){ ctx.fillStyle='#7ee8fa'; ctx.font='bold '+Math.round(14/sf)+'px sans-serif'; ctx.textAlign='left'; ctx.fillText('⚡ 幽灵可反吃 ' + power.toFixed(1)+'s', 10, 24); }
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,4,4); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
    floats.forEach(f=>{ f.t+=dt; ctx.globalAlpha=Math.max(0,1-f.t/1.3); ctx.fillStyle=f.col; ctx.font='bold '+Math.round(11/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.fillText(f.txt, f.x, f.y-f.t*30); });
    ctx.globalAlpha=1; floats=floats.filter(f=>f.t<1.3);
  }
  function endGame(isWin){
    if(ended)return; ended=true;
    if(isWin){ recordGameWin('pacman'); miniMarkClear(cfg.id); playSound('fanfare'); }
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">👾</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">'+(isWin?'镜像全部回收！':'被清理进程回收了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 到第 <b style="color:var(--amber)">'+level+'</b> 关</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.pcAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.pcDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300);
  }
  window.pcAgain=()=>{ overlay.remove(); openPacman(cfg,onComplete); };
  window.pcDone=()=>{ if(onComplete)onComplete(isWin); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}

function openTank(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('tank')) {
    showGameTutorial('tank', '🎯 消息守卫战', [
      '你的<b>坦克</b>守卫车间中央的 <b>MQTT Broker</b>，用 <b>WASD/←→↑↓</b>（手机<b>滑动</b>）移动',
      '<b>自动开炮</b>打掉涌来的垃圾消息（垃圾订阅/断线黑洞/畸形消息）',
      '消息<b>碰到 Broker 基地</b> -1 基地血；碰到坦克 -1 坦克命',
      '清完一波进下一波，越来越快'
    ], function(){ openTank(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('tank') || 'boss');
  const topics=(cfg.topics||['factory/+/temp']).map(String);
  const en=(cfg.enemies||[{topic:'factory/a/temp',name:'温度消息'}]).map(function(e){return {topic:e.topic||'factory/a/temp',name:e.name||e.topic};});
  const W=840,H=560;
  let lives=3, base=3, score=0, wave=1, ended=false;
  let tx=W/2, ty=H-60, dir={x:0,y:-1}, fireCd=0, invuln=0;
  let topicIdx=0, cannonTopic=topics[0];   // 炮口主题：只打匹配主题的消息
  let bullets=[], foes=[], spawnT=0, toSpawn=6, particles=[];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🎯 消息守卫战</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 坦克守 Broker</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>🚗 <b id="tkLives">3</b></span><span>🏰 <b id="tkBase">3</b></span><span>🎯 <b id="tkTopic" style="color:#7ee8fa">${cannonTopic}</b></span><span>🌊 第 <b id="tkWave">1</b> 波</span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#071019;touch-action:none"><canvas id="tkCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">↑/↓ 切炮口主题 · 只打<b>匹配主题</b>的消息 · 守 Broker 别漏</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('tkCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('tkLives'), baseEl=document.getElementById('tkBase'), scoreEl=document.getElementById('tkScore'), waveEl=document.getElementById('tkWave');
  const keys={};
  document.addEventListener('keydown', e=>{ keys[e.key]=true;
    if(e.key==='ArrowUp'||e.key==='w'){ topicIdx=(topicIdx+1)%topics.length; cannonTopic=topics[topicIdx]; var _t=document.getElementById('tkTopic'); if(_t)_t.textContent=cannonTopic; playSound('click'); }
    else if(e.key==='ArrowDown'||e.key==='s'){ topicIdx=(topicIdx+topics.length-1)%topics.length; cannonTopic=topics[topicIdx]; var _t2=document.getElementById('tkTopic'); if(_t2)_t2.textContent=cannonTopic; playSound('click'); }
    else if(e.key==='Escape')closeGame(false); });
  document.addEventListener('keyup', e=>{ keys[e.key]=false; });
  let joystick=null;
  cv.addEventListener('pointerdown',e=>{ joystick={x:e.clientX,y:e.clientY}; });
  cv.addEventListener('pointermove',e=>{ if(!joystick)return; const dx=e.clientX-joystick.x, dy=e.clientY-joystick.y; if(Math.abs(dx)>Math.abs(dy)) dir={x:Math.sign(dx),y:0}; else if(dy!==0) dir={x:0,y:Math.sign(dy)}; joystick.x=e.clientX; joystick.y=e.clientY; });
  cv.addEventListener('pointerup',()=>{ joystick=null; });
  function addParticles(x,y,c){ for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,t:0,color:c}); }
  function spawnFoe(){ const x=40+Math.random()*(W-80); const e=en[Math.floor(Math.random()*en.length)]; foes.push({x,y:-20,vy:40+wave*8,topic:e.topic,label:e.name}); }
  function update(dt){
    if(ended)return;
    if(invuln>0)invuln-=dt;
    // 移动
    let mvx=0,mvy=0;
    if(keys['a']||keys['ArrowLeft'])mvx=-1; if(keys['d']||keys['ArrowRight'])mvx=1;
    if(keys['w']||keys['ArrowUp'])mvy=-1; if(keys['s']||keys['ArrowDown'])mvy=1;
    if(mvx||mvy){ dir={x:mvx,y:mvy}; tx+=mvx*150*dt; ty+=mvy*150*dt; }
    tx=Math.max(20,Math.min(W-20,tx)); ty=Math.max(20,Math.min(H-30,ty));
    // 自动开炮
    fireCd-=dt; if(fireCd<=0){ fireCd=0.32; const bx=tx+dir.x*20, by=ty+dir.y*20; bullets.push({x:bx,y:by,vx:dir.x*340,vy:dir.y*340}); }
    // 生成敌人
    spawnT-=dt; if(spawnT<=0 && toSpawn>0){ spawnFoe(); toSpawn--; spawnT=Math.max(0.4,1.4-wave*0.08); }
    bullets.forEach(b=>{ b.x+=b.vx*dt; b.y+=b.vy*dt; });
    bullets=bullets.filter(b=>b.x>-20&&b.x<W+20&&b.y>-20&&b.y<H+20);
    foes.forEach(f=>{ f.y+=f.vy*dt; });
    foes=foes.filter(f=>f.y<H+20);
    // 子弹命中
    bullets.forEach(b=>{ foes.forEach(f=>{ if(!f.hit&&Math.abs(b.x-f.x)<22&&Math.abs(b.y-f.y)<22){ if(f.topic===cannonTopic){ f.hit=true; b.hit=true; score+=10; scoreEl.textContent=score; addParticles(f.x,f.y,'#ffb000'); playSound('success'); } else { b.hit=true; addParticles(f.x,f.y,'#7ee8fa'); playSound('click'); } } }); });
    bullets=bullets.filter(b=>!b.hit); foes=foes.filter(f=>!f.hit);
    // 敌人到基地
    foes.forEach(f=>{ if(f.y>H-28){ f.hit=true; base--; baseEl.textContent=base; addParticles(f.x,H-28,'#ff5252'); playSound('error'); if(base<=0){endGame(false);return;} } });
    foes=foes.filter(f=>!f.hit);
    // 敌人碰坦克
    foes.forEach(f=>{ if(invuln<=0&&Math.abs(f.x-tx)<26&&Math.abs(f.y-ty)<26){ f.hit=true; lives--; livesEl.textContent=lives; invuln=1.5; addParticles(tx,ty,'#ff5252'); playSound('error'); if(lives<=0){endGame(false);return;} } });
    foes=foes.filter(f=>!f.hit);
    // 清波
    if(toSpawn<=0 && foes.length===0){ wave++; waveEl.textContent=wave; toSpawn=6+wave*2; showToast('🌊 第 '+wave+' 波消息来袭！','success'); playSound('levelup'); }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    // 基地 Broker
    ctx.fillStyle='rgba(0,188,212,.15)'; ctx.fillRect(0,H-30,W,30);
    ctx.fillStyle='#00bcd4'; ctx.shadowColor='#00bcd4'; ctx.shadowBlur=14; ctx.beginPath(); ctx.arc(W/2,H-15,14,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Broker',W/2,H-15);
    // 坦克
    if(invuln<=0||Math.floor(invuln*8)%2===0){ ctx.fillStyle='#00e676'; ctx.fillRect(tx-14,ty-12,28,24); ctx.fillStyle='#b2ff59'; ctx.fillRect(tx+dir.x*16-4,ty+dir.y*16-6,8,12); }
    // 子弹
    ctx.fillStyle='#ffe066'; bullets.forEach(b=>ctx.fillRect(b.x-3,b.y-3,6,6));
    // 敌人（匹配炮口主题的亮红，否则灰）
    foes.forEach(f=>{ const match=f.topic===cannonTopic; ctx.fillStyle=match?'#ff5252':'#546e7a'; ctx.shadowColor=match?'#ff5252':'transparent'; ctx.shadowBlur=8; ctx.fillRect(f.x-18,f.y-10,36,20); ctx.shadowBlur=0; ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(8/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((f.topic||'').length>6?(f.topic||'').slice(0,6):f.topic||'', f.x, f.y); });
    // 粒子
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){ if(ended)return; ended=true; if(isWin){recordGameWin('tank');miniMarkClear(cfg.id);playSound('fanfare');}
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🎯</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">'+(base>0?'Broker 守住了！':'Broker 被攻破了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">守到第 <b style="color:var(--amber)">'+wave+'</b> 波 · 得分 <b style="color:var(--amber)">'+score+'</b></div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.tkAgain()">🔁 再战</button><button class="mm-btn primary" onclick="window.tkDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300); }
  window.tkAgain=()=>{ overlay.remove(); openTank(cfg,onComplete); };
  window.tkDone=()=>{ if(onComplete)onComplete(base>0); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}

function openBreakout(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('breakout')) {
    showGameTutorial('breakout', '🧱 AI 打砖块', [
      '下面的<b>板 = 你的 AI 决策</b>，<b>←/→</b> 或 <b>拖动</b> 移动，接住弹球',
      '球反弹消掉<b>设备故障砖</b>（模型漂移/数据偏差…）',
      '球漏到底 -1 命；消光砖块过关，下一关更快更硬',
      '吃 ⭐ 掉落可加命/加速'
    ], function(){ openBreakout(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('breakout') || 'hub');
  const fault=(cfg.fault||['设备故障','模型漂移']).map(String);
  const normal=(cfg.normal||['正常样本','冗余备份']).map(String);
  const W=840,H=560;
  let lives=3, score=0, level=1, ended=false;
  let px=W/2, pw=90, ball={x:W/2,y:H-60,vx:150,vy:-200}, onPaddle=true;
  let bricks=[], speed=1, particles=[];
  const colors=['#ff5252','#ff7043','#ffb300','#7ee8fa','#ab6cff'];
  const overlay=document.createElement('div');
  overlay.className='mm-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML=`
    <div class="sh-box">
      <div class="mm-head"><div><div class="mm-title">🧱 AI 打砖块</div><div class="mm-sub">${escHtml(cfg.name||'')} —— 板=你的 AI 决策，消掉故障砖</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="sh-stats"><span>❤️ <b id="brLives">3</b></span><span>🎯 <b id="brScore">0</b></span><span>🏆 第 <b id="brLevel">1</b> 关</span></div>
      <div class="canvas-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#04060c;cursor:none;touch-action:none"><canvas id="brCanvas" width="${W}" height="${H}" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;touch-action:none"></canvas></div>
      <div class="sh-tip">←/→ 或 拖动 移动板 · 接球消砖 · 漏球 -1 命</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick=()=>closeGame(false);
  const cv=document.getElementById('brCanvas'), ctx=cv.getContext('2d');
  const cw=cv.clientWidth||W; const sf=Math.max(0.6,cw/W);
  const livesEl=document.getElementById('brLives'), scoreEl=document.getElementById('brScore'), levelEl=document.getElementById('brLevel');
  function build(){
    bricks=[]; const rows=4+Math.min(level,3), cols=8;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const isFault = Math.random() < 0.62;   // 62% 是故障（该打），其余是正常（不该打）
      const label = isFault ? fault[Math.floor(Math.random()*fault.length)] : normal[Math.floor(Math.random()*normal.length)];
      bricks.push({ x: c*104+20, y: r*34+40, w:96, h:26, col: isFault ? colors[(r+level)%colors.length] : '#546e7a', label, fault: isFault, flash:0 });
    }
    ball={x:W/2,y:H-60,vx:(Math.random()<.5?1:-1)*150,vy:-200}; onPaddle=true; px=W/2;
  }
  build();
  function addParticles(x,y,c){ for(let i=0;i<14;i++)particles.push({x,y,vx:(Math.random()-.5)*260,vy:(Math.random()-.5)*260,t:0,color:c}); }
  document.addEventListener('keydown', e=>{ if(e.key==='ArrowLeft'||e.key==='a'){px-=28;} else if(e.key==='ArrowRight'||e.key==='d'){px+=28;} else if(e.key==='Escape')closeGame(false); });
  cv.addEventListener('pointermove', e=>{ const r=cv.getBoundingClientRect(); px=Math.max(pw/2,Math.min(W-pw/2,(e.clientX-r.left)/sf)); });
  cv.addEventListener('pointerdown', e=>{ if(onPaddle){ onPaddle=false; } });
  function update(dt){
    if(ended)return;
    // 板
    px=Math.max(pw/2,Math.min(W-pw/2,px));
    if(onPaddle){ ball.x=px; ball.y=H-58; }
    else {
      ball.x+=ball.vx*speed*dt; ball.y+=ball.vy*speed*dt;
      if(ball.x<8||ball.x>W-8) ball.vx*=-1;
      if(ball.y<8) ball.vy*=-1;
      if(ball.y>H+10){ lives--; livesEl.textContent=lives; playSound('error'); if(lives<=0){endGame(false);return;} onPaddle=true; ball.x=px; ball.y=H-58; }
      // 板碰撞
      if(ball.vy>0 && ball.y>H-70 && ball.y<H-50 && Math.abs(ball.x-px)<pw/2+6){ ball.vy=-Math.abs(ball.vy); ball.vx+=(ball.x-px)*0.6; playSound('type'); }
      // 砖碰撞
      bricks.forEach(b=>{ if(!b.hit && ball.x>b.x-8&&ball.x<b.x+b.w+8&&ball.y>b.y-8&&ball.y<b.y+b.h+8){ ball.vy*=-1;
        if(b.fault){ b.hit=true; score+=10; scoreEl.textContent=score; addParticles(b.x+b.w/2,b.y+b.h/2,b.col); playSound('success'); }
        else { score=Math.max(0,score-5); scoreEl.textContent=score; b.flash=0.3; playSound('error'); }
      } });
      bricks.forEach(b=>{ if(b.flash>0)b.flash-=dt; });
      bricks=bricks.filter(b=>!b.hit);
      // 过关：所有故障砖清完即可（正常砖是干扰，不用打）
      if(!bricks.some(b=>b.fault)){ level++; levelEl.textContent=level; score+=level*50; speed=Math.min(2,1+level*0.15); playSound('fanfare'); build(); }
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    // 砖
    bricks.forEach(b=>{ ctx.fillStyle=b.col; ctx.shadowColor=b.fault?b.col:'transparent'; ctx.shadowBlur=8; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.shadowBlur=0;
      if(b.flash>0){ ctx.globalAlpha=Math.min(1,b.flash/0.3)*0.6; ctx.fillStyle='#fff'; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.globalAlpha=1; }
      ctx.fillStyle='#061018'; ctx.font='bold '+Math.round(10/sf)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.label.length>4?b.label.slice(0,4):b.label, b.x+b.w/2, b.y+b.h/2); });
    // 板（AI 决策）
    ctx.fillStyle='#7ee8fa'; ctx.shadowColor='#7ee8fa'; ctx.shadowBlur=12; ctx.fillRect(px-pw/2, H-44, pw, 10); ctx.shadowBlur=0;
    // 球
    ctx.fillStyle='#fff'; ctx.shadowColor='#fff'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(ball.x,ball.y,7,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    // 粒子
    particles.forEach(p=>{ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; ctx.globalAlpha=Math.max(0,1-p.t/0.5); ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,5,5); });
    ctx.globalAlpha=1; particles=particles.filter(p=>p.t<0.5);
  }
  function endGame(isWin){ if(ended)return; ended=true; if(isWin){recordGameWin('breakout');miniMarkClear(cfg.id);playSound('fanfare');}
    setTimeout(()=>{ const res=document.createElement('div'); res.className='ty-result';
      focusResultPrimary(overlay);
      res.innerHTML='<div style="font-size:46px;line-height:1">🧱</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:8px">'+(isWin?'故障全消！':'AI 决策失误，球漏了')+'</div><div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 到第 <b style="color:var(--amber)">'+level+'</b> 关</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.brAgain()">🔁 再来</button><button class="mm-btn primary" onclick="window.brDone()">收下奖励</button></div>';
      overlay.innerHTML=''; overlay.appendChild(res); },300); }
  window.brAgain=()=>{ overlay.remove(); openBreakout(cfg,onComplete); };
  window.brDone=()=>{ if(onComplete)onComplete(score>=50); overlay.remove(); playAreaMusic(); };
  function closeGame(manual){ if(ended)return; ended=true; cancelAnimationFrame(raf); overlay.remove(); if(manual){if(onComplete)onComplete(false);playAreaMusic();} }
  let last=performance.now(), dt=0;
  function loop(now){ dt=Math.min(0.05,(now-last)/1000); last=now; update(dt); draw(); raf=requestAnimationFrame(loop); }
  let raf; raf=requestAnimationFrame(loop);
}

// =========================================================================
// 9x. SORTER — 数据分类大师（传送带分拣）
// 传送带送物品，点下方正确的分类筐归位；点错或溜到尽头掉命，速度越来越快
// =========================================================================
function openSorter(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('sorter')) {
    showGameTutorial('sorter', '📦 数据分类大师', [
      '数据<b>从上方落下</b>，在它滑到<b>判定线</b>前，点下方<b>正确的分类筐</b>接住它',
      '点错筐，或让它滑过判定线漏掉，都会 <b>-1 命</b>',
      '越接近判定线接住，<b>PERFECT</b> 加分越多；连续接对连击加分',
      '清完一波过关，越来越快'
    ], function(){ openSorter(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('sorter') || 'match');
  const cats = (cfg.categories || []).map(c => ({ name: String(c.name||''), icon: c.icon||'📦' }));
  const items = (cfg.items || []).filter(it => it && it.label && typeof it.cat === 'number').map(it => ({ label: String(it.label), cat: it.cat }));
  if (!cats.length || !items.length) { showToast('没有可分类的数据', 'error'); return; }
  const WAVES = cfg._endless ? 999 : (cfg.waves || 3);
  const PER = cfg.perWave || 10;
  const LIVES = cfg._hard ? 2 : (cfg.lives || 3);
  const HIT_Y = 232;      // 判定线（与 CSS .so-belt::after 对齐）
  const LEAK_Y = 292;     // 漏接线：滑过即失败

  let lives = LIVES, score = 0, combo = 0, wave = 1, done = 0, processed = 0, totalSorted = 0, ended = false;
  let belt = [], queue = [], spawnT = 0, last = 0, raf = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="so-box">
      <div class="mm-head"><div><div class="mm-title">📦 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="so-stats">
        <span>❤️ <b id="soLives">${LIVES}</b></span>
        <span>🌊 第 <b id="soWave">1</b>/${WAVES} 波</span>
        <span>📦 <b id="soDone">0</b>/${PER}</span>
        <span>🎯 <b id="soScore">0</b></span>
        <span>🔥 <b id="soCombo" style="color:#ff7a00"></b></span>
      </div>
      <div class="so-belt" id="soBelt"><div class="so-judge" id="soJudge"></div></div>
      <div class="so-bins" id="soBins"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const beltEl = document.getElementById('soBelt');
  const judgeEl = document.getElementById('soJudge');
  const livesEl = document.getElementById('soLives');
  const scoreEl = document.getElementById('soScore');
  const comboEl = document.getElementById('soCombo');
  const waveEl = document.getElementById('soWave');
  const doneEl = document.getElementById('soDone');
  const binsEl = document.getElementById('soBins');

  // 分类筐
  cats.forEach((c, ci) => {
    const b = document.createElement('button');
    b.className = 'so-bin';
    b.innerHTML = '<span class="so-bin-icon">' + (c.icon||'') + '</span><span class="so-bin-name">' + escHtml(c.name) + '</span>';
    b.onclick = () => sortTo(ci, b);
    binsEl.appendChild(b);
  });

  function judge(txt, col){          // 节奏判定飘字
    judgeEl.textContent = txt;
    judgeEl.style.color = col || '#ffd700';
    judgeEl.classList.add('on');
    clearTimeout(judge._t);
    judge._t = setTimeout(() => judgeEl.classList.remove('on'), 500);
  }
  function pickItem(ci) {
    const pool = items.filter(it => it.cat === ci);
    return (pool[Math.floor(Math.random()*pool.length)] || {label:'?'}).label;
  }
  function newWave() {
    done = 0; processed = 0; doneEl.textContent = '0';
    waveEl.textContent = wave;
    queue = [];
    cats.forEach((c, ci) => { queue.push({ label: pickItem(ci), cat: ci }); });
    while (queue.length < PER) {
      const it = items[Math.floor(Math.random()*items.length)];
      queue.push({ label: it.label, cat: it.cat });
    }
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [queue[i],queue[j]]=[queue[j],queue[i]]; }
  }
  function itemSpeed() { return (34 + wave*7) * (cfg._hard ? 1.2 : 1); }   // px/s（纵向更慢，节奏从容）
  function spawnGap() { return Math.max(420, 1500 - wave*170); }             // ms
  function removeFromBelt(it) { const i = belt.indexOf(it); if (i >= 0) belt.splice(i,1); }

  function refreshUrgent() {
    let best = null;
    belt.forEach(it => { if (it.y < LEAK_Y && (!best || it.y > best.y)) best = it; });
    belt.forEach(it => { it.el.classList.toggle('so-urgent', it === best); });
  }
  function spawnItem() {
    if (ended || !queue.length) return;
    const q = queue.shift();
    const el = document.createElement('div');
    el.className = 'so-item';
    el.textContent = q.label;
    el.title = q.label;
    el.style.top = '-44px';
    beltEl.appendChild(el);
    belt.push({ el: el, label: q.label, cat: q.cat, y: -44, speed: itemSpeed() });
    refreshUrgent();
  }
  function flyTo(it, btn) {
    const r = btn.getBoundingClientRect(), be = beltEl.getBoundingClientRect();
    it.el.style.transition = 'all .28s ease';
    it.el.style.left = (r.left - be.left + r.width/2) + 'px';
    it.el.style.top = (r.top - be.top + r.height/2) + 'px';
    it.el.style.opacity = '0';
    setTimeout(() => { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 300);
  }
  function sortTo(ci, btn) {
    if (ended) return;
    let best = null;
    belt.forEach(it => { if (it.y < LEAK_Y && (!best || it.y > best.y)) best = it; });
    if (!best) { playSound('click'); return; }
    if (best.cat === ci) {
      const dist = Math.abs(best.y - HIT_Y);
      const rating = dist <= 14 ? 'PERFECT' : dist <= 34 ? 'GOOD' : 'OK';
      const mult = rating === 'PERFECT' ? 3 : rating === 'GOOD' ? 2 : 1;
      combo++; totalSorted++; processed++;
      score += 10 * mult * (1 + Math.floor(combo/5));
      scoreEl.textContent = score;
      comboEl.textContent = combo >= 2 ? 'x'+combo : '';
      done++; doneEl.textContent = Math.min(done, PER);
      playSound('success');
      removeFromBelt(best); flyTo(best, btn);
      judge(rating, rating === 'PERFECT' ? '#ffd700' : rating === 'GOOD' ? '#7ee8fa' : '#9aa3bd');
      // —— 分类成功：粒子 + 得分飘字 ——
      try{
        const bb=btn.getBoundingClientRect(), ob=beltEl.getBoundingClientRect();
        const bx=bb.left+bb.width/2-ob.left, by=bb.top-ob.top;
        for(let k=0;k<10;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*90-45))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#00e676','#ffd700','#7ee8fa','#b388ff'][k%4];
          beltEl.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
        const fl=document.createElement('div');
        fl.className='so-float';
        fl.textContent = '+'+ (10 * mult * (1 + Math.floor(combo/5)));
        fl.style.cssText='left:'+bx+'px;top:'+(by-16)+'px';
        beltEl.appendChild(fl);
        setTimeout(()=>{ try{fl.remove();}catch(e){} }, 800);
      }catch(e2){}
      refreshUrgent();
      if (processed >= PER) onWaveClear();
    } else {
      combo = 0; if (comboEl) comboEl.textContent='';
      processed++; lives--; livesEl.textContent = lives;   // 点错也算处理过（扣命）
      best.el.classList.add('so-wrong');
      playSound('error');
      beltEl.classList.remove('so-hit'); void beltEl.offsetWidth; beltEl.classList.add('so-hit');
      judge('MISS', '#ff5252');
      removeFromBelt(best);
      setTimeout(() => { if (best.el.parentNode) best.el.parentNode.removeChild(best.el); }, 240);
      refreshUrgent();
      if (lives <= 0) endGame(false);
    }
  }
  function onWaveClear() {
    if (ended) return;
    belt.forEach(it => { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); });
    belt = [];
    if (wave >= WAVES && !cfg._endless) { endGame(true); return; }
    wave++; newWave();
    spawnT = 600;
    showToast('🌊 第 '+wave+' 波！更快了', 'success');
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (isWin) { recordGameWin('sorter'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs = getGameStats(); _gs.sorterBest = Math.max(_gs.sorterBest||0, score); _gs.sorterCombo = Math.max(_gs.sorterCombo||0, combo); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'全部归位，产线顺畅！':'分拣超载，流水线停了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">分类 <b style="color:var(--amber)">'+totalSorted+'</b> 个 · 得分 <b style="color:var(--amber)">'+score+'</b> · 到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.soAgain()">🔁 再玩一次</button><button class="mm-btn primary" onclick="window.soDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.soAgain = () => { overlay.remove(); openSorter(cfg, onComplete); };
  window.soDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(!ended ? false : (wave > WAVES && !cfg._endless ? true : false)); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last)/1000); last = now;
    if (!ended) {
      spawnT -= dt*1000;
      if (spawnT <= 0 && queue.length) { spawnItem(); spawnT = spawnGap(); }
      for (let i = belt.length - 1; i >= 0; i--) {
        const it = belt[i];
        it.y += it.speed * dt;
        it.el.style.top = it.y + 'px';
        if (it.y >= LEAK_Y) {   // 滑过判定线没接住：漏了
          combo = 0; if (comboEl) comboEl.textContent='';
          processed++; lives--; livesEl.textContent = lives;
          it.el.classList.add('so-leak');
          judge('MISS 漏接', '#ff5252');
          playSound('error');
          removeFromBelt(it);
          setTimeout(() => { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 260);
          if (lives <= 0) { endGame(false); return; }
        }
      }
      if (!ended && processed >= PER) onWaveClear();
      refreshUrgent();
    }
    raf = requestAnimationFrame(loop);
  }
  newWave();
  spawnT = 400;
  raf = requestAnimationFrame(loop);
}

// =========================================================================
// 9y. FORGE — 数据熔炉（合成大西瓜·数据单位）
// 落下数据单元，同类相撞合成更大的；合成出目标单位即过关，堆满溢出失败
// =========================================================================
function openForge(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('forge')) {
    showGameTutorial('forge', '🔥 数据熔炉', [
      '从顶部<b>落下一个数据单元</b>（bit→Byte→KB→MB→GB…），同类相撞就<b>合成更大的</b>',
      '目标：合成出 <b>'+escHtml(cfg.target||'TB')+'</b> 即过关；堆到顶部溢出就失败',
      '<b>连续合成</b>有连击加分，合出越高档分数越多'
    ], function(){ openForge(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('forge') || 'match');
  const units = (cfg.units || ['bit','Byte','KB','MB','GB','TB','PB']).map((u,i)=>({ name: String(u), lv: i }));
  const TARGET_LV = units.length - 1;
  const DROPS = cfg.drops || 22;
  const W = 500, H = 620;
  const G = 1300, DAMP = 0.999, REST = 0.3;
  const colors = ['#8e9bb5','#7ee8fa','#4dd0e1','#66bb6a','#ffb300','#ff7043','#ec407a'];

  let score = 0, combo = 0, drops = 0, ended = false, win = false;
  let balls = [], raf = 0, last = 0, hoverX = W/2, holding = true;
  let dropLv = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="fg-box">
      <div class="mm-head"><div><div class="mm-title">🔥 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="fg-stats">
        <span>🎯 目标 <b id="fgTarget">${escHtml(cfg.target||units[TARGET_LV].name)}</b></span>
        <span>⏳ 投放 <b id="fgDrops">0</b>/${DROPS}</span>
        <span>🎯 <b id="fgScore">0</b></span>
        <span>🔥 <b id="fgCombo" style="color:#ff7a00"></b></span>
        <span>⬇️ 下一个 <b id="fgNext" class="fg-next">…</b></span>
      </div>
      <canvas id="fgCanvas" width="${W}" height="${H}"></canvas>
      <div class="fg-tip">点击/点按顶部位置投放数据单元 · 同类相撞合成更大</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('fgCanvas'), ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('fgScore'), comboEl = document.getElementById('fgCombo');
  const dropsEl = document.getElementById('fgDrops'), nextEl = document.getElementById('fgNext'), targetEl = document.getElementById('fgTarget');

  function radius(lv) { return 16 + lv*9; }
  function color(lv) { return colors[lv % colors.length]; }
  function pickLv() {
    // 低档位为主、中档可出，保证目标(MB)可达；高档稀有
    const r = Math.random();
    if (r < 0.35) return 0;   // bit
    if (r < 0.6) return 1;    // Byte
    if (r < 0.8) return 2;    // KB
    if (r < 0.92) return 3;   // MB
    return 4;                 // GB
  }
  function spawnDrop() {
    dropLv = pickLv();
    nextEl.textContent = units[dropLv].name;
  }
  function addBall(lv, x, y, vx, vy) {
    balls.push({ lv: lv, x: x, y: y, r: radius(lv), vx: vx||0, vy: vy||0, born: performance.now() });
  }
  function doDrop() {
    if (ended || !holding) return;
    holding = false;
    drops++; dropsEl.textContent = drops;
    addBall(dropLv, hoverX, 26, (Math.random()-0.5)*40, 30);
    spawnDrop();
    holding = true;   // 准备投放下一个（否则只能投 1 个球）
    if (drops >= DROPS) { // 投放用完还没合出目标 → 失败
      endGame(false);
    }
  }
  function merge(a, b) {
    const lv = a.lv;
    const nx = (a.x+b.x)/2, ny = Math.min(a.y,b.y) - 10;
    balls = balls.filter(x => x !== a && x !== b);   // 安全移除（避免 splice 索引错位）
    if (lv+1 > TARGET_LV) { // 已到最高档，再合 → 直接清掉+分
      score += (lv+1)*30; combo++; updateUI(); playSound('success'); popAt(nx,ny,'🔥 '+units[lv].name+'!'); return;
    }
    const nl = lv + 1;
    addBall(nl, nx, ny, 0, -60);
    combo++; score += (nl+1)*15 * (1 + Math.floor(combo/5));
    updateUI(); playSound('success');
    popAt(nx, ny, units[nl].name);
    if (nl === TARGET_LV) { win = true; setTimeout(()=>endGame(true), 500); }
  }
  const pops = [];
  function popAt(x,y,txt){ pops.push({x:x,y:y,txt:txt,t:0}); }
  function drawPops(dt) {
    pops.forEach(p => { p.t += dt; ctx.globalAlpha = Math.max(0,1-p.t/0.8); ctx.fillStyle='#ffd27d'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText(p.txt, p.x, p.y - p.t*36); });
    ctx.globalAlpha = 1;
    for (let i = pops.length-1; i>=0; i--) if (pops[i].t >= 0.8) pops.splice(i,1);
  }
  function updateUI() { scoreEl.textContent = score; comboEl.textContent = combo>=2?'x'+combo:''; }

  // 物理更新
  function step(dt) {
    balls.forEach(b => {
      b.vy += G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // 墙
      if (b.x - b.r < 4) { b.x = b.r + 4; b.vx = -b.vx * REST; }
      if (b.x + b.r > W-4) { b.x = W - b.r - 4; b.vx = -b.vx * REST; }
      // 底
      if (b.y + b.r > H-4) { b.y = H - b.r - 4; if (b.vy > 0) b.vy = -b.vy * REST; }
      // 顶（溢出判定）：刚投下的球给 0.8s 缓冲落进堆里，避免一生成就误判溢出
      if (b.y - b.r < 20 && performance.now() - b.born > 800) { endGame(false); return; }
      b.vx *= DAMP; b.vy *= DAMP;
      if (Math.abs(b.vx) < 0.6) b.vx = 0;
      if (Math.abs(b.vy) < 0.6 && b.y + b.r >= H-5) b.vy = 0;
    });
    // 两两碰撞 + 合并（同等级接触即合成；用重启循环避免索引错位）
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < balls.length; i++) {
        for (let j = i+1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x-a.x, dy = b.y-a.y;
          const d2 = dx*dx + dy*dy; const min = a.r + b.r;
          if (d2 < min*min && d2 > 0.0001) {
            if (a.lv === b.lv) { merge(a,b); merged = true; break; }
            const d = Math.sqrt(d2), nx = dx/d, ny = dy/d, overlap = min - d;
            a.x -= nx*overlap/2; a.y -= ny*overlap/2;
            b.x += nx*overlap/2; b.y += ny*overlap/2;
          }
        }
        if (merged) break;
      }
    }
    if (ended) return;
    raf = requestAnimationFrame(frame);
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    // 顶线（溢出线）
    ctx.strokeStyle = 'rgba(255,85,85,.35)'; ctx.setLineDash([6,6]); ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,20); ctx.lineTo(W,20); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,85,85,.5)'; ctx.font='11px sans-serif'; ctx.fillText('溢出线', 8, 14);
    // 当前待投放
    if (holding && !ended) {
      const lv = dropLv;
      ctx.beginPath(); ctx.arc(hoverX, 26, radius(lv), 0, Math.PI*2);
      ctx.fillStyle = color(lv); ctx.globalAlpha=.55; ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.fillText(units[lv].name, hoverX, 30);
    }
    // 球
    balls.forEach(b => {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fillStyle = color(b.lv); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#0a0d14'; ctx.font='bold '+Math.max(10, 13-b.lv)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(units[b.lv].name, b.x, b.y);
    });
    drawPops(0.016);
  }
  function frame(now) {
    const dt = Math.min(0.033, (now-last)/1000); last = now;
    if (!ended) { step(dt); if (!ended) draw(); }
  }
  // 指针控制
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    hoverX = Math.max(radius(dropLv)+2, Math.min(W - radius(dropLv)-2, (e.clientX - r.left) * (W/r.width)));
  });
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect();
    hoverX = Math.max(radius(dropLv)+2, Math.min(W - radius(dropLv)-2, (e.clientX - r.left) * (W/r.width)));
    doDrop();
  });

  function endGame(isWin) {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    win = isWin;
    if (win) { recordGameWin('forge'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs = getGameStats(); _gs.forgeBest = Math.max(_gs.forgeBest||0, score); _gs.forgeCombo = Math.max(_gs.forgeCombo||0, combo); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(win?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(win?'var(--green)':'var(--red)')+';margin-top:8px">'+(win?'合成出 '+escHtml(cfg.target||units[TARGET_LV].name)+'！':'熔炉溢出了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 最高连击 <b style="color:var(--amber)">'+combo+'</b></div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.fgAgain()">🔁 再来一炉</button><button class="mm-btn primary" onclick="window.fgDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.fgAgain = () => { overlay.remove(); openForge(cfg, onComplete); };
  window.fgDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(win); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  spawnDrop();
  raf = requestAnimationFrame(frame);
}

// =========================================================================
// 9z. LIANLIAN — 连连看·对对碰（术语-解释配对，≤2拐弯路径消除）
// =========================================================================
function openLianLian(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('ll')) {
    showGameTutorial('ll', '🔗 连连看·对对碰', [
      '点一个<b>术语</b>，再点它的<b>解释</b>——若两者能用<b>不超过 2 个拐弯</b>的空路径连通，就消除',
      '路径只能走空白格；<b>全部消除</b>即过关',
      '卡住了点「重新洗牌」'
    ], function(){ openLianLian(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('ll') || 'match');
  const pairs = (cfg.pairs || []).slice(0, cfg.size || (cfg.pairs||[]).length);
  if (!pairs.length) { showToast('没有可配对的术语', 'error'); return; }
  const N = 2 * pairs.length;
  let cols = Math.ceil(Math.sqrt(N));
  while (cols > 2 && N % cols !== 0) cols--;
  const rows = N / cols;
  const TIME = cfg.timeLimit || 150;
  const R = rows + 2, C = cols + 2;
  let cells = Array.from({length: R}, () => Array(C).fill(null));
  let score = 0, cleared = 0, timeLeft = TIME, ended = false;
  let sel = null, timer = 0, resultWin = false;

  // 生成并打乱
  const tiles = [];
  pairs.forEach((p, i) => { tiles.push({ pair: i, text: p.term, kind:'t' }); tiles.push({ pair: i, text: p.hint, kind:'d' }); });
  for (let i = tiles.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [tiles[i],tiles[j]]=[tiles[j],tiles[i]]; }
  let k = 0;
  for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) cells[r][c] = tiles[k++];

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="ll-box">
      <div class="mm-head"><div><div class="mm-title">🔗 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="ll-stats">
        <span>⏱ <b id="llTime">${TIME}</b>s</span>
        <span>✅ <b id="llDone">0</b>/${pairs.length}</span>
        <span>🎯 <b id="llScore">0</b></span>
        <button class="ll-btn" id="llShuffle">🔀 洗牌</button>
      </div>
      <div class="ll-grid" id="llGrid"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('llGrid'), timeEl = document.getElementById('llTime');
  const doneEl = document.getElementById('llDone'), scoreEl = document.getElementById('llScore');
  gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', 74px)';
  gridEl.style.gridTemplateRows = 'repeat(' + rows + ', 54px)';
  document.getElementById('llShuffle').onclick = shuffleRemaining;
  // 保证初始盘面至少有一对可消除（否则重排）
  for (let t=0;t<30;t++) { if (findAnyPair()) break; shuffleRemaining(); }

  function passable(r, c) { return r < 0 || r >= R || c < 0 || c >= C || cells[r][c] === null; }
  // 连通判定：允许走外圈空环，最多 2 个拐弯（经典连连看规则）
  function canConnect(a, b) {
    if (a.pair !== b.pair) return false;
    if (a.r===b.r && a.c===b.c) return false;
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    const stack = [], seen = {};
    for (let d=0;d<4;d++){ const key=a.r+','+a.c+','+d+',0'; if(!seen[key]){ seen[key]=1; stack.push({r:a.r,c:a.c,d:d,t:0}); } }
    while (stack.length) {
      const cur = stack.pop();
      const dr=dirs[cur.d][0], dc=dirs[cur.d][1];
      let nr=cur.r+dr, nc=cur.c+dc;
      while (true) {
        if (nr===b.r && nc===b.c) return true;
        if (nr < -1 || nr > R || nc < -1 || nc > C) break;           // 外圈只到 1 格，再远无意义
        const inB = nr>=0 && nr<R && nc>=0 && nc<C;
        if (inB && cells[nr][nc]!==null) break;                       // 被其它牌挡住
        if (cur.t < 2) {
          for (let nd=0;nd<4;nd++){
            if (nd===cur.d) continue;
            const key=nr+','+nc+','+nd+','+(cur.t+1);
            if(!seen[key]){ seen[key]=1; stack.push({r:nr,c:nc,d:nd,t:cur.t+1}); }
          }
        }
        nr+=dr; nc+=dc;
      }
    }
    return false;
  }
  // 找一对当前可消除的牌（用于保证盘面始终有解）
  function findAnyPair() {
    const pos=[];
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) if (cells[r][c]) pos.push({r:r,c:c,pair:cells[r][c].pair});
    for (let i=0;i<pos.length;i++) for (let j=i+1;j<pos.length;j++) {
      if (pos[i].pair===pos[j].pair && canConnect(pos[i],pos[j])) return [pos[i],pos[j]];
    }
    return null;
  }
  function ensureSolvable() {   // 若无解则洗牌，最多尝试 30 次
    for (let t=0;t<30 && !findAnyPair();t++) shuffleRemaining();
  }
  function render() {
    gridEl.innerHTML = '';
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) {
      const cell = cells[r][c];
      if (!cell) { gridEl.appendChild(document.createElement('div')); continue; }
      const div = document.createElement('div');
      div.className = 'll-tile' + (sel && sel.pair===cell.pair && sel.r===r && sel.c===c ? ' sel' : '');
      div.dataset.r = r; div.dataset.c = c;
      div.textContent = cell.text;
      div.title = cell.text;   // 悬停查看完整文字
      const _len = cell.text.length;   // 长文字自适应字号
      div.style.fontSize = (_len > 12 ? 10 : _len > 7 ? 11 : _len > 5 ? 12 : 13) + 'px';
      div.onclick = () => pick(r, c, div);
      gridEl.appendChild(div);
    }
  }
  function pick(r, c, div) {
    if (ended) return;
    const cell = cells[r][c];
    if (!cell) return;
    if (!sel) { sel = {r:r,c:c,pair:cell.pair}; render(); playSound('click'); return; }
    if (sel.r===r && sel.c===c) { sel=null; render(); return; }
    if (sel.pair === cell.pair) {
      if (canConnect(sel, {r:r,c:c})) {
        cleared++; doneEl.textContent = cleared;
        score += 50 + Math.max(0, timeLeft) ;
        scoreEl.textContent = score;
        // —— 消除特效：连线闪光 + 粒子 + 加分飘字 ——
        try {
          const gb = gridEl.getBoundingClientRect();
          const t1 = gridEl.children[(sel.r-1)*cols+(sel.c-1)], t2 = gridEl.children[(r-1)*cols+(c-1)];
          const b1 = t1.getBoundingClientRect(), b2 = t2.getBoundingClientRect();
          const x1 = b1.left+b1.width/2-gb.left, y1 = b1.top+b1.height/2-gb.top;
          const x2 = b2.left+b2.width/2-gb.left, y2 = b2.top+b2.height/2-gb.top;
          // 连线
          const line = document.createElement('div');
          line.className = 'll-line';
          const lx=(x1+x2)/2, ly=(y1+y2)/2, len=Math.hypot(x2-x1,y2-y1), ang=Math.atan2(y2-y1,x2-x1);
          line.style.cssText = 'left:'+lx+'px;top:'+ly+'px;width:'+len+'px;transform:rotate('+ang+'rad)';
          gridEl.appendChild(line);
          setTimeout(()=>{ try{line.remove();}catch(e){} }, 500);
          // 粒子（两端各 8 个）
          [[x1,y1],[x2,y2]].forEach(function(pt){
            for(let k=0;k<8;k++){
              const p2=document.createElement('span');
              p2.className='mm-burst';
              p2.style.cssText='left:'+pt[0]+'px;top:'+pt[1]+'px;--mx:'+((Math.random()*100-50))+'px;--my:'+((Math.random()*-90-10))+'px;background:'+['#00e676','#ffd700','#7ee8fa','#b388ff'][k%4];
              gridEl.appendChild(p2);
              setTimeout(()=>{ try{p2.remove();}catch(e){} }, 550);
            }
          });
          // 加分飘字
          const fl=document.createElement('div');
          fl.className='ll-float';
          fl.textContent = '+'+(50 + Math.max(0, timeLeft));
          fl.style.cssText='left:'+((x1+x2)/2)+'px;top:'+((y1+y2)/2-20)+'px';
          gridEl.appendChild(fl);
          setTimeout(()=>{ try{fl.remove();}catch(e){} }, 800);
        } catch(e){}
        cells[sel.r][sel.c] = null; cells[r][c] = null;
        sel = null; playSound('success');
        render();
        if (cleared >= pairs.length) { endGame(true); return; }
        if (!findAnyPair()) { shuffleRemaining(); showToast('🔀 无路可走，已自动洗牌', 'info'); }
      } else {
        sel = null; render(); playSound('error'); shakeScreen();
        if (!findAnyPair()) { shuffleRemaining(); showToast('🔀 无路可走，已自动洗牌', 'info'); }
      }
    } else {
      sel = null; render(); playSound('click');
    }
  }
  function shuffleRemaining() {
    const rest = [];
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) if (cells[r][c]) { rest.push(cells[r][c]); cells[r][c]=null; }
    for (let i=rest.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [rest[i],rest[j]]=[rest[j],rest[i]]; }
    let k=0;
    for (let r=1;r<=rows;r++) for (let c=1;c<=cols;c++) if (!cells[r][c] && k<rest.length) cells[r][c] = rest[k++];
    render(); playSound('click');
  }
  function tick() {
    if (ended) return;
    timeLeft -= 1; timeEl.textContent = Math.max(0, timeLeft);
    if (timeLeft <= 0) { endGame(false); return; }
  }
  timer = setInterval(tick, 1000);

  function endGame(isWin) {
    if (ended) return;
    ended = true; clearInterval(timer);
    resultWin = isWin;
    if (isWin) { recordGameWin('ll'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.llBest=Math.max(_gs.llBest||0, score); _gs.llWins=(_gs.llWins||0)+ (isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'⏰')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'全部配对消除！':'时间到')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 配对 '+cleared+'/'+pairs.length+' 对</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.llAgain()">🔁 再来一局</button><button class="mm-btn primary" onclick="window.llDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.llAgain = () => { overlay.remove(); openLianLian(cfg, onComplete); };
  window.llDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(timer);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  render();
}

// =========================================================================
// 9w. PIPE — 管道工·数据通路（旋转管道接通数据流，L7 MQTT）
// =========================================================================
function openPipe(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('pipe')) {
    showGameTutorial('pipe', '🔧 管道工·数据通路', [
      '每根管道都要<b>接通邻居</b>：开口朝邻居，邻居也得朝它开口',
      '<b>点击管道旋转</b>，让整张图每条管道都严丝合缝、没有断头',
      '全部接通即过关——数据就能从发布端流到 Broker 再到订阅端'
    ], function(){ openPipe(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('pipe') || 'match');
  const COLS = cfg.cols || 4, ROWS = cfg.rows || 4;
  // 开口表：u/r/d/l 各边是否有开口
  function opens(shape, rot) {
    if (shape === 0) return rot === 0 ? {l:1,r:1,u:0,d:0} : {l:0,r:0,u:1,d:1};   // 直管
    return [{u:1,r:1,d:0,l:0},{u:0,r:1,d:1,l:0},{u:0,r:0,d:1,l:1},{u:1,r:0,d:0,l:1}][rot]; // 弯管
  }
  // 贪心生成一致解
  const shapes = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  const target = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const needL = c>0 && opens(shapes[r][c-1], target[r][c-1]).r === 1;
    const needU = r>0 && opens(shapes[r-1][c], target[r-1][c]).d === 1;
    // 需求 L、U 都有或都没有 → 弯管；只有一个 → 直管（保证内部开口一致）
    if (needL === needU) { shapes[r][c] = 1; target[r][c] = needL ? 3 : 1; }
    else { shapes[r][c] = 0; target[r][c] = needL ? 0 : 1; }
  }
  // 初始错位
  const cur = Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) cur[r][c] = Math.floor(Math.random() * (shapes[r][c]===0?2:4));
  let moves = 0, ended = false;

  function checkConsistent() {
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const o = opens(shapes[r][c], cur[r][c]);
      // 边界开口视为端点（数据从边缘进出），只校验内部邻居
      if (o.u && r>0 && !opens(shapes[r-1][c],cur[r-1][c]).d) return false;
      if (!o.u && r>0 && opens(shapes[r-1][c],cur[r-1][c]).d) return false;
      if (o.d && r<ROWS-1 && !opens(shapes[r+1][c],cur[r+1][c]).u) return false;
      if (!o.d && r<ROWS-1 && opens(shapes[r+1][c],cur[r+1][c]).u) return false;
      if (o.l && c>0 && !opens(shapes[r][c-1],cur[r][c-1]).r) return false;
      if (!o.l && c>0 && opens(shapes[r][c-1],cur[r][c-1]).r) return false;
      if (o.r && c<COLS-1 && !opens(shapes[r][c+1],cur[r][c+1]).l) return false;
      if (!o.r && c<COLS-1 && opens(shapes[r][c+1],cur[r][c+1]).l) return false;
    }
    return true;
  }
  function svgOf(shape, rot) {
    const o = opens(shape, rot); let p = '';
    if (o.l) p += '<line x1="2" y1="30" x2="30" y2="30"/>';
    if (o.r) p += '<line x1="30" y1="30" x2="58" y2="30"/>';
    if (o.u) p += '<line x1="30" y1="2" x2="30" y2="30"/>';
    if (o.d) p += '<line x1="30" y1="30" x2="30" y2="58"/>';
    p += '<circle cx="30" cy="30" r="9"/>';
    return '<svg viewBox="0 0 60 60" fill="#7ee8fa">' + p + '</svg>';
  }
  function render() {
    const grid = document.getElementById('pipeGrid');
    grid.innerHTML = '';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d = document.createElement('div');
      d.className = 'pipe-tile';
      d.innerHTML = svgOf(shapes[r][c], cur[r][c]);
      d.onclick = () => {
        if (ended) return;
        moves++;
        const maxRot = shapes[r][c]===0?2:4;
        cur[r][c] = (cur[r][c]+1)%maxRot;
        d.innerHTML = svgOf(shapes[r][c], cur[r][c]);
        playSound('click');
        if (checkConsistent()) { endGame(true); return; }
        // 标记明显断头
        const o = opens(shapes[r][c], cur[r][c]);
        const bad = (o.u && (r===0 || !opens(shapes[r-1][c],cur[r-1][c]).d)) || (o.d && (r===ROWS-1 || !opens(shapes[r+1][c],cur[r+1][c]).u));
        d.classList.toggle('wrong', !!bad);
      };
      grid.appendChild(d);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="pipe-box">
      <div class="mm-head"><div><div class="mm-title">🔧 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="pipe-stats">
        <span>👣 旋转 <b id="pipeMoves">0</b> 次</span>
        <span>⏱ <b id="pipeTime">0</b>s</span>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--dim)">发布端 → 🧩 数据通路 → Broker → 仪表盘</div>
      <div class="pipe-grid" id="pipeGrid"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const movesEl = document.getElementById('pipeMoves'), timeEl = document.getElementById('pipeTime');
  const gridEl = document.getElementById('pipeGrid');
  gridEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 60px)';
  gridEl.style.gridTemplateRows = 'repeat(' + ROWS + ', 60px)';
  let elapsed = 0;
  const timer = setInterval(() => { if (!ended) { elapsed++; timeEl.textContent = elapsed; } }, 1000);

  function endGame(isWin) {
    if (ended) return;
    ended = true; clearInterval(timer);
    if (isWin) { recordGameWin('pipe'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.pipeBest=Math.max(_gs.pipeBest||0, 2000 - moves*20 - elapsed*5); _gs.pipeWins=(_gs.pipeWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'⏰')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据通路全部接通！':'还没接完')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">旋转 <b style="color:var(--amber)">'+moves+'</b> 次 · 用时 <b style="color:var(--amber)">'+elapsed+'</b>s</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.piAgain()">🔁 再接一程</button><button class="mm-btn primary" onclick="window.piDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.piAgain = () => { overlay.remove(); openPipe(cfg, onComplete); };
  window.piDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(ended && checkConsistent()); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(timer);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  render();
}

// =========================================================================
// 9v. MATCH3 — 消消乐·三连车间（同类三连消除，L5 分类）
// =========================================================================
function openMatch3(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('m3')) {
    showGameTutorial('m3', '🍬 消消乐·三连车间', [
      '<b>点击两个相邻的同类</b>（或点一个再点相邻），<b>三连</b>就消除',
      '消除后上方会掉下新块，<b>连锁消除</b>分数更高',
      '每波达到目标分即过关；步数用完就失败'
    ], function(){ openMatch3(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('m3') || 'match');
  const cats = (cfg.categories || []).map(c => ({ name: String(c.name||''), emoji: c.emoji||'🍬' }));
  if (cats.length < 3) { showToast('分类种类太少', 'error'); return; }
  const COLS = cfg.cols || 8, ROWS = cfg.rows || 6;
  const COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c07bd6','#ff9f43'];
  const WAVES = cfg.waves || 3;
  let wave = 1, score = 0, moves = 0, ended = false;
  let board = [], sel = null, resolving = false;
  let waveTarget = 0, waveMoves = 0;

  function newWave() {
    const targets = [28, 40, 52];
    const movesLim = [16, 18, 20];
    waveTarget = targets[Math.min(wave-1, targets.length-1)];
    waveMoves = movesLim[Math.min(wave-1, movesLim.length-1)];
    moves = 0;
    waveEl.textContent = wave + '/' + WAVES;
    tgtEl.textContent = waveTarget;
    movesEl.textContent = waveMoves;
    // 生成无初始三连的板
    do { genBoard(); } while (findMatches().length);
    render();
  }
  function genBoard() {
    board = [];
    for (let r=0;r<ROWS;r++) { board[r]=[]; for (let c=0;c<COLS;c++) {
      let col; do { col = Math.floor(Math.random()*cats.length); } while (r>=2 && board[r-1][c]===col && board[r-2][c]===col || c>=2 && board[r][c-1]===col && board[r][c-2]===col);
      board[r][c] = col;
    }}
  }
  function findMatches() {
    const matched = new Set();
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      // 横向
      if (c+2<COLS && board[r][c]===board[r][c+1] && board[r][c]===board[r][c+2]) {
        let e=c; while (e<COLS && board[r][e]===board[r][c]) { matched.add(r*COLS+e); e++; }
      }
      // 纵向
      if (r+2<ROWS && board[r][c]===board[r+1][c] && board[r][c]===board[r+2][c]) {
        let e=r; while (e<ROWS && board[e][c]===board[r][c]) { matched.add(e*COLS+c); e++; }
      }
    }
    return [...matched];
  }
  function removeAndCascade() {
    resolving = true;
    let matched = findMatches();
    let gained = 0, combo = 0;
    if (!matched.length) { resolving = false; return; }
    function stepM() {
      if (!matched.length) {
        // 重力 + 补新
        for (let c=0;c<COLS;c++) {
          let write = ROWS-1;
          for (let r=ROWS-1;r>=0;r--) if (!(matchedSet.has(r*COLS+c))) { board[write--][c] = board[r][c]; }
          for (let r=write;r>=0;r--) board[r][c] = Math.floor(Math.random()*cats.length);
        }
        matchedSet = null;
        render();
        const next = findMatches();
        if (next.length) { matched = next; matchedSet = new Set(next); combo++; setTimeout(stepM, 350); }
        else { resolving = false; if (score>=waveTarget) onWaveClear(); }
        return;
      }
      matchedSet = new Set(matched);
      gained += matched.length;
      combo++;
      score += matched.length * 10 * combo;
      scoreEl.textContent = score;
      comboEl.textContent = combo>=2 ? '连消 x'+combo : '';
      matched.forEach(idx => { board[Math.floor(idx/COLS)][idx%COLS] = -1; });
      matched = [];   // 清空，避免 stepM 无限循环重复加分
      playSound('success');
      setTimeout(stepM, 250);
    }
    let matchedSet = new Set(matched);
    stepM();
  }
  function swap(r1,c1,r2,c2) {
    if (resolving || ended) return;
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
    if (findMatches().length) {
      moves++; movesEl.textContent = Math.max(0, waveMoves - moves);
      playSound('click');
      render();
      removeAndCascade();
      if (moves >= waveMoves && !ended && score < waveTarget) endGame(false);
    } else {
      [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];   // 换回
      playSound('error');
      render();
    }
  }
  function onWaveClear() {
    if (ended) return;
    if (wave >= WAVES) { endGame(true); return; }
    wave++; newWave();
    showToast('🌊 第 '+wave+' 波！目标更高', 'success');
  }
  function render() {
    gridEl.innerHTML = '';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d = document.createElement('div');
      const col = board[r][c];
      d.className = 'm3-tile' + (sel && sel.r===r && sel.c===c ? ' sel' : '');
      if (col >= 0) { d.style.background = COLORS[col]; d.textContent = cats[col].emoji; }
      else { d.style.background = 'transparent'; }
      d.onclick = () => {
        if (resolving || ended) return;
        if (!sel) { sel = {r:r,c:c}; render(); return; }
        if (sel.r===r && sel.c===c) { sel=null; render(); return; }
        const dr=Math.abs(sel.r-r), dc=Math.abs(sel.c-c);
        if (dr+dc === 1) { swap(sel.r, sel.c, r, c); sel=null; }
        else { sel = {r:r,c:c}; render(); }
      };
      gridEl.appendChild(d);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="m3-box">
      <div class="mm-head"><div><div class="mm-title">🍬 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="m3-stats">
        <span>🌊 第 <b id="m3Wave">1</b>/${WAVES} 波</span>
        <span>🎯 目标 <b id="m3Tgt">28</b> 分</span>
        <span>🎯 <b id="m3Score">0</b></span>
        <span>👣 步数 <b id="m3Moves">16</b></span>
        <span>🔥 <b id="m3Combo" style="color:#ff7a00"></b></span>
      </div>
      <div class="m3-grid" id="m3Grid"></div>
      <div class="m3-legend">${cats.map((c,i)=>'<span><i style="background:'+COLORS[i]+'"></i>'+escHtml(c.name)+'</span>').join('')}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('m3Grid');
  const waveEl = document.getElementById('m3Wave'), tgtEl = document.getElementById('m3Tgt');
  const scoreEl = document.getElementById('m3Score'), movesEl = document.getElementById('m3Moves'), comboEl = document.getElementById('m3Combo');
  gridEl.style.gridTemplateColumns = 'repeat(' + COLS + ', 52px)';
  gridEl.style.gridTemplateRows = 'repeat(' + ROWS + ', 52px)';

  function endGame(isWin) {
    if (ended) return;
    ended = true;
    if (isWin) { recordGameWin('m3'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.m3Best=Math.max(_gs.m3Best||0, score); _gs.m3Wins=(_gs.m3Wins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'三连清场，车间转起来了！':'步数用完')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.m3Again()">🔁 再来一局</button><button class="mm-btn primary" onclick="window.m3Done()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.m3Again = () => { overlay.remove(); openMatch3(cfg, onComplete); };
  window.m3Done = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(ended && score>=waveTarget); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  newWave();
}

// =========================================================================
// 9u. TOWER DEFENSE — 车间防线（部署防线拦攻击数据，L1 攻防）
// =========================================================================
// 9u. TOWER DEFENSE — 车间防线（部署防线拦攻击数据，L1 攻防）
// 知识嵌入：每种攻击有弱点，只有"克制它的设备"才能打出高伤害——
// 玩家必须理解"防火墙挡DDoS / IDS抓扫描 / 网关防ARP"才能守住
// =========================================================================
function openTowerDefense(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('td')) {
    showGameTutorial('td', '🛡️ 车间防线 · 对症下药', [
      '<b>攻击都有弱点</b>：DDoS 怕防火墙，端口扫描怕 IDS，ARP 欺骗怕安全网关',
      '点击空地<b>部署设备</b>；只有<b>克制对应攻击</b>的设备才能打出高伤害',
      '用错设备伤害极低——<b>选对设备</b>才能守住！<br>（恶魔会在你耳边嘀咕？别信它）'
    ], function(){ openTowerDefense(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('td') || 'boss');
  const CELL = 40, COLS = 13, ROWS = 13;
  const W = COLS*CELL, H = ROWS*CELL;
  const PATH = [[0,6],[3,6],[3,3],[6,3],[6,9],[9,9],[9,2],[12,2]];
  // 塔：攻击有克星 —— counter 指向它克制的敌人 id
  const TOWERS = [
    { id:'fw',  name:'防火墙',   emoji:'🧱', cost:50, range:110, dmg:14, cd:0.5,  color:'#ffb300', counter:'ddos', sub:'拦 DDoS' },
    { id:'ids', name:'IDS',     emoji:'🕵️', cost:80, range:140, dmg:20, cd:0.8,  color:'#4d96ff', counter:'scan', sub:'抓扫描' },
    { id:'gw',  name:'安全网关', emoji:'🛡️', cost:110,range:150, dmg:26, cd:1.0,  color:'#50e3c2', counter:'arp',  sub:'防欺骗' }
  ];
  // 敌人：weak 是它的弱点（哪个塔克制它）
  const ENEMIES = [
    { id:'ddos', name:'DDoS',      emoji:'🌐', hp:26, speed:1.5, gold:12, color:'#ff6b6b', r:9,  weak:'fw',  weakName:'防火墙' },
    { id:'scan', name:'端口扫描',   emoji:'🔍', hp:50, speed:1.0, gold:20, color:'#ff9f43', r:10, weak:'ids', weakName:'IDS' },
    { id:'arp',  name:'ARP欺骗',   emoji:'🕸️', hp:90, speed:0.7, gold:32, color:'#c07bd6', r:11, weak:'gw',  weakName:'安全网关' }
  ];
  // 教学波次：每波只出同一种敌人，让玩家学会"对症下药"
  const TEACH = [ ['ddos'], ['scan'], ['arp'] ];
  const WAVES = Math.max(cfg.waves || 5, 4);
  let wave = 0, lives = 10, money = 130, ended = false;
  let enemies = [], towers = [], bullets = [];
  let selTower = 0, spawnQ = [], spawnT = 0, waveActive = false, last = 0, raf = 0;
  let effects = [], floaters = [];   // 特效：冲击波/粒子/飘字
  let waveBanner = 0;
  const pathPts = PATH.map(p => [p[0]*CELL+CELL/2, p[1]*CELL+CELL/2]);
  const occupied = {};
  PATH.forEach(p => { occupied[p[0]+','+p[1]] = true; });
  const counterMult = 2.6;   // 克制伤害倍率
  const wrongMult = 0.18;    // 用错设备伤害倍率（几乎无效）

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="td-box">
      <div class="mm-head"><div><div class="mm-title">🛡️ ${escHtml(cfg.name)}</div><div class="mm-sub">对症下药：用克制的设备打对应攻击</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="td-stats">
        <span>🌊 第 <b id="tdWave">0</b>/${WAVES} 波</span>
        <span>❤️ <b id="tdLives">${lives}</b></span>
        <span>💰 <b id="tdMoney">${money}</b></span>
        <span>👾 <b id="tdLeft">0</b></span>
      </div>
      <canvas id="tdCanvas" width="${W}" height="${H}"></canvas>
      <div class="td-toolbar" id="tdToolbar"></div>
      <div class="td-legend" id="tdLegend"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv = document.getElementById('tdCanvas'), ctx = cv.getContext('2d');
  const livesEl=document.getElementById('tdLives'), moneyEl=document.getElementById('tdMoney'), waveEl=document.getElementById('tdWave'), leftEl=document.getElementById('tdLeft');

  // 工具栏：每个设备按钮显示"克制谁"
  const tb = document.getElementById('tdToolbar');
  TOWERS.forEach((t,i) => {
    const b = document.createElement('button');
    b.className = 'td-tower-btn' + (i===0?' active':'');
    b.innerHTML = t.emoji + ' <b>'+t.name+'</b> <span class="td-sub">克 '+t.sub+'</span> <b style="color:var(--amber)">'+t.cost+'</b>';
    b.title = t.name + ' —— 专门克制 ' + ENEMIES.find(e=>e.id===t.counter).name;
    b.onclick = () => { selTower = i; tb.querySelectorAll('.td-tower-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); playSound('click'); };
    tb.appendChild(b);
  });
  // 图例：三种攻击 → 该用什么设备
  const legend = document.getElementById('tdLegend');
  legend.innerHTML = ENEMIES.map(e=>{
    const t=TOWERS.find(x=>x.id===e.weak);
    return '<span class="td-lg" data-weak="'+e.weak+'">'+e.emoji+' '+e.name+' → '+t.emoji+t.name+'</span>';
  }).join('');

  // 点击空地放塔（坐标按画布实际显示尺寸换算）
  cv.addEventListener('click', e => {
    if (ended) return;
    const r = cv.getBoundingClientRect();
    const cx = Math.floor((e.clientX - r.left) * (W/r.width) / CELL);
    const cy = Math.floor((e.clientY - r.top) * (H/r.height) / CELL);
    const key = cx+','+cy;
    if (cx<0||cx>=COLS||cy<0||cy>=ROWS||occupied[key]) { playSound('error'); return; }
    const t = TOWERS[selTower];
    if (money < t.cost) { showToast('钱不够，先杀怪攒钱', 'error'); return; }
    money -= t.cost; moneyEl.textContent = money;
    occupied[key] = true;
    towers.push({ x: cx*CELL+CELL/2, y: cy*CELL+CELL/2, cx, cy, type: selTower, cd: 0, fresh: true });
    setTimeout(function(){ var idx=towers.length-1; if(towers[idx]) towers[idx].fresh=false; }, 700);
    window.__tdSelTower = towers[towers.length-1];
    addEffect(cx*CELL+CELL/2, cy*CELL+CELL/2, 'boom', {color:t.color});
    playSound('click');
  });

  // 教学提示：波前弹出"该用什么"的引导
  function showTeach(w){
    if (w-1 < TEACH.length) {
      const eid = TEACH[w-1][0];
      const e = ENEMIES.find(x=>x.id===eid);
      const t = TOWERS.find(x=>x.id===e.weak);
      const tip = document.createElement('div');
      tip.className = 'td-teach';
      tip.innerHTML = '<div class="td-teach-em">'+e.emoji+'</div><div class="td-teach-txt">第 '+w+' 波：<b>'+e.name+'</b> 来了！<br>它最怕 <b style="color:'+t.color+'">'+t.emoji+t.name+'</b> —— 部署它，打起来才疼！</div>';
      document.body.appendChild(tip);
      setTimeout(()=>{ tip.classList.add('show'); }, 200);
      setTimeout(()=>{ tip.classList.remove('show'); setTimeout(()=>tip.remove(),500); }, 3200);
    }
  }

  function startWave() {
    wave++; waveEl.textContent = wave;
    waveActive = true;
    const n = 3 + wave;
    spawnQ = [];
    // 教学波只出同一种；第4波起混合
    if (wave <= TEACH.length) {
      const eid = TEACH[wave-1][0];
      for (let i=0;i<n;i++) spawnQ.push(eid);
    } else {
      for (let i=0;i<n;i++) spawnQ.push(ENEMIES[Math.floor(Math.random()*ENEMIES.length)].id);
    }
    spawnT = 0.5;
    showTeach(wave);
    waveBanner = 1.2;   // 波次横幅
  }
  function endWave() {
    waveActive = false;
    if (wave >= WAVES) { endGame(true); return; }
    startWave();
  }

  function addEffect(x,y,type,extra){
    effects.push({x,y,type,t:0,extra:extra||{}});
  }
  function addFloat(x,y,txt,color,big){
    floaters.push({x,y,txt,color,t:0,big:!!big});
  }

  function update(dt) {
    if (waveBanner>0) waveBanner-=dt;
    if (ended) return;
    // 生成
    if (waveActive && spawnQ.length) {
      spawnT -= dt;
      if (spawnT <= 0) {
        const eid = spawnQ.shift();
        const en = ENEMIES.find(x=>x.id===eid);
        enemies.push({ x:pathPts[0][0], y:pathPts[0][1], hp:en.hp*(1+wave*0.18), max:en.hp*(1+wave*0.18), speed:en.speed, gold:en.gold, color:en.color, r:en.r, id:eid, weak:en.weak, weakName:en.weakName, emoji:en.emoji, name:en.name, wp:1 });
        spawnT = Math.max(0.35, 1.05 - wave*0.12);
      }
    }
    // 敌人移动
    for (let i=enemies.length-1;i>=0;i--) {
      const e = enemies[i];
      const tx = pathPts[e.wp][0], ty = pathPts[e.wp][1];
      const dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy);
      if (d < 2) { e.wp++; if (e.wp >= pathPts.length) { enemies.splice(i,1); lives--; livesEl.textContent=lives; addEffect(pathPts[pathPts.length-1][0], pathPts[pathPts.length-1][1],'leak'); if (lives<=0) { endGame(false); return; } } }
      else { e.x += dx/d*e.speed*CELL*0.28; e.y += dy/d*e.speed*CELL*0.28; }
    }
    // 塔射击
    towers.forEach(t => {
      t.cd -= dt;
      if (t.cd > 0) return;
      let best=null, bd=99999;
      enemies.forEach(e => { const d2=(e.x-t.x)**2+(e.y-t.y)**2; if (d2 < TOWERS[t.type].range**2 && d2 < bd) { bd=d2; best=e; } });
      if (best) {
        const tw = TOWERS[t.type];
        const isCounter = tw.counter === best.weak;   // 这个塔克制这个敌人?
        t.cd = tw.cd;
        bullets.push({ x:t.x, y:t.y, tx:best.x, ty:best.y, tgt:best, dmg:tw.dmg*(isCounter?counterMult:wrongMult), color:tw.color, counter:isCounter, weak:best.weak });
        // 塔开火闪光
        addEffect(t.x, t.y, 'muzzle', {color:tw.color, counter:isCounter});
        playSound('click');
      }
    });
    // 子弹
    for (let i=bullets.length-1;i>=0;i--) {
      const b = bullets[i];
      if (!b.tgt || !enemies.includes(b.tgt)) { bullets.splice(i,1); continue; }
      const dx=b.tgt.x-b.x, dy=b.tgt.y-b.y, d=Math.hypot(dx,dy);
      if (d < 6) {
        b.tgt.hp -= b.dmg;
        const killed = b.tgt.hp <= 0;
        bullets.splice(i,1);
        if (b.counter) {
          // 克制命中：金色暴击特效
          addEffect(b.tgt.x, b.tgt.y, 'hit-big', {color:'#ffd700'});
          addFloat(b.tgt.x, b.tgt.y-16, '克制 ×'+counterMult+'！', '#ffd700', true);
          playSound('fanfare');
        } else {
          // 用错设备：微弱火花 + 提示
          addEffect(b.tgt.x, b.tgt.y, 'hit-sm', {color:'#888'});
          addFloat(b.tgt.x, b.tgt.y-14, '无效（非克制）', '#999');
          playSound('click');
        }
        if (killed) {
          const idx=enemies.indexOf(b.tgt); if(idx>=0) enemies.splice(idx,1);
          money += b.tgt.gold; moneyEl.textContent = money;
          addEffect(b.tgt.x, b.tgt.y, 'boom', {color:b.tgt.color});
          addFloat(b.tgt.x, b.tgt.y, '+'+b.tgt.gold+'💰', '#ffd27d');
          playSound('success');
        }
      }
      else { b.x += dx/d*420*dt; b.y += dy/d*420*dt; }
    }
    // 特效更新
    effects.forEach(f=>f.t+=dt); effects=effects.filter(f=>f.t<0.6);
    floaters.forEach(f=>f.t+=dt); floaters=floaters.filter(f=>f.t<1.1);
    leftEl.textContent = enemies.length + spawnQ.length;
    if (waveActive && !spawnQ.length && !enemies.length) endWave();
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    // 背景网格（带深浅）
    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1;
    for (let x=0;x<=W;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for (let y=0;y<=H;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // 可部署格微光
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){ if(!occupied[c+','+r]){ ctx.fillStyle='rgba(255,255,255,.02)'; ctx.fillRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2); } }
    // 通路
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth=CELL*0.8; ctx.strokeStyle='#2a2336'; ctx.beginPath(); ctx.moveTo(pathPts[0][0],pathPts[0][1]); for (let i=1;i<pathPts.length;i++) ctx.lineTo(pathPts[i][0],pathPts[i][1]); ctx.stroke();
    ctx.lineWidth=CELL*0.5; ctx.strokeStyle='#7a5ad0'; ctx.beginPath(); ctx.moveTo(pathPts[0][0],pathPts[0][1]); for (let i=1;i<pathPts.length;i++) ctx.lineTo(pathPts[i][0],pathPts[i][1]); ctx.stroke();
    // 起点/终点
    ctx.save(); ctx.shadowColor='#00e676'; ctx.shadowBlur=12; ctx.font='22px sans-serif'; ctx.fillText('🏭', pathPts[0][0]-8, pathPts[0][1]+7); ctx.restore();
    ctx.save(); ctx.shadowColor='#ff5252'; ctx.shadowBlur=12; ctx.font='22px sans-serif'; ctx.fillText('🚪', pathPts[pathPts.length-1][0]-8, pathPts[pathPts.length-1][1]+7); ctx.restore();
    // 塔
    towers.forEach(t => {
      const tw=TOWERS[t.type], tx=t.x, ty=t.y, R=CELL*0.42;
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(tx-R-2, ty+R-6, R*2+4, 6);
      ctx.fillStyle=tw.color; ctx.shadowColor=tw.color; ctx.shadowBlur=12;
      ctx.fillRect(tx-R, ty-R, R*2, R*2); ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(tx-R+2, ty-R+2, R*2-4, 4);
      ctx.fillStyle='#0a0d14'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(tw.emoji, tx, ty+1);
      // 塔克制目标显示小字
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='9px sans-serif'; ctx.textBaseline='top';
      ctx.fillText(tw.sub, tx, ty+R+2);
      if(t.fresh){ ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(tx,ty,R+6,0,Math.PI*2); ctx.stroke(); }
      if(window.__tdSelTower===t){ ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(tx,ty,tw.range,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    });
    // 敌人
    enemies.forEach(e => {
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y+e.r+3, e.r*0.9, 3, 0, 0, Math.PI*2); ctx.fill();
      const grad=ctx.createRadialGradient(e.x-e.r*0.3,e.y-e.r*0.3,e.r*0.2,e.x,e.y,e.r);
      grad.addColorStop(0,'#fff'); grad.addColorStop(0.35,e.color); grad.addColorStop(1,'rgba(0,0,0,.4)');
      ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=1; ctx.stroke();
      ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(e.emoji, e.x, e.y-1);
      // 弱点标签（头顶：怕哪个设备）
      ctx.save();
      ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.fillText('怕 '+TOWERS.find(x=>x.id===e.weak).emoji+e.weakName, e.x, e.y-e.r-6);
      ctx.restore();
      // 血条
      const bw=e.r*2.4;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(e.x-bw/2, e.y+e.r+3, bw, 4);
      ctx.fillStyle=e.hp/e.max>0.5?'#00e676':'#ff5252'; ctx.fillRect(e.x-bw/2, e.y+e.r+3, bw*Math.max(0,e.hp/e.max), 4);
    });
    // 子弹（光点+拖尾）
    bullets.forEach(b => {
      const ang=Math.atan2(b.ty-b.y,b.tx-b.x);
      ctx.strokeStyle=b.color; ctx.globalAlpha=0.5; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(b.x-Math.cos(ang)*8, b.y-Math.sin(ang)*8); ctx.lineTo(b.x,b.y); ctx.stroke();
      ctx.globalAlpha=1; ctx.shadowColor=b.color; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(b.x,b.y,3.2,0,Math.PI*2); ctx.fillStyle=b.color; ctx.fill(); ctx.shadowBlur=0;
    });
    // 特效
    effects.forEach(f=>{
      const p=f.t/0.6;
      if(f.type==='boom'){ // 爆炸碎片
        for(let i=0;i<8;i++){ const a=i*Math.PI/4; const d=p*26; ctx.fillStyle=f.extra.color; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x+Math.cos(a)*d, f.y+Math.sin(a)*d, 3,0,Math.PI*2); ctx.fill(); }
        ctx.globalAlpha=1;
      } else if(f.type==='hit-big'){ // 克制命中金色冲击环
        ctx.strokeStyle='#ffd700'; ctx.globalAlpha=1-p; ctx.lineWidth=3;
        ctx.beginPath(); ctx.arc(f.x,f.y,8+p*22,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
      } else if(f.type==='hit-sm'){ // 无效微光
        ctx.fillStyle='#888'; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x,f.y,2,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      } else if(f.type==='muzzle'){ // 开火闪光
        ctx.fillStyle=f.extra.color; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x,f.y,5+p*6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
      } else if(f.type==='leak'){ // 漏敌红闪
        ctx.fillStyle='#ff5252'; ctx.globalAlpha=1-p; ctx.beginPath(); ctx.arc(f.x,f.y,8+p*30,0,Math.PI*2); ctx.strokeStyle='#ff5252'; ctx.lineWidth=3; ctx.stroke(); ctx.globalAlpha=1;
      }
    });
    // 飘字
    floaters.forEach(f=>{
      ctx.globalAlpha=Math.max(0,1-f.t/1.1);
      ctx.fillStyle=f.color; ctx.font='bold '+(f.big?16:11)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='#000'; ctx.shadowBlur=4;
      ctx.fillText(f.txt, f.x, f.y-f.t*34); ctx.shadowBlur=0;
      ctx.globalAlpha=1;
    });
    // 波次横幅
    if(waveBanner>0 && wave>0){
      const a=Math.min(1, waveBanner/1.2*2);
      ctx.save(); ctx.globalAlpha=Math.max(0,a);
      ctx.fillStyle='#ffd700'; ctx.font='bold 30px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='#000'; ctx.shadowBlur=10;
      ctx.fillText('第 '+wave+' 波', W/2, H/2-10);
      ctx.fillStyle='#fff'; ctx.font='14px sans-serif';
      ctx.fillText(wave<=TEACH.length?('全 '+ENEMIES.find(x=>x.id===TEACH[wave-1][0]).name+'！'):'混合攻击！', W/2, H/2+18);
      ctx.restore();
    }
  }

  function frame(now) {
    const dt = Math.min(0.033,(now-last)/1000); last = now;
    if (!ended) { update(dt); draw(); raf = requestAnimationFrame(frame); }
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true;
    if (isWin) { recordGameWin('td'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.tdBest=Math.max(_gs.tdBest||0, wave); _gs.tdWins=(_gs.tdWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'车间防线守住！':'防线被攻破')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">守到第 '+Math.min(wave,WAVES)+'/'+WAVES+' 波 · 剩余 💰 '+money+'</div>'+
        '<div style="font-size:13px;color:var(--dim);margin-top:4px">记住：DDoS→防火墙 · 端口扫描→IDS · ARP欺骗→安全网关</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.tdAgain()">🔁 再守一轮</button><button class="mm-btn primary" onclick="window.tdDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.tdAgain = () => { overlay.remove(); openTowerDefense(cfg, onComplete); };
  window.tdDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(ended && wave>=WAVES); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  startWave();
  raf = requestAnimationFrame(frame);
}

function openTile2048(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('t48')) {
    showGameTutorial('t48', '🔢 2048·数据融合', [
      '<b>←/→/↑/↓</b>（手机<b>滑动</b>）让整排数据滑动，<b>相同单位相撞就合成更大的</b>',
      'bit→Byte→KB→MB→GB→TB，<b>合成出目标单位即过关</b>',
      '每次滑动会生成新的小数据，铺满且无相邻相同就失败'
    ], function(){ openTile2048(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('t48') || 'match');
  const units = (cfg.units || ['bit','Byte','KB','MB','GB','TB']).map(String);
  const TARGET = cfg.target || 'TB';
  const TARGET_LV = units.indexOf(TARGET);
  const COLS = cfg.cols || 4, ROWS = cfg.rows || 4;
  let grid = Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  let score = 0, moves = 0, ended = false, resultWin = false;

  function spawn() {
    const empty = [];
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c]<0) empty.push([r,c]);
    if (!empty.length) return;
    const [r,c] = empty[Math.floor(Math.random()*empty.length)];
    grid[r][c] = Math.random() < 0.8 ? 0 : 1;   // 多半是 bit，偶尔 Byte
  }
  function slideLine(line) {   // 返回 {new, moved, gained}
    const arr = line.filter(v => v>=0);
    let gained = 0, changed = false;
    const out = [];
    for (let i=0;i<arr.length;i++) {
      if (i+1 < arr.length && arr[i]===arr[i+1]) {
        out.push(arr[i]+1); gained += (arr[i]+1); i++;
        if (arr[i] >= TARGET_LV) { /* 达标 */ }
      } else out.push(arr[i]);
    }
    while (out.length < line.length) out.push(-1);
    for (let i=0;i<line.length;i++) if (out[i] !== line[i]) changed = true;
    return { out, moved: changed, gained };
  }
  function slide(dir) {
    let moved = false, gained = 0;
    for (let i=0;i<COLS;i++) {
      const line = [];
      for (let j=0;j<ROWS;j++) line.push(dir===0 || dir===1 ? grid[j][i] : grid[i][j]);
      const rev = (dir===1 || dir===3);   // 下/右：从尾部合并
      const src = rev ? line.slice().reverse() : line;
      const res = slideLine(src);
      const out = rev ? res.out.slice().reverse() : res.out;
      for (let j=0;j<ROWS;j++) { if (dir===0 || dir===1) grid[j][i]=out[j]; else grid[i][j]=out[j]; }
      if (res.moved) moved = true;
      gained += res.gained;
    }
    if (moved) { score += gained*10; moves++; spawn(); render(); checkEnd(); }
    return moved;
  }
  function checkEnd() {
    // 达标
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c] >= TARGET_LV) { endGame(true); return; }
    // 无空位且无相邻相同 → 失败
    let empty = false, mergeable = false;
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      if (grid[r][c]<0) { empty=true; continue; }
      if (r+1<ROWS && grid[r][c]===grid[r+1][c]) mergeable=true;
      if (c+1<COLS && grid[r][c]===grid[r][c+1]) mergeable=true;
    }
    if (!empty && !mergeable) endGame(false);
  }
  function render() {
    gridEl.innerHTML='';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d=document.createElement('div');
      d.className='t48-cell' + (grid[r][c]>=0 ? ' t48-'+Math.min(grid[r][c],7) : '');
      d.textContent = grid[r][c]>=0 ? units[Math.min(grid[r][c], units.length-1)] : '';
      gridEl.appendChild(d);
    }
    scoreEl.textContent = score; movesEl.textContent = moves;
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="t48-box">
      <div class="mm-head"><div><div class="mm-title">🔢 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="t48-stats"><span>🎯 目标 <b>${escHtml(TARGET)}</b></span><span>🎯 <b id="t48Score">0</b></span><span>👣 <b id="t48Moves">0</b></span></div>
      <div class="t48-grid" id="t48Grid" style="grid-template-columns:repeat(${COLS},70px);grid-template-rows:repeat(${ROWS},70px)"></div>
      <div class="t48-tip">←/→/↑/↓ 或滑动 · ${units.join(' → ')}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('t48Grid'), scoreEl = document.getElementById('t48Score'), movesEl = document.getElementById('t48Moves');
  // 键盘
  function _k(e){
    if (ended) return;
    if (e.key==='ArrowLeft'){ slide(2); e.preventDefault(); }
    else if (e.key==='ArrowRight'){ slide(3); e.preventDefault(); }
    else if (e.key==='ArrowUp'){ slide(0); e.preventDefault(); }
    else if (e.key==='ArrowDown'){ slide(1); e.preventDefault(); }
    else if (e.key==='Escape') closeGame(false);
  }
  document.addEventListener('keydown', _k);
  // 滑动（pointermove 立即判定，快速滑动也不会丢）
  let st=null;
  gridEl.addEventListener('pointerdown', e=>{ st={x:e.clientX,y:e.clientY}; });
  gridEl.addEventListener('pointermove', e=>{
    if (!st) return; const dx=e.clientX-st.x, dy=e.clientY-st.y;
    if (Math.abs(dx)<20 && Math.abs(dy)<20) return;
    if (Math.abs(dx)>Math.abs(dy)) slide(dx>0?3:2); else slide(dy>0?1:0);
    st=null;
  });
  gridEl.addEventListener('pointerup', e=>{ st=null; });
  gridEl.addEventListener('pointercancel', e=>{ st=null; });

  function endGame(isWin) {
    if (ended) return;
    ended = true;
    resultWin = isWin;
    document.removeEventListener('keydown', _k);
    if (isWin) { recordGameWin('t48'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.t48Best=Math.max(_gs.t48Best||0, score); _gs.t48Wins=(_gs.t48Wins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'合成出 '+escHtml(TARGET)+'！':'格子满了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">得分 <b style="color:var(--amber)">'+score+'</b> · 步数 <b style="color:var(--amber)">'+moves+'</b></div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.t48Again()">🔁 再来一局</button><button class="mm-btn primary" onclick="window.t48Done()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.t48Again = () => { overlay.remove(); openTile2048(cfg, onComplete); };
  window.t48Done = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    document.removeEventListener('keydown', _k);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  spawn(); spawn(); render();
}

// =========================================================================
// 9s. MAZE — 数据迷宫·包到彼岸（迷宫寻路 + 知识门）
// =========================================================================
function openMaze(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('maze')) {
    showGameTutorial('maze', '🌐 数据迷宫·包到彼岸', [
      '你是一个<b>数据包</b>，用 <b>←/→/↑/↓</b>（手机<b>滑动</b>）在车间迷宫里找到 <b>服务器</b>',
      '金色格子是<b>协议门</b>——踩上去要<b>答对题</b>才能开门通过',
      '撞墙或答错 <b>-1 命</b>；找到服务器即过关'
    ], function(){ openMaze(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('maze') || 'match');
  const COLS = cfg.cols || 11, ROWS = cfg.rows || 11;
  const pairs = (cfg.pairs || []).filter(p=>p && p.term && p.hint);
  if (!pairs.length) { showToast('没有知识门题库', 'error'); return; }
  const TIME = cfg.timeLimit || 90;
  let lives = cfg._hard ? 2 : 3, timeLeft = TIME, ended = false, moves = 0, resultWin = false;
  let grid = [], px = 1, py = 1, sx = COLS-2, sy = ROWS-2;
  let gateQ = null, timer = 0;

  function genMaze() {
    // 递归回溯生成「完美迷宫」：路径唯一、无死胡同死局，比随机墙更好玩
    grid = [];
    for (let r=0;r<ROWS;r++){ grid[r]=[]; for (let c=0;c<COLS;c++) grid[r][c]=1; }
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    const stack=[[px,py]]; grid[py][px]=0;
    while (stack.length) {
      const [x,y]=stack[stack.length-1];
      const opts=[];
      dirs.forEach(d=>{
        const nx=x+d[0]*2, ny=y+d[1]*2;
        if (nx<1||ny<1||nx>=COLS-1||ny>=ROWS-1) return;
        if (grid[ny][nx]===1) opts.push(d);
      });
      if (!opts.length){ stack.pop(); continue; }
      const d=opts[Math.floor(Math.random()*opts.length)];
      const nx=x+d[0]*2, ny=y+d[1]*2;
      grid[y+d[1]][x+d[0]]=0; grid[ny][nx]=0;
      stack.push([nx,ny]);
    }
    grid[sy][sx]=0; grid[py][px]=0;
    // 布知识门（挑 6 个非起终点的空地，放在通道上）
    const empties=[];
    for (let r=1;r<ROWS-1;r++) for (let c=1;c<COLS-1;c++) if (grid[r][c]===0 && !(r===py&&c===px) && !(r===sy&&c===sx)) empties.push([r,c]);
    for (let i=empties.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [empties[i],empties[j]]=[empties[j],empties[i]]; }
    empties.slice(0,6).forEach(function(p){ grid[p[1]][p[0]]=2; });
  }
  function move(dx,dy) {
    if (ended || gateQ) return;
    const nx=px+dx, ny=py+dy;
    if (nx<0||ny<0||nx>=COLS||ny>=ROWS) { playSound('error'); return; }
    if (grid[ny][nx]===1) { lives--; livesEl.textContent=lives; shakeScreen(); playSound('error'); if (lives<=0) endGame(false); return; }
    moves++;
    px=nx; py=ny;
    if (grid[py][px]===2) { askGate(py,px); }
    render();
    if (px===sx && py===sy) { endGame(true); }
  }
  function askGate(r,c) {
    gateQ = true;
    const q = pairs[Math.floor(Math.random()*pairs.length)];
    const opts = [q.hint].concat(pairs.filter(p=>p.term!==q.term).map(p=>p.hint).slice(0,3));
    for (let i=opts.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [opts[i],opts[j]]=[opts[j],opts[i]]; }
    const ov=document.createElement('div');
    ov.className='mm-overlay'; ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9700;display:flex;align-items:center;justify-content:center';
    ov.innerHTML='<div class="mm-box" style="width:min(460px,92vw)"><div class="mm-head"><div><div class="mm-title">🚪 协议门</div><div class="mm-sub">答对才能通过这个门</div></div></div><div class="pd-body"><div style="font-size:16px;font-weight:bold;color:var(--amber);margin-bottom:10px">「'+escHtml(q.term)+'」是什么？</div><div style="display:flex;flex-direction:column;gap:8px" id="mzOpts"></div></div></div>';
    document.body.appendChild(ov);
    const box=ov.querySelector('#mzOpts');
    opts.forEach(h => {
      const b=document.createElement('button'); b.className='mm-btn'; b.style.cssText='text-align:left;white-space:normal;height:auto;line-height:1.4;padding:10px 14px';
      b.textContent=h;
      b.onclick=()=>{ ov.remove(); gateQ=false;
        if (h===q.hint) { grid[r][c]=0; playSound('success'); showToast('✅ 门开了！','success'); }
        else { lives--; livesEl.textContent=lives; playSound('error'); if (lives<=0) endGame(false); }
        render();
      };
      box.appendChild(b);
    });
  }
  function render() {
    gridEl.innerHTML='';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d=document.createElement('div');
      d.className='mz-cell' + (grid[r][c]===1?' mz-wall':grid[r][c]===2?' mz-gate':' mz-open');
      if (r===py&&c===px) { d.classList.add('mz-player'); d.textContent='📦'; }
      else if (r===sy&&c===sx) { d.classList.add('mz-srv'); d.textContent='🖥️'; }
      gridEl.appendChild(d);
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mz-box">
      <div class="mm-head"><div><div class="mm-title">🌐 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="mz-stats"><span>❤️ <b id="mzLives">${lives}</b></span><span>👣 <b id="mzMoves">0</b></span><span>⏱ <b id="mzTime">${TIME}</b>s</span><span>🎯 找 🖥️ 服务器</span></div>
      <div class="mz-grid" id="mzGrid" style="--mzc:${COLS};grid-template-columns:repeat(${COLS},1fr)"></div>
      <div class="mz-tip">←/→/↑/↓ 或滑动移动 · 金色=协议门(答题通过) · 撞墙扣命</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('mzGrid'), livesEl = document.getElementById('mzLives');
  const movesEl = document.getElementById('mzMoves'), timeEl = document.getElementById('mzTime');
  function _k(e){
    if (ended) return;
    if (e.key==='ArrowUp'){ move(0,-1); e.preventDefault(); }
    else if (e.key==='ArrowDown'){ move(0,1); e.preventDefault(); }
    else if (e.key==='ArrowLeft'){ move(-1,0); e.preventDefault(); }
    else if (e.key==='ArrowRight'){ move(1,0); e.preventDefault(); }
    else if (e.key==='Escape') closeGame(false);
  }
  document.addEventListener('keydown', _k);
  let sw=null;
  gridEl.addEventListener('pointerdown', e=>{ sw={x:e.clientX,y:e.clientY}; });
  gridEl.addEventListener('pointermove', e=>{
    if (!sw) return; const dx=e.clientX-sw.x, dy=e.clientY-sw.y;
    if (Math.abs(dx)<16&&Math.abs(dy)<16) return;
    if (Math.abs(dx)>Math.abs(dy)) move(dx>0?1:-1,0); else move(0,dy>0?1:-1);
    sw=null;
  });
  gridEl.addEventListener('pointerup', e=>{ sw=null; });
  gridEl.addEventListener('pointercancel', e=>{ sw=null; });
  timer = setInterval(()=>{ if(!ended){ timeLeft--; timeEl.textContent=Math.max(0,timeLeft); if(timeLeft<=0) endGame(false); } },1000);

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    clearInterval(timer); document.removeEventListener('keydown', _k);
    if (isWin) { recordGameWin('maze'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.mazeBest=Math.max(_gs.mazeBest||0, moves); _gs.mazeWins=(_gs.mazeWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据包送达服务器！':'数据包丢了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">步数 <b style="color:var(--amber)">'+moves+'</b> · 剩余 ❤️ '+Math.max(0,lives)+'</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.mzAgain()">🔁 再送一程</button><button class="mm-btn primary" onclick="window.mzDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.mzAgain = () => { overlay.remove(); openMaze(cfg, onComplete); };
  window.mzDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; clearInterval(timer); document.removeEventListener('keydown', _k);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  genMaze(); render();
  render();
}

// =========================================================================
// 9r. HACKNET — 黑客终端·网络溯源（敲命令逐个攻破网络节点）
// =========================================================================
function openHacknet(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('hack')) {
    showGameTutorial('hack', '🕹️ 黑客终端·网络溯源', [
      '屏幕上是一张<b>网络地图</b>，你要逐个<b>攻破节点</b>',
      '在下方<b>终端输入命令</b>（如 ping / ip addr / ssh…），命令对就拿下节点',
      '输错命令会<b>掉命</b>（提示会帮你）；拿下全部节点即过关'
    ], function(){ openHacknet(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('hack') || 'match');
  const nodes = (cfg.nodes || []).filter(n=>n && n.name);
  if (!nodes.length) { showToast('没有攻破目标', 'error'); return; }
  const LIVES = cfg._hard ? 2 : (cfg.lives || 3);
  let lives = LIVES, idx = 0, ended = false, resultWin = false;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="hk-box">
      <div class="mm-head"><div><div class="mm-title">🕹️ ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="hk-stats"><span>❤️ <b id="hkLives">${LIVES}</b></span><span>📡 节点 <b id="hkIdx">0</b>/${nodes.length}</span></div>
      <div class="hk-map" id="hkMap"></div>
      <div class="hk-term" id="hkTerm"></div>
      <div class="hk-input"><input id="hkInput" autocomplete="off" spellcheck="false" placeholder="输入命令…"><button class="ll-btn" id="hkGo">执行</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const mapEl = document.getElementById('hkMap'), termEl = document.getElementById('hkTerm');
  const livesEl = document.getElementById('hkLives'), idxEl = document.getElementById('hkIdx');
  const input = document.getElementById('hkInput');
  function log(html){ termEl.innerHTML += html + '<br>'; termEl.scrollTop = termEl.scrollHeight; }
  function norm(c){ return c.trim().toLowerCase().replace(/\s+/g,' '); }
  function renderMap() {
    mapEl.innerHTML = '';
    nodes.forEach((n,i) => {
      if (i>0) mapEl.insertAdjacentHTML('beforeend', '<span class="hk-link">→</span>');
      const d = document.createElement('div');
      d.className = 'hk-node' + (i<idx ? ' hacked' : i===idx ? ' cur' : '');
      d.innerHTML = '<span class="hk-emo">' + (n.emoji||'🖥️') + '</span>' + escHtml(n.name);
      mapEl.appendChild(d);
    });
  }
  function renderPrompt() {
    const n = nodes[idx];
    log('<span class="prompt">root@nuc:~$</span> 目标 <b>' + escHtml(n.name) + '</b>：' + escHtml(n.prompt || ''));
    log('<span style="color:var(--dim)">提示：' + escHtml(n.hint || '') + '</span>');
    idxEl.textContent = (idx+1);
  }
  function check() {
    const cmd = input.value; input.value = '';
    if (!cmd.trim()) return;
    log('<span class="prompt">root@nuc:~$</span> ' + escHtml(cmd));
    const n = nodes[idx];
    const ok = (n.expect || []).some(e => norm(e) === norm(cmd));
    if (ok) {
      log('<span style="color:#6f6">✅ 节点 ' + escHtml(n.name) + ' 已拿下！</span>');
      playSound('success');
      idx++;
      if (idx >= nodes.length) { endGame(true); return; }
      renderMap(); renderPrompt();
    } else {
      lives--; livesEl.textContent = lives;
      log('<span class="err">❌ 命令不对，攻击被拦截（-1 命）</span>');
      playSound('error'); shakeScreen();
      if (lives <= 0) { endGame(false); return; }
      log('<span style="color:var(--amber)">💡 ' + escHtml(n.tryHint || n.hint || '再想想该敲什么命令') + '</span>');
    }
  }
  input.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); if (!ended) check(); } });
  document.getElementById('hkGo').onclick = () => { if (!ended) check(); };

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    input.disabled = true;
    if (isWin) { recordGameWin('hack'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.hackBest=Math.max(_gs.hackBest||0, idx); _gs.hackWins=(_gs.hackWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'全网络溯源完成！':'被反制了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">拿下 <b style="color:var(--amber)">'+idx+'</b>/'+nodes.length+' 个节点</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.hkAgain()">🔁 再攻一轮</button><button class="mm-btn primary" onclick="window.hkDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.hkAgain = () => { overlay.remove(); openHacknet(cfg, onComplete); };
  window.hkDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  renderMap(); renderPrompt();
  input.focus();
}

// =========================================================================
// 9q. TYCOON — 工厂大亨·数据经营（放置经营，ISA-95 逐级解锁）
// =========================================================================
function openTycoon(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('tyc')) {
    showGameTutorial('tyc', '🏭 工厂大亨·数据经营', [
      '<b>点大按钮</b>产出数据；买机器让它<b>自动产出</b>',
      '机器按 ISA-95 层级解锁：传感器→PLC→SCADA→MES→ERP，越高级产得越快',
      '<b>数据累计到目标值即过关</b>，越高档机器越划算'
    ], function(){ openTycoon(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('tyc') || 'match');
  const TIERS = (cfg.tiers || [
    {name:'传感器', emoji:'🌡️', base:1, cost:10},
    {name:'PLC', emoji:'⚙️', base:6, cost:50},
    {name:'SCADA', emoji:'🖥️', base:35, cost:250},
    {name:'MES', emoji:'🗂️', base:180, cost:1200},
    {name:'ERP', emoji:'🏢', base:900, cost:6000}
  ]).map((t,i)=>({name:t.name, emoji:t.emoji, base:t.base, cost:t.cost}));
  const TARGET = cfg.target || 50000;
  let data = 0, total = 0, click = 1, ended = false, resultWin = false;
  let levels = TIERS.map(()=>0);
  let last = performance.now(), raf = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="tyc-box">
      <div class="mm-head"><div><div class="mm-title">🏭 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="tyc-stats"><span>🎯 目标 <b>${TARGET.toLocaleString()}</b></span><span>⏱ <b id="tycTime">0</b>s</span></div>
      <div class="tyc-main"><button class="tyc-click" id="tycClick">📊</button></div>
      <div class="tyc-data" id="tycData">0 / ${TARGET.toLocaleString()}</div>
      <div class="tyc-rate" id="tycRate">每秒产出 0</div>
      <div class="tyc-shop" id="tycShop"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const dataEl = document.getElementById('tycData'), rateEl = document.getElementById('tycRate'), timeEl = document.getElementById('tycTime');
  const clickBtn = document.getElementById('tycClick'), shopEl = document.getElementById('tycShop');
  let elapsed = 0;

  function renderShop() {
    shopEl.innerHTML = '';
    TIERS.forEach((t,i) => {
      const cost = Math.ceil(t.cost * Math.pow(1.6, levels[i]));
      const item = document.createElement('div');
      item.className = 'tyc-item';
      item.innerHTML = '<div><div class="nm">' + t.emoji + ' ' + escHtml(t.name) + ' <b>x'+levels[i]+'</b></div><div class="ct">每级每秒 +'+t.base+' · 成本 '+cost.toLocaleString()+'</div></div><button data-i="'+i+'" '+(data>=cost?'':'disabled')+'>买入</button>';
      item.querySelector('button').onclick = () => { if (data>=cost){ data-=cost; levels[i]++; playSound('click'); renderShop(); } };
      shopEl.appendChild(item);
    });
  }
  clickBtn.onclick = () => { data += click; total += click; playSound('click'); flashData(); renderShop(); };
  function flashData() {
    dataEl.textContent = Math.floor(data).toLocaleString() + ' / ' + TARGET.toLocaleString();
    if (total >= TARGET) endGame(true);
  }
  function frame(now) {
    const dt = Math.min(0.05,(now-last)/1000); last = now;
    if (!ended) {
      const rate = TIERS.reduce((a,t,i)=>a + t.base*levels[i], 0);
      data += rate*dt; total += rate*dt;
      rateEl.textContent = '每秒产出 ' + Math.round(rate);
      dataEl.textContent = Math.floor(data).toLocaleString() + ' / ' + TARGET.toLocaleString();
      renderShop();
      if (total >= TARGET) endGame(true);
      raf = requestAnimationFrame(frame);
    }
  }
  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    cancelAnimationFrame(raf);
    if (isWin) { recordGameWin('tyc'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.tycBest=Math.max(_gs.tycBest||0, Math.round(total)); _gs.tycWins=(_gs.tycWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据产值达标，工厂转起来了！':'还没达标')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">总数据 <b style="color:var(--amber)">'+Math.round(total).toLocaleString()+'</b> · 用时 <b style="color:var(--amber)">'+Math.round(elapsed)+'</b>s</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.tycAgain()">🔁 再经营一轮</button><button class="mm-btn primary" onclick="window.tycDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.tycAgain = () => { overlay.remove(); openTycoon(cfg, onComplete); };
  window.tycDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  renderShop();
  raf = requestAnimationFrame(frame);
}

// =========================================================================
// 9p. LASER — 激光反射·数据路由（放镜子把数据光束反射到目标）
// =========================================================================
function openLaser(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('lzr')) {
    showGameTutorial('lzr', '🔦 激光反射·数据路由', [
      '<b>点击空格放镜子</b>（再点切 /、\ ），把数据光束从 💡 反射到 📡',
      '点镜子可循环：空 → / → \ → 空',
      '光束到达目标即过关'
    ], function(){ openLaser(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('lzr') || 'match');
  const COLS = cfg.cols || 7, ROWS = cfg.rows || 7;
  const src = { x:0, y:Math.floor(ROWS/2) }, dst = { x:COLS-1, y:0 };
  let mirrors = {}, moves = 0, ended = false, resultWin = false;

  function reflect(dir, m) {
    if (m==='/') { if (dir[0]===1) return [0,-1]; if (dir[0]===-1) return [0,1]; if (dir[1]===-1) return [1,0]; return [-1,0]; }
    else { if (dir[0]===1) return [0,1]; if (dir[0]===-1) return [0,-1]; if (dir[1]===-1) return [-1,0]; return [1,0]; }
  }
  function trace() {
    let x=src.x, y=src.y, dir=[1,0]; const seen=new Set(); const path=[[x,y]];
    while (true) {
      x+=dir[0]; y+=dir[1];
      if (x<0||y<0||x>=COLS||y>=ROWS) break;
      if (x===dst.x && y===dst.y) { path.push([x,y]); return {win:true, path}; }
      const k=x+','+y;
      if (seen.has(k)) break;
      seen.add(k); path.push([x,y]);
      if (mirrors[k]) dir = reflect(dir, mirrors[k]);
    }
    return {win:false, path};
  }
  function render() {
    const tr = trace();
    gridEl.innerHTML='';
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const d=document.createElement('div');
      d.className='lzr-cell'; const k=c+','+r;
      if (mirrors[k]) { d.classList.add('mir'); d.textContent=mirrors[k]; }
      if (tr.path.some(p=>p[0]===c&&p[1]===r)) d.classList.add('beam');
      if (c===src.x&&r===src.y){ d.textContent='💡'; }
      if (c===dst.x&&r===dst.y){ d.textContent='📡'; }
      d.onclick=()=>cycleMirror(k);
      gridEl.appendChild(d);
    }
    movesEl.textContent = moves;
    return tr.win;
  }
  function cycleMirror(k) {
    if (ended) return;
    moves++;
    const cur=mirrors[k];
    if (!cur) mirrors[k]='/';
    else if (cur==='/') mirrors[k]='\\';
    else delete mirrors[k];
    playSound('click');
    const win = render();
    if (win) endGame(true);
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="lzr-box">
      <div class="mm-head"><div><div class="mm-title">🔦 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="lzr-stats"><span>👣 镜子 <b id="lzrMoves">0</b></span><span>🎯 让 💡 → 📡 连通</span></div>
      <div class="lzr-grid" id="lzrGrid" style="grid-template-columns:repeat(${COLS},42px)"></div>
      <div class="lzr-tip">点空格放 / 或 \ 镜子，把数据光束反射到 📡</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const gridEl = document.getElementById('lzrGrid'), movesEl = document.getElementById('lzrMoves');

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    if (isWin) { recordGameWin('lzr'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.lzrBest=Math.max(_gs.lzrBest||0, moves); _gs.lzrWins=(_gs.lzrWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'数据光束连通目标！':'还没连通')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">用了 <b style="color:var(--amber)">'+moves+'</b> 面镜子</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.lzrAgain()">🔁 再布一局</button><button class="mm-btn primary" onclick="window.lzrDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.lzrAgain = () => { overlay.remove(); openLaser(cfg, onComplete); };
  window.lzrDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true;
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  render();
}

// =========================================================================
// 9o. BOSS SLING — 愤怒的厂长·弹射排障（弹弓射出命令弹砸故障塔）
// =========================================================================
function openBoss(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('boss')) {
    showGameTutorial('boss', '🎯 愤怒的厂长·弹射排障', [
      '对面的<b>故障塔</b>里藏着一块<b>红色故障</b>，把它砸掉就过关',
      '在弹弓上<b>按住向后拖</b>再松手发射命令弹（ping/ss/curl 重量不同）',
      '只有 <b>N 发</b>，砸中故障块即赢'
    ], function(){ openBoss(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('boss') || 'boss');
  const W=600,H=360, GR=430;
  const BALLS=[{name:'ping',emoji:'⚪',mass:1,color:'#9fa8da'},{name:'ss',emoji:'🔵',mass:0.75,color:'#4d96ff'},{name:'curl',emoji:'🟠',mass:1.4,color:'#ff9f43'}];
  const SHOTS = cfg.shots || 5;
  let selBall=0, used=0, ended=false, resultWin=false;
  let blocks=[], proj=null, drag=null, raf=0, last=0;
  const SX=55, SY=H-60;

  function build(){
    blocks=[]; const bx=W-130;
    for(let i=0;i<4;i++) blocks.push({x:bx, y:H-28-(i+1)*34, w:82, h:32, fault:(i===1)});
  }
  function launch(px,py){
    if(proj||ended) return;
    used++; shotsEl.textContent=Math.max(0,SHOTS-used);
    const dx=SX-px, dy=SY-py, p=Math.min(540, Math.hypot(dx,dy)*2.6), ang=Math.atan2(dy,dx);
    const b=BALLS[selBall];
    proj={x:SX,y:SY, vx:Math.cos(ang)*p/b.mass, vy:Math.sin(ang)*p/b.mass, color:b.color, emoji:b.emoji};
    playSound('click');
  }
  function update(dt){
    if(proj){
      proj.vy+=GR*dt; proj.x+=proj.vx*dt; proj.y+=proj.vy*dt;
      if(proj.y>H-12||proj.x<0||proj.x>W){ proj=null; nextShot(); return; }
      for(let i=blocks.length-1;i>=0;i--){
        const b=blocks[i];
        if(proj.x>b.x&&proj.x<b.x+b.w&&proj.y>b.y&&proj.y<b.y+b.h){
          const wasFault=b.fault; blocks.splice(i,1); playSound('success');
          if(wasFault){ endGame(true); return; }
          proj=null; nextShot(); return;
        }
      }
    }
  }
  function nextShot(){ if(!ended && used>=SHOTS && !proj) endGame(false); }
  function draw(){
    ctx.clearRect(0,0,W,H);
    // 地面
    ctx.fillStyle='#11141c'; ctx.fillRect(0,H-8,W,8);
    // 弹弓
    ctx.strokeStyle='#8a5a2b'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(SX-14,H); ctx.lineTo(SX-8,SY); ctx.moveTo(SX+14,H); ctx.lineTo(SX+8,SY); ctx.stroke();
    // 瞄准线（拖拽时）
    if(drag){
      const r=cv.getBoundingClientRect();
      const px=(drag.x-r.left)*(W/r.width), py=(drag.y-r.top)*(H/r.height);
      ctx.strokeStyle='rgba(255,176,0,.4)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(SX,SY); ctx.lineTo(px,py); ctx.stroke(); ctx.setLineDash([]);
    }
    // 块
    blocks.forEach(b=>{
      ctx.fillStyle = b.fault ? '#ff5252' : '#3a4458';
      ctx.strokeStyle='#0a0d14'; ctx.lineWidth=2;
      ctx.fillRect(b.x,b.y,b.w,b.h); ctx.strokeRect(b.x,b.y,b.w,b.h);
      if(b.fault){ ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('故障', b.x+b.w/2, b.y+b.h/2); }
    });
    // 待发弹
    if(!proj && !ended){
      const b=BALLS[selBall];
      ctx.beginPath(); ctx.arc(SX,SY,12,0,Math.PI*2); ctx.fillStyle=b.color; ctx.fill(); ctx.fillStyle='#0a0d14'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b.emoji,SX,SY);
    }
    // 飞行弹
    if(proj){ ctx.beginPath(); ctx.arc(proj.x,proj.y,10,0,Math.PI*2); ctx.fillStyle=proj.color; ctx.fill(); ctx.fillStyle='#0a0d14'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(proj.emoji,proj.x,proj.y); }
  }
  function frame(now){
    const dt=Math.min(0.033,(now-last)/1000); last=now;
    if(!ended){ update(dt); draw(); raf=requestAnimationFrame(frame); }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="bz-box">
      <div class="mm-head"><div><div class="mm-title">🎯 ${escHtml(cfg.name)}</div><div class="mm-sub">${escHtml(cfg.subtitle||'')}</div></div><div class="mm-close" title="关闭">✕</div></div>
      <div class="bz-stats"><span>🎯 打掉 <b>红色故障块</b></span><span>🎯 剩余 <b id="bzShots">${SHOTS}</b> 发</span></div>
      <canvas id="bzCanvas" width="${W}" height="${H}"></canvas>
      <div class="bz-balls">${BALLS.map((b,i)=>'<button class="bz-ball-btn'+(i===0?' active':'')+'" data-i="'+i+'">'+b.emoji+' '+b.name+'</button>').join('')}</div>
      <div class="bz-tip">按住向后拖再松手发射 · ping轻/ss快/curl重</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.mm-close').onclick = () => closeGame(false);
  const cv=document.getElementById('bzCanvas'), ctx=cv.getContext('2d');
  const shotsEl=document.getElementById('bzShots');
  overlay.querySelectorAll('.bz-ball-btn').forEach(btn=>{
    btn.onclick=()=>{ selBall=+btn.dataset.i; overlay.querySelectorAll('.bz-ball-btn').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); };
  });
  cv.addEventListener('pointerdown', e=>{ if(!ended&&!proj){ drag={x:e.clientX,y:e.clientY}; } });
  cv.addEventListener('pointermove', e=>{ if(drag){ drag.x=e.clientX; drag.y=e.clientY; } });
  cv.addEventListener('pointerup', e=>{ if(drag){ drag=null; const r=cv.getBoundingClientRect(); launch((e.clientX-r.left)*(W/r.width),(e.clientY-r.top)*(H/r.height)); } });

  function endGame(isWin) {
    if (ended) return;
    ended = true; resultWin = isWin;
    if (isWin) { recordGameWin('boss'); miniMarkClear(cfg.id); playSound('fanfare'); }
    try { const _gs=getGameStats(); _gs.bossBest=Math.max(_gs.bossBest||0, used); _gs.bossWins=(_gs.bossWins||0)+(isWin?1:0); saveGameStats(_gs); } catch(e){}
    setTimeout(() => {
      const res = document.createElement('div');
      res.className = 'ty-result';
      res.innerHTML = '<div style="font-size:46px;line-height:1">'+(isWin?'🎉':'💥')+'</div>'+
        '<div style="font-size:20px;font-weight:bold;color:'+(isWin?'var(--green)':'var(--red)')+';margin-top:8px">'+(isWin?'故障块砸掉了！':'命令弹打光了')+'</div>'+
        '<div style="font-size:15px;color:var(--dim);margin-top:6px">用了 <b style="color:var(--amber)">'+used+'</b> 发</div>'+
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" onclick="window.bzAgain()">🔁 再砸一轮</button><button class="mm-btn primary" onclick="window.bzDone()">收下奖励</button></div>';
      focusResultPrimary(overlay);
      overlay.innerHTML=''; overlay.appendChild(res);
    }, 300);
  }
  window.bzAgain = () => { overlay.remove(); openBoss(cfg, onComplete); };
  window.bzDone = () => { overlay.remove(); playAreaMusic(); if (onComplete) onComplete(resultWin); };
  function closeGame(manual) {
    if (ended) return;
    ended = true; cancelAnimationFrame(raf);
    overlay.remove();
    if (manual) { if (onComplete) onComplete(false); playAreaMusic(); }
  }
  build();
  raf = requestAnimationFrame(frame);
}

function openMemoryMatch(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('memory')) {
    showGameTutorial('memory', '🧠 翻牌配对', [
      '翻开两张牌，把<b>术语</b>和它的<b>解释</b>配成一对',
      '配对成功就消除，全部配完过关；<b>连对</b>有连击加成',
      '牌堆里可能藏着<b>特殊卡</b>：⏱ 时间、💎 幸运、🛡 护身',
      '多关玩法：过一关，卡片更多（4→6→8 张）'
    ], function(){ openMemoryMatch(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('memory'));
  // 堆叠式（cfg.levels 存在时）
  if (cfg.levels) { openStackedMatch(cfg, onComplete); return; }
  // 多关递进（cfg.rounds = 每关卡片对数，如 [2,3,4] → 4/6/8 张）：
  // 中途自动进下一关、不弹结算；失败或全部通关后统一出整场总结算
  if (cfg.rounds && cfg.rounds.length) {
    let sizes = cfg.rounds.slice();
    if (cfg._hard) sizes = sizes.map(function(r){ return Math.min(r + 1, 6); });   // 二周目：每关加一档
    const base = Object.assign({}, cfg);
    delete base.rounds;
    let ri = 0;
    const run = { rounds: [], totalMoves: 0, totalMatches: 0, failed: false, failRound: 0 };
    function showRunSummary(allWin) {
      playAreaMusic();
      const totalPairsAll = sizes.reduce(function(a, b){ return a + b; }, 0);
      function roundCards(i){ return sizes[i] * 2 + (sizes[i] >= 3 ? 2 : 0); }   // ≥3对时含1组事件卡
      const totalCards = sizes.reduce(function(a, b, i){ return a + roundCards(i); }, 0);
      const ov = document.createElement('div');
      ov.className = 'mm-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
      const rowsHtml = run.rounds.map(function(r){
        return '<div style="font-size:14px;color:var(--dim);margin-top:5px">第 ' + r.index + ' 关（' + (r.size * 2 + (r.size >= 3 ? 2 : 0)) + ' 张）：' + (r.win ? '✅ 用 ' + r.moves + ' 步 · ' + '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '❌ 失败') + '</div>';
      }).join('');
      const headHtml = allWin
        ? '<div class="big">🎉</div><div style="font-size:22px;font-weight:bold;color:var(--green);margin-top:6px">全部 ' + sizes.length + ' 关通关！</div>'
        : '<div class="big">💥</div><div style="font-size:22px;font-weight:bold;color:var(--red);margin-top:6px">第 ' + run.failRound + '/' + sizes.length + ' 关失败</div>';
      const statHtml = allWin
        ? '<div style="font-size:15px;color:var(--dim);margin-top:8px">总步数 <b style="color:var(--amber)">' + run.totalMoves + '</b> · 配对 <b style="color:var(--amber)">' + run.totalMatches + '/' + totalPairsAll + '</b> 对</div>'
        : '<div style="font-size:15px;color:var(--dim);margin-top:8px">已通过 ' + (run.failRound - 1) + ' 关 · 配对 ' + run.totalMatches + ' 对</div>';
      const btns = allWin
        ? '<button class="mm-btn" data-act="again">🔁 再来一次</button><button class="mm-btn primary" data-act="done">收下奖励</button>'
        : '<button class="mm-btn primary" data-act="retry">🔁 再来一次</button><button class="mm-btn" data-act="skip">跳过，先干正事</button>';
      ov.innerHTML = '<div class="mm-box" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🧠 ' + escHtml(base.name) + '</div><div class="mm-sub">连续 ' + sizes.length + ' 关 · 共 ' + totalCards + ' 张卡</div></div></div><div class="pd-body" style="text-align:center">' + headHtml + statHtml + rowsHtml + '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">' + btns + '</div></div></div>';
      document.body.appendChild(ov);
      if (allWin) { recordGameWin('mm'); miniMarkClear(base.id); }
      const bind = function(act, fn){ const el = ov.querySelector('[data-act="' + act + '"]'); if (el) el.onclick = fn; };
      bind('done', () => { playAreaMusic(); ov.remove(); if (onComplete) onComplete(true); });
      bind('again', () => { ov.remove(); openMemoryMatch(cfg, onComplete); });
      bind('retry', () => { ov.remove(); openMemoryMatch(cfg, onComplete); });
      bind('skip', () => { playAreaMusic(); ov.remove(); if (onComplete) onComplete(false); });
      focusResultPrimary(ov);
    }
    (function go() {
      if (ri >= sizes.length) {
        if (cfg._endless) { sizes.push(sizes[sizes.length - 1] + 1); run.rounds = []; run.totalMoves = 0; run.totalMatches = 0; }   // 无限战：继续加牌，重新累计
        else { showRunSummary(true); return; }
      }
      const sub = Object.assign({}, base, {
        size: sizes[ri],
        name: base.name + (sizes.length > 1 ? ' · 第 ' + (ri + 1) + '/' + sizes.length + ' 关 · ' + (sizes[ri] * 2 + (sizes[ri] >= 3 ? 2 : 0)) + ' 张' : ''),
        _silent: true,   // 中途不弹结算，过关自动进下一关
        events: sizes[ri] >= 3   // 只有 4 张的小关不塞事件卡，保持干净；6/8 张的大关保留事件卡彩蛋
      });
      if (cfg._endless) { sub.timed = true; sub.timeLimit = Math.max(18, 55 - ri * 3); }   // 无限战：逐关缩时
      openMemoryMatch(sub, function(win, stats){
        const st = stats || { moves: 0, matched: 0, stars: 0 };
        run.rounds.push({ index: ri + 1, size: sizes[ri], win: !!win, moves: st.moves, matched: st.matched, stars: st.stars });
        run.totalMoves += st.moves; run.totalMatches += st.matched;
        if (win) { ri++; go(); }
        else { run.failed = true; run.failRound = ri + 1; showRunSummary(false); }
      });
    })();
    return;
  }
  if (cfg._hard && !cfg.timed) { cfg.timed = true; cfg.timeLimit = cfg.timeLimit || 90; }   // 单关二周目：加限时
  const pairs = cfg.pairs.slice(0, cfg.size);
  let streak = 0;
  let bestStreak = 0;
  const cards = [];
  pairs.forEach((p, i) => {
    cards.push({ pairId: i, kind: 'term', text: p.term, emoji: p.emoji });
    cards.push({ pairId: i, kind: 'hint', text: p.hint, emoji: p.emoji });
  });
  // 事件卡：特殊道具卡，配成一对后触发效果（增加惊喜与节奏）
  const EVENT_POOL = [
    { id: 'time', emoji: '⏱', term: '时间卡', hint: '限时 +5 秒 / 免记 1 步', effect: 'time' },
    { id: 'score', emoji: '💎', term: '幸运卡', hint: '少记 2 步', effect: 'score' },
    { id: 'shield', emoji: '🛡', term: '护身卡', hint: '下次配错不扣时间/不记步数', effect: 'shield' }
  ];
  const deckEvents = [];
  if (cfg.events !== false) {
    const want = (Array.isArray(cfg.events) && cfg.events.length) ? cfg.events.slice() : [null];
    const pool = EVENT_POOL.slice();
    want.forEach(id => {
      const evt = id ? pool.find(e => e.id === id) : pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!evt) return;
      deckEvents.push(evt);
      cards.push({ pairId: 'E_' + evt.id, kind: 'term', text: evt.term, emoji: evt.emoji, event: evt });
      cards.push({ pairId: 'E_' + evt.id, kind: 'hint', text: evt.hint, emoji: evt.emoji, event: evt });
    });
  }
  const totalPairs = cfg.size + deckEvents.length;
  // Fisher-Yates 洗牌
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box mm-fill">
      <div class="mm-head">
        <div>
          <div class="mm-title">🧠 ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close" title="关闭">✕</div>
      </div>
      <div class="mm-stats">
        ${cfg.timed ? '<span>⏱ <b class="mm-timer">' + (cfg.timeLimit || 0) + '</b>s</span>' : ''}
        <span>步数 <b class="mm-moves">0</b></span>
        <span>配对 <b class="mm-matched">0</b>/${totalPairs}</span>
        <span>🔥 <b class="mm-combo" style="color:#ff7a00"></b></span>
      </div>
      ${cfg.timed ? '<div class="mm-timerbar"><div class="mm-timerbar-fill high" style="width:100%"></div></div>' : ''}
      <div class="mm-grid"></div>
      <div class="mm-foot">${escHtml(cfg.tip || '记不住没关系，混个脸熟就行！')}</div>
    </div>`;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('.mm-grid');
  const cols = Math.ceil(Math.sqrt(cards.length));
  const rows = Math.ceil(cards.length / cols);
  const gap = 10;
  function fitCard(){
    const aw = grid.clientWidth - (cols - 1) * gap;
    const ah = grid.clientHeight - (rows - 1) * gap;
    const size = Math.max(36, Math.floor(Math.min(aw / cols, ah / rows)));
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + size + 'px)';
    grid.style.gridTemplateRows = 'repeat(' + rows + ', ' + size + 'px)';
  }
  fitCard();
  requestAnimationFrame(fitCard);

  const timerEl = overlay.querySelector('.mm-timer');
  const movesEl = overlay.querySelector('.mm-moves');
  const matchedEl = overlay.querySelector('.mm-matched');
  const comboEl = overlay.querySelector('.mm-combo');

  let timeLeft = cfg.timeLimit || 0;
  let mmTimeTotal = Math.max(cfg.timeLimit || 0, 1);
  let moves = 0, matched = 0;
  let flipped = [], lock = false, finished = false;
  let timer = null;
  let shield = false;   // 护身卡：下次配错不扣时间

  if (cfg.timed) {
    let mmLastTick = 99;
    timer = setInterval(() => {
      timeLeft -= 0.1;
      if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
      const mmSec = Math.ceil(timeLeft);
      if (mmSec <= 5 && mmSec > 0 && mmSec !== mmLastTick) { playSound('tick'); mmLastTick = mmSec; }
      const bar = overlay.querySelector('.mm-timerbar-fill');
      if (bar) {
        const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
        bar.style.width = pct + '%';
        bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
      }
      if (timeLeft <= 0 && !finished) { clearInterval(timer); finish(false); }
    }, 100);
  }

  function isCardMatched(i) { return grid.children[i] && grid.children[i].classList.contains('matched'); }
  function applyEvent(evt) {
    if (evt.effect === 'time') {
      if (cfg.timed) {
        timeLeft = Math.min(cfg.timeLimit || 60, timeLeft + 5);
        if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
        const bar = overlay.querySelector('.mm-timerbar-fill');
        if (bar) {
          const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
          bar.style.width = pct + '%';
          bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
        }
        showToast('⏱ 时间 +5 秒！', 'success');
      } else {
        moves = Math.max(0, moves - 1);
        if (movesEl) movesEl.textContent = moves;
        showToast('⏱ 少记 1 步，更容易拿三星', 'success');
      }
    } else if (evt.effect === 'score') {
      moves = Math.max(0, moves - 2);
      if (movesEl) movesEl.textContent = moves;
      showToast('💎 少记 2 步，评价更稳', 'success');
    } else if (evt.effect === 'shield') {
      shield = true;
      showToast('🛡 护身卡就绪：下次配错不扣时间/不记步数', 'info');
    }
  }

  function flipCard(card) {
    if (lock || finished) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    if (flipped.length >= 2) return;
    card.classList.add('flipped');
    playSound('click');
    flipped.push(card);
    if (flipped.length === 2) {
      moves++;
      movesEl.textContent = moves;
      lock = true;
      const [a, b] = flipped;
      const da = cards[+a.dataset.idx], db = cards[+b.dataset.idx];
      if (da.pairId === db.pairId && da.kind !== db.kind) {
        setTimeout(() => {
          a.classList.add('matched');
          b.classList.add('matched');
          matched++;
          matchedEl.textContent = matched;
          playSound('success');
          streak++;
          bestStreak = Math.max(bestStreak, streak);
          if (comboEl) comboEl.textContent = streak >= 2 ? 'x' + streak : '';
          bumpGameStats({ mmStreak: bestStreak, mmMatched: (getGameStats().mmMatched || 0) + 1 });
          // —— 配对连击特效：彩屑粒子 + 连击环 + 飘字 ——
          try {
            const box = grid.getBoundingClientRect();
            const ax = a.getBoundingClientRect(), bx = b.getBoundingClientRect();
            const cx = (ax.left+ax.right+bx.left+bx.right)/4 - box.left;
            const cy = (ax.top+ax.bottom+bx.top+bx.bottom)/4 - box.top;
            // 彩屑粒子
            for (let k=0;k<14;k++){
              const p2=document.createElement('span');
              p2.className='mm-burst';
              const colors=['#00e676','#ffd700','#7ee8fa','#ff5252','#b388ff'];
              p2.style.cssText='left:'+(cx)+'px;top:'+(cy)+'px;--mx:'+((Math.random()*120-60))+'px;--my:'+((Math.random()*-100-20))+'px;background:'+colors[k%colors.length];
              grid.appendChild(p2);
              setTimeout(()=>{ try{p2.remove();}catch(e){} }, 600);
            }
            // 连击环（≥2 连）
            if (streak >= 2){
              const ring=document.createElement('div');
              ring.className='mm-combo-ring';
              ring.style.cssText='left:'+(cx-26)+'px;top:'+(cy-26)+'px';
              grid.appendChild(ring);
              setTimeout(()=>{ try{ring.remove();}catch(e){} }, 600);
              const fl=document.createElement('div');
              fl.className='mm-combo-float';
              fl.textContent = '🔥 连击 x'+streak+' +'+Math.min(10,5+streak*2)+'';
              fl.style.cssText='left:'+(cx)+'px;top:'+(cy-46)+'px';
              grid.appendChild(fl);
              setTimeout(()=>{ try{fl.remove();}catch(e){} }, 900);
            }
          } catch(e){}
          flipped = [];
          lock = false;
          if (da.event) applyEvent(da.event);
          if (matched === totalPairs) { clearInterval(timer); finish(true); }
        }, 320);
      } else {
        setTimeout(() => {
          a.classList.add('wrong');
          b.classList.add('wrong');
          streak = 0;
          if (comboEl) comboEl.textContent = '';
          playSound('error');
          if (cfg.timed) {
            if (shield) {
              shield = false;
              showToast('🛡 护身生效，这次不扣时间', 'info');
            } else {
              timeLeft = Math.max(0, timeLeft - 2.5);
              if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
              const bar = overlay.querySelector('.mm-timerbar-fill');
              if (bar) {
                const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
                bar.style.width = pct + '%';
                bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
              }
              showToast('❌ 记错了，时间 -2.5s', 'error');
            }
          } else if (shield) {
            shield = false;
            moves = Math.max(0, moves - 1);
            if (movesEl) movesEl.textContent = moves;
            showToast('🛡 护身生效，这次不记步数', 'info');
          }
          setTimeout(() => {
            a.classList.remove('flipped', 'wrong');
            b.classList.remove('flipped', 'wrong');
            flipped = [];
            lock = false;
          }, 650);
        }, 480);
      }
    }
  }

  cards.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.dataset.idx = idx;
    card.innerHTML = '<div class="mm-inner"><div class="mm-face mm-back"><span>❔</span></div><div class="mm-face mm-front"><div class="mm-emoji">' + c.emoji + '</div><div class="mm-text">' + escHtml(c.text) + '</div></div></div>';
    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
  });
  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };

  function closeOverlay() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }

  function finish(win) {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    const stars = win ? (moves <= totalPairs ? 3 : moves <= totalPairs * 1.5 ? 2 : 1) : 0;
    const stats = { moves: moves, matched: matched, totalPairs: totalPairs, stars: stars };
    if (win) {
      // 配对成功即收入图鉴
      const ids = cfg.pairs.map(pr => pr.id).filter(Boolean);
      if (ids.length) unlockPedia(currentLevelId, ids);
      // 全部配对：卡片依次点亮 + 结果横幅
      grid.querySelectorAll('.mm-card').forEach((c, i) => {
        setTimeout(() => c.classList.add('celebrate'), i * 45);
      });
      playSound('fanfare');
      if (cfg._silent) {
        // 连续关卡中途：简短庆祝后直接进下一关，不弹结算
        setTimeout(() => { overlay.remove(); if (onComplete) onComplete(true, stats); }, 600);
        return;
      }
      setTimeout(() => {
        grid.style.display = 'none';
        const foot = overlay.querySelector('.mm-foot');
        if (foot) foot.style.display = 'none';
        const res = document.createElement('div');
        res.className = 'mm-result';
        res.innerHTML = `
          <div class="big">🎉</div>
          <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 完成！</div>
          <div class="xp">+${cfg.xp || 0} XP</div>
          <div style="font-size:14px;color:var(--dim)">用 ${moves} 步配对 ${matched} 对 · 评价 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
          <div style="font-size:13px;color:var(--cyan);margin-top:4px">厂长：术语全部入库！再看到它们就不会陌生了</div>
          <div class="note">热身奖励不计入排行榜，重在混个脸熟</div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
            <button class="mm-btn" data-act="again">🔁 再玩一次</button>
            <button class="mm-btn primary" data-act="done">${cfg._doneText || '收下奖励继续'}</button>
          </div>`;
        overlay.appendChild(res);
        overlay.querySelector('[data-act="again"]').onclick = () => { playAreaMusic(); overlay.remove(); openMemoryMatch(cfg, onComplete); };
        const _done = () => { playAreaMusic(); overlay.remove(); if (!cfg._noRecord) { recordGameWin('mm'); miniMarkClear(cfg.id); } if (onComplete) onComplete(true, stats); };
        overlay.querySelector('[data-act="done"]').onclick = _done;
      }, 700);
    } else {
      playSound('fail');
      if (cfg._silent) {
        // 连续关卡中途失败：交回结果，由外层统一出整场总结算
        setTimeout(() => { overlay.remove(); if (onComplete) onComplete(false, stats); }, 350);
        return;
      }
      // 超时/未完成
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⏰</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">时间到，还差 ${totalPairs - matched} 对</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">混个脸熟就行，再试一次吧！</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">跳过，先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { playAreaMusic(); overlay.remove(); openMemoryMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false, stats); };
    }
  }
}



// 番外：堆叠式多层翻牌（一层层揭开）
function openStackedMatch(cfg, onComplete) {
  playMusic('boss');
  const levels = cfg.levels;
  let cur = 0;
  let finished = false;
  let totalMatched = 0;
  const totalPairs = levels.reduce((sum, l) => sum + l.pairs.length, 0);
  let timeLeft = cfg.timeLimit || 120;
  let timer = null;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🧠 ${escHtml(cfg.name)}</div>
          <div class="mm-sub" id="mmStackSub">${escHtml(levels[0].subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="mm-stats">
        <span>⏱ <b class="mm-timer">${timeLeft}</b>s</span>
        <span>层 <b id="mmStackCur">1</b>/${levels.length}</span>
        <span>配对 <b id="mmStackTotal">0</b>/${totalPairs}</span>
      </div>
      <div class="mm-timerbar"><div class="mm-timerbar-fill high" style="width:100%"></div></div>
      <div class="mm-stack" id="mmStack"></div>
      <div class="mm-foot">${escHtml(cfg.tip || '')}</div>
    </div>`;
  document.body.appendChild(overlay);

  const stack = overlay.querySelector('#mmStack');
  const subEl = overlay.querySelector('#mmStackSub');
  const curEl = overlay.querySelector('#mmStackCur');
  const totalEl = overlay.querySelector('#mmStackTotal');
  const timerEl = overlay.querySelector('.mm-timer');

  // 构建每一层牌堆
  levels.forEach((lv, li) => {
    const cards = [];
    lv.pairs.forEach((pr, i) => {
      cards.push({ pairId: i, kind: 'term', text: pr.term, emoji: pr.emoji });
      cards.push({ pairId: i, kind: 'hint', text: pr.hint, emoji: pr.emoji });
    });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const el = document.createElement('div');
    el.className = 'mm-stack-level' + (li === 0 ? ' active' : '');
    el.innerHTML = '<div class="mm-stack-grid"></div>';
    const grid = el.querySelector('.mm-stack-grid');
    const cols = Math.ceil(Math.sqrt(cards.length));
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

    const st = { cards, flipped: [], lock: false, matched: 0, size: lv.pairs.length };
    cards.forEach((c, idx) => {
      const card = document.createElement('div');
      card.className = 'mm-card';
      card.dataset.idx = idx;
      card.innerHTML = '<div class="mm-inner"><div class="mm-face mm-back"><span>❔</span></div><div class="mm-face mm-front"><div class="mm-emoji">' + c.emoji + '</div><div class="mm-text">' + escHtml(c.text) + '</div></div></div>';
      card.addEventListener('click', () => {
        if (st.lock || finished) return;
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
        if (st.flipped.length >= 2) return;
        card.classList.add('flipped');
        playSound('click');
        st.flipped.push(card);
        if (st.flipped.length === 2) {
          st.lock = true;
          const [a, b] = st.flipped;
          const da = st.cards[+a.dataset.idx], db = st.cards[+b.dataset.idx];
          if (da.pairId === db.pairId && da.kind !== db.kind) {
            setTimeout(() => {
              a.classList.add('matched');
              b.classList.add('matched');
              st.matched++;
              totalMatched++;
              totalEl.textContent = totalMatched;
              playSound('success');
              st.flipped = [];
              st.lock = false;
              if (st.matched === st.size) {
                const ids = lv.pairs.map(pr => pr.id).filter(Boolean);
                if (ids.length) unlockPedia(currentLevelId, ids);
                setTimeout(() => nextLevel(li), 500);
              }
            }, 320);
          } else {
            setTimeout(() => {
              a.classList.add('wrong');
              b.classList.add('wrong');
              playSound('error');
              timeLeft = Math.max(0, timeLeft - 2.5);
              if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
              const bar = overlay.querySelector('.mm-timerbar-fill');
              if (bar) {
                const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
                bar.style.width = pct + '%';
                bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
              }
              showToast('❌ 记错了，时间 -2.5s', 'error');
              setTimeout(() => {
                a.classList.remove('flipped', 'wrong');
                b.classList.remove('flipped', 'wrong');
                st.flipped = [];
                st.lock = false;
              }, 650);
            }, 480);
          }
        }
      });
      grid.appendChild(card);
    });
    stack.appendChild(el);
  });

  function nextLevel(li) {
    if (li + 1 >= levels.length) { finish(true); return; }
    const curEl2 = stack.children[li];
    const nextEl = stack.children[li + 1];
    curEl2.classList.remove('active');
    curEl2.classList.add('leaving');
    nextEl.classList.add('active');
    cur = li + 1;
    curEl.textContent = cur + 1;
    subEl.textContent = levels[cur].subtitle || '';
    playSound('levelup');
    setTimeout(() => { curEl2.style.display = 'none'; }, 600);
  }

  const mmTimeTotal = Math.max(timeLeft, 1);
  let mmLastTick = 99;
  timer = setInterval(() => {
    timeLeft -= 0.1;
    if (timerEl) timerEl.textContent = Math.max(Math.ceil(timeLeft), 0);
    const mmSec = Math.ceil(timeLeft);
    if (mmSec <= 5 && mmSec > 0 && mmSec !== mmLastTick) { playSound('tick'); mmLastTick = mmSec; }
    const bar = overlay.querySelector('.mm-timerbar-fill');
    if (bar) {
      const pct = Math.max(0, Math.min(100, (timeLeft / mmTimeTotal) * 100));
      bar.style.width = pct + '%';
      bar.className = 'mm-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
    }
    if (timeLeft <= 0 && !finished) { clearInterval(timer); finish(false); }
  }, 100);

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };
  function closeOverlay() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }
  function finish(win) {
    finished = true;
    clearInterval(timer);
    if (win) {
      playSound('fanfare');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">🏆</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 通关！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">三层全破，${totalPairs} 对全认全</div>
        <div class="note">挑战奖励不计入排行榜，重在混个脸熟</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="done"]').onclick = () => { playAreaMusic(); overlay.remove(); recordGameWin('mm'); miniMarkClear(cfg.id); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⏰</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">时间到，还差 ${totalPairs - totalMatched} 对</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">混个脸熟就行，再来一次吧！</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { playAreaMusic(); overlay.remove(); openStackedMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }
}

// 连线匹配小游戏：左项↔右项配对
function openMatchGame(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (tutSeen('match') === false) {
    showGameTutorial('match', '🔗 连线配对', [
      '把左边的<b>术语</b>连到右边对应的<b>解释</b>',
      '全部配对成功即过关'
    ], function(){ openMatchGame(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('match'));
  if (cfg._hard) cfg.size = Math.min((cfg.size || 4) + 2, (cfg.pairs || []).length);   // 二周目：多加 2 组
  const pairs = (cfg.pairs || []).slice(0, cfg.size);
  const rights = pairs.map((p, i) => ({ text: p.right, pairIdx: i }));
  for (let i = rights.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rights[i], rights[j]] = [rights[j], rights[i]];
  }
  let selected = null;
  let matchedCount = 0;
  const matched = new Set();
  let finished = false;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🔗 ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="mm-stats"><span>配对 <b id="mmMatchCount">0</b>/${cfg.size}</span></div>
      <div class="match-area">
        <div class="match-col"><h4>${escHtml(cfg.leftTitle || '概念 / 场景')}</h4><div id="mmLeft"></div></div>
        <div class="match-col"><h4>${escHtml(cfg.rightTitle || '匹配项')}</h4><div id="mmRight"></div></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const leftEl = overlay.querySelector('#mmLeft');
  const rightEl = overlay.querySelector('#mmRight');
  const countEl = overlay.querySelector('#mmMatchCount');

  function render() {
    leftEl.innerHTML = '';
    rightEl.innerHTML = '';
    pairs.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'match-item' + (matched.has(i) ? ' matched' : '') + (selected === i ? ' selected' : '');
      div.textContent = p.left;
      if (!matched.has(i)) div.onclick = () => { selected = i; render(); };
      leftEl.appendChild(div);
    });
    rights.forEach(r => {
      const div = document.createElement('div');
      div.className = 'match-item' + (matched.has(r.pairIdx) ? ' matched' : '');
      div.textContent = r.text;
      if (!matched.has(r.pairIdx) && selected !== null) {
        div.onclick = () => {
          if (selected === r.pairIdx) {
            matched.add(r.pairIdx);
            matchedCount++;
            selected = null;
            countEl.textContent = matchedCount;
            playSound('success');
            if (pairs[r.pairIdx].id) unlockPedia(currentLevelId, [pairs[r.pairIdx].id]);
            bumpGameStats({ mmMatched: (getGameStats().mmMatched || 0) + 1 });
            render();
            if (matchedCount >= cfg.size) finish(true);
          } else {
            div.classList.add('wrong');
            playSound('error');
            shakeScreen();
            setTimeout(() => div.classList.remove('wrong'), 300);
          }
        };
      }
      rightEl.appendChild(div);
    });
  }

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    playAreaMusic(); overlay.remove();
    if (onComplete) onComplete(false);
  };
  function finish(win) {
    finished = true;
    if (win) {
      playSound('fanfare');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `<div class="big">🔗</div><div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 完成！</div><div class="xp">+${cfg.xp || 0} XP</div><div style="font-size:14px;color:var(--dim)">${cfg.size} 组全部配对成功</div><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="mm-btn" data-act="again">🔁 再玩一次</button><button class="mm-btn primary" data-act="done">收下奖励</button></div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { playAreaMusic(); overlay.remove(); openMatchGame(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { playAreaMusic(); overlay.remove(); recordGameWin('match'); miniMarkClear(cfg.id); if (onComplete) onComplete(true); };
    }
  }
  render();
}

// 产线快打（命令快反）：看提示点对命令，计时+连击
function openQuickMatch(cfg, onComplete) {
  applyMiniTier(cfg);
  if (cfg._tier) cfg.name = (cfg.name || '') + (cfg._endless ? ' ∞ 无限战' : cfg._hard ? ' · 二周目' : '');
  if (!tutSeen('quick')) {
    showGameTutorial('quick', '⚡ 快打', [
      '题目弹出，快速点选<b>正确答案</b>',
      '连对越多连击越高、越爽',
      '在倒计时结束前尽量多答对'
    ], function(){ openQuickMatch(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('quick'));
  const questions = cfg.pairs.slice(0, cfg.size).map(pr => Object.assign({}, pr));
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const distractors = (cfg.distractors || []).filter(d => !questions.some(q => q.term === d));
  let cur = 0, score = 0, combo = 0, bestCombo = 0;
  let qkBaseTime = Math.round((cfg.timeLimit || 45) * (cfg._hard ? 0.7 : 1));   // 二周目初始时间打 7 折
  let timeLeft = qkBaseTime;
  let timer = null, finished = false;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box qk-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">⚡ ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="qk-stats">
        <span>题 <b id="qkCur">1</b>/${cfg.size}</span>
        <span>得分 <b id="qkScore">0</b></span>
        <span>连击 <b id="qkCombo">0</b> 🔥</span>
        <span>⏱ <b class="qk-timer">${timeLeft}</b>s</span>
      </div>
      <div class="qk-timerbar"><div class="qk-timerbar-fill high" id="qkTimerBar"></div></div>
      <div class="qk-terminal">
        <div class="qk-term-head">五号车间 · SSH 终端</div>
        <div class="qk-term-body" id="qkBody"></div>
      </div>
      <div class="qk-btns" id="qkBtns"></div>
      <div class="qk-msg" id="qkMsg"></div>
    </div>`;
  document.body.appendChild(overlay);

  function renderQ() {
    if (finished) return;
    if (cur >= questions.length) { clearInterval(timer); finish(true); return; }
    const q = questions[cur];
    overlay.querySelector('#qkCur').textContent = cur + 1;
    overlay.querySelector('#qkBody').innerHTML = '<div class="qk-q">' + escHtml(q.q || q.hint) + '</div>';
    overlay.querySelector('#qkMsg').textContent = '';
    const localD = (q.distractors || []).filter(function(d){ return d !== q.term; });
    const opts = [q.term].concat(localD.length ? localD : distractors);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const btns = overlay.querySelector('#qkBtns');
    btns.innerHTML = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      b.className = 'qk-btn';
      b.textContent = o;
      b.onclick = () => {
        if (finished) return;
        if (o === q.term) {
          combo++;
          bestCombo = Math.max(bestCombo, combo);
          bumpGameStats({ qkCombo: Math.max(getGameStats().qkCombo || 0, bestCombo) });
          score += 10 + combo * 2;
          overlay.querySelector('#qkScore').textContent = score;
          overlay.querySelector('#qkCombo').textContent = combo;
          if (combo >= 2) playSound('combo', combo); else playSound('success');
          overlay.querySelector('#qkMsg').innerHTML = '<span class="qk-ok">✓ 正确！' + (q.cmd ? ' 示例：' + escHtml(q.cmd) : '') + '</span>';
          // —— 打击感：按钮爆发 + 粒子 + 连击飘字 ——
          try{
            b.classList.add('hit');
            const bb=b.getBoundingClientRect();
            const bx=bb.left+bb.width/2, by=bb.top+bb.height/2;
            // 粒子：fixed 定位到按钮中心（视口坐标）
            for(let k=0;k<10;k++){
              const sp=document.createElement('span');
              sp.className='qk-burst';
              sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*90-45))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#00e676','#ffd700','#7ee8fa'][k%3];
              document.body.appendChild(sp);
              setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
            }
            if(combo>=2){
              const fl=document.createElement('div');
              fl.className='qk-combo-float';
              fl.textContent = '🔥 连击 x'+combo;
              fl.style.cssText='left:'+bx+'px;top:'+(by-10)+'px';
              document.body.appendChild(fl);
              setTimeout(()=>{ try{fl.remove();}catch(e){} }, 800);
            }
          }catch(e2){}
          if (q.id) unlockPedia(currentLevelId, [q.id]);
          cur++;
          if (cur >= cfg.size) {
            if (cfg._endless) { cur = 0; qkBaseTime = Math.max(6, qkBaseTime - 3); timeLeft = qkBaseTime; qkTimeTotal = qkBaseTime; renderQ(); showToast('⏱ 下一轮时间缩短到 ' + qkBaseTime + ' 秒！', 'info'); }   // 无限战：每轮缩 3 秒，直到来不及
            else { clearInterval(timer); setTimeout(() => finish(true), 700); }
          }
          else setTimeout(renderQ, 550);
        } else {
          combo = 0;
          overlay.querySelector('#qkCombo').textContent = combo;
          playSound('error');
          overlay.querySelector('#qkMsg').innerHTML = '<span class="qk-err">✗ 正确答案是 ' + escHtml(q.term) + '（' + escHtml(q.hint) + '）</span>';
          b.classList.add('wrong');
          setTimeout(() => { b.classList.remove('wrong'); renderQ(); }, 1000);
        }
      };
      btns.appendChild(b);
    });
  }

  let qkTimeTotal = Math.max(timeLeft, 1);
  let qkLastTick = 99;
  timer = setInterval(() => {
    timeLeft -= 0.1;
    const t = overlay.querySelector('.qk-timer');
    if (t) t.textContent = Math.max(Math.ceil(timeLeft), 0);
    const qkSec = Math.ceil(timeLeft);
    if (qkSec <= 5 && qkSec > 0 && qkSec !== qkLastTick) { playSound('tick'); qkLastTick = qkSec; }
    const bar = overlay.querySelector('#qkTimerBar');
    if (bar) {
      const pct = Math.max(0, Math.min(100, (timeLeft / qkTimeTotal) * 100));
      bar.style.width = pct + '%';
      bar.className = 'qk-timerbar-fill ' + (pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low');
    }
    if (timeLeft <= 0 && !finished) { clearInterval(timer); finish(false); }
  }, 100);

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };
  function closeOverlay() {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s';
    setTimeout(() => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }
  function finish(win) {
    finished = true;
    clearInterval(timer);
    if (win) {
      playSound('fanfare');
      const stars = bestCombo >= cfg.size ? 3 : bestCombo >= Math.ceil(cfg.size / 2) ? 2 : 1;
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⚡</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 完成！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">得分 ${score} · 最高连击 ${bestCombo} · 评价 ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="note">快打奖励不计入排行榜，重在认熟命令</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn" data-act="again">🔁 再打一次</button>
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { playAreaMusic(); overlay.remove(); openQuickMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { playAreaMusic(); overlay.remove(); recordGameWin('qk'); miniMarkClear(cfg.id); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">⏰</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">时间到，答对 ${cur}/${cfg.size} 题</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">再打一次，手感会更好！</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { playAreaMusic(); overlay.remove(); openQuickMatch(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }
  renderQ();
}

// ===== Storm Defense（数据风暴·守住管道，L4 新玩法）=====
function openStormDefense(cfg, onComplete) {
  if (!tutSeen('storm')) {
    showGameTutorial('storm', '🌪️ 数据风暴', [
      '数据风暴来了！拖<b>过滤器</b>处理涌入的数据',
      '每种过滤器有费用，算力有限不能全开',
      '别让管道崩了，守住每一波'
    ], function(){ openStormDefense(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('storm'));
  const duration = cfg.duration || 60;
  const waves = cfg.waves || 5;
  const waveDur = duration / waves;
  const FILTERS = (cfg.filters || [
    { id: 'smooth', name: '滑动均值', emoji: '📉', desc: '滤噪声压波动', cost: 8 },
    { id: 'clamp', name: '阈值截断', emoji: '🎚️', desc: '压异常尖峰', cost: 10 },
    { id: 'drop', name: '丢弃异常', emoji: '🗑️', desc: '直接丢异常·可能误伤关键', cost: 14 },
    { id: 'down', name: '降采样', emoji: '⏳', desc: '流量减半·可能漏关键', cost: 6 }
  ]);
  const BASE_P = { normal: 6, noise: 4, anomaly: 12, critical: 10 };
  const SCORE = { normal: 2, noise: 1, anomaly: 3, critical: 20 };
  const TYPE_NAME = { normal: '正常', noise: '噪声', anomaly: '异常', critical: '关键' };
  const TYPE_EMOJI = { normal: '🟢', noise: '⚪', anomaly: '🔴', critical: '🟡' };
  const DRAIN = 8, COMPUTE_MAX = 100, COMPUTE_REGEN = 25;

  let timeLeft = duration, pressure = 0, compute = COMPUTE_MAX, score = 0;
  let finished = false, peakPressure = 0, totalCrit = 0, savedCrit = 0;
  let blocks = [], spawnIdx = 0, timer = null;
  const filterSet = new Set();

  // 预生成各波数据块（越往后越猛，关键数据从后半程出现）
  const spawns = [];
  for (let w = 1; w <= waves; w++) {
    const inten = w / waves;
    const count = 8 + Math.round(10 * inten);
    const gap = (waveDur - 1.2) / count;
    let t = 0.5;
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let type;
      if (inten < 0.35) type = r < 0.72 ? 'normal' : 'noise';
      else if (inten < 0.6) type = r < 0.45 ? 'normal' : (r < 0.78 ? 'noise' : 'anomaly');
      else type = r < 0.22 ? 'normal' : (r < 0.5 ? 'noise' : (r < 0.84 ? 'anomaly' : 'critical'));
      spawns.push({ absT: (w - 1) * waveDur + t, type });
      t += gap;
    }
  }

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box sd-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🌪️ ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="sd-top">
        <span>⏱ <b id="sdTime">${duration}</b>s</span>
        <span>波 <b id="sdWave">1</b>/${waves}</span>
        <span>得分 <b id="sdScore">0</b></span>
      </div>
      <div class="sd-bar-wrap">
        <div class="sd-bar-label">管道压力（满 100 就崩）<span id="sdPNum" style="float:right;color:var(--amber)">0</span></div>
        <div class="sd-bar"><div class="sd-bar-fill sd-pressure-fill" id="sdPressure" style="width:0%"></div></div>
      </div>
      <div class="sd-bar-wrap">
        <div class="sd-bar-label">边缘算力 <span id="sdCNum" style="float:right;color:var(--cyan)">100</span></div>
        <div class="sd-bar"><div class="sd-bar-fill sd-compute-fill" id="sdCompute" style="width:100%"></div></div>
      </div>
      <div class="sd-pipe" id="sdPipe">
        <div class="sd-pipe-label">🌊 数据流 → 边缘处理（点下方过滤器来守管道）</div>
      </div>
      <div class="sd-filters" id="sdFilters"></div>
      <div class="sd-msg" id="sdMsg"></div>
    </div>`;
  document.body.appendChild(overlay);

  const pipe = overlay.querySelector('#sdPipe');
  const msgEl = overlay.querySelector('#sdMsg');
  let pipeWidth = 0;
  function measurePipe() { pipeWidth = pipe.clientWidth || 0; }
  measurePipe();
  setTimeout(measurePipe, 120);

  function flashMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.style.color = cls === 'err' ? 'var(--red)' : cls === 'ok' ? 'var(--green)' : 'var(--amber)';
    clearTimeout(flashMsg._t);
    flashMsg._t = setTimeout(() => { msgEl.textContent = ''; }, 1500);
  }

  function renderFilters() {
    const box = overlay.querySelector('#sdFilters');
    box.innerHTML = '';
    FILTERS.forEach(f => {
      const on = filterSet.has(f.id);
      const btn = document.createElement('div');
      btn.className = 'sd-filter' + (on ? ' on' : '');
      btn.innerHTML = '<div class="sd-f-emoji">' + f.emoji + '</div><div class="sd-f-name">' + escHtml(f.name) + '</div><div class="sd-f-cost">⚡ ' + f.cost + '/s</div><div class="sd-f-desc">' + escHtml(f.desc) + '</div>';
      btn.onclick = () => toggleFilter(f.id);
      box.appendChild(btn);
    });
    const c = Math.max(0, Math.round(compute));
    overlay.querySelector('#sdCompute').style.width = c + '%';
    overlay.querySelector('#sdCNum').textContent = c;
  }

  function toggleFilter(id) {
    if (finished) return;
    playSound('toggle');
    if (filterSet.has(id)) { filterSet.delete(id); }
    else {
      const f = FILTERS.find(x => x.id === id);
      if (compute < f.cost) { flashMsg('⚡ 算力不足，先关掉别的过滤器再开', 'err'); return; }
      filterSet.add(id);
      flashMsg(f.emoji + ' ' + f.name + ' 已启用', 'ok');
      // 启用过滤器：粒子爆散
      try{
        const b = box.querySelector('[data-fid="'+id+'"]') || box;
        const rb=b.getBoundingClientRect(), ob=box.getBoundingClientRect();
        const bx=rb.left+rb.width/2-ob.left, by=rb.top+rb.height/2-ob.top;
        for(let k=0;k<8;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*70-35))+'px;--my:'+((Math.random()*-60-10))+'px;background:'+['#00e676','#7ee8fa','#ffd700'][k%3];
          box.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
      }catch(e2){}
    }
    renderFilters();
  }

  function pressureAdd(type) {
    let p = BASE_P[type];
    if (filterSet.has('smooth')) {
      if (type === 'noise') p *= 0.5;
      if (type === 'anomaly') p *= 0.75;
      if (type === 'critical') p *= 1.3;
    }
    if (filterSet.has('clamp')) {
      if (type === 'anomaly') p *= 0.4;
      if (type === 'noise') p *= 0.7;
    }
    if (filterSet.has('down')) {
      if (type === 'normal') p *= 0.5;
      if (type === 'critical') p *= 1.4;
    }
    if (filterSet.has('drop')) {
      if (type === 'anomaly') return { p: 0, dropped: true };
      if (type === 'critical' && Math.random() < 0.15) return { p: 15, mis: true };
    }
    return { p: Math.round(p), dropped: false };
  }

  function valueFor(type) {
    if (type === 'normal') return (24 + Math.random() * 6).toFixed(0) + '℃';
    if (type === 'noise') return (23 + Math.random() * 13).toFixed(0) + '℃';
    if (type === 'anomaly') return (88 + Math.random() * 18).toFixed(0) + '℃';
    return (32 + Math.random() * 8).toFixed(0) + '℃';
  }

  function spawn(type) {
    const r = pressureAdd(type);
    if (r.mis) {
      score -= 20;
      flashMsg('❌ 误丢了关键数据！-20 分，压力 +15', 'err');
      pipe.classList.remove('shake'); void pipe.offsetWidth; pipe.classList.add('shake');
      pressure += r.p;
      return;
    }
    if (r.dropped) { score += 3; return; }
    pressure += r.p;
    peakPressure = Math.max(peakPressure, pressure);
    const el = document.createElement('div');
    el.className = 'sd-block ' + type;
    el.innerHTML = '<span class="sd-b-val">' + valueFor(type) + '</span><span class="sd-b-type">' + TYPE_EMOJI[type] + ' ' + TYPE_NAME[type] + '</span>';
    pipe.appendChild(el);
    if (type === 'critical') totalCrit++;
    blocks.push({ el, type, x: 0, speed: (pipeWidth + 110) / 5.5 });
  }

  function tick() {
    if (finished) return;
    const dt = 0.05;
    pressure = Math.max(0, pressure - DRAIN * dt);
    compute = Math.min(COMPUTE_MAX, compute + COMPUTE_REGEN * dt);
    let cost = 0;
    filterSet.forEach(id => { const f = FILTERS.find(x => x.id === id); if (f) cost += f.cost; });
    compute -= cost * dt;
    if (compute <= 0) {
      compute = 0; filterSet.clear(); renderFilters();
      flashMsg('⚡ 算力耗尽，过滤器全关！', 'err');
    }
    timeLeft -= dt;
    const elapsed = duration - timeLeft;
    while (spawnIdx < spawns.length && spawns[spawnIdx].absT <= elapsed) { spawn(spawns[spawnIdx].type); spawnIdx++; }
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b.x += b.speed * dt;
      b.el.style.transform = 'translateX(' + b.x + 'px)';
      if (b.x >= pipeWidth + 50) {
        b.el.remove(); blocks.splice(i, 1);
        score += SCORE[b.type];
        if (b.type === 'critical') savedCrit++;
      }
    }
    const waveNow = Math.min(waves, Math.floor((duration - timeLeft) / waveDur) + 1);
    overlay.querySelector('#sdTime').textContent = Math.max(0, Math.ceil(timeLeft));
    overlay.querySelector('#sdWave').textContent = waveNow;
    overlay.querySelector('#sdScore').textContent = score;
    overlay.querySelector('#sdPressure').style.width = Math.min(100, pressure) + '%';
    overlay.querySelector('#sdPNum').textContent = Math.round(pressure);
    if (pressure >= 100) { clearInterval(timer); finish(false); return; }
    if (timeLeft <= 0) {
      clearInterval(timer);
      // 收尾：把仍在管道里、已通过的数据一并算作处理完
      blocks.forEach(bl => { if (bl.el) bl.el.remove(); if (bl.type === 'critical') savedCrit++; });
      blocks = [];
      finish(true);
    }
  }

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };
  function closeOverlay() {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s';
    setTimeout(() => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }

  function finish(win) {
    finished = true;
    clearInterval(timer);
    if (win) {
      const ids = (cfg.pairs || []).map(pr => pr.id).filter(Boolean);
      if (ids.length) unlockPedia(currentLevelId, ids);
      playSound('fanfare');
      const savedRate = totalCrit ? savedCrit / totalCrit : 1;
      const stars = (peakPressure <= 60 && savedRate >= 0.9) ? 3 : (peakPressure <= 85 && savedRate >= 0.6) ? 2 : 1;
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">🌪️</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 守住了！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">峰值压力 ${Math.round(peakPressure)}% · 关键数据保住 ${savedCrit}/${totalCrit} · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="note">边缘算力有限，过滤器不能全开——学会掂量着用</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn" data-act="again">🔁 再守一次</button>
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { playAreaMusic(); overlay.remove(); openStormDefense(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { playAreaMusic(); overlay.remove(); recordGameWin('storm'); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">💥</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">管道崩了！</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">压力冲到 100%（峰值 ${Math.round(peakPressure)}%）· 再来一次，试着提前开好过滤器</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { playAreaMusic(); overlay.remove(); openStormDefense(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }

  renderFilters();
  timer = setInterval(tick, 50);
}

// ===== Alarm Rush（值班抢险·别让产线烧了，L4 新玩法）=====
function openAlarmRush(cfg, onComplete) {
  if (!tutSeen('alarm')) {
    showGameTutorial('alarm', '🚨 值班抢险', [
      '产线设备<b>报警</b>了，快速处理',
      '别让产线烧了，稳住每一波'
    ], function(){ openAlarmRush(cfg, onComplete); });
    return;
  }
  playMusic(gameSong('alarm'));
  const duration = cfg.duration || 40;
  const waves = cfg.waves || 4;
  const waveDur = duration / waves;
  const deviceCount = cfg.devices || 4;
  const OVERHEAT_TEMP = 80;
  const WINDOW = 3.0;         // 过热处理窗口（秒）
  const CRASH_LIMIT = 3;      // 累计宕机 3 台 → 产线瘫痪

  let timeLeft = duration, score = 0, combo = 0, crashes = 0, saves = 0;
  let wave = 1, finished = false, timer = null;
  const devices = [];

  // 预生成各波"哪台盒子会爆表"
  const events = [];
  for (let w = 1; w <= waves; w++) {
    const count = Math.min(deviceCount, 1 + Math.round((w - 1) * 0.7));
    const arr = [];
    for (let i = 0; i < deviceCount; i++) arr.push(i);
    arr.sort(() => Math.random() - 0.5);
    const pick = arr.slice(0, count);
    let t = waveDur * 0.15;
    const gap = (waveDur * 0.75) / Math.max(1, count);
    pick.forEach(d => { events.push({ absT: (w - 1) * waveDur + t, device: d }); t += gap; });
  }
  let evIdx = 0;

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  overlay.innerHTML = `
    <div class="mm-box ar-box">
      <div class="mm-head">
        <div>
          <div class="mm-title">🚨 ${escHtml(cfg.name)}</div>
          <div class="mm-sub">${escHtml(cfg.subtitle || '')}</div>
        </div>
        <div class="mm-close">✕</div>
      </div>
      <div class="ar-top">
        <span>⏱ <b id="arTime">${duration}</b>s</span>
        <span>波 <b id="arWave">1</b>/${waves}</span>
        <span>得分 <b id="arScore">0</b></span>
        <span>连击 <b id="arCombo">0</b> 🔥</span>
        <span>宕机 <b id="arCrash" style="color:var(--red)">0</b>/${CRASH_LIMIT}</span>
      </div>
      <div class="ar-grid" id="arGrid"></div>
      <div class="ar-msg" id="arMsg"></div>
    </div>`;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#arGrid');
  const msgEl = overlay.querySelector('#arMsg');

  function flash(t, cls) {
    msgEl.textContent = t;
    msgEl.style.color = cls === 'err' ? 'var(--red)' : cls === 'ok' ? 'var(--green)' : cls === 'warn' ? 'var(--amber)' : 'var(--amber)';
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { msgEl.textContent = ''; }, 1500);
  }
  function shake(el) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  for (let i = 0; i < deviceCount; i++) {
    const el = document.createElement('div');
    el.className = 'ar-card normal';
    el.innerHTML = '<div class="ar-dev-name">边缘盒子 0' + (i + 1) + '</div><div class="ar-temp">--℃</div><div class="ar-bar"><div class="ar-bar-fill" style="width:30%"></div></div><div class="ar-status">正常</div><button class="ar-cool" style="display:none">❄️ 强制降温</button>';
    grid.appendChild(el);
    const d = {
      i, el,
      temp: 52 + Math.random() * 14, state: 'normal', crashTimer: 0, heatRate: 7,
      tempEl: el.querySelector('.ar-temp'), barEl: el.querySelector('.ar-bar-fill'), statusEl: el.querySelector('.ar-status'),
      coolEl: el.querySelector('.ar-cool')
    };
    d.coolEl.onclick = (ev) => { ev.stopPropagation(); coolDevice(d); };
    el.onclick = () => tapDevice(d);
    devices.push(d);
  }

  // 主动降温：区别于"等到爆表再点"——升温中提前用 ❄️ 压下去，得奖励
  function coolDevice(d) {
    if (finished) return;
    if (d.state === 'heating') {
      combo++; saves++;
      const gain = 15 + (combo - 1) * 5;
      score += gain;
      flash('❄️ 提前降温 +' + gain, 'ok');
      if (combo >= 2) playSound('combo', combo); else playSound('success');
      d.temp = Math.max(38, d.temp - 34);
      d.state = 'normal';
      d.el.className = 'ar-card normal'; d.statusEl.textContent = '已降温';
      d.coolEl.style.display = 'none';
      try{
        const rb=d.el.getBoundingClientRect(), ob=overlay.getBoundingClientRect();
        const bx=rb.left+rb.width/2-ob.left, by=rb.top+rb.height/2-ob.top;
        for(let k=0;k<8;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*80-40))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#7ee8fa','#fff','#4dd0e1'][k%3];
          overlay.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
      }catch(e2){}
    } else if (d.state === 'overheat') {
      // 爆表了必须点卡片本体处理，❄️ 只能压一部分
      d.temp -= 20;
      if (d.temp < OVERHEAT_TEMP) { d.state = 'heating'; d.el.className = 'ar-card heating'; d.statusEl.textContent = '降温中…'; flash('❄️ 压住了，但还没完全好', 'warn'); }
      else flash('❄️ 降温中，别松手…', 'warn');
    }
    renderHUD();
  }

  function tapDevice(d) {
    if (finished) return;
    if (d.state === 'overheat') {
      d.state = 'saved';
      combo++;
      saves++;
      const gain = 20 + (combo - 1) * 5;
      score += gain;
      flash('✅ 处理成功 +' + gain, 'ok');
      if (combo >= 2) playSound('combo', combo); else playSound('success');
      d.el.className = 'ar-card saved';
      d.statusEl.textContent = '已处理';
      d.coolEl.style.display = 'none';
      // 处理成功粒子
      try{
        const rb=d.el.getBoundingClientRect(), ob=overlay.getBoundingClientRect();
        const bx=rb.left+rb.width/2-ob.left, by=rb.top+rb.height/2-ob.top;
        for(let k=0;k<10;k++){
          const sp=document.createElement('span');
          sp.className='mm-burst';
          sp.style.cssText='left:'+bx+'px;top:'+by+'px;--mx:'+((Math.random()*80-40))+'px;--my:'+((Math.random()*-70-10))+'px;background:'+['#00e676','#ffd700','#ff7a7a'][k%3];
          overlay.appendChild(sp);
          setTimeout(()=>{ try{sp.remove();}catch(e){} }, 550);
        }
      }catch(e2){}
      d.temp = 46 + Math.random() * 8;
      setTimeout(() => { if (d.state === 'saved') { d.state = 'normal'; d.el.className = 'ar-card normal'; d.statusEl.textContent = '正常'; } }, 2600);
    } else if (d.state === 'heating') {
      combo = 0; score -= 5;
      flash('⚠️ 处理太早 -5（等它冒烟变红再点）', 'err');
      shake(d.el); playSound('error');
    } else if (d.state === 'normal') {
      combo = 0; score -= 10;
      flash('❌ 误报 -10（它还好好的，别乱点）', 'err');
      shake(d.el); playSound('error');
    }
    renderHUD();
  }

  function renderHUD() {
    overlay.querySelector('#arScore').textContent = score;
    overlay.querySelector('#arCombo').textContent = combo;
    overlay.querySelector('#arCrash').textContent = crashes;
  }

  function tick() {
    if (finished) return;
    const dt = 0.05;
    timeLeft -= dt;
    const elapsed = duration - timeLeft;
    // 触发爆表事件
    while (evIdx < events.length && events[evIdx].absT <= elapsed) {
      const e = events[evIdx++];
      const d = devices[e.device];
      if (d.state === 'crashed') continue;
      d.state = 'heating';
      d.temp = Math.max(d.temp, 66);
      d.el.className = 'ar-card heating';
      d.statusEl.textContent = '升温中';
      d.coolEl.style.display = '';
      flash('🌡️ 边缘盒子 0' + (d.i + 1) + ' 开始升温！快用 ❄️ 降温！', 'warn');
    }
    // 更新每台盒子
    devices.forEach(d => {
      if (d.state === 'normal') {
        d.temp += (Math.random() - 0.5) * 1.4 * dt;
        d.temp = Math.max(36, Math.min(74, d.temp));
      } else if (d.state === 'heating') {
        d.temp += d.heatRate * dt;
        if (d.temp >= OVERHEAT_TEMP) {
          d.state = 'overheat'; d.crashTimer = WINDOW;
          d.el.className = 'ar-card overheat';
          d.statusEl.textContent = '🔥 过热！点卡片处理！';
          d.coolEl.style.display = '';
          flash('🔥 边缘盒子 0' + (d.i + 1) + ' 爆表了！快点卡片！', 'err');
          playSound('alarm');
        }
      } else if (d.state === 'overheat') {
        d.crashTimer -= dt;
        if (d.crashTimer <= 0) {
          d.state = 'crashed'; crashes++; combo = 0; score -= 30;
          d.el.className = 'ar-card crashed';
          d.statusEl.textContent = '💥 宕机';
          d.coolEl.style.display = 'none';
          flash('💥 宕机 -30（共宕机 ' + crashes + '/' + CRASH_LIMIT + '）', 'err');
          shake(d.el); playSound('error');
          if (crashes >= CRASH_LIMIT) { clearInterval(timer); finish(false); return; }
        }
      }
      d.tempEl.textContent = Math.round(d.temp) + '℃';
      d.barEl.style.width = Math.min(100, Math.max(0, ((d.temp - 35) / 65) * 100)) + '%';
    });
    wave = Math.min(waves, Math.floor((duration - timeLeft) / waveDur) + 1);
    overlay.querySelector('#arTime').textContent = Math.max(0, Math.ceil(timeLeft));
    overlay.querySelector('#arWave').textContent = wave;
    renderHUD();
    if (timeLeft <= 0) { clearInterval(timer); finish(true); }
  }

  overlay.querySelector('.mm-close').onclick = () => {
    if (finished) return;
    clearInterval(timer);
    closeOverlay();
  };
  function closeOverlay() {
    overlay.style.opacity = '0'; overlay.style.transition = 'opacity .3s';
    setTimeout(() => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); }, 300);
  }

  function finish(win) {
    finished = true;
    clearInterval(timer);
    if (win) {
      const ids = (cfg.pairs || []).map(pr => pr.id).filter(Boolean);
      if (ids.length) unlockPedia(currentLevelId, ids);
      playSound('fanfare');
      const totalEvents = events.length;
      const stars = (crashes === 0 && saves >= Math.ceil(totalEvents * 0.9)) ? 3 : (crashes <= 1) ? 2 : 1;
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">🚨</div>
        <div style="font-size:20px;font-weight:bold;color:var(--amber);margin-top:6px">${escHtml(cfg.name)} 守住产线！</div>
        <div class="xp">+${cfg.xp || 0} XP</div>
        <div style="font-size:14px;color:var(--dim)">得分 ${score} · 处理成功 ${saves}/${totalEvents} 起 · 宕机 ${crashes} 台 · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="note">看准冒烟变红的盒子再点，连击越多分越高</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn" data-act="again">🔁 再守一次</button>
          <button class="mm-btn primary" data-act="done">收下奖励</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="again"]').onclick = () => { playAreaMusic(); overlay.remove(); openAlarmRush(cfg, onComplete); };
      overlay.querySelector('[data-act="done"]').onclick = () => { playAreaMusic(); overlay.remove(); recordGameWin('alarm'); if (onComplete) onComplete(true); };
    } else {
      playSound('fail');
      const res = document.createElement('div');
      res.className = 'mm-result';
      res.innerHTML = `
        <div class="big">💥</div>
        <div style="font-size:20px;font-weight:bold;color:var(--red);margin-top:6px">产线瘫痪了！</div>
        <div style="font-size:14px;color:var(--dim);margin-top:8px">宕机 ${crashes}/${CRASH_LIMIT} 台 · 再来一次，盯紧冒烟的盒子</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <button class="mm-btn primary" data-act="retry">🔁 再来一次</button>
          <button class="mm-btn" data-act="skip">先干正事</button>
        </div>`;
      overlay.appendChild(res);
      overlay.querySelector('[data-act="retry"]').onclick = () => { playAreaMusic(); overlay.remove(); openAlarmRush(cfg, onComplete); };
      overlay.querySelector('[data-act="skip"]').onclick = () => { playAreaMusic(); overlay.remove(); if (onComplete) onComplete(false); };
    }
  }

  renderHUD();
  timer = setInterval(tick, 50);
}

// 术语图鉴（收藏）
function getPedia() {
  try { return JSON.parse(localStorage.getItem('term_pedia') || '{}'); } catch (e) { return {}; }
}
function savePedia(p) { localStorage.setItem('term_pedia', JSON.stringify(p)); }
function getPediaCount() {
  const p = getPedia();
  return Object.values(p).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}
function unlockPedia(levelId, ids) {
  const p = getPedia();
  const key = '' + levelId;
  const cur = new Set(p[key] || []);
  ids.forEach(id => cur.add(id));
  p[key] = Array.from(cur);
  savePedia(p);
}
function pediaCount(levelId) {
  const tl = getTermLevel(levelId);
  if (!tl) return { got: 0, total: 0 };
  const all = new Set();
  tl.warmups.forEach(w => (w.pairs || []).forEach(pr => { if (pr && pr.id) all.add(pr.id); }));
  ((tl.bonus && tl.bonus.levels) || []).forEach(l => (l.pairs || []).forEach(pr => { if (pr && pr.id) all.add(pr.id); }));
  const got = new Set(getPedia()['' + levelId] || []);
  let gotCount = 0;
  all.forEach(id => { if (got.has(id)) gotCount++; });
  return { got: gotCount, total: all.size };
}
function openPedia() {
  document.getElementById('pdOverlay').classList.add('show');
  renderPedia();
}
function closePedia() {
  if (_mapFlowFeature) { goMap(); return; }
  document.getElementById('pdOverlay').classList.remove('show');
}
function renderPedia() {
  const tl = getTermLevel(currentLevelId);
  const body = document.getElementById('pdBody');
  if (!tl) {
    body.innerHTML = '<div class="lb-empty">当前关卡暂无图鉴内容</div>';
    document.getElementById('pdProgress').textContent = '';
    return;
  }
  const pediaSet = new Set(getPedia()['' + currentLevelId] || []);
  const all = new Map();
  tl.warmups.forEach(w => (w.pairs || []).forEach(pr => { if (pr && pr.id) all.set(pr.id, pr); }));
  ((tl.bonus && tl.bonus.levels) || []).forEach(l => (l.pairs || []).forEach(pr => { if (pr && pr.id) all.set(pr.id, pr); }));
  const entries = Array.from(all.values());
  const gotCount = entries.filter(pr => pediaSet.has(pr.id)).length;
  document.getElementById('pdProgress').textContent = (tl.emoji || '📖') + ' ' + (tl.name || ('第 ' + currentLevelId + ' 关')) + ' · 已收集 ' + gotCount + '/' + entries.length;
  let html = '';
  if (gotCount === entries.length) {
    html += '<div class="pd-full">🎉 图鉴集齐！这些词汇你已经全部脸熟，后面学起来事半功倍</div>';
  }
  html += '<div class="pd-grid">';
  entries.forEach(pr => {
    const got = pediaSet.has(pr.id);
    if (got) {
      html += '<div class="pd-card">' +
        '<div class="pd-emoji">' + pr.emoji + '</div>' +
        '<div class="pd-term">' + escHtml(pr.term) + '</div>' +
        '<div class="pd-hint">' + escHtml(pr.hint) + '</div>' +
        (pr.cmd ? '<div class="pd-cmd">$ ' + escHtml(pr.cmd) + '</div>' : '') +
        (pr.cat ? '<span class="pd-cat">' + escHtml(pr.cat) + '</span>' : '') +
      '</div>';
    } else {
      html += '<div class="pd-card locked">' +
        '<div class="pd-emoji">🔒</div>' +
        '<div style="font-size:14px;color:var(--dim);margin-top:8px">？？？</div>' +
        '<div style="font-size:12px;color:var(--dim);margin-top:6px">完成翻牌解锁</div>' +
      '</div>';
    }
  });
  html += '</div>';
  body.innerHTML = html;
}

// =========================================================================
// 10. LEVEL UP CHECK
// =========================================================================
let prevRank = null;

function checkLevelUp() {
  const xp = calcTotalXP();
  const rank = getRank(xp);
  if (prevRank && prevRank.title !== rank.title) {
    playSound('levelup');
    showLevelUp(rank);
  }
  prevRank = rank;
}

function showLevelUp(rank) {
  const overlay = document.getElementById('levelUpOverlay');
  document.getElementById('levelUpRank').textContent = rank.emoji;
  document.getElementById('levelUpLabel').innerHTML = `🏅 ${rank.title}<br><span style="font-size: 14px;color:var(--dim);margin-top:6px;display:inline-block">厂长拍了拍你的肩膀</span>`;
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 3000);
}

// =========================================================================
// 11. TOAST
// =========================================================================

function showWelcomeDialog(msg, done) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--amber);border-radius:8px;padding:24px 32px;max-width:460px;width:90%;box-shadow:0 0 40px rgba(255,176,0,.15)';
  box.innerHTML = `
    <div style="font-size:15px;line-height:1.8;color:var(--text);margin-bottom:20px">${msg}</div>
    <button style="display:block;margin:0 auto;padding:8px 28px;background:var(--amber);color:#000;border:none;border-radius:4px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit">知道了</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('button').onclick = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => { overlay.remove(); if (done) setTimeout(done, 50); }, 300);
    playSound('click');
  };
  playSound('boot');
}

// =========================================================================
// P2 NARRATIVE SYSTEM: Level Entry Dialogue
// =========================================================================
function showLevelIntro(lv, onStart) {
  // Check if already seen this level intro this session
  const seenKey = 'levelIntroSeen_' + lv.id;
  const isReturning = sessionStorage.getItem(seenKey) === 'true';
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--amber);border-radius:8px;padding:0;max-width:520px;width:90%;box-shadow:0 0 60px rgba(255,176,0,.2);overflow:hidden';
  
  const introText = lv.narrative.intro;
  const mood = isReturning ? 'neutral' : 'thinking';
  const moodEmoji = { proud: '😎', stern: '😤', awkward: '😅', thinking: '🤔', neutral: '👨‍💼' }[mood];
  const moodLine = getRandomMoodLine(mood);
  
  box.innerHTML = `
    <div class="director-box director-mood-${mood}" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border);padding:16px 20px">
      <div class="director-portrait">${moodEmoji}</div>
      <div class="director-bubble">
        <div class="director-name">厂长</div>
        <div class="director-mood-line" style="font-size:13px;color:var(--accent);margin-bottom:4px;font-style:italic">${moodLine}</div>
        <div class="director-text" id="levelIntroText" style="font-size:15px;line-height:1.7;color:var(--text)"></div>
      </div>
    </div>
    <div style="padding:16px 20px;text-align:center;border-top:1px solid var(--border);background:rgba(0,0,0,.2)">
      <button id="levelIntroBtn" style="display:block;margin:0 auto;padding:10px 32px;background:var(--amber);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;opacity:0.5" disabled>
        ${isReturning ? '跳过 → 开始任务' : '正在交代任务...'}
      </button>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  const textEl = box.querySelector('#levelIntroText');
  const btn = box.querySelector('#levelIntroBtn');
  
  typewrite(textEl, introText, isReturning ? 5 : 25, () => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = isReturning ? '跳过 → 开始任务' : '收到，开始任务';
    playSound('click');
  });
  
  btn.onclick = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => overlay.remove(), 300);
    playSound('click');
    sessionStorage.setItem(seenKey, 'true');
    if (onStart) onStart();
  };
}

// =========================================================================
// P2 NARRATIVE SYSTEM: Level Complete Dialogue
// =========================================================================
function showLevelComplete(lv, done) {
  const xpEarned = calculateLevelXP(lv.id);
  const totalXP = calcTotalXP();
  const rank = getRank(totalXP);
  const nextRank = RANKS.find(r => r.min > totalXP);
  const maxXP = nextRank ? nextRank.min : 8000;
  const minXP = rank.min;
  const pct = nextRank ? Math.round((totalXP - minXP) / (maxXP - minXP) * 100) : 100;
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--green);border-radius:8px;padding:0;max-width:520px;width:90%;box-shadow:0 0 60px rgba(0,230,118,.25);overflow:hidden;text-align:center';
  
  const moodEmoji = '😎';
  const moodLine = getRandomMoodLine('proud');
  
  box.innerHTML = `
    <div class="director-box director-mood-proud" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border);padding:16px 20px;text-align:left">
      <div class="director-portrait">${moodEmoji}</div>
      <div class="director-bubble">
        <div class="director-name">厂长</div>
        <div class="director-mood-line" style="font-size:13px;color:var(--green);margin-bottom:4px;font-style:italic">${moodLine}</div>
        <div class="director-text" id="levelCompleteText" style="font-size:15px;line-height:1.7;color:var(--text)"></div>
      </div>
    </div>
    <div style="padding:20px;background:rgba(0,230,118,.05);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
      <div style="font-size:14px;color:var(--dim);margin-bottom:8px">本关获得经验</div>
      <div style="font-size:36px;font-weight:bold;color:var(--green);margin-bottom:16px">+${xpEarned} XP</div>
      <div style="font-size:14px;color:var(--dim);margin-bottom:8px">总经验：<span style="color:var(--amber)">${totalXP}</span> / ${maxXP === 8000 ? 'MAX' : maxXP}</div>
      <div style="height:8px;background:#1a1a24;border-radius:4px;overflow:hidden;margin-top:8px">
        <div style="width:${Math.min(pct,100)}%;height:100%;background:linear-gradient(90deg,var(--amber),var(--green));transition:width .8s"></div>
      </div>
      <div style="font-size:13px;color:var(--dim);margin-top:6px">段位：${rank.emoji} ${rank.title} (${Math.min(pct,100)}%)</div>
    </div>
    <div style="padding:16px 20px;text-align:center">
      <button id="levelCompleteBtn" style="display:block;margin:0 auto;padding:10px 32px;background:var(--green);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit">
        返回工厂查看
      </button>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  const textEl = box.querySelector('#levelCompleteText');
  const btn = box.querySelector('#levelCompleteBtn');
  
  const completeText = lv.narrative.complete || '关卡完成，产线又亮了一盏灯。';
  typewrite(textEl, completeText, 25, () => {
    playSound('success');
  });
  
  if (sessionStorage.getItem('mapFlow') === '1') {
    btn.textContent = '🗺️ 回厂区继续';
    btn.onclick = () => { playSound('click'); goMap(); };
  } else {
    btn.onclick = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .3s';
      setTimeout(() => { overlay.remove(); if (done) setTimeout(done, 50); }, 300);
      playSound('click');
    };
  }
}

function calculateLevelXP(levelId) {
  const lv = content.levels.find(l => l.id === levelId);
  if (!lv) return 0;
  let xp = 0;
  lv.tasks.forEach(t => {
    if (gameState.check[taskKey(t.id)]) xp += taskXP(t);
  });
  return xp;
}

// =========================================================================
// P2 NARRATIVE SYSTEM: Task Preface Dialogue
// =========================================================================
function showTaskPreface(task, onStart) {
  const teachText = generateTeach(task);
  const mood = 'thinking';
  const moodEmoji = '🤔';
  const moodLine = getRandomMoodLine(mood);
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:10001;display:flex;align-items:center;justify-content:center';
  
  const box = document.createElement('div');
  box.style.cssText = 'background:#12121a;border:2px solid var(--cyan);border-radius:8px;padding:0;max-width:500px;width:90%;box-shadow:0 0 60px rgba(0,188,212,.2);overflow:hidden';
  
  box.innerHTML = `
    <div class="director-box director-mood-thinking" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border);padding:16px 20px">
      <div class="director-portrait">${moodEmoji}</div>
      <div class="director-bubble">
        <div class="director-name">厂长</div>
        <div class="director-mood-line" style="font-size:13px;color:var(--cyan);margin-bottom:4px;font-style:italic">${moodLine}</div>
        <div class="director-text" id="taskPrefaceText" style="font-size:15px;line-height:1.7;color:var(--text)"></div>
      </div>
    </div>
    <div style="padding:16px 20px;text-align:center;border-top:1px solid var(--border);background:rgba(0,0,0,.2)">
      <button id="taskPrefaceBtn" style="display:block;margin:0 auto;padding:10px 32px;background:var(--cyan);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;opacity:0.5" disabled>
        正在讲解...
      </button>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  const textEl = box.querySelector('#taskPrefaceText');
  const btn = box.querySelector('#taskPrefaceBtn');
  
  typewrite(textEl, teachText, 20, () => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '收到，开始操作';
    playSound('click');
  });
  
  btn.onclick = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => overlay.remove(), 300);
    playSound('click');
    if (onStart) onStart();
  };
  
  return overlay;
}

function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || 'info');
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), 1500);
}

// 🐛 抓虫有奖 - Bug 反馈
function openBugReport(){ document.getElementById('bugOverlay').classList.add('show'); }
function closeBugReport(){ document.getElementById('bugOverlay').classList.remove('show'); document.getElementById('bugErr').textContent=''; }
async function submitBugReport(){
  const loc=document.getElementById('bugLocation').value.trim();
  const content=document.getElementById('bugContent').value.trim();
  const err=document.getElementById('bugErr');
  if(!content){ err.textContent='请描述一下你遇到的问题'; return; }
  const btn=document.getElementById('bugSubmit'); btn.disabled=true; btn.textContent='提交中…';
  const res=await api('/api/student/bug-report',{method:'POST',body:JSON.stringify({location:loc,content})});
  btn.disabled=false; btn.textContent='🐛 提交反馈';
  if(!res || !res.ok){ err.textContent=(res&&res.error)||'提交失败，请重试'; return; }
  closeBugReport(); showToast('🐛 已收到反馈，谢谢！抓虫有奖','success');
}

// =========================================================================
// 12. LOGOUT
// =========================================================================
function hideTransit(){ var t=document.getElementById('transit'); if(t){ setTimeout(function(){ t.classList.remove('show'); }, 150); } }
function goMap(){
  // 从房间进入的任务：返回时直接回房间 room.html?room=xx；否则回厂区地图
  var target='map_proto.html';
  try{ var mr=sessionStorage.getItem('mapRoom'); if(mr) target='room.html?room='+mr; }catch(e){}
  var t=document.getElementById('transit');
  if(t){ var e=document.getElementById('trText'); if(e) e.innerHTML='正在返回 <b>厂区</b>…'; t.classList.add('show'); }
  setTimeout(function(){ location.href=target; }, 500);
}
function logout() {
  sessionStorage.clear();
  var t=document.getElementById('transit');
  if(t){ var e=document.getElementById('trText'); if(e) e.innerHTML='正在退出…'; t.classList.add('show'); }
  setTimeout(function(){ location.href='index.html'; }, 400);
}

// =========================================================================
// 13. INIT
// =========================================================================
async function init() {
  const _urlQ = new URLSearchParams(location.search);
  const _fromMap = !!( _urlQ.get('task') || _urlQ.get('level') || _urlQ.get('open') );
  if (_fromMap) { try { sessionStorage.setItem('mapFlow', '1'); } catch(e){} }
  await loadGameContent();
  if (!content) {
    document.getElementById('missionTitle').textContent = '无法加载游戏内容';
    return;
  }
  await loadState();
  await termCardsPromise;   // 确保小游戏(term-cards)数据就绪后再渲染，一次刷新即稳定显示
  detectNewServerAchievements();
  prevRank = getRank(calcTotalXP());
  renderFactory();
  renderMission();
  renderHeader();
  renderAchBar();
  // 8bit 背景音乐（按场景切换）
  try { if (localStorage.getItem('music_enabled') === '0') musicEnabled = false; } catch(e){}
  const _musicBtn = document.getElementById('musicToggle');
  if (_musicBtn) _musicBtn.textContent = musicEnabled ? '🎵' : '🔕';
  // 按当前进度定位到第一个可进入的幕，播放对应区域背景乐
  const _startLv = content.levels.find(l => l.id === 1 || (l.id > 1 && levelProgress(l.id - 1).completed)) || content.levels[0];
  setArea(_startLv ? _startLv.id : 1);
  playAreaMusic();
  document.addEventListener('pointerdown', function _firstGesture(){
    try { const _c = getAudioCtx(); if (_c && _c.state === 'suspended') _c.resume(); } catch(e){}
    if (musicEnabled && currentTrack && !musicSrc) playMusic(currentTrack);
    document.removeEventListener('pointerdown', _firstGesture);
  });
  // 评估并弹出新解锁成就；异步刷新排行榜后再次评估（捕捉先锋等依赖排行数据的成就）
  evaluateAchievements(true);
  refreshLeaderboard().then(() => evaluateAchievements(true));
  // —— 登录弹窗队列：按顺序一次一个（成就动画→关卡结算→厂长欢迎→改密引导；重复弹窗每天一次）——
  enqueueAchievementsJob();
  if (pendingLevelComplete && !popupShownToday('lv')) {
    markPopupToday('lv');
    enqueueLoginPopup(done => showLevelComplete(pendingLevelComplete, done));
  }
  const isReturning = gameState.check && Object.keys(gameState.check).length > 0;
  const greetLines = isReturning
    ? ['👨‍💼 厂长推门进来：「回来了？上次你修的产线跑得不错。今天还有活，别歇着。」']
    : ['👨‍💼 厂长走过来，递给你工牌：「新来的？我是厂长。你负责把中控室搭起来——装系统、通网络、调链路。我在里面等你。」'];
  if (!popupShownToday('welcome')) {
    markPopupToday('welcome');
    enqueueLoginPopup(done => showWelcomeDialog(greetLines[0], done));
  }
  if (PASSWORD_ENABLED && !gameState.hasPassword && !popupShownToday('pw')) {
    markPopupToday('pw');
    enqueueLoginPopup(done => showPasswordPrompt(done));
  }
}

init().then(() => {
  // —— 从厂区地图跳转：?task=1-0 或 ?level=1 自动定位 ——
  const p = new URLSearchParams(location.search);
  const taskId = p.get('task');
  const levelId = p.get('level');
  const openFeat = p.get('open');
  const backBtn = document.getElementById('backMapBtn');
  if (backBtn && (taskId || levelId || openFeat)) backBtn.style.display = '';
  const _crumbEl = document.getElementById('mapCrumb');
  if (_crumbEl && (taskId || levelId || openFeat)) _crumbEl.style.display = '';
  if (taskId || levelId || openFeat) { try { sessionStorage.setItem('mapFlow', '1'); } catch(e){} }
  // 地图流程（task/level/open）：隐藏旧版关卡页，跳转不闪旧界面
  if (taskId || levelId || openFeat) document.body.classList.add('map-flow');
  if (openFeat) {
    const featMap = { game: openGameZone, pedia: openPedia, leaderboard: openLeaderboard, achievements: openAchievements, wallet: openWallet };
    const fn = featMap[openFeat];
    if (openFeat) _mapFlowFeature = openFeat;
    if (fn) setTimeout(() => { try { fn(); } catch(e){} }, 600);
    setTimeout(() => hideTransit(), 1500);   // 功能浮层打开后淡出过场
  }
  if (taskId || levelId || openFeat) {
    // 顶部面包屑：明确是在厂区地图的任务流
    let crumb = '';
    if (taskId || levelId) {
      const _lv = content.levels.find(l => (taskId ? (l.tasks || []).some(t => String(t.id) === taskId) : String(l.id) === levelId));
      const _t = taskId ? (_lv && _lv.tasks.find(t => String(t.id) === taskId)) : null;
      crumb = '🗺️ 厂区地图 › ' + (_lv ? _lv.areaName : '') + (_t ? ' · ' + _t.title : '');
    } else {
      const _names = { game: '游戏专区', pedia: '术语图鉴', leaderboard: '排行榜', achievements: '成就', wallet: '工资与商城' };
      crumb = '🗺️ 厂区地图 › ' + (_names[openFeat] || '');
    }
    const _bc = document.getElementById('mapCrumb');
    if (_bc) _bc.textContent = crumb;
  }
  if (taskId || levelId) {
    let lv = null;
    if (taskId) lv = content.levels.find(l => (l.tasks || []).some(t => String(t.id) === taskId));
    if (!lv && levelId) lv = content.levels.find(l => String(l.id) === levelId);
    if (lv) {
      const realTask = taskId ? lv.tasks.find(t => String(t.id) === taskId) : null;
      selectLevel(lv.id, !!realTask);
      if (realTask) {
        // 排进登录弹窗队列之后打开：欢迎/改密逐个关完，再进任务前言，避免弹窗轰炸
        enqueueLoginPopup(done => openTaskModal(lv.id, realTask.id, function(){ hideTransit(); done(); }));
      }
    }
  }
});


// ═══════════════════════════════════════════════════════════════════
// ES Module 全局挂载（function + async function + 顶层变量全覆盖）
// 兼容 onclick / window.openXxx 测试调用；后续拆子模块后逐步收敛
// ═══════════════════════════════════════════════════════════════════
Object.assign(window, {
  ACHIEVEMENTS,
  ACH_SEEN_KEY,
  API,
  BG_TRACKS,
  ENEMY_SKIN_COLORS,
  PASSWORD_ENABLED,
  PLANE_SKINS,
  RANKS,
  SHOP_CACHE,
  TY_HINTS,
  _fmtTime,
  _mapFlowFeature,
  _shooterSkipLoadout,
  achDraining,
  achQueue,
  achShowing,
  achievementContext,
  addDirectorBox,
  addTaskItemBar,
  api,
  applyMiniTier,
  areaStars,
  audioCtx,
  bgIdx,
  buildGameZone,
  buildWallet,
  bumpGameStats,
  buyItem,
  calcTotalXP,
  calculateLevelXP,
  checkLevelUp,
  claimSalaryNow,
  closeBugReport,
  closeGameRecords,
  closeGameZone,
  closeLb,
  closeModal,
  closePasswordModal,
  closePedia,
  closeTaskModal,
  closeWallet,
  completeTask,
  content,
  countUnlockedGameTypes,
  currentAreaKey,
  currentLevelId,
  currentTaskId,
  currentTrack,
  detectNewServerAchievements,
  directorMood,
  directorMoodLines,
  drainAchQueue,
  drainLoginPopups,
  dstr,
  enqueueAchievementsJob,
  enqueueLoginPopup,
  equipSkin,
  equippedEnemySkin,
  errors,
  escHtml,
  evaluateAchievements,
  findTaskAnswer,
  focusResultPrimary,
  gameSong,
  gameState,
  generateTeach,
  getAudioCtx,
  getDirectorMood,
  getEquippedSkin,
  getGameStats,
  getInteraction,
  getLevelTasks,
  getMusicSong,
  getPedia,
  getPediaCount,
  getRandomMoodLine,
  getRank,
  getSeenAch,
  getTermLevel,
  glowCorrect,
  goMap,
  gzAfter,
  gzEmoji,
  gzList,
  gzMeta,
  gzName,
  gzPlay,
  hideTransit,
  init,
  interactions,
  isTaskDone,
  lbTab,
  leaderboardCache,
  levelProgress,
  loadGameContent,
  loadKnowledgeTags,
  loadShop,
  loadState,
  loadTermCards,
  loginPopActive,
  loginPopQueue,
  logout,
  markPopupToday,
  markTermWarmupDone,
  miniGames,
  miniMarkClear,
  miniTier,
  miniTierBadge,
  musicEnabled,
  musicGainNode,
  musicSrc,
  myName,
  nextMusic,
  openAchievements,
  openAlarmRush,
  openBoss,
  openBreakout,
  openBugReport,
  openDataRacing,
  openFlappy,
  openForge,
  openGameRecords,
  openGameZone,
  openHacknet,
  openLaser,
  openLeaderboard,
  openLianLian,
  openMatch3,
  openMatchGame,
  openMaze,
  openMemoryMatch,
  openMole,
  openPacman,
  openPasswordModal,
  openPedia,
  openPipe,
  openQuickMatch,
  openShooter,
  openSnake,
  openSorter,
  openStackedMatch,
  openStormDefense,
  openTank,
  openTaskModal,
  openTile2048,
  openTowerDefense,
  openTycoon,
  openTypingDefense,
  openWallet,
  pediaCount,
  pendingLevelComplete,
  playAreaMusic,
  playMusic,
  playSound,
  popupShownToday,
  prevRank,
  recordGameWin,
  refreshGameZone,
  refreshLeaderboard,
  registerInteraction,
  registerMiniGame,
  renderAchBar,
  renderAchievements,
  renderFactory,
  renderGameRecords,
  renderGameZone,
  renderHeader,
  renderLeaderboard,
  renderMission,
  renderPedia,
  renderTypeTerminal,
  renderWallet,
  role,
  saveGameStats,
  savePassword,
  savePedia,
  saveState,
  selectLevel,
  selfTeachTypes,
  setArea,
  setSeenAch,
  shakeScreen,
  shooterBuff,
  showAchievementUnlock,
  showGameTutorial,
  showLevelComplete,
  showLevelIntro,
  showLevelUp,
  showPasswordPrompt,
  showShooterLoadout,
  showTaskHintPopup,
  showTaskPreface,
  showToast,
  showTypingTutorial,
  showWelcomeDialog,
  soundEnabled,
  starStr,
  streak,
  submitBugReport,
  switchLbTab,
  taskKey,
  taskXP,
  termCardsPromise,
  termWarmupDone,
  toggleMusic,
  toggleSound,
  toggleTask,
  token,
  tutMark,
  tutSeen,
  typewrite,
  unlockPedia,
  updateDirectorAvatar,
  useTaskHint,
  useTaskPass,
  walletRank
});
