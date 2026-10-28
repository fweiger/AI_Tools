// SiBionics Apple Health v2.0 CORE — pick a new file on EVERY run.
// Paired with: 硅基血糖写入v2.0简版.shortcut
// No saved folder, state JSON, history ledger, pending batch, cap, or callback.
// Source, transmitted number and native writer all use glucose mmol/L. No x18 /18.
// Each run writes all valid rows in the chosen file; overlapping files may duplicate records.
// This file contains code only; it contains no user's measurements.
const VERSION = '2.0';
const SHORTCUT_NAME = '硅基血糖写入v2.0简版';
const SOURCE_UTC_OFFSET = '+08:00'; // Source CGM export wall-clock zone; not the iPhone travel zone.
function fail(message) { throw new Error('硅基血糖 v2.0：'+message); }
function valueText(x) {
  const n=Number(x);
  if(!String(x).trim() || !Number.isFinite(n) || n<=0) fail('血糖值必须是有效正数（mmol/L）：'+x);
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
    // Completely empty styled rows are not glucose measurements.
    if(!String(obj.A||'').trim() && !String(obj.B||'').trim()) continue;
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

function prepareFile(filename, data) {
  let raw;
  if(/\.xlsx$/i.test(filename)) raw=readXlsx(data.getBytes());
  else if(/\.csv$/i.test(filename)) raw=readCsv(data.toRawString());
  else fail('请选择硅基轻享导出的 .xlsx 或两列 .csv；不要只修改文件后缀。');
  if(!raw.length) fail('所选文件没有血糖记录。');
  // Validate all input before launching any Health write. No historical lookup or cap.
  return raw.map(([time,value]) =>
    normalizeTime(time).replace(' ','T')+SOURCE_UTC_OFFSET+'|'+valueText(value)
  ).join('\n');
}
async function main() {
  let path;
  try {
    // Fresh system picker every run. Browse to ANY folder and select today's file.
    path=await DocumentPicker.openFile();
  } catch(e) {
    if(/cancel|取消/i.test(String(e && e.message || e))) return;
    throw e;
  }
  if(!path) return;
  const data=Data.fromFile(path);
  if(!data) fail('无法读取所选文件，请确认文件已下载到 iPhone。');
  const output=prepareFile(path.split('/').pop(),data);
  Pasteboard.copy(output); // Newly parsed rows, never a token or old saved batch.
  Safari.open('shortcuts://run-shortcut?name='+encodeURIComponent(SHORTCUT_NAME)+'&input=clipboard');
}
try { await main(); }
catch(e) {
  const a=new Alert();
  a.title='本次未提交导入';
  a.message=String(e && e.message || e);
  a.addAction('确定');
  await a.presentAlert();
}
Script.complete();
