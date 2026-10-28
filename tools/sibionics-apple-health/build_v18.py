#!/usr/bin/env python3
"""Build v1.8 from pinned v1.5. Contains NO patient data."""
import copy, hashlib, json, os, pathlib, plistlib, subprocess, urllib.request, uuid
PIN='cd8fbf67a40cddaabdffead823ed5ed752c1fcc8'
BASE=f'https://raw.githubusercontent.com/fweiger/test/{PIN}/tools/sibionics-apple-health/'
OUT=pathlib.Path(os.environ.get('OUT_DIR','tools/sibionics-apple-health'))
OUT.mkdir(parents=True,exist_ok=True)
def get(name):
    return urllib.request.urlopen(BASE+name, timeout=25).read().decode('utf-8')
s=get('Sibionics_AppleHealth_OneTap1.5.js')
def replace_once(old,new):
    global s
    assert s.count(old)==1, 'Ambiguous/missing patch: '+old[:60]
    s=s.replace(old,new)
s=s.replace('v1.5','v1.8').replace("SCRIPT_VERSION = '1.5'","SCRIPT_VERSION = '1.8'").replace('SIBIONICS-CGM-V15','SIBIONICS-CGM-V18-MGDL')
s=s.replace("const STATE_FILE = 'sibionics_health_import_v14_state.json';","const STATE_FILE = 'sibionics_health_import_v18_verified_units.json';")
s=s.replace("if(input==='PING-V14')","if(input==='PING-V18')").replace("return 'READY|1.4'","return 'READY|1.8'")
# Legacy receipts can correspond to wrong-unit data. Preserve, never trust them as corrected imports.
start=s.index('    // Do not silently re-import samples')
end=s.index('    return initialState();',start)
s=s[:start]+s[end:]
replace_once('function valueText(x) {', '''const GLUCOSE_MOLAR_MASS = 180.15588000005408;
const MGDL_PER_MMOL = GLUCOSE_MOLAR_MASS / 10;
function writerValue(x) { return String(Number((Number(valueText(x))*MGDL_PER_MMOL).toFixed(8))); }
function verifiedValue(raw,unit) {
  const u=String(unit).trim().toLowerCase().replace(/\\s+/g,'');
  const mg=['mg/dl','毫克/分升','毫克／分升','milligramsperdeciliter','milligramsperdecilitre'];
  const mm=['mmol/l','毫摩尔/升','毫摩爾/升','毫摩尔／升','millimolesperliter','millimolesperlitre'];
  const isMG=mg.includes(u), isMM=mm.includes(u)||/^mmol<180\\.15588[0-9]*>\\/l$/.test(u);
  if(!isMG&&!isMM)fail('写入结果单位无法核验：'+unit+'。停止后续写入。');
  let txt=String(raw).trim().replace(/\\u00a0/g,' ');
  const tail=String(unit).trim();
  if(tail&&txt.toLowerCase().endsWith(tail.toLowerCase()))txt=txt.slice(0,-tail.length).trim();
  if(!/^[+-]?\\d+(?:[.,]\\d+)?(?:e[+-]?\\d+)?$/i.test(txt))fail('写入样本数值无法核验：'+raw);
  const n=Number(txt.replace(',','.'));
  if(!Number.isFinite(n)||n<=0)fail('写入样本数值无效。');
  return isMG?n/MGDL_PER_MMOL:n;
}
function legacyTimes() {
  const out=new Set();
  for(const filename of ['sibionics_health_import_v14_state.json','sibionics_health_imported_v1.json']) {
    const p=fm.joinPath(fm.documentsDirectory(),filename);if(!fm.fileExists(p))continue;
    const old=JSON.parse(fm.readString(p));
    for(const t of Object.keys(old.completed||old.byTime||{}))out.add(t);
    if(old.active&&Array.isArray(old.active.rows))for(const row of old.active.rows)out.add(row[0]);
  }
  return out;
}
function valueText(x) {''')
replace_once("  if(input.startsWith('PRECHECK|'))", """  if(input.startsWith('VERIFY|')) {
    const parts=input.split('\\n');if(parts.length!==3)fail('写入结果回执格式错误。');
    const header=parts[0].slice(7), cut=header.lastIndexOf('|');
    const index=Number(header.slice(cut+1));
    if(cut<0||!Number.isInteger(index)||index<1)fail('写入结果行号错误。');
    return {kind:'verify',token:header.slice(0,cut),index,raw:parts[1],unit:parts[2]};
  }
  if(input.startsWith('PRECHECK|'))""")
replace_once("    batch.status='running';", "    batch.status='running';\n    batch.verifiedCount=0;")
replace_once("SOURCE_UTC_OFFSET+'|'+x[1]", "SOURCE_UTC_OFFSET+'|'+writerValue(x[1])")
replace_once("  if(command.kind==='commit') {", """  if(command.kind==='verify') {
    if(batch.status!=='running'||command.index!==(batch.verifiedCount||0)+1||command.index>batch.rows.length)
      fail('写入结果回执与当前批次不匹配。');
    const expected=Number(batch.rows[command.index-1][1]);
    const actual=verifiedValue(command.raw,command.unit);
    if(Math.abs(actual-expected)>0.005)
      fail('单位校验失败：原始 '+expected+' mmol/L，写入动作返回 '+command.raw+' '+command.unit+'。已停止；不要重复运行。');
    batch.verifiedCount=command.index;
    saveState(s);
    return '已核验 '+command.index+' 条；本条 '+expected+' mmol/L';
  }
  if(command.kind==='commit') {
    if(batch.verifiedCount!==batch.rows.length)fail('尚未逐条核验全部写入结果，不能登记整批完成。');""")
replace_once("  const limit=MAX_PER_BATCH;", """  const oldTimes=legacyTimes();
  const overlap=pending.filter(([t])=>oldTimes.has(t)&&!(s.cleanupConfirmed||{})[t]);
  if(overlap.length) {
    const answer=await alertText('先清理旧版写错的数据',
      '当前文件有 '+overlap.length+' 个时间点被旧版处理过。\\n仅在苹果健康删除对应时间点、由旧快捷指令写错的记录后继续；不要删除其他来源。\\n旧台账会保留，本程序不会删除健康数据。',
      ['对应旧错值已清理，继续按原始文件导入']);
    if(answer!==0){Script.complete();return;}
    if(!s.cleanupConfirmed)s.cleanupConfirmed={};
    for(const [t] of overlap)s.cleanupConfirmed[t]=true;
    saveState(s);
  }
  const limit=MAX_PER_BATCH;""")
replace_once("'\\n'+sample+'\\n时间按 UTC+08:00 解释。", "'\\n'+sample+'\\n源值保持 mmol/L；程序内部换算为 mg/dL 写入，每条写后核对返回样本的数值与单位。\\n时间按 UTC+08:00 解释。")
s=s.replace('// Intentionally reuse v1.4 local state to preserve any prior completed measurements and the stranded 3-row batch.','// Separate corrected-unit state. Old receipts are preserved, not treated as correct imports.')
assert 'fm.move(' not in '\n'.join(x for x in s.splitlines() if not x.lstrip().startswith('//'))
assert 'writerValue(x[1])' in s and 'verifiedCount' in s
(OUT/'Sibionics_AppleHealth_OneTap1.8.js').write_text(s,encoding='utf-8')
# Reuse action syntax already executed on the user iPhone.
builder=get('build_shortcut_v15.py')
ns={}
exec(builder[:builder.index('# Sign with a third-party service')],ns)
w=copy.deepcopy(ns['original']); a=w['WFWorkflowActions']
for item in a:
    params=item['WFWorkflowActionParameters']
    if 'fileName' in params:params['fileName']='Sibionics_AppleHealth_OneTap1.8'
health=a[10]['WFWorkflowActionParameters']; health['WFQuantitySampleQuantity']['Value']['Unit']='mg/dL'
health['WFQuantitySampleAdditionalQuantity']={'WFSerializationType':'WFQuantityFieldValue','Value':{'Unit':'mg/dL'}}
def uid():return str(uuid.uuid4()).upper()
def ref(id_,name):return {'WFSerializationType':'WFTextTokenAttachment','Value':{'OutputUUID':id_,'OutputName':name,'Type':'ActionOutput'}}
def act(id_,p):return {'WFWorkflowActionIdentifier':id_,'WFWorkflowActionParameters':p}
def tokenstr(text,tokens):
    d={};n=0
    for i,ch in enumerate(text):
        if ch=='\ufffc':d['{%d, 1}'%i]=tokens[n];n+=1
    assert n==len(tokens)
    return {'WFSerializationType':'WFTextTokenString','Value':{'string':text,'attachmentsByRange':d}}
hid=health['UUID'];vi=uid();ui=uid();ti=uid()
readvalue=act('is.workflow.actions.properties.health.quantity',{'UUID':vi,'CustomOutputName':'保存值','WFContentItemPropertyName':'Value','WFInput':ref(hid,'Health Sample')})
readunit=act('is.workflow.actions.properties.health.quantity',{'UUID':ui,'CustomOutputName':'保存单位','WFContentItemPropertyName':'Unit','WFInput':ref(hid,'Health Sample')})
cbid=a[0]['WFWorkflowActionParameters']['UUID']
verification=act('is.workflow.actions.gettext',{'UUID':ti,'CustomOutputName':'样本单位核验',
 'WFTextActionText':tokenstr('VERIFY|\ufffc|\ufffc\n\ufffc\n\ufffc',[
  {'Type':'ActionOutput','OutputUUID':cbid,'OutputName':'Clipboard'},
  {'Type':'Variable','VariableName':'Repeat Index'},
  {'Type':'ActionOutput','OutputUUID':vi,'OutputName':'保存值'},
  {'Type':'ActionOutput','OutputUUID':ui,'OutputName':'保存单位'}])})
verifyrun=act('dk.simonbs.Scriptable.ParameterizedRunScriptIntent',{
 'UUID':uid(),'fileName':'Sibionics_AppleHealth_OneTap1.8','parameter':ref(ti,'样本单位核验'),'ShowWhenRun':False,'runInApp':False})
a[11:11]=[readvalue,readunit,verification,verifyrun]
w['WFWorkflowName']='硅基血糖写入v1.8'
assert len(a)==19
assert health['WFQuantitySampleQuantity']['Value']['Unit']=='mg/dL'
assert sum(x['WFWorkflowActionIdentifier']=='is.workflow.actions.health.quantity.log' for x in a)==1
assert all(p['WFWorkflowActionParameters'].get('fileName','Sibionics_AppleHealth_OneTap1.8')=='Sibionics_AppleHealth_OneTap1.8' for p in a)
unsigned=plistlib.dumps(w,fmt=plistlib.FMT_BINARY,sort_keys=False)
(OUT/'Sibionics_v18.source.plist').write_bytes(plistlib.dumps(w,fmt=plistlib.FMT_XML,sort_keys=False))
# Actual-JS boundary tests. This does not emulate the iPhone or prove a HealthKit write.
test='''const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
const cut=src.lastIndexOf('try {await main();}');assert(cut>0);
const store=new Map();const fm={documentsDirectory:()=>'/local',joinPath:(a,b)=>a+'/'+b,fileExists:p=>store.has(p),readString:p=>store.get(p),writeString:(p,s)=>store.set(p,s),isDirectory:()=>false,remove:p=>store.delete(p)};
const c={FileManager:{local:()=>fm},console};vm.createContext(c);
vm.runInContext(src.slice(0,cut)+';globalThis.api={writerValue,verifiedValue,initialState,saveState,loadState,handleCommand,parseCommand};',c);
const f=c.api;for(let i=1;i<=400;i++){const n=i/10;assert(Math.abs(Number(f.writerValue(n))/18.015588000005408-n)<1e-8);}
assert(Math.abs(f.verifiedValue('79.27','mg/dL')-4.4)<0.005);
assert.strictEqual(f.verifiedValue('4.4','mmol/L'),4.4);
assert.strictEqual(f.verifiedValue('4,4','毫摩尔/升'),4.4);
assert.throws(()=>f.verifiedValue('4.4','unknown'));
const token='SIBIONICS-CGM-V18-MGDL|'+('a'.repeat(35));
let state=f.initialState();state.active={token,rows:[['2030-01-01 10:00:00','4.4']],status:'prepared'};f.saveState(state);
const rows=f.handleCommand(f.parseCommand('PRECHECK|'+token));assert(rows.endsWith('|79.2685872'));
assert.throws(()=>f.handleCommand(f.parseCommand('VERIFY|'+token+'|1\\n0.24\\nmmol/L')));
assert.throws(()=>f.handleCommand(f.parseCommand('COMMIT|'+token+'|1')));
f.handleCommand(f.parseCommand('VERIFY|'+token+'|1\\n79.2685872\\nmg/dL'));
f.handleCommand(f.parseCommand('COMMIT|'+token+'|1'));
assert.strictEqual(f.loadState().completed['2030-01-01 10:00:00'],'4.4');
assert.throws(()=>f.handleCommand(f.parseCommand('PRECHECK|'+token)));
console.log('PASS: 400 unit round trips; actual JS verify/reject/commit/replay checks. No iPhone execution.');'''
(OUT/'test_units_v18.cjs').write_text(test)
subprocess.run(['node',str(OUT/'test_units_v18.cjs'),str(OUT/'Sibionics_AppleHealth_OneTap1.8.js')],check=True)
# Only program actions go to the signer, never patient measurements.
boundary='----SibionicsV18'+uuid.uuid4().hex
payload=(('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="Sibionics_v18.shortcut"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+unsigned+('\r\n--'+boundary+'--\r\n').encode())
req=urllib.request.Request('https://sign.shortcuty.app/api/v1/sign',data=payload,headers={'Content-Type':'multipart/form-data; boundary='+boundary},method='POST')
with urllib.request.urlopen(req,timeout=45) as r:signed=r.read()
assert signed.startswith(b'AEA1') and len(signed)>9000
(OUT/'硅基血糖写入v1.8.shortcut').write_bytes(signed)
manifest={'version':'1.8','source_unit':'mmol/L','writer_unit':'mg/dL','factor':180.15588000005408/10,'action_count':len(a),'native_sample_return_checked':True,'actual_iPhone_write_verified':False,'js_sha256':hashlib.sha256(s.encode()).hexdigest(),'shortcut_sha256':hashlib.sha256(signed).hexdigest()}
(OUT/'manifest_v18.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False))
