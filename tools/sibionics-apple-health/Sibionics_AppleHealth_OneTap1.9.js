// SiBionics XLSX -> Apple Health v1.9. New filenames; no same-name replacement.
// Paired native Shortcut: 硅基血糖写入v1.9
// IMPORTANT: input, preview, wire values and ledger remain mmol/L. NO x18 or /18.
// The writer uses HealthKit's glucose-specific unitString, not the display label.
// Immutable matched release: SIBIONICS-19-MMOL-20261028-A.
// Dictionary receipts; pre-write original-value guard; per-sample result validation.
// HealthKit real-device execution has NOT been tested here.
const VERSION = '1.9';
const SHORTCUT_NAME = '硅基血糖写入v1.9';
const PROTOCOL = 'SIBIONICS-CGM-V19';
const BUILD_ID = 'SIBIONICS-19-MMOL-20261028-A';
const EXPECTED_SCRIPT_NAME = 'Sibionics_AppleHealth_OneTap1.9';
const HK_GLUCOSE_MMOL = 'mmol<180.1558800000541>/L';
const MGDL_PER_MMOL = 18.01558800000541; // Read-back conversion only. Never converts outgoing values.
const SOURCE_UTC_OFFSET = '+08:00'; // Exported timestamps have no zone; keep the existing source convention.
const MAX_PER_BATCH = 200;
const fm = FileManager.local();
const statePath = fm.joinPath(fm.documentsDirectory(), 'sibionics_health_mmol_v19.json');
const backupPath = statePath + '.bak';
function fail(message) { throw new Error('硅基血糖 v1.9：'+message); }
function initialState() { return {version:19,unit:HK_GLUCOSE_MMOL,completed:{},active:null}; }
function stateValid(s) {
  return !!s && s.version===19 && s.unit===HK_GLUCOSE_MMOL &&
    !!s.completed && typeof s.completed==='object' && !Array.isArray(s.completed) &&
    Object.prototype.hasOwnProperty.call(s,'active');
}
function loadState() {
  if(!fm.fileExists(statePath)) {
    if(fm.fileExists(backupPath)) fail('主状态缺失但有备份。为避免重复导入，请勿删除或自动恢复台账。');
    return initialState();
  }
  let s; try { s=JSON.parse(fm.readString(statePath)); } catch(e) { fail('状态文件不可读，已停止。'); }
  if(!stateValid(s)) fail('状态版本或单位不匹配。');
  return s;
}
function saveState(s) {
  if(!stateValid(s)) fail('拒绝保存无效状态。');
  s.updatedAt=new Date().toISOString();
  const text=JSON.stringify(s);
  if(fm.fileExists(statePath)) {
    const old=fm.readString(statePath);
    if(!stateValid(JSON.parse(old))) fail('旧状态无效，拒绝覆盖。');
    fm.writeString(backupPath,old);
    if(fm.readString(backupPath)!==old) fail('备份校验失败。');
  }
  // writeString overwrites existing file; move() must NOT be used here.
  fm.writeString(statePath,text);
  if(fm.readString(statePath)!==text) fail('状态写入校验失败。');
}
function newToken() {
  return PROTOCOL+'|'+Date.now().toString(36)+'-'+Array.from({length:6},()=>Math.floor(Math.random()*0x100000000).toString(36)).join('-');
}

function valueText(x) {
  const n=Number(x);
  if(!Number.isFinite(n) || !(n>0 && n<=40)) fail('血糖值不在 (0,40] mmol/L 内：'+x);
  return String(n);
}
function normalizeTime(value) {
  const clean=String(value).trim().replace(/\s+at\s+/i,' ').replace(/[./]/g,'-').replace('T',' ');
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clean);
  if(!m) fail('不支持的日期格式：'+value);
  const y=+m[1],mon=+m[2],d=+m[3],h=+m[4],min=+m[5],sec=+(m[6]||'0');
  const date=new Date(Date.UTC(y,mon-1,d,h,min,sec));
  if(y<2000||y>2100||mon<1||mon>12||h>23||min>59||sec>59||date.getUTCFullYear()!==y||
     date.getUTCMonth()!==mon-1||date.getUTCDate()!==d) fail('无效测量时间：'+value);
  const p=n=>String(n).padStart(2,'0');
  return y+'-'+p(mon)+'-'+p(d)+' '+p(h)+':'+p(min)+':'+p(sec);
}
function xmlUnescape(t) {
  return (t || '').replace(/&(#(?:x[0-9a-fA-F]+|\d+)|amp|lt|gt|quot|apos);/g, (_,x) => {
    if (x === 'amp') return '&';
    if (x === 'lt') return '<';
    if (x === 'gt') return '>';
    if (x === 'quot') return '"';
    if (x === 'apos') return "'";
    if (x.startsWith('#')) return String.fromCodePoint(x[1].toLowerCase() === 'x' ? parseInt(x.slice(2),16) : Number(x.slice(1)));
    return _;
  });
}
// UTF-8 decode without browser-only TextDecoder (Scriptable is JavaScriptCore).
function utf8(bytes) {
  let s='', chunks=[];
  for(let i=0;i<bytes.length;) {
    let b=bytes[i++], c=b;
    if(b<128) { c=b; }
    else if((b&224)===192) { c=((b&31)<<6)|(bytes[i++]&63); }
    else if((b&240)===224) { c=((b&15)<<12)|((bytes[i++]&63)<<6)|(bytes[i++]&63); }
    else if((b&248)===240) { c=((b&7)<<18)|((bytes[i++]&63)<<12)|((bytes[i++]&63)<<6)|(bytes[i++]&63); }
    else fail('文件的 UTF-8 文本编码异常。');
    if(c<=65535) chunks.push(String.fromCharCode(c));
    else { c-=65536; chunks.push(String.fromCharCode(0xD800+(c>>10), 0xDC00+(c&1023))); }
    if(chunks.length>2048) { s+=chunks.join(''); chunks=[]; }
  }
  return s+chunks.join('');
}
// Self-contained RFC1951 DEFLATE decoder. Handles fixed/dynamic Huffman & stored blocks.
function inflateRaw(bytes, targetSize) {
  let bit=0, pos=0;
  if(targetSize > 25*1024*1024) fail('Excel 解压目标超过 25MB 安全上限。');
  const out=new Uint8Array(targetSize);
  function getBits(n) {
    if (bit+n>bytes.length*8) fail('压缩数据不完整。');
    let v=0;
    for(let k=0;k<n;k++,bit++) v|=((bytes[bit>>>3] >>> (bit&7))&1)<<k;
    return v;
  }
  function tree(lengths) {
    const counts=new Array(16).fill(0), next=new Array(16).fill(0), maps=new Array(16);
    for(let i=0;i<16;i++) maps[i]=Object.create(null);
    for(let i=0;i<lengths.length;i++) {const l=lengths[i]; if(l>0) counts[l]++;}
    let code=0;
    for(let n=1;n<=15;n++){code=(code+counts[n-1])*2; next[n]=code;}
    for(let i=0;i<lengths.length;i++){const n=lengths[i];if(n) maps[n][next[n]++]=i;}
    return maps;
  }
  function decode(t) {
    let code=0;
    for(let n=1;n<=15;n++) {
      code=(code<<1)|getBits(1);
      if(Object.prototype.hasOwnProperty.call(t[n],code)) return t[n][code];
    }
    fail('DEFLATE 哈夫曼编码错误。');
  }
  const LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEXTRA=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DEXTRA=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CLORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  let final=false;
  while(!final) {
    final=getBits(1)===1;
    const type=getBits(2);
    if(type===0) {
      bit=(bit+7)&~7;
      const len=getBits(16), nlen=getBits(16);
      if((len^0xFFFF)!==nlen) fail('无压缩区块长度不匹配。');
      for(let i=0;i<len;i++) {if(pos>=out.length) fail('解压长度超出预期。'); out[pos++]=getBits(8);}
      continue;
    }
    let lit,dist;
    if(type===1) {
      const ll=new Array(288);
      for(let i=0;i<288;i++) ll[i]=i<=143?8:i<=255?9:i<=279?7:8;
      lit=tree(ll);dist=tree(new Array(32).fill(5));
    } else if(type===2) {
      const hlit=getBits(5)+257, hdist=getBits(5)+1, hclen=getBits(4)+4;
      const cl=new Array(19).fill(0);
      for(let i=0;i<hclen;i++) cl[CLORDER[i]]=getBits(3);
      const ct=tree(cl), lengths=[];
      while(lengths.length<hlit+hdist) {
        const n=decode(ct);
        if(n<=15) lengths.push(n);
        else if(n===16) {if(!lengths.length) fail('错误的重复编码。');let r=3+getBits(2),prev=lengths[lengths.length-1];while(r--) lengths.push(prev);}
        else if(n===17) {let r=3+getBits(3);while(r--) lengths.push(0);}
        else if(n===18) {let r=11+getBits(7);while(r--) lengths.push(0);}
        if(lengths.length>hlit+hdist) fail('无效的编码长度。');
      }
      lit=tree(lengths.slice(0,hlit));dist=tree(lengths.slice(hlit));
    } else fail('ZIP 内含未知的 DEFLATE 压缩类型。');
    while(true) {
      const s=decode(lit);
      if(s===256) break;
      if(s<=255){if(pos>=out.length) fail('解压长度超出预期。');out[pos++]=s;continue;}
      if(s<257||s>285) fail('错误的长度代码。');
      const idx=s-257, len=LBASE[idx]+getBits(LEXTRA[idx]), ds=decode(dist);
      if(ds>29) fail('错误的距离代码。');
      const gap=DBASE[ds]+getBits(DEXTRA[ds]);
      if(gap>pos||pos+len>out.length) fail('反向复制超出解压范围。');
      for(let i=0;i<len;i++) {out[pos]=out[pos-gap];pos++;}
    }
  }
  if(pos!==targetSize) fail('解压长度和 Excel 文件不一致。');
  return out;
}
// ZIP reader using central-directory offsets (works with XLSX data-descriptors).
function zipFiles(raw, names) {
  const bytes=new Uint8Array(raw), dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=o=>dv.getUint16(o,true),u32=o=>dv.getUint32(o,true);
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-66000);p--) if(u32(p)===0x06054b50){end=p;break;}
  if(end<0) fail('这不是有效的 Excel XLSX ZIP 文件。');
  let at=u32(end+16), count=u16(end+10);
  const targets=new Set(names), result=Object.create(null);
  for(let i=0;i<count;i++) {
    if(u32(at)!==0x02014b50) fail('ZIP 目录损坏。');
    const method=u16(at+10),compressed=u32(at+20),uncompressed=u32(at+24);
    const nameLen=u16(at+28),extraLen=u16(at+30),commentLen=u16(at+32),localAt=u32(at+42);
    const name=utf8(bytes.subarray(at+46,at+46+nameLen));
    if(targets.has(name)) {
      if(u32(localAt)!==0x04034b50) fail('ZIP 文件头损坏。');
      const dataAt=localAt+30+u16(localAt+26)+u16(localAt+28);
      const packed=bytes.subarray(dataAt,dataAt+compressed);
      if(method!==8&&method!==0) fail('暂不支持 Excel 的此种压缩方法。');
      const extracted=method===8?inflateRaw(packed,uncompressed):packed;
      if(extracted.length!==uncompressed) fail('Excel 压缩长度异常。');
      result[name]=utf8(extracted);
    }
    at+=46+nameLen+extraLen+commentLen;
  }
  return result;
}
function getTagText(fragment,tag) {
  const rx=new RegExp('<(?:[\\w-]+:)?'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+tag+'>','g');
  let str='',m;
  while((m=rx.exec(fragment))!==null) str+=xmlUnescape(m[1].replace(/<[^>]*>/g,''));
  return str;
}
function excelDate(n) {
  const v=Number(n);
  if(!Number.isFinite(v)||v<25000||v>100000) fail('不支持的 Excel 时间序列。');
  const d=new Date(Date.UTC(1899,11,30)+Math.round(v*86400000));
  const pad=x=>String(x).padStart(2,'0');
  return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds());
}
// Strict SiBionics template: first sheet, exactly two data columns.
function readXlsx(bytes) {
  const xml=zipFiles(bytes,['xl/worksheets/sheet1.xml','xl/sharedStrings.xml','xl/workbook.xml']);
  const sheet=xml['xl/worksheets/sheet1.xml'];
  if(!sheet) fail('未找到第一张工作表 sheet1.xml。');
  if(xml['xl/workbook.xml'] && /date1904="1"/.test(xml['xl/workbook.xml'])) fail('不支持 1904 Excel 日期系统。');
  const shared=[];
  const stringRx=/<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while((m=stringRx.exec(xml['xl/sharedStrings.xml']||''))) shared.push(getTagText(m[1],'t'));
  const rows=[], rx=/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let lastRow=0, headerFound=false;
  while((m=rx.exec(sheet))) {
    const number=Number(m[1]);
    if(number<=lastRow) fail('Excel 行号重复或逆序：'+number);
    if(number!==lastRow+1) fail('Excel 缺少第 '+(lastRow+1)+' 行，拒绝静默跳过数据。');
    lastRow=number;
    const obj=Object.create(null),cellRx=/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g;
    let cell;
    while((cell=cellRx.exec(m[2]))) {
      const attrs=cell[1],content=cell[2]||'';
      const rc=/\br="([A-Z]+)\d+"/.exec(attrs);if(!rc)continue;
      if(rc[1]!=='A'&&rc[1]!=='B')continue;
      const typeMatch=/\bt="([^"]+)"/.exec(attrs),kind=typeMatch?typeMatch[1]:'';
      const raw=getTagText(content,'v');
      obj[rc[1]]=kind==='s'?shared[Number(raw)] : kind==='inlineStr'?getTagText(content,'t') : raw;
    }
    if(number===1) {
      if(!/血糖时间/.test(String(obj.A||''))||!/血糖值/.test(String(obj.B||'')))
        fail('第一行应为 A列「血糖时间」、B列「血糖值」。');
      headerFound=true; continue;
    }
    if(obj.A===undefined || obj.B===undefined || !String(obj.A).trim() || !String(obj.B).trim())
      fail('Excel 第 '+number+' 行缺少时间或血糖值，禁止跳过。');
    const t=/^\d{4}[/\.\-]/.test(String(obj.A))?String(obj.A):excelDate(obj.A);
    rows.push([t,obj.B]);
  }
  if(!headerFound||!rows.length) fail('Excel 没有有效表头或血糖记录。');
  return rows;
}
function readCsv(input) {
  const text=input.replace(/^\uFEFF/,'');
  const rows=text.trim().split(/\r?\n/).map((line,i)=>line.split(',').map(x=>x.trim()));
  if(rows.length&&rows[0][0]==='血糖时间'&&rows[0][1]==='血糖值')rows.shift();
  for(let i=0;i<rows.length;i++)if(rows[i].length!==2||!rows[i][0]||!rows[i][1])
    fail('CSV 第 '+(i+2)+' 行不是完整的两列数据。');
  return rows;
}
function getRecords(rows) {
  const result=new Map();
  for(let i=0;i<rows.length;i++) {
    const date=normalizeTime(rows[i][0]),value=valueText(rows[i][1]);
    if(result.has(date)) fail('文件内存在重复时间：'+date);
    result.set(date,value);
  }
  if(!result.size) fail('没有血糖记录。');
  return Array.from(result.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
}
function checkGaps(records) {
  const issues=[];
  for(let i=1;i<records.length;i++) {
    const a=Date.parse(records[i-1][0].replace(' ','T')+'Z');
    const b=Date.parse(records[i][0].replace(' ','T')+'Z');
    const min=(b-a)/60000;
    if(min!==5) issues.push(records[i-1][0]+' 至 '+records[i][0]+'：'+min+' 分钟');
  }
  return issues;
}


function validToken(token) {
  if(typeof token!=='string'||!token.startsWith(PROTOCOL+'|')||!/^[-a-z0-9]{30,}$/.test(token.slice(PROTOCOL.length+1))) fail('批次令牌不匹配。');
  return token;
}
function parseCommand(input) {
  if(input===null||input===undefined||input==='')return null;
  // Native Shortcuts Dictionary -> args.shortcutParameter. No pipe/newline framing.
  let c=input;
  if(typeof c==='string') {
    try {c=JSON.parse(c);} catch(_) {fail('收到旧版文本协议；请使用同一安装包中的 v1.9 快捷指令。未执行写入。');}
  }
  if(!c||typeof c!=='object'||Array.isArray(c))fail('回执必须为字典。');
  if(c.build!==BUILD_ID)fail('两端版本不一致；拒绝处理，未开始新的写入。');
  if(!['precheck','guard','verify','commit'].includes(c.cmd))fail('未知回执命令。');
  const out={kind:c.cmd,token:String(c.token||'')};
  if(c.cmd==='precheck' && c.writerUnit!==HK_GLUCOSE_MMOL)
    fail('快捷指令单位配置与本版不一致，拒绝写入。');
  if(c.cmd==='guard'||c.cmd==='verify') {
    out.index=Number(c.index);
    if(!Number.isSafeInteger(out.index)||out.index<1)fail('回执行号无效。');
    if(c.value===undefined||c.unit===undefined)fail('回执缺少值或单位。');
    out.value=c.value;out.unit=c.unit;
  }
  if(c.cmd==='commit') {
    out.count=Number(c.count);
    if(!Number.isSafeInteger(out.count)||out.count<1)fail('回执数量无效。');
  }
  return out;
}
function savedValueInMmol(value,unit) {
  // Unit comes from the saved sample's Unit property, NOT from a constant or the input.
  const u=String(unit).replace(/[\s\u200e\u200f]/g,'').toLowerCase();
  let scale;
  if(/^mmol(?:<180\.15588[0-9]*>)?\/l$/.test(u)||u==='毫摩尔/升'||u==='毫摩爾/升')scale=1;
  else if(u==='mg/dl'||u==='毫克/分升'||u==='毫克/分昇')scale=1/MGDL_PER_MMOL;
  else fail('无法识别已保存样本单位：'+unit+'。已停止后续写入，请核对刚才那条记录。');
  const raw=String(value).trim();
  const m=/^([+-]?\d+(?:[.,]\d+)?)(?:\s+.*)?$/.exec(raw);
  if(!m)fail('无法识别已保存样本的数值：'+value);
  const n=Number(m[1].replace(',','.'));
  if(!Number.isFinite(n)||n<=0)fail('已保存样本数值非法。');
  return n*scale;
}
function handleCommand(c) {
  const token=validToken(c.token),s=loadState(),b=s.active;
  if(!b||b.token!==token||!Array.isArray(b.rows)||!b.rows.length)fail('批次不存在或已完成；拒绝重复写入。');
  if(c.kind==='precheck') {
    if(b.status!=='prepared')fail('这批已经启动。请勿直接重试，以免重复。');
    b.status='running'; b.verified=0; saveState(s);
    // Source mmol/L number is passed unchanged. Correct unit is in the native Shortcut.
    return b.rows.map(([t,v])=>t.replace(' ','T')+SOURCE_UTC_OFFSET+'|'+valueText(v)).join('\n');
  }
  if(b.status!=='running')fail('批次尚未开始写入。');
  if(c.kind==='guard') {
    if(c.index!==b.verified+1||c.index>b.rows.length)fail('写入前行号与本批次不匹配。');
    if(c.unit!==HK_GLUCOSE_MMOL)fail('写入前单位不是本版固定的 mmol/L 单位。');
    const expected=Number(b.rows[c.index-1][1]);
    const raw=String(c.value).trim();
    if(!/^\d+(?:\.\d+)?$/.test(raw))fail('写入前数值不是纯数字。');
    const received=Number(raw);
    if(!Number.isFinite(received)||Math.abs(received-expected)>1e-9)
      fail('写入前拦截：原始 '+expected+' mmol/L，准备写入 '+raw+'。尚未写入本条。');
    // This action output, not an unchecked text column, feeds Log Health Sample.
    return expected;
  }
  if(c.kind==='verify') {
    if(c.index!==b.verified+1||c.index<1||c.index>b.rows.length)fail('写入结果顺序异常。');
    const [time,source]=b.rows[c.index-1],expected=Number(source);
    const actual=savedValueInMmol(c.value,c.unit);
    if(Math.abs(actual-expected)>0.011) {
      b.unitError={index:c.index,expected,returnedValue:c.value,returnedUnit:c.unit};
      saveState(s);
      fail('单位/数值校验失败：原始 '+expected+' mmol/L，写入结果 '+c.value+' '+c.unit+'。已停止后续记录；刚才这一条可能已保存，请在健康中删除该错值。');
    }
    if(Object.prototype.hasOwnProperty.call(s.completed,time)&&s.completed[time]!==source)fail('同一时刻的已完成记录冲突。');
    s.completed[time]=source; b.verified=c.index; saveState(s);
    return 'OK|'+c.index;
  }
  if(c.kind==='commit') {
    if(c.count!==b.rows.length||b.verified!==b.rows.length)fail('未逐条通过单位/数值校验，拒绝登记整批完成。');
    const n=b.rows.length; s.active=null;saveState(s);
    return 'v1.9：本批 '+n+' 条写入动作完成且返回值校验通过。请在苹果健康核对原始时间和 mmol/L 数值。';
  }
  fail('不支持的命令。');
}
async function ask(title,message,options) {
  const a=new Alert();a.title=title;a.message=message;
  options.forEach(x=>a.addAction(x));a.addCancelAction('取消');return await a.presentAlert();
}
function launch(token) {
  Pasteboard.copy(token);
  Safari.open('shortcuts://run-shortcut?name='+encodeURIComponent(SHORTCUT_NAME)+'&input=clipboard');
}
async function main() {
  if(Script.name()!==EXPECTED_SCRIPT_NAME)fail('脚本名称必须为 '+EXPECTED_SCRIPT_NAME+'，不能覆盖或改名为旧版。');
  const input=args.shortcutParameter,c=parseCommand(input);
  if(c){Script.setShortcutOutput(handleCommand(c));Script.complete();return;}
  if(input!==null&&input!==undefined&&input!=='')fail('不支持的输入。');
  let s=loadState();
  if(s.active) {
    const b=s.active;
    if(b.status==='prepared') {
      const n=await ask('v1.9：待导入批次','本批 '+b.rows.length+' 条尚未执行写入。',['继续这一批','取消本批并重新选择']);
      if(n===0){launch(b.token);Script.complete();return;}
      if(n!==1){Script.complete();return;}
      s.active=null;saveState(s);
    } else if(b.status==='running') {
      const n=b.verified||0,remaining=b.rows.length-n;
      if(!remaining){s.active=null;saveState(s);}
      else {
        const first=b.rows[n][0],last=b.rows[b.rows.length-1][0];
        const choice=await ask('v1.9：恢复中断的导入',
          '已核验 '+n+' 条会保留。未核验范围：'+first+' ～ '+last+'。\n其中可能有一条已保存但没回传，程序不能从 JS 判断。请仅在确认此范围没有本次残留样本，或已清理后继续。',
          ['已确认未核验范围无残留，继续']);
        if(choice!==0){Script.complete();return;}
        s.active={token:newToken(),rows:b.rows.slice(n),status:'prepared',verified:0,createdAt:new Date().toISOString()};
        saveState(s);launch(s.active.token);Script.complete();return;
      }
    } else fail('未知批次状态。');
  }
  let path;try {path=await DocumentPicker.openFile();}catch(e){Script.complete();return;}
  if(Array.isArray(path))path=path[0];
  if(!path){Script.complete();return;}
  const data=Data.fromFile(path),name=path.split('/').pop();
  if(!data)fail('无法读取所选文件。');
  let raw;
  if(/\.xlsx$/i.test(name))raw=readXlsx(data.getBytes());
  else if(/\.csv$/i.test(name))raw=readCsv(data.toRawString());
  else fail('请选择原始 XLSX，不要改文件后缀。');
  const all=getRecords(raw),pending=all.filter(([t,v])=>{
    if(!Object.prototype.hasOwnProperty.call(s.completed,t))return true;
    if(s.completed[t]!==v)fail('相同时间的原始数值与本版台账冲突：'+t);
    return false;
  });
  if(!pending.length){await ask('v1.9：无新增记录','本版台账已登记这些记录。',['完成']);Script.complete();return;}
  const rows=pending.slice(0,MAX_PER_BATCH),sample=rows.slice(0,3).map(([t,v])=>t+'  '+v+' mmol/L').join('\n');
  // Old ledgers may contain wrongly-unitized samples. Never treat those receipts as correct imports.
  // This version never deletes or modifies old ledgers or Health data.
  const firstUse=Object.keys(s.completed).length===0;
  const warning=firstUse?'\n旧版零点几及91.88等错值不会被覆盖：重导前必须先删除本文件对应的错误记录；其他正确记录请保留。此版不会自动删除健康数据。\n':'';
  const choice=await ask('硅基血糖 v1.9 · mmol/L 原值写入',
    '解析 '+all.length+' 条，本批 '+rows.length+' 条。原始数值不乘18、不除18。\n'+sample+'\n来源时间 UTC+08:00。'+warning,
    [firstUse?'已清理对应旧错值，确认导入':'确认导入 → 苹果健康']);
  if(choice!==0){Script.complete();return;}
  s=loadState(); if(s.active)fail('已有批次正在处理。');
  for(const [t] of rows)if(Object.prototype.hasOwnProperty.call(s.completed,t))fail('台账已变化，请重选文件。');
  s.active={token:newToken(),rows,status:'prepared',verified:0,createdAt:new Date().toISOString()};
  saveState(s);launch(s.active.token);Script.complete();
}
try {await main();}
catch(e) {
  if(args.shortcutParameter!==null&&args.shortcutParameter!==undefined&&args.shortcutParameter!=='')throw e;
  const a=new Alert();a.title='硅基血糖 v1.9：已停止';a.message=String(e.message||e);a.addAction('确定');await a.presentAlert();Script.complete();
}
