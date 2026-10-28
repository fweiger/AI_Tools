// SiBionics/硅基轻享 XLSX -> Apple Health, Scriptable v1.5 (unique filenames to avoid Safari/iCloud cache)
// Exact pairing: native Shortcuts `硅基血糖写入v1.4`.
// Source file stays on iPhone; ONLY a one-use batch token goes to clipboard.
// The native Shortcut calls PRECHECK before logging any Health samples and
// COMMIT only after ALL HealthKit actions have returned successfully.
// On interrupted/uncertain writes this program FAILS CLOSED; it never retries
// a possibly-written batch automatically (manual Health inspection required).

const SCRIPT_VERSION = '1.5';
const PATCH_VERSION = '1.5'; // New installed script identity; reuse existing v1.4 state safely.
const SHORTCUT_NAME = '硅基血糖写入v1.5';
const PROTOCOL = 'SIBIONICS-CGM-V14';
const FIRST_BATCH = 3;
const MAX_PER_BATCH = 200;
// SiBionics XLSX omits timezone. Source device is treated as mainland China (+08:00).
// This makes HealthKit absolute timestamps consistent when the iPhone travels across timezones.
const SOURCE_UTC_OFFSET = '+08:00';
const STATE_FILE = 'sibionics_health_import_v14_state.json';
const LEGACY_FILE = 'sibionics_health_imported_v1.json';
const fm = FileManager.local();
const statePath = fm.joinPath(fm.documentsDirectory(), STATE_FILE);
const legacyPath = fm.joinPath(fm.documentsDirectory(), LEGACY_FILE);
const stateBackupPath = statePath + '.bak';
const oldTempPath = statePath + '.tmp';
function fail(message) { throw new Error('硅基血糖 v1.4：' + message); }
function initialState() {
  return {version:2, firstBatchComplete:false, completed:{}, active:null};
}
function loadState() {
  if (!fm.fileExists(statePath)) {
    // A partial/failed state write is not a fresh installation. Fail closed.
    if (fm.fileExists(stateBackupPath) || fm.fileExists(oldTempPath))
      fail('主状态文件缺失，但检测到 .bak/.tmp。不能按首次导入处理；请先核对苹果健康。');
    // Do not silently re-import samples that may have been written by the v1.2/v1.3 tool.
    if (fm.fileExists(legacyPath)) {
      let old;
      try { old=JSON.parse(fm.readString(legacyPath)); }
      catch(e) { fail('检测到旧版本台账但无法读取。请先核对苹果健康中已有记录。'); }
      if(old && old.byTime && Object.keys(old.byTime).length)
        fail('检测到旧版本已登记 '+Object.keys(old.byTime).length+' 条。为防重复写入，暂停迁移；请先核对苹果健康。');
    }
    return initialState();
  }
  let s;
  try { s=JSON.parse(fm.readString(statePath)); }
  catch(e) { fail('本地状态文件损坏，已停止自动导入；不得直接重试。'); }
  if (!s || s.version!==2 || typeof s.completed!=='object' || !s.completed ||
      typeof s.firstBatchComplete!=='boolean' || !Object.prototype.hasOwnProperty.call(s,'active'))
    fail('本地状态文件版本或字段异常；已停止自动导入。');
  return s;
}
function saveState(s) {
  s.updatedAt=new Date().toISOString();
  const contents=JSON.stringify(s);
  // iOS actually rejected move(tmp, statePath) when statePath already existed.
  // Use Scriptable's documented overwriting writeString() instead of move().
  // Keep the LAST known good version so an interrupted write can be inspected.
  // Do NOT restore the backup automatically: it may predate HealthKit writes.
  try {
    if (fm.fileExists(statePath)) {
      if (fm.isDirectory(statePath)) fail('状态路径误指向文件夹，停止导入。');
      const previous=fm.readString(statePath);
      // Do not overwrite a valid state or backup with data we cannot parse.
      const parsed=JSON.parse(previous);
      if (!parsed || parsed.version!==2 || typeof parsed.completed!=='object' ||
          typeof parsed.firstBatchComplete!=='boolean' || !('active' in parsed))
        fail('当前状态文件结构异常，拒绝覆盖。');
      fm.writeString(stateBackupPath, previous);
      if (fm.readString(stateBackupPath)!==previous)
        fail('状态备份校验失败，拒绝覆盖主状态。');
    }
    fm.writeString(statePath, contents); // Existing destination is overwritten.
    if (fm.readString(statePath)!==contents)
      fail('状态写入后校验不一致，拒绝继续。');
  } catch (e) {
    fail('状态保存失败，未确认批次状态；禁止继续写入或立即重试。详情：'+String(e.message||e));
  }
  // v1.4 move() failure may have left this orphan. Remove it only after
  // the canonical state file has been successfully verified.
  try {
    if (fm.fileExists(oldTempPath) && !fm.isDirectory(oldTempPath))
      fm.remove(oldTempPath);
  } catch (_) { /* Noncritical cleanup; canonical file is already verified. */ }
}
function newToken() {
  return Date.now().toString(36)+'-'+Array.from({length:6},()=>Math.floor(Math.random()*0x100000000).toString(36).padStart(7,'0')).join('-');
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
    const t=/^\d{4}[/.\-]/.test(String(obj.A))?String(obj.A):excelDate(obj.A);
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
function parseCommand(input) {
  if(typeof input!=='string') return null;
  if(input==='PING-V14') return {kind:'ping'};
  if(input.startsWith('PRECHECK|')) return {kind:'precheck',token:input.slice(9)};
  if(input.startsWith('COMMIT|')) {
    const rest=input.slice(7), cut=rest.lastIndexOf('|');
    if(cut<0) fail('COMMIT 缺少实际执行行数。');
    const n=rest.slice(cut+1);
    if(!/^[1-9]\d*$/.test(n)) fail('COMMIT 的执行行数无效。');
    return {kind:'commit',token:rest.slice(0,cut),processedCount:Number(n)};
  }
  return null;
}
function validateToken(token) {
  if(!token.startsWith(PROTOCOL+'|') || !/^[a-z0-9-]{30,}$/.test(token.slice(PROTOCOL.length+1)))
    fail('批次令牌格式无效或协议不匹配。');
  return token;
}
function handleCommand(command) {
  if(command.kind==='ping')return 'READY|1.4';
  const token=validateToken(command.token), s=loadState();
  if(!s.active || s.active.token!==token)fail('批次不存在、已经完成或被替换；拒绝重复写入。');
  const batch=s.active;
  if(!Array.isArray(batch.rows)||!batch.rows.length)fail('待处理批次为空。');
  if(command.kind==='precheck') {
    if(batch.status!=='prepared')fail('该批次已经启动或状态不明；为防重复写入，禁止再次启动。');
    batch.status='running';
    batch.startedAt=new Date().toISOString();
    saveState(s); // durable lock BEFORE any HealthKit write starts.
    return batch.rows.map(x=>x[0].replace(' ','T')+SOURCE_UTC_OFFSET+'|'+x[1]).join('\n');
  }
  if(command.kind==='commit') {
    if(command.processedCount!==batch.rows.length)
      fail('快捷指令处理行数与批次数量不一致，拒绝登记。');
    if(batch.status!=='running')fail('没有经过 PRECHECK 的批次，不能登记为成功。');
    for(const [time,val] of batch.rows) {
      if(Object.prototype.hasOwnProperty.call(s.completed,time) && s.completed[time]!==val)
        fail('已完成记录与本批次冲突：'+time);
    }
    for(const [time,val] of batch.rows)s.completed[time]=val;
    if(!s.firstBatchComplete)s.firstBatchComplete=true;
    const count=batch.rows.length;
    s.active=null;
    saveState(s);
    return '已登记本批 '+count+' 条；共登记 '+Object.keys(s.completed).length+' 条。请到苹果健康核对。';
  }
  fail('未识别的内部命令。');
}
async function alertText(title,body,buttons) {
  const a=new Alert();a.title=title;a.message=body;
  for(const b of buttons)a.addAction(b);
  a.addCancelAction('取消');
  return await a.presentAlert();
}
async function handleUnfinishedBatch(stage) {
  if(stage.status==='running') {
    const a=new Alert();
    a.title='上次导入状态不明：已停止自动重试';
    a.message='上批 '+stage.rows.length+' 条记录已进入写入流程，但没有完整成功回执。\n为了避免重复写入，本程序不会重试。请核对 Apple 健康中的已有记录后再处理。\n批次：'+stage.token;
    a.addAction('明白');await a.presentAlert();return;
  }
  const choice=await alertText('发现尚未开始的批次',
    '准备写入 '+stage.rows.length+' 条，但快捷指令尚未发回开始确认。\n可以重新打开同一批次，或取消尚未开始的批次。',
    ['重新启动同一批次','取消未开始的批次']);
  if(choice===0) launchShortcut(stage.token);
  if(choice===1) {
    const s=loadState();
    if(s.active && s.active.token===stage.token && s.active.status==='prepared') {
      s.active=null;saveState(s);
    }
  }
}
function launchShortcut(token) {
  Pasteboard.copy(token);
  const url='shortcuts://run-shortcut?name='+encodeURIComponent(SHORTCUT_NAME)+'&input=clipboard';
  Safari.open(url);
}
async function main() {
  const input=args.shortcutParameter;
  const cmd=parseCommand(input);
  if(cmd) {
    const value=handleCommand(cmd);
    Script.setShortcutOutput(value);
    Script.complete();return;
  }
  if(input!==null && input!==undefined && input!=='')fail('不支持的快捷指令入参。');
  const s=loadState();
  if(s.active){await handleUnfinishedBatch(s.active);Script.complete();return;}
  let path;
  try {path=await DocumentPicker.openFile();}
  catch(e) {Script.complete();return;} // user cancelled file chooser
  if(!path) {Script.complete();return;}
  const filename=path.split('/').pop(),bytes=Data.fromFile(path);
  if(!bytes)fail('无法读取 Excel，请把原始 XLSX 保存到 iPhone「文件」App 后重新选择。');
  let raw;
  if(/\.xlsx$/i.test(filename))raw=readXlsx(bytes.getBytes());
  else if(/\.csv$/i.test(filename))raw=readCsv(bytes.toRawString());
  else fail('仅支持原始 .xlsx 或两列 .csv 文件。');
  const all=getRecords(raw), gaps=checkGaps(all);
  const pending=all.filter(([time,val])=>{
    if(!Object.prototype.hasOwnProperty.call(s.completed,time))return true;
    if(s.completed[time]!==val)fail('已写入时间对应的血糖发生变化：'+time);
    return false;
  });
  if(!pending.length){
    const a=new Alert();a.title='没有待导入记录';a.message='已解析 '+all.length+' 条，本地台账均登记完成。';a.addAction('完成');await a.presentAlert();Script.complete();return;
  }
  const limit=s.firstBatchComplete?MAX_PER_BATCH:FIRST_BATCH;
  const rows=pending.slice(0,limit);
  const sample=rows.slice(0,3).map(([t,v])=>t+'  '+v+' mmol/L').join('\n');
  const message='识别 '+all.length+' 条，待导入 '+pending.length+' 条；本批 '+rows.length+' 条。\n'+
    (gaps.length?'注意：检测到 '+gaps.length+' 处非 5 分钟间隔（首处：'+gaps[0]+'）。\n':'')+
    '\n'+sample+'\n时间按 UTC+08:00 解释。\n\n确认后自动启动「'+SHORTCUT_NAME+'」。只有整批写入完成后才登记。';
  const choice=await alertText('硅基血糖 v1.5 · 确认导入',message,['确认导入 → 苹果健康']);
  if(choice!==0){Script.complete();return;}
  // Re-read state before staging to guard re-entry from the action extension.
  const latest=loadState();
  if(latest.active)fail('另一批正在等待处理，拒绝并发提交。');
  for(const [t,v] of rows) if(Object.prototype.hasOwnProperty.call(latest.completed,t))fail('期间发生记录变更，请重新打开。');
  const token=PROTOCOL+'|'+newToken();
  latest.active={token,rows,status:'prepared',createdAt:new Date().toISOString(),sourceName:filename};
  saveState(latest);
  launchShortcut(token); // only token is in clipboard, not patient measurements.
  Script.complete();
}
try {await main();}
catch(e) {
  const msg=String(e && e.message || e);
  if(args.shortcutParameter!==null && args.shortcutParameter!==undefined && args.shortcutParameter!=='') {
    console.error(msg);throw e; // Important: Shortcuts action must fail closed on errors.
  }
  const a=new Alert();a.title='硅基血糖 v1.5：已停止';a.message=msg;a.addAction('确定');await a.presentAlert();
  Script.complete();
}