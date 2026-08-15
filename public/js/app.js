// ═══════════════════════════════════════════════════════════════════════
// 学生端主业务（原 student.html 主 script 迁出）
// ES Module：见 docs/架构设计.md
// ═══════════════════════════════════════════════════════════════════════
// BLOCK INDEX
// ═══════════════════════════════════════════════════════════════════════

import { escHtml, dstr, _fmtTime, starStr, taskKey, taskXP } from './core/utils.js';
import { checkLevelUp } from './ui/modals.js';
import { showLevelUp } from './ui/modals.js';
import { showWelcomeDialog } from './ui/modals.js';
import { showLevelIntro } from './ui/modals.js';
import { showLevelComplete } from './ui/modals.js';
import { tutSeen } from './ui/tutorial.js';
import { tutMark } from './ui/tutorial.js';
import { showGameTutorial } from './ui/tutorial.js';
import { showTypingTutorial } from './ui/tutorial.js';
import { showShooterLoadout } from './ui/tutorial.js';
import { loadTermCards } from './ui/gamezone.js';
import { getTermLevel } from './ui/gamezone.js';
import { termWarmupDone } from './ui/gamezone.js';
import { markTermWarmupDone } from './ui/gamezone.js';
import { countUnlockedGameTypes } from './ui/gamezone.js';
import { gzEmoji } from './ui/gamezone.js';
import { gzMeta } from './ui/gamezone.js';
import { gzName } from './ui/gamezone.js';
import { renderGameZone } from './ui/gamezone.js';
import { gzPlay } from './ui/gamezone.js';
import { refreshGameZone } from './ui/gamezone.js';
import { gzAfter } from './ui/gamezone.js';
import { buildGameZone } from './ui/gamezone.js';
import { openGameZone } from './ui/gamezone.js';
import { closeGameZone } from './ui/gamezone.js';
import { loadShop } from './ui/wallet.js';
import { walletRank } from './ui/wallet.js';
import { buildWallet } from './ui/wallet.js';
import { openWallet } from './ui/wallet.js';
import { closeWallet } from './ui/wallet.js';
import { renderWallet } from './ui/wallet.js';
import { claimSalaryNow } from './ui/wallet.js';
import { buyItem } from './ui/wallet.js';
import { getEquippedSkin } from './ui/wallet.js';
import { equippedEnemySkin } from './ui/wallet.js';
import { equipSkin } from './ui/wallet.js';
import { refreshLeaderboard } from './ui/leaderboard.js';
import { openGameRecords } from './ui/leaderboard.js';
import { closeGameRecords } from './ui/leaderboard.js';
import { renderGameRecords } from './ui/leaderboard.js';
import { openLeaderboard } from './ui/leaderboard.js';
import { openAchievements } from './ui/leaderboard.js';
import { closeLb } from './ui/leaderboard.js';
import { switchLbTab } from './ui/leaderboard.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { renderAchievements } from './ui/leaderboard.js';
import { openPasswordModal } from './ui/password.js';
import { closePasswordModal } from './ui/password.js';
import { savePassword } from './ui/password.js';
import { showPasswordPrompt } from './ui/password.js';
import { getPedia } from './ui/pedia.js';
import { savePedia } from './ui/pedia.js';
import { getPediaCount } from './ui/pedia.js';
import { unlockPedia } from './ui/pedia.js';
import { pediaCount } from './ui/pedia.js';
import { openPedia } from './ui/pedia.js';
import { closePedia } from './ui/pedia.js';
import { renderPedia } from './ui/pedia.js';
import { interactions, registerInteraction, getInteraction, miniGames, registerMiniGame } from './core/interactions.js';
import './interactions/terminal.js';
import './interactions/quiz.js';
import './interactions/chain_quiz.js';
import './interactions/fill_blank.js';
import './interactions/progress_bar.js';
import './interactions/install_wizard.js';
import './interactions/scenario_match.js';
import './interactions/sort.js';
import './interactions/code_review.js';
import './interactions/ethics.js';
import './interactions/diagnosis_tree.js';
import './interactions/drag_classify.js';
import './interactions/boss_fight.js';
import './interactions/config_debug.js';
import './interactions/log_forensics.js';
import './interactions/default.js';
import { getAudioCtx, toggleSound, getMusicSong, playMusic, toggleMusic, nextMusic, playSound, loadMusicPref, ensureMusicPlayback, BG_TRACKS, bgIdx, soundEnabled, audioCtx, musicEnabled, currentTrack, musicGainNode, musicSrc } from './core/sound.js';
import { openPacman } from './games/pacman.js';
import { openHacknet } from './games/hack.js';
import { openTycoon } from './games/tyc.js';
import { openLaser } from './games/lzr.js';
import { openBoss } from './games/boss.js';
import { openMemoryMatch } from './games/memory.js';
import { openStackedMatch } from './games/stacked.js';
import { openMatchGame } from './games/match.js';
import { openQuickMatch } from './games/quick.js';
import { openStormDefense } from './games/storm.js';
import { openAlarmRush } from './games/alarm.js';
import { openTypingDefense } from './games/typing.js';
import { openShooter } from './games/shooter.js';
import { openSorter } from './games/sorter.js';
import { openForge } from './games/forge.js';
import { openLianLian } from './games/ll.js';
import { openPipe } from './games/pipe.js';
import { openMatch3 } from './games/m3.js';
import { openTowerDefense } from './games/td.js';
import { openTile2048 } from './games/t48.js';
import { openMaze } from './games/maze.js';
import { openFlappy } from './games/flappy.js';
import { openMole } from './games/mole.js';
import { openSnake } from './games/snake.js';
import { openBreakout } from './games/breakout.js';
import { openTank } from './games/tank.js';
import { openDataRacing } from './games/racing.js';
// 弹窗每日标记（依赖 utils 的 dstr）
function popupShownToday(t){ try{ return localStorage.getItem('popup_day_'+t)===dstr(); }catch(e){ return false; } }


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


function isTaskDone(taskId) {
  return !!gameState.check[taskKey(taskId)];
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



// 📊 我的战绩







// =========================================================================
// 9c. PASSWORD SETTINGS
// =========================================================================



// 登录后未设置密码时的引导提示

// =========================================================================
// 9d. MINI GAMES — memory_match（术语翻牌热身）
// =========================================================================

// 提前发起加载并保存 promise，init 里 await 后再渲染关卡（避免首次刷新小游戏不显示）
const termCardsPromise = loadTermCards();

// 统计当前已解锁的小游戏类型数（按任务块完成判定）
// ===== 游戏专区：解锁后直接选玩 =====
let gzList = [];
let _mapFlowFeature = null;   // 本次由厂区地图 ?open=xxx 进入的功能（关闭时回地图，避免露旧界面）

// 统一结算回调：提示 + 刷新专区列表 & 关卡内嵌小游戏行


// 打开翻牌小游戏（memory_match）

// ===== 小游戏首次引导 =====
// 打字游戏引导：慢速掉一个词→提示打字→打爆→正式开战

// =========================================================================
// 9g. SHOOTER — 数据蜂群 · 保卫工厂（小蜜蜂/Galaxian 风格）
// =========================================================================
let shooterBuff = null;   // 商城道具·本局开局加成
let _shooterSkipLoadout = false;   // 本局已选择“不用道具”，不再弹装备窗







// =========================================================================
// 9x. SORTER — 数据分类大师（传送带分拣）
// 传送带送物品，点下方正确的分类筐归位；点错或溜到尽头掉命，速度越来越快

// =========================================================================
// 9y. FORGE — 数据熔炉（合成大西瓜·数据单位）
// 落下数据单元，同类相撞合成更大的；合成出目标单位即过关，堆满溢出失败

// =========================================================================
// 9z. LIANLIAN — 连连看·对对碰（术语-解释配对，≤2拐弯路径消除）

// =========================================================================
// 9w. PIPE — 管道工·数据通路（旋转管道接通数据流，L7 MQTT）

// =========================================================================
// 9v. MATCH3 — 消消乐·三连车间（同类三连消除，L5 分类）

// =========================================================================
// 9u. TOWER DEFENSE — 车间防线（部署防线拦攻击数据，L1 攻防）
// =========================================================================
// 9u. TOWER DEFENSE — 车间防线（部署防线拦攻击数据，L1 攻防）
// 知识嵌入：每种攻击有弱点，只有"克制它的设备"才能打出高伤害——
// 玩家必须理解"防火墙挡DDoS / IDS抓扫描 / 网关防ARP"才能守住


// =========================================================================
// 9s. MAZE — 数据迷宫·包到彼岸（迷宫寻路 + 知识门）

// =========================================================================
// 9r. HACKNET — 黑客终端·网络溯源（敲命令逐个攻破网络节点）

// =========================================================================
// 9q. TYCOON — 工厂大亨·数据经营（放置经营，ISA-95 逐级解锁）

// =========================================================================
// 9p. LASER — 激光反射·数据路由（放镜子把数据光束反射到目标）

// =========================================================================
// 9o. BOSS SLING — 愤怒的厂长·弹射排障（弹弓射出命令弹砸故障塔）




// 番外：堆叠式多层翻牌（一层层揭开）

// 连线匹配小游戏：左项↔右项配对

// 产线快打（命令快反）：看提示点对命令，计时+连击



// 术语图鉴（收藏）

// =========================================================================
// 10. LEVEL UP CHECK
// =========================================================================
let prevRank = null;



// =========================================================================
// 11. TOAST
// =========================================================================


// =========================================================================
// P2 NARRATIVE SYSTEM: Level Entry Dialogue
// =========================================================================

// =========================================================================
// P2 NARRATIVE SYSTEM: Level Complete Dialogue
// =========================================================================

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
  loadMusicPref();
  const _musicBtn = document.getElementById('musicToggle');
  if (_musicBtn) _musicBtn.textContent = musicEnabled ? '🎵' : '🔕';
  // 按当前进度定位到第一个可进入的幕，播放对应区域背景乐
  const _startLv = content.levels.find(l => l.id === 1 || (l.id > 1 && levelProgress(l.id - 1).completed)) || content.levels[0];
  setArea(_startLv ? _startLv.id : 1);
  playAreaMusic();
  document.addEventListener('pointerdown', function _firstGesture(){
    try { const _c = getAudioCtx(); if (_c && _c.state === 'suspended') _c.resume(); } catch(e){}
    ensureMusicPlayback();
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
// ES Module 全局挂载
//  - 函数 & 常量 → Object.assign 值挂载（onclick / window.openXxx 测试调用）
//  - 可变状态(let/var) → defineProperty getter 挂载（始终反映模块变量当前值，
//    避免 Object.assign 挂在 init() 之前的初始值导致的 stale 问题）
// 后续拆子模块后逐步收敛为"只挂 onclick 需要的"
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
  TY_HINTS,
  _fmtTime,
  achievementContext,
  addDirectorBox,
  addTaskItemBar,
  api,
  applyMiniTier,
  areaStars,
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
  countUnlockedGameTypes,
  detectNewServerAchievements,
  drainAchQueue,
  drainLoginPopups,
  dstr,
  enqueueAchievementsJob,
  enqueueLoginPopup,
  equipSkin,
  equippedEnemySkin,
  escHtml,
  evaluateAchievements,
  findTaskAnswer,
  focusResultPrimary,
  gameSong,
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
  gzMeta,
  gzName,
  gzPlay,
  hideTransit,
  init,
  interactions,
  isTaskDone,
  levelProgress,
  loadGameContent,
  loadKnowledgeTags,
  loadShop,
  loadState,
  loadTermCards,
  logout,
  markPopupToday,
  markTermWarmupDone,
  miniGames,
  miniMarkClear,
  miniTier,
  miniTierBadge,
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
  playAreaMusic,
  playMusic,
  playSound,
  popupShownToday,
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
  setArea,
  setSeenAch,
  shakeScreen,
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
  starStr,
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

Object.defineProperty(window, 'SHOP_CACHE', { get: () => SHOP_CACHE, set: v => { SHOP_CACHE = v; }, configurable: true });
Object.defineProperty(window, '_mapFlowFeature', { get: () => _mapFlowFeature, set: v => { _mapFlowFeature = v; }, configurable: true });
Object.defineProperty(window, '_shooterSkipLoadout', { get: () => _shooterSkipLoadout, set: v => { _shooterSkipLoadout = v; }, configurable: true });
Object.defineProperty(window, 'achDraining', { get: () => achDraining, set: v => { achDraining = v; }, configurable: true });
Object.defineProperty(window, 'achQueue', { get: () => achQueue, set: v => { achQueue = v; }, configurable: true });
Object.defineProperty(window, 'achShowing', { get: () => achShowing, set: v => { achShowing = v; }, configurable: true });
Object.defineProperty(window, 'audioCtx', { get: () => audioCtx, configurable: true });
Object.defineProperty(window, 'bgIdx', { get: () => bgIdx, configurable: true });
Object.defineProperty(window, 'content', { get: () => content, set: v => { content = v; }, configurable: true });
Object.defineProperty(window, 'currentAreaKey', { get: () => currentAreaKey, set: v => { currentAreaKey = v; }, configurable: true });
Object.defineProperty(window, 'currentLevelId', { get: () => currentLevelId, set: v => { currentLevelId = v; }, configurable: true });
Object.defineProperty(window, 'currentTaskId', { get: () => currentTaskId, set: v => { currentTaskId = v; }, configurable: true });
Object.defineProperty(window, 'currentTrack', { get: () => currentTrack, configurable: true });
Object.defineProperty(window, 'directorMood', { get: () => directorMood, set: v => { directorMood = v; }, configurable: true });
Object.defineProperty(window, 'directorMoodLines', { get: () => directorMoodLines, set: v => { directorMoodLines = v; }, configurable: true });
Object.defineProperty(window, 'errors', { get: () => errors, set: v => { errors = v; }, configurable: true });
Object.defineProperty(window, 'gameState', { get: () => gameState, set: v => { gameState = v; }, configurable: true });
Object.defineProperty(window, 'gzList', { get: () => gzList, set: v => { gzList = v; }, configurable: true });
Object.defineProperty(window, 'lbTab', { get: () => lbTab, set: v => { lbTab = v; }, configurable: true });
Object.defineProperty(window, 'leaderboardCache', { get: () => leaderboardCache, set: v => { leaderboardCache = v; }, configurable: true });
Object.defineProperty(window, 'loginPopActive', { get: () => loginPopActive, set: v => { loginPopActive = v; }, configurable: true });
Object.defineProperty(window, 'loginPopQueue', { get: () => loginPopQueue, set: v => { loginPopQueue = v; }, configurable: true });
Object.defineProperty(window, 'musicEnabled', { get: () => musicEnabled, configurable: true });
Object.defineProperty(window, 'musicGainNode', { get: () => musicGainNode, configurable: true });
Object.defineProperty(window, 'musicSrc', { get: () => musicSrc, configurable: true });
Object.defineProperty(window, 'pendingLevelComplete', { get: () => pendingLevelComplete, set: v => { pendingLevelComplete = v; }, configurable: true });
Object.defineProperty(window, 'prevRank', { get: () => prevRank, set: v => { prevRank = v; }, configurable: true });
Object.defineProperty(window, 'selfTeachTypes', { get: () => selfTeachTypes, set: v => { selfTeachTypes = v; }, configurable: true });
Object.defineProperty(window, 'shooterBuff', { get: () => shooterBuff, set: v => { shooterBuff = v; }, configurable: true });
Object.defineProperty(window, 'soundEnabled', { get: () => soundEnabled, configurable: true });
Object.defineProperty(window, 'streak', { get: () => streak, set: v => { streak = v; }, configurable: true });
