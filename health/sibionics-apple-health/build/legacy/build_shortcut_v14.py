#!/usr/bin/env python3
"""Build a native iOS Shortcut paired with Scriptable v1.4.

Input: source Blood Glucose Importer native shortcut stored on iCloud.
Uses only code, no patient's XLSX or measurements.
The runner uploading this file does not include patient data.
"""
import copy
import hashlib
import json
import pathlib
import plistlib
import urllib.request
import uuid

ROOT = pathlib.Path('/tmp/sibionics_v14_build')
ROOT.mkdir(parents=True, exist_ok=True)
RECORD = 'https://www.icloud.com/shortcuts/api/records/1d1ca07a917d4b138b61a83d6eb2bd82'
SCRIPT_NAME = 'Sibionics_AppleHealth_OneTap1.4'
SHORTCUT_NAME = '硅基血糖写入v1.4'

def uid():
    return str(uuid.uuid4()).upper()

def ref(id_, name):
    return {'WFSerializationType': 'WFTextTokenAttachment', 'Value': {'OutputUUID': id_, 'OutputName': name, 'Type': 'ActionOutput'}}

def action(identifier, parameters):
    return {'WFWorkflowActionIdentifier': identifier, 'WFWorkflowActionParameters': parameters}

def literal_with_attachment(prefix, id_, name, custom_name):
    p = {
        'UUID': uid(),
        'CustomOutputName': custom_name,
        'WFTextActionText': {'WFSerializationType': 'WFTextTokenString',
                             'Value': {'string': prefix+'\ufffc',
                                       'attachmentsByRange': {f'{{{len(prefix)}, 1}}': {
                                           'OutputUUID': id_, 'OutputName': name, 'Type': 'ActionOutput'}}}}
    }
    return action('is.workflow.actions.gettext', p)

with urllib.request.urlopen(RECORD, timeout=15) as handle:
    info = json.load(handle)
url = info['fields']['shortcut']['value']['downloadURL'].replace(chr(36)+'{f}', 'download')
with urllib.request.urlopen(url, timeout=15) as handle:
    original = plistlib.loads(handle.read())
old = original['WFWorkflowActions']
assert len(old) == 10
assert old[1]['WFWorkflowActionIdentifier'] == 'is.workflow.actions.text.split'
assert old[2]['WFWorkflowActionIdentifier'] == 'is.workflow.actions.repeat.each'
assert old[3]['WFWorkflowActionIdentifier'] == 'is.workflow.actions.text.split'
assert old[5]['WFWorkflowActionIdentifier'] == 'is.workflow.actions.getitemfromlist'
assert old[6]['WFWorkflowActionIdentifier'] == 'is.workflow.actions.getitemfromlist'
assert old[7]['WFWorkflowActionIdentifier'] == 'is.workflow.actions.health.quantity.log'

# STEP 1. Clipboard contains ONLY the opaque single-use token from Scriptable.
cb_uid=uid()
clipboard=action('is.workflow.actions.getclipboard',{'UUID':cb_uid})

# STEP 2. PRECHECK acquires running lock BEFORE any Health write.
pretext=literal_with_attachment('PRECHECK|',cb_uid,'Clipboard','准备批次校验')
pre_uid=pretext['WFWorkflowActionParameters']['UUID']
pre_uid_script=uid()
precall=action('dk.simonbs.Scriptable.ParameterizedRunScriptIntent',{
  'UUID':pre_uid_script,'fileName':SCRIPT_NAME,'parameter':ref(pre_uid,'准备批次校验'),
  'ShowWhenRun':False,'runInApp':False})

# STEP 3. On successful PRECHECK Scriptable returns newline-delimited ISO-8601+08:00 readings.
newline=copy.deepcopy(old[1]);newline_uid=newline['WFWorkflowActionParameters']['UUID']
newline['WFWorkflowActionParameters']['text']=ref(pre_uid_script,'Output')
newline['WFWorkflowActionParameters']['CustomOutputName']='血糖记录列表'
# Capture the exact number of rows delivered by Scriptable; COMMIT validates this count.
count_uid=uid()
count=action('is.workflow.actions.count',{'UUID':count_uid,'WFCountType':'Items',
      'Input':ref(newline_uid,'血糖记录列表'),'WFInput':ref(newline_uid,'血糖记录列表')})
loop=copy.deepcopy(old[2]);loop['WFWorkflowActionParameters']['WFInput']=ref(newline_uid,'血糖记录列表')
sep=copy.deepcopy(old[3]);sep_uid=sep['WFWorkflowActionParameters']['UUID']
sep['WFWorkflowActionParameters']['WFTextSeparator']='Custom'
sep['WFWorkflowActionParameters']['WFTextCustomSeparator']='|'
sep['WFWorkflowActionParameters']['CustomOutputName']='两列数据'
col1=copy.deepcopy(old[5]);col1['WFWorkflowActionParameters']['WFInput']=ref(sep_uid,'两列数据')
col1['WFWorkflowActionParameters']['CustomOutputName']='测量日期文本'
col1_uid=col1['WFWorkflowActionParameters']['UUID']
col2=copy.deepcopy(old[6]);col2['WFWorkflowActionParameters']['WFInput']=ref(sep_uid,'两列数据')
col2_uid=col2['WFWorkflowActionParameters']['UUID']
parsed_uid=uid()
parse_date=action('is.workflow.actions.detect.date',{
   'UUID':parsed_uid,'WFInput':ref(col1_uid,'测量日期文本'),'CustomOutputName':'日期对象'})

# STEP 4. One Apple Health sample for each normalized reading, correct unit and historical timestamp.
health=copy.deepcopy(old[7]); hp=health['WFWorkflowActionParameters']
hp['WFQuantitySampleType']='Blood Glucose'
hp['WFQuantitySampleQuantity']['Value']['Unit']='mmol/L'
hp['WFQuantitySampleQuantity']['Value']['Magnitude']={
    'Type':'ActionOutput','OutputUUID':col2_uid,'OutputName':'Item from List'}
hp['WFQuantitySampleDate']={
    'WFSerializationType':'WFTextTokenString',
    'Value':{'string':'\ufffc','attachmentsByRange':{'{0, 1}':{
        'Type':'ActionOutput','OutputUUID':parsed_uid,'OutputName':'日期对象'}}}}
endloop=copy.deepcopy(old[9]);
assert endloop['WFWorkflowActionParameters']['GroupingIdentifier']==loop['WFWorkflowActionParameters']['GroupingIdentifier']

# STEP 5. Only after entire HealthKit repeat finished (not cancelled/failed), write a batch receipt.
commit_uid=uid()
committext=action('is.workflow.actions.gettext', {
    'UUID':commit_uid,'CustomOutputName':'批次成功回执',
    'WFTextActionText':{'WFSerializationType':'WFTextTokenString','Value':{
       'string':'COMMIT|\ufffc|\ufffc',
       'attachmentsByRange':{
         '{7, 1}':{'OutputUUID':cb_uid,'OutputName':'Clipboard','Type':'ActionOutput'},
         '{9, 1}':{'OutputUUID':count_uid,'OutputName':'Count','Type':'ActionOutput'}
       }
    }}
})
receipt_uid=uid()
receipt=action('dk.simonbs.Scriptable.ParameterizedRunScriptIntent',{
  'UUID':receipt_uid,'fileName':SCRIPT_NAME,
  'parameter':ref(commit_uid,'批次成功回执'),'ShowWhenRun':False,'runInApp':False})
show=action('is.workflow.actions.showresult',{'UUID':uid(),'Text':ref(receipt_uid,'Output')})

acts=[clipboard,pretext,precall,newline,count,loop,sep,col1,col2,parse_date,health,endloop,committext,receipt,show]
original['WFWorkflowActions']=acts
original['WFWorkflowIcon']={'WFWorkflowIconStartColor':4282601983,'WFWorkflowIconGlyphNumber':61696}
original['WFWorkflowImportQuestions']=[]
original['WFWorkflowName']=SHORTCUT_NAME

# Structural QA: all dynamic variables target actions that exist, controls balance.
all_ids=[a['WFWorkflowActionParameters']['UUID'] for a in acts if a['WFWorkflowActionParameters'].get('UUID')]
assert len(set(all_ids))==len(all_ids)
refs=[]
def search(v):
    if isinstance(v, dict):
        if 'OutputUUID' in v:refs.append(v['OutputUUID'])
        for x in v.values():search(x)
    elif isinstance(v,list):
        for x in v:search(x)
search(original)
assert all(x in set(all_ids) for x in refs), sorted(set(refs)-set(all_ids))
assert [a['WFWorkflowActionIdentifier'] for a in acts].count('is.workflow.actions.health.quantity.log')==1
assert [a['WFWorkflowActionIdentifier'] for a in acts].count('dk.simonbs.Scriptable.ParameterizedRunScriptIntent')==2
assert acts[10]['WFWorkflowActionParameters']['WFQuantitySampleQuantity']['Value']['Unit']=='mmol/L'
assert acts[13]['WFWorkflowActionParameters']['fileName']==acts[2]['WFWorkflowActionParameters']['fileName']==SCRIPT_NAME
assert acts[0]['WFWorkflowActionIdentifier']=='is.workflow.actions.getclipboard'
assert len(acts)==15
assert acts[2]['WFWorkflowActionParameters']['parameter']['Value']['OutputUUID']==pre_uid
assert acts[13]['WFWorkflowActionParameters']['parameter']['Value']['OutputUUID']==commit_uid
# No source CGM data goes into a signed shortcut.
for forbidden in ('KVW7X9', '2026/10/27', '2026/10/28', '22:03:00|5.1'):
    assert forbidden not in str(original)

unsigned=plistlib.dumps(original,fmt=plistlib.FMT_BINARY,sort_keys=False)
(ROOT/'Sibionics_v14_writer_unsigned.shortcut').write_bytes(unsigned)
(ROOT/'Sibionics_v14_writer_source.plist').write_bytes(plistlib.dumps(original,fmt=plistlib.FMT_XML,sort_keys=False))

# Sign with a third-party service; only action definitions are sent, not CGM records.
boundary='----SibionicsV14'+uuid.uuid4().hex
payload=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="Sibionics_v14.shortcut"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+unsigned+('\r\n--'+boundary+'--\r\n').encode()
request=urllib.request.Request('https://sign.shortcuty.app/api/v1/sign',data=payload,headers={'Content-Type':'multipart/form-data; boundary='+boundary,'User-Agent':'SiBionics-AppleHealth/1.4'},method='POST')
with urllib.request.urlopen(request,timeout=35) as response:
    signed=response.read()
assert signed[:4]==b'AEA1' and len(signed)>9000
(ROOT/'Sibionics_v14_writer_signed.shortcut').write_bytes(signed)

manifest={'version':'1.4','name':SHORTCUT_NAME,'script':SCRIPT_NAME,'protocol':'SIBIONICS-CGM-V14',
          'action_count':len(acts),'source_time_offset':'+08:00','commit_count_guard':True,
          'signed_size':len(signed),'sha256':hashlib.sha256(signed).hexdigest(),
          'source_contains_private_data':False,'phone_healthkit_validation':False}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))