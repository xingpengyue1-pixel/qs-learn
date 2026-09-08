const assert=require('node:assert/strict');const p=require('./diary_parser.js');
const parse=(s,options={})=>p.parse(s,{today:'2026-09-08',...options});
for(const [s,h] of [['1小时30分钟',1.5],['90分钟',1.5],['半小时',.5],['1h30min',1.5],['2小时',2]])assert.equal(parse('1.项目沟通'+s).total_hours,h);
assert.equal(parse('1.沟通1小时',{defaultDate:'2026-09-07'}).date,'2026-09-07');
assert.equal(parse('20360907\n1.沟通1小时').date,null);
assert.equal(parse('【系统验收】\n1.沟通1小时').test_mode,false);
assert.equal(parse('1.直播25小时').alerts[0].code,'R01');
assert.equal(parse('1.直播1e3小时').alerts[0].code,'R01');
const fs=require('node:fs');for(const name of ['daily.html','index.html']){const s=fs.readFileSync(name,'utf8');for(const word of ['prefill_日报原文','prefill_成果链接','prefill_工时异常说明'])assert(!s.includes(word));assert(s.includes(fs.readFileSync('diary_parser.js','utf8')));}
console.log('Parser boundaries and public handoff privacy passed');

assert(!fs.readFileSync('full.html','utf8').includes('prefill_'));
