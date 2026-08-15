// ═══════════════════════════════════════════════════════════════════
// core/fx.js — fx 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { playSound } from '../core/sound.js';
import { escHtml } from './utils.js';

export function typewrite(el, text, speed, cb) {
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

export function generateTeach(task) {
  const cfg = task.config;
  const cmd = cfg.command ? (Array.isArray(cfg.command) ? cfg.command[0] : cfg.command) : '';
  const explains = {
    '1-1': 'Ubuntu Server 不装图形界面，这不代表操作受限——你可以坐在服务器前接显示器键盘敲命令，也可以在另一台电脑甚至手机上用 SSH 远程登录。工控工程师经常晚上躺床上拿手机查服务器日志——跟你在王者峡谷操作英雄没什么区别，只不过这次你的英雄是一台 Linux。记住 Shell 是 bash，装软件用 apt install，这些都是你后面每天都要用的基本操作。',
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

export function getRandomMoodLine(mood) {
  var pool = window.directorMoodLines[mood] || window.directorMoodLines.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getDirectorMood(task, context) {
  // context: { window.streak, window.errors, hintUsed, firstTime, wrongCmdType }
  if (!context) return 'neutral';
  
  // 优先级：尴尬(输错类型) > 严肃(连续错/用hint还错) > 得意(连胜/0失误) > 思考(初次/请求hint) > 中性
  if (context.wrongCmdType) return 'awkward';
  if (context.errors >= 2 || (context.hintUsed && context.errors >= 1)) return 'stern';
  if (context.streak >= 3 && context.errors === 0) return 'proud';
  if (context.firstTime || context.hintUsed) return 'thinking';
  return 'neutral';
}

export function addDirectorBox(container, text, cb, mood) {
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

export function shakeScreen() {
  const overlay = document.getElementById('modalOverlay');
  overlay.style.animation = 'none';
  overlay.offsetHeight;
  overlay.style.animation = 'shake 0.3s ease';
  playSound('error');
}

export function glowCorrect(el) {
  el.classList.remove('glow-correct');
  el.offsetHeight;
  el.classList.add('glow-correct');
  playSound('success');
}

// 答错提示：厂长气泡 + 针对所点干扰项的解释，点"知道了，再试一次"回到本题
export function showWrongExplain(container, text, onRetry) {
  const box = document.createElement('div');
  box.className = 'director-box director-mood-thinking';
  box.style.cssText = 'margin-bottom:10px';
  box.innerHTML =
    '<div class="director-portrait">🤔</div>' +
    '<div class="director-bubble">' +
      '<div class="director-name">厂长</div>' +
      '<div class="director-text" style="white-space:pre-wrap;line-height:1.7">' + escHtml(String(text || '想岔了，再想想？').replace(/^厂长[:：]\s*/, '')) + '</div>' +
      '<div style="margin-top:8px;text-align:right"><button class="btn btn-primary">知道了，再试一次</button></div>' +
    '</div>';
  box.querySelector('button').onclick = () => { box.remove(); if (onRetry) onRetry(); };
  container.prepend(box);
  return box;
}
