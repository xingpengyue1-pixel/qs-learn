/* 同一识别器用于浏览器预览与后台；不发起网络请求。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiaryParser=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='2.2.0';
const PROJECTS=['呼市移动','果然好酒','公司职能','其他待归类'];
const round=n=>Math.round(n*10000)/10000;
function validDate(y,m,d){const t=new Date(Date.UTC(y,m-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;}
function dateValue(s){const m=s.trim().replace(/\\\s*$/,'').trim().match(/^(20\d{2})(?:[.\/-](\d{1,2})[.\/-](\d{1,2})|(\d{2})(\d{2}))$/);if(!m)return null;const y=+m[1],mo=+(m[2]||m[4]),d=+(m[3]||m[5]);return {raw:s,date:validDate(y,mo,d)?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null,year:y,month:mo,day:d};}
function category(s){
 if(/助播/.test(s))return '助播';
 if(/调试|开.*直播间|直播间.*准备/.test(s))return '直播准备';
 if(/培训|测试|教学|学习/.test(s))return '培训学习';
 if(/文案|剪辑|拍摄|贴片|小红书|视频选题|设计/.test(s))return '内容制作';
 if(/发票|工资|补助|绩效表|绩效优化|快递|招聘|直聘|试岗|入职/.test(s))return '行政人事';
 if(/定稿|合作|合同|需求|项目.*沟通|对接|方案/.test(s))return '项目推进';
 if(/直播/.test(s)&&!/数据|截图|贴片|调试|方案|准备|培训|学习|沟通|基地|计划|合同|开.*直播间/.test(s))return '直播';
 if(/电话|客户|留资|派单|评论|门店|资质|账号|办卡|福袋|数据/.test(s))return '运营服务';
 return '一般工作';
}
function project(s){
 const matches=[];for(const [n,re] of [['呼市移动',/呼市移动|呼和浩特移动|移动大号|呼分/g],['果然好酒',/果然好酒/g]]){for(const m of s.matchAll(re))matches.push({name:n,at:m.index});}
 if(matches.length){const uniq=[...new Set(matches.map(m=>m.name))];return {name:matches.sort((a,b)=>b.at-a.at)[0].name,explicit:true,multiple:uniq.length>1};}
 if(/快递|发票|工资|补助|绩效|直聘|招聘|试岗|入职|高德电话/.test(s))return {name:'公司职能',explicit:false,multiple:false};
 return {name:'其他待归类',explicit:false,multiple:false};
}
function chineseNumber(s){if(/^\d/.test(s))return +s;const nums={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(s==='十')return 10;if(s.includes('十')){const [a,b]=s.split('十');return (a?nums[a]:1)*10+(b?nums[b]:0);}return nums[s];}
function parseItem(line,index){
 const text=line.replace(/^\s*\d{1,2}\s*\\?[.、．]\s*/,'').trim();const flags=[];
 if(/-\s*\d+(?:\.\d+)?\s*(?:小时|[hH])/.test(text))flags.push('工时不能为负数，请修正原文');
 if(/(?:\d+(?:\.\d+)?[eE][+-]?\d+|\d+[:：]\d+|[一二三四五六七八九十]+|\d+\s*[-~～至]\s*\d+)\s*(?:小时|分钟|[hHmM])/.test(text))flags.push('工时格式暂不支持，请改为明确的小时或分钟数，请修正原文');
 if(/-\s*(?:\d+(?:\.\d+)?\s*(?:分钟|[mM](?:in)?)|半小时)/.test(text))flags.push('工时不能为负数，请修正原文');
 const duration=/(\d+(?:\.\d+)?)\s*(?:小时|[hH](?![a-zA-Z]))(?:\s*(?:(\d+(?:\.\d+)?)\s*(?:分钟|[mM](?:in)?(?![a-zA-Z]))|(半)))?|半小时|(\d+(?:\.\d+)?)\s*(?:分钟|[mM](?:in)?(?![a-zA-Z]))/g;
 const hours=[...text.matchAll(duration)].map(m=>({value:round(m[1]!==undefined?+m[1]+(m[2]?+m[2]/60:0)+(m[3]?0.5:0):m[4]!==undefined?+m[4]/60:0.5),at:m.index,end:m.index+m[0].length,ignore:false}));
 for(let i=0;i<hours.length;i++){
  const h=hours[i],prefix=text.slice(0,h.at);
  if(/(?:共|合计|总计)\s*$/.test(prefix)&&hours.length>1){h.ignore=true;h.aggregate=true;}
  if(i&&/^\s*$/.test(text.slice(hours[i-1].end,h.at))&&hours[i-1].value===h.value){h.ignore=true;h.duplicate=true;}
 }
 const last=hours[hours.length-1];
 if(last&&hours.length>1&&/[（(]\s*$/.test(text.slice(0,last.at))&&/^[）)]?\s*$/.test(text.slice(last.end))){
  const others=hours.slice(0,-1).filter(h=>!h.ignore),sum=round(others.reduce((a,h)=>a+h.value,0));
  if(others.length){last.ignore=true;last.aggregate=true;if(sum!==last.value)flags.push('括号总工时与分项不符，请修正原文');}
 }
 const core=hours.filter(h=>!h.ignore);const total=core.length?round(core.reduce((a,h)=>a+h.value,0)):null;
 for(const h of hours.filter(h=>h.aggregate))if(total!==null&&h.value!==total)flags.push('合计工时与分项不符，请修正原文');
 if(total!==null&&(total<0||total>24))flags.push('单项工时超出0至24小时，请核对');
 if(total===null)flags.push('未填写工时');
 const segments=[];let start=0;
 for(const h of core){const context=text.slice(start,h.at).replace(/^[，,、；;\s]+/,'').replace(/[（(]\s*$/,'');let pr=project(context);const cat=category(context||text);let metric=null;
  if(pr.multiple&&core.length===1){pr={name:'其他待归类',explicit:false,multiple:true};flags.push('多个项目共用一段工时，需拆分后再提交');}
  const planned=/^(?:明天|明日|明早|计划|预计|准备于|下周)/.test(context.trim());
  if(cat==='直播'&&!planned)metric={name:'直播小时',value:h.value};
  segments.push({number:segments.length+1,context:context||text,project:pr.name,project_basis:pr.explicit?'原文明确':pr.name==='公司职能'?'按事项性质归类':'待本人补充',hours:h.value,category:cat,planned,metric});start=h.end;
 }
 if(!segments.length){const pr=project(text);segments.push({number:1,context:text,project:pr.name,project_basis:pr.explicit?'原文明确':pr.name==='公司职能'?'按事项性质归类':'待本人补充',hours:null,category:category(text),planned:/^(?:明天|明日|计划|预计|下周)/.test(text),metric:null});}
 const progress=[...text.matchAll(/(?:完成|进度)\s*(\d+(?:\.\d+)?)\s*[%％]/g)].map(m=>+m[1]);if(progress.some(p=>p<0||p>100))flags.push('进度百分比超出范围');
 const quantities=[...text.matchAll(/(\d+(?:\.\d+)?|[零一二两三四五六七八九十]{1,3})\s*(人|条|家|张|个|份|项|单|户|场|件)(?!小时)/g)].map(m=>({value:chineseNumber(m[1]),unit:m[2],context:text.slice(Math.max(0,m.index-14),m.index+m[0].length)})).filter(q=>Number.isFinite(q.value));
 const planned=segments.every(x=>x.planned);if(planned)flags.push('后续计划不计入当日实际工时');
 if(/明天|明日|明早|三日内|下周/.test(text)&&!planned)flags.push('含后续计划，付款或发送等动作尚不能视为已完成');
 return {number:index,raw:line,text,category:category(text),hours:total,actual_hours:segments.some(s=>!s.planned&&s.hours!==null)?round(segments.filter(s=>!s.planned&&s.hours!==null).reduce((a,s)=>a+s.hours,0)):null,segments,quantities,progress:progress.length?progress[0]:null,status:planned?'后续计划':progress.some(n=>n<100)?'进行中':'申报完成，待核验',flags:[...new Set(flags)]};
}
function parse(raw,options={}){
 raw=String(raw||'').replace(/\r\n?/g,'\n');const today=options.today||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);const dates=lines.map(dateValue).filter(Boolean);const harvestCount=lines.filter(x=>/^今日收获/.test(x)).length;const multi=dates.length>1||harvestCount>1;const detected=dates[0]||null;let date=detected?.date||(options.defaultDate===undefined?today:options.defaultDate);const flags=[];let dateIssue='';
 if(multi)flags.push('检测到多份日报，请按本人、每天分别提交');
 if(detected&&!detected.date){date=null;dateIssue='原文日期无效，请核对日期';}
 if(!detected&&!date){dateIssue='原文及提交日期缺失，请本人指定日期';}
 if(date&&date>today){dateIssue='原文日期晚于今天，请本人确认正确日期';date=null;}
 if(options.date){const d=dateValue(options.date);if(!d?.date||d.date>today){dateIssue='指定日期无效或晚于今天';date=null;}else{date=d.date;dateIssue='';}}
 let harvesting=false;const harvest=[];const work=[];
 for(const line of lines){
  if(dateValue(line))continue;
  if(/^今日收获/.test(line)){harvesting=true;const a=line.replace(/^今日收获\s*[:：，,]?\s*/,'');if(a)harvest.push(a);continue;}
  if(/^工作总结\s*[:：]?\s*$/.test(line)){harvesting=false;continue;}
  if(/^【系统验收/.test(line))continue;
  if(harvesting){harvest.push(line);continue;}
  if(/^\d{1,2}\s*\\?[.、．]/.test(line)||/小时|分钟|\d\s*[hHmM]\b/.test(line))work.push(line);
  else if(work.length)work[work.length-1]+=' '+line;
  else if(line)flags.push('未归入工作事项：'+line.slice(0,35));
 }
 const items=work.map((s,i)=>parseItem(s,i+1));const overrides={};
 for(const line of String(options.projects||'').split('\n')){const m=line.match(/^事项(\d+)\.(\d+)\s*[:：]\s*(.+?)\s*$/);if(m&&PROJECTS.includes(m[3]))overrides[m[1]+'.'+m[2]]=m[3];}
 for(const item of items)for(const seg of item.segments){const key=item.number+'.'+seg.number;if(overrides[key]){seg.project=overrides[key];seg.project_basis='本人选择';}}
 const known=items.filter(i=>i.actual_hours!==null);const total=known.length?round(known.reduce((a,i)=>a+i.actual_hours,0)):null;
 if(total!==null&&total>24)flags.push('当日申报总工时超过24小时，请核对');
 if(!items.length)flags.push('没有识别到工作事项');
 if(dateIssue)flags.push(dateIssue);
 const unknown=items.flatMap(i=>i.segments.filter(s=>s.project==='其他待归类').map(s=>`事项${i.number}.${s.number}`));
 const result={version:VERSION,date,date_raw:detected?.raw||null,date_basis:options.date?'本人指定':detected?'原文日期':'原文无日期，采用提交当天',date_issue:dateIssue,multiple_reports:multi,items,harvest:harvest.join('\n'),total_hours:total,missing_hours:items.filter(i=>i.hours===null).length,unassigned:unknown,flags:[...new Set(flags)],test_mode:options.testMode===true};result.alerts=timeAlerts(result);return result;
}

// R12、R4、重复事项是本应用试点规则，不是行业劳动定额。
const TIME_RULES={dailyStandard:8,dailyPriority:12,longItem:4,weeklyStandard:40,weeklyHealth:55};
function timeAlerts(p){
 const a=[];const add=(code,level,message,basis,action,item=null)=>a.push({code,level,message,basis,action,item});
 const all=p.flags.concat(p.items.flatMap(i=>i.flags));
 if(all.some(s=>/超过24|超出0至24|不能为负|工时与分项不符|工时格式暂不支持/.test(s)))add('R01','红色需修正','存在非法工时或分项与合计冲突','数值与算术校验','修正原文后重新识别；修正前不计入汇总');
 if(p.total_hours!==null&&p.total_hours<=24){
  if(p.total_hours>TIME_RULES.dailyPriority)add('R12','橙色重点核对','当日申报'+p.total_hours+'小时，超过12小时试点提醒线','本应用试点阈值，不是法定时限','核对休息、等待、并行及跨日任务，补充起止时间或安排说明');
  else if(p.total_hours>TIME_RULES.dailyStandard)add('R08','黄色提示','当日申报'+p.total_hours+'小时，超过8小时标准工时参照','CN8：每日8小时标准工时；适用制度须核对','说明加班、值守、出差等情况，由负责人核对工作安排');
 }
 const seen=new Map();
 for(const i of p.items){
  if(i.hours===null&&!i.segments.every(s=>s.planned))add('R02','黄色提示','事项'+i.number+'未填写工时','原文缺失，不补0','有实际投入请补时长；确实未统计可说明',i.number);
  if(i.actual_hours===0&&i.quantities.some(q=>q.value>0))add('R03','黄色提示','事项'+i.number+'有成果数量但工时为0','数量与工时组合核对','核对是否批量导入、自动化处理或工时漏记',i.number);
  if(i.actual_hours>TIME_RULES.longItem&&!['直播','助播'].includes(i.category))add('R04','黄色提示','事项'+i.number+'单项投入超过4小时，建议补充阶段或工作量','本应用试点阈值，不是岗位标准耗时','说明数量、复杂度、等待或分阶段投入；保留合理长任务',i.number);
  const norm=i.text.replace(/\s|[（()）。，,；;、]/g,'');
  if(seen.has(norm))add('R05','黄色提示','事项'+i.number+'与事项'+seen.get(norm)+'文字和时长相同，可能重复','文本完全一致，仅是重复线索','确认是否不同场次；重复则修正，确有两次请说明',i.number);else seen.set(norm,i.number);
  if(/同时|并行|一边.*一边/.test(i.text)&&i.segments.length>1)add('R06','黄色提示','事项'+i.number+'提到并行工作，请核对是否重复累计同一时段','原文线索；没有起止时间不能认定重叠','说明起止时间与分摊方法',i.number);
 }
 return a;
}
return {VERSION,PROJECTS,TIME_RULES,parse,parseItem,timeAlerts};
});
