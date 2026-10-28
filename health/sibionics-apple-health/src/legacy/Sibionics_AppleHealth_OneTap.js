// 硅基轻享 / SiBionics CGM -> Apple Health
// iOS Scriptable (free) + Apple Shortcuts (HealthKit write) | v1.2
// Input: untouched XLSX exported from 硅基轻享; optional CSV of datetime,glucose
// Unit: mmol/L. This script NEVER writes to Apple Health; Shortcuts must log each sample.
// No Internet access, external libraries, uploads or unit conversion needed for SiBionics XLSX.
// Two modes: 1) file chooser & prepare records; 2) COMMIT\nrecords mark fully imported samples.

const SCRIPT_VERSION = '1.2';
const HEALTH_SHORTCUT_NAME = '硅基血糖写入'; // Exact name of the one-time Shortcuts HealthKit writer.
const MAX_PER_RUN = 400; // Limit each HealthKit write batch for reliability.
const FIRST_RUN_TEST = 3; // Safe first-run import; after success subsequent runs use up to 400.
const LEDGER_NAME = 'sibionics_health_imported_v1.json';
const fm = FileManager.local();
const ledgerPath = fm.joinPath(fm.documentsDirectory(), LEDGER_NAME);
function fail(message) { throw new Error('血糖导入：' + message); }
function loadLedger() {
  if (!fm.fileExists(ledgerPath)) return {};
  let doc = JSON.parse(fm.readString(ledgerPath));
  if (!doc || doc.version !== 1 || typeof doc.byTime !== 'object') fail('导入记录文件异常。');
  return doc.byTime;
}
function saveLedger(byTime) {
  fm.writeString(ledgerPath, JSON.stringify({version: 1, lastUpdated: new Date().toISOString(), byTime}));
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
function readXlsx(bytes) {
  const xml=zipFiles(bytes,['xl/worksheets/sheet1.xml','xl/sharedStrings.xml','xl/workbook.xml']);
  const sheet=xml['xl/worksheets/sheet1.xml'];
  if(!sheet) fail('未找到工作表 Sheet1，请确认是硅基轻享导出的 Excel。');
  if(xml['xl/workbook.xml'] && /date1904="1"/.test(xml['xl/workbook.xml'])) fail('暂不支持 1904 Excel 日期系统。');
  const shared=[]; let match;
  const sharedXml=xml['xl/sharedStrings.xml']||'';
  const stringRx=/<si\b[^>]*>([\s\S]*?)<\/si>/g;
  while((match=stringRx.exec(sharedXml))) shared.push(getTagText(match[1],'t'));
  const table=[]; const rowRx=/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  while((match=rowRx.exec(sheet))) {
    const obj=Object.create(null);const cellRx=/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g;
    let cell;
    while((cell=cellRx.exec(match[2]))) {
      const attr=cell[1], content=cell[2]||'';
      const rc=/\br="([A-Z]+)\d+"/.exec(attr);if(!rc)continue;
      const type=/\bt="([^"]+)"/.exec(attr);const t=type?type[1]:'';
      const v=getTagText(content,'v');
      if(t==='s') obj[rc[1]]=shared[Number(v)];
      else if(t==='inlineStr') obj[rc[1]]=getTagText(content,'t');
      else obj[rc[1]]=v;
    }
    if(match[1]==='1') {
      if(!/血糖时间/.test(String(obj.A||'')) || !/血糖值/.test(String(obj.B||''))) fail('表头应为 A列「血糖时间」、B列「血糖值」。');
      continue;
    }
    if(obj.A!==undefined && obj.B!==undefined && String(obj.A).trim()) {
      const time=typeof obj.A==='string'&& /^\d{4}[\/.\-]/.test(obj.A)?obj.A:excelDate(obj.A);
      table.push([time,obj.B]);
    }
  }
  return table;
}
function readCsv(input) {
  const str=input.replace(/^\uFEFF/,'');
  const rows=[]; let row=[],v='',quote=false;
  for(let i=0;i<str.length;i++) {
    const ch=str[i];
    if(ch==='"') {if(quote&&str[i+1]==='"'){v+='"';i++;}else quote=!quote;}
    else if(!quote&&ch===','){row.push(v);v='';}
    else if(!quote&&(ch==='\r'||ch==='\n')) {
      if(ch==='\r'&&str[i+1]==='\n') i++;
      row.push(v);if(row.some(x=>x.trim()))rows.push(row);row=[];v='';
    }else v+=ch;
  }
  if(quote) fail('CSV 文件的引号未闭合。');
  row.push(v);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length && /血糖|time|date|timestamp/i.test(rows[0][0])) rows.shift();
  return rows.map(x=>[x[0],x[1]]);
}
function normalizeTime(value) {
  const clean=String(value).trim().replace(/\s+at\s+/i,' ').replace(/[./]/g,'-').replace('T',' ');
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clean);
  if(!m) fail('时间格式无法识别：'+String(value));
  const Y=+m[1],Mo=+m[2],D=+m[3],H=+m[4],Mi=+m[5],S=+(m[6]||'0');
  const x=new Date(Date.UTC(Y,Mo-1,D,H,Mi,S));
  if(x.getUTCFullYear()!==Y||x.getUTCMonth()!==Mo-1||x.getUTCDate()!==D||H>23||Mi>59||S>59) fail('无效的测量时间：'+value);
  const pad=n=>String(n).padStart(2,'0');
  return Y+'-'+pad(Mo)+'-'+pad(D)+' '+pad(H)+':'+pad(Mi)+':'+pad(S);
}
function getRecords(rows,filename) {
  const mgFile=/_mgdL_/i.test(filename); // Only known explicitly labelled mg/dL exports.
  const result=new Map();
  for(let i=0;i<rows.length;i++) {
    const [rawDate,rawValue]=rows[i];
    if(!String(rawDate||'').trim()&&!String(rawValue||'').trim()) continue;
    const time=normalizeTime(rawDate); const raw=Number(String(rawValue).trim());
    if(!Number.isFinite(raw)) fail('第 '+(i+2)+' 行血糖不是数字。');
    const value=mgFile?Number((raw/18.0182).toFixed(2)):raw;
    if(value<=0||value>40) fail('第 '+(i+2)+' 行血糖数值异常（可能单位不是 mmol/L）。');
    const v=String(value);
    if(result.has(time) && result.get(time)!==v) fail('同一时刻存在不同的血糖值：'+time);
    result.set(time,v);
  }
  if(!result.size) fail('没有找到血糖数据。');
  return [...result].sort((a,b)=>a[0].localeCompare(b[0]));
}
async function showStandalonePreview(name, totalCount, pendingCount, selection) {
  const preview = selection.slice(0,3).map(([t,v])=>t+'  '+v+' mmol/L').join('\n');
  const alert = new Alert();
  alert.title = selection.length ? '血糖文件解析成功' : '没有新的血糖记录';
  alert.message = '文件：'+name+'\n识别记录：'+totalCount+' 条\n尚未登记：'+pendingCount+' 条'
    +(selection.length ? '\n本批可交给快捷指令：'+selection.length+' 条\n\n样例：\n'+preview : '\n这些记录已登记，不会重复导入。')
    +'\n\n注意：Scriptable 本身不能写入苹果健康，选择写入后将打开苹果快捷指令。';
  if (selection.length) {
    alert.addAction('调用苹果健康写入');
    alert.addAction('仅预览，不写入');
    alert.addCancelAction('取消');
    return (await alert.presentAlert()) === 0;
  }
  alert.addAction('确定');
  await alert.presentAlert();
  return false;
}
async function main() {
  const input=args.shortcutParameter;
  const standalone = input===undefined || input===null || input==='';
  if(typeof input==='string' && input.startsWith('COMMIT\n')) {
    const rows=input.slice(7).trim().split(/\r?\n/).filter(Boolean);
    const ledger=loadLedger();
    for(const row of rows) {
      const sp=row.lastIndexOf('|'); if(sp<0) fail('完成记录格式错误。');
      const time=normalizeTime(row.slice(0,sp));const value=Number(row.slice(sp+1));
      if(!(value>0 && value<=40)) fail('完成记录血糖值非法。');
      const val=String(value);
      if(ledger[time] && ledger[time]!==val) fail('重复时间的数值冲突：'+time);
      ledger[time]=val;
    }
    saveLedger(ledger);
    Script.setShortcutOutput('已登记 '+rows.length+' 条，后续重复导入会跳过。');
    Script.complete();return;
  }
  // In Shortcuts: Select File -> Scriptable / Run Script, set Input = Selected File.
  // Scriptable receives a binary XLSX as a path, and may pass CSV as text.
  // Standalone fallback: use Scriptable's own Files picker.
  let sourceArg = typeof input==='string' && input.length ? input : null;
  if(!sourceArg) sourceArg=await DocumentPicker.openFile();
  let name, rows;
  if(/^\s*\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}/.test(sourceArg) || /^\s*血糖时间[,\r\n]/.test(sourceArg)) {
    name='selected.csv';
    rows=readCsv(sourceArg);
  } else {
    const file=sourceArg;
    name=file.split('/').pop();
    const data=Data.fromFile(file);
    if(!data) fail('无法读取所选文件。请在快捷指令中将“选择文件”的结果传入“运行脚本”的输入。');
    if(/\.xlsx$/i.test(name)) rows=readXlsx(data.getBytes());
    else if(/\.csv$/i.test(name)) rows=readCsv(data.toRawString());
    else fail('请选择硅基轻享导出的 .xlsx 或两列血糖 .csv。');
  }
  const ledger=loadLedger();const all=getRecords(rows,name);
  const pending=all.filter(([t,v])=>{
    if(!Object.prototype.hasOwnProperty.call(ledger,t))return true;
    if(ledger[t]!==v)fail('历史已导入数据发生变化：'+t+'（已导入 '+ledger[t+'']+'，新值 '+v+'）');
    return false;
  });
  const selected=pending.slice(0, fm.fileExists(ledgerPath)?MAX_PER_RUN:FIRST_RUN_TEST);
  // ISO-style local wall time: Shortcuts must interpret this text as LOCAL date, not UTC.
  const output = selected.map(([t,v])=>t+'|'+v).join('\n');
  if(standalone) {
    const doImport=await showStandalonePreview(name, all.length, pending.length, selected);
    if(doImport && selected.length) {
      // The text is passed only on device via clipboard. No network uploads.
      // Apple officially supports launching a Shortcut with clipboard input.
      Pasteboard.copy(output);
      Safari.open('shortcuts://run-shortcut?name='+encodeURIComponent(HEALTH_SHORTCUT_NAME)+'&input=clipboard');
    }
    Script.complete();return;
  }
  if(selected.length===0) {Script.setShortcutOutput('EMPTY');Script.complete();return;}
  Script.setShortcutOutput(output);
  Script.complete();
}
try {await main();} catch(e) {
  // Do not proceed to the Shortcut's HealthKit loop after parser errors.
  const a=new Alert();a.title='硅基轻享导入失败';a.message=String(e.message||e);a.addCancelAction('确定');await a.presentAlert();
  throw e;
}