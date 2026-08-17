// ═══════════════════════════════════════════════════════════════════
// core/cmd-annotate.js — 命令拆解卡片（共享）
//   命令词中文词典 + 自动把命令每个词标注中文，供 install_wizard /
//   diagnosis_tree / terminal 等所有终端交互任务复用
// ═══════════════════════════════════════════════════════════════════
export const COMMAND_ZH = {
  'apt':'包管理工具','update':'更新(拉包列表)','upgrade':'升级','install':'安装','remove':'卸载','&&':'前面成功才执行后面',
  'ip':'网络配置命令','addr':'address·查看地址','ss':'查看端口/连接','-t':'只看TCP','-l':'只看监听','-n':'数字显示(不解析)',
  'grep':'过滤·挑出','|':'管道:前输出给后','traceroute':'追踪路由每跳','iptables':'防火墙','-A':'追加规则','-j':'动作',
  'icmp':'ping用的协议','--icmp-type':'ICMP包类型','echo-request':'请求包','DROP':'丢弃','ACCEPT':'放行',
  'systemctl':'服务管理','status':'查看状态','start':'启动','stop':'停止','restart':'重启','enable':'启用(systemctl=开机自启)',
  'ssh':'远程登录','ls':'列出文件','-la':'-l长格式 -a隐藏文件','curl':'命令行网页工具','modpoll':'Modbus测试工具',
  '-m':'协议(如tcp)','-r':'起始地址','-1':'只读一次','node-red':'Node-RED启动','sudo':'管理员权限','ping':'测连通',
  'pwd':'当前目录','route':'路由表','add':'添加','default':'默认','via':'经由(网关)','show':'显示','list':'列出',
  'rm':'删除','mkdir':'创建目录','cd':'切换目录','cat':'查看文件','echo':'输出文本','bash':'执行脚本','chmod':'改权限',
  'nslookup':'查域名IP','-a':'显示全部/隐藏文件','-p':'参数(随命令:协议/端口/进程)','--help':'帮助','-h':'帮助',
  // 端口/网络工具与补充词条
  'nc':'netcat·端口测试工具','netcat':'nc全称·端口测试','-zv':'-z只扫+-v显示结果','-z':'只扫不传数据','-v':'显示结果',
  'docker':'容器工具','run':'运行容器','ps':'查看进程','head':'看开头几行','wc':'统计','uname':'查看系统信息','hostname':'查看主机名',
  'pip':'Python包管理器','-c':'次数/数量','-d':'指定内容/设备','-s':'大小或静默','-E':'保留$不解析','-I':'只看响应头','-X':'指定请求方法','--version':'查看版本',
  '-tln':'-t TCP -l监听 -n数字','-tlnp':'-tln+进程','INPUT':'入站链','OUTPUT':'出站链','FORWARD':'转发链','tcp':'TCP协议',
  'mosquitto':'MQTT消息服务器','mosquitto_pub':'MQTT发布','mosquitto_sub':'MQTT订阅','mosquitto-clients':'MQTT工具包',
  'ssh-copy-id':'把公钥复制到服务器','ssh-keygen':'生成SSH密钥','openssh-server':'SSH服务端软件包','sshd':'SSH服务',
  'localhost':'本机','openplc':'OpenPLC服务','edge-service':'边缘服务','nodered':'Node-RED','node':'Node.js运行时'
};

export function cmdAnnotate(cmd){
  var tokens = String(cmd).split(/\s+/).filter(Boolean);
  return tokens.map(function(t){
    var zh = COMMAND_ZH[t] || COMMAND_ZH[t.toLowerCase()];
    var esc = String(t).replace(/</g,'&lt;');
    var chip = '<span style="display:inline-flex;flex-direction:column;align-items:center;margin:2px 5px 2px 0;padding:3px 8px;background:#0a0e1c;border:1px solid var(--border);border-radius:4px"><b style="color:var(--green);font-size:14px;font-family:inherit">'+esc+'</b>';
    if (zh) chip += '<i style="font-size:11px;color:var(--amber);font-style:normal;margin-top:1px">'+zh+'</i>';
    return chip + '</span>';
  }).join('');
}

export function cmdAnnotateBox(cmd){
  if (!cmd) return '';
  return '<div style="display:flex;flex-wrap:wrap;gap:2px;margin:10px 0 4px;background:rgba(0,188,212,.04);border:1px dashed rgba(0,188,212,.3);border-radius:6px;padding:8px 10px"><span style="font-size:12px;color:var(--dim);margin-right:8px;align-self:center">📖 命令拆解：</span>' + cmdAnnotate(cmd) + '</div>';
}
