#!/usr/bin/env python3
"""Build only the native v2.0 core workflow. No HealthKit execution, no network.
The resulting .unsigned.shortcut requires Apple's `shortcuts sign` before iPhone installation.
"""
from pathlib import Path
import json, plistlib, uuid, hashlib
ROOT=Path(__file__).resolve().parent
NAME='硅基血糖写入v2.0简版'
UNIT='mmol<180.1558800000541>/L'
def uid():return str(uuid.uuid4()).upper()
def out(u,n):return {'Type':'ActionOutput','OutputUUID':u,'OutputName':n}
def ref(u,n):return {'WFSerializationType':'WFTextTokenAttachment','Value':out(u,n)}
def action(k,p):return {'WFWorkflowActionIdentifier':k,'WFWorkflowActionParameters':p}
ids=[uid() for _ in range(11)];group=uid()
a=[
 action('is.workflow.actions.getclipboard',{'UUID':ids[0]}),
 action('is.workflow.actions.text.split',{'UUID':ids[1],'text':ref(ids[0],'Clipboard'),'CustomOutputName':'本次文件的血糖记录'}),
 action('is.workflow.actions.count',{'UUID':ids[2],'WFCountType':'Items','Input':ref(ids[1],'本次文件的血糖记录'),'WFInput':ref(ids[1],'本次文件的血糖记录')}),
 action('is.workflow.actions.repeat.each',{'UUID':ids[3],'GroupingIdentifier':group,'WFControlFlowMode':0,'WFInput':ref(ids[1],'本次文件的血糖记录')}),
 action('is.workflow.actions.text.split',{'UUID':ids[4],'WFTextSeparator':'Custom','WFTextCustomSeparator':'|','text':{'WFSerializationType':'WFTextTokenAttachment','Value':{'Type':'Variable','VariableName':'Repeat Item'}},'CustomOutputName':'时间和血糖'}),
 action('is.workflow.actions.getitemfromlist',{'UUID':ids[5],'WFInput':ref(ids[4],'时间和血糖'),'WFItemSpecifier':'Item At Index','WFItemIndex':'1','CustomOutputName':'原始测量时间'}),
 action('is.workflow.actions.getitemfromlist',{'UUID':ids[6],'WFInput':ref(ids[4],'时间和血糖'),'WFItemSpecifier':'Item At Index','WFItemIndex':'2','CustomOutputName':'原始血糖值'}),
 action('is.workflow.actions.detect.date',{'UUID':ids[7],'WFInput':ref(ids[5],'原始测量时间'),'CustomOutputName':'测量日期'}),
 action('is.workflow.actions.health.quantity.log',{
  'UUID':ids[8],'WFQuantitySampleType':'Blood Glucose',
  'WFQuantitySampleQuantity':{'WFSerializationType':'WFQuantityFieldValue','Value':{'Unit':UNIT,'Magnitude':out(ids[6],'原始血糖值')}},
  'WFQuantitySampleAdditionalQuantity':{'WFSerializationType':'WFQuantityFieldValue','Value':{'Unit':UNIT}},
  'WFQuantitySampleDate':{'WFSerializationType':'WFTextTokenString','Value':{'string':'\ufffc','attachmentsByRange':{'{0, 1}':out(ids[7],'测量日期')}}}
 }),
 action('is.workflow.actions.repeat.each',{'UUID':ids[9],'GroupingIdentifier':group,'WFControlFlowMode':2}),
 action('is.workflow.actions.showresult',{'UUID':ids[10],'Text':{'WFSerializationType':'WFTextTokenString','Value':{
  'string':'本次已导入 \ufffc 条血糖记录。\n下次运行 Scriptable 2.0，可从任意文件夹选择新的 Excel。',
  'attachmentsByRange':{'{6, 1}':out(ids[2],'Count')}
 }}})
]
w={'WFWorkflowMinimumClientVersionString':'900','WFWorkflowMinimumClientVersion':900,
   'WFWorkflowClientVersion':'3036.0.7','WFWorkflowIcon':{'WFWorkflowIconStartColor':4282601983,'WFWorkflowIconGlyphNumber':61696},
   'WFWorkflowOutputContentItemClasses':[],'WFWorkflowInputContentItemClasses':['WFStringContentItem'],
   'WFWorkflowHasOutputFallback':False,'WFWorkflowHasShortcutInputVariables':False,
   'WFWorkflowImportQuestions':[],'WFWorkflowTypes':[],'WFQuickActionSurfaces':[],
   'WFWorkflowName':NAME,'WFWorkflowActions':a}
assert len(a)==11
assert not any('Scriptable' in x['WFWorkflowActionIdentifier'] for x in a)
assert not any('properties.health' in x['WFWorkflowActionIdentifier'] for x in a)
references=[]
def scan(v):
 if isinstance(v,dict):
  if 'OutputUUID' in v:references.append(v['OutputUUID'])
  for x in v.values():scan(x)
 elif isinstance(v,list):
  for x in v:scan(x)
scan(a);assert all(x in ids for x in references)
assert a[8]['WFWorkflowActionParameters']['WFQuantitySampleQuantity']['Value']['Unit']==UNIT
assert a[9]['WFWorkflowActionParameters']['WFControlFlowMode']==2
assert a[-1]['WFWorkflowActionIdentifier']=='is.workflow.actions.showresult'
assert 'PRECHECK' not in str(w) and 'COMMIT' not in str(w) and 'VERIFY' not in str(w)
xml=plistlib.dumps(w,fmt=plistlib.FMT_XML,sort_keys=False)
binary=plistlib.dumps(w,fmt=plistlib.FMT_BINARY,sort_keys=False)
(ROOT/'writer20_source.plist').write_bytes(xml)
(ROOT/'Sibionics_Core20.unsigned.shortcut').write_bytes(binary)
print(json.dumps({'name':NAME,'actions':len(a),'unit':UNIT,'callbacks':0,'unsigned_sha256':hashlib.sha256(binary).hexdigest(),'iphone_tested':False},ensure_ascii=False))
