import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchAnalyticsOutbox } from '../_lib/analytics-outbox.js';
import { runAnalyticsWorker } from '../../scripts/dispatch-analytics.mjs';
const environment={ANALYTICS_FORWARD_URL:'https://collector.example.test/collect'};
function fixture(exhausted=0) {
 let state='pending',attempts=0;const statements=[];
 const sql=async(strings,...values)=>{
  const query=strings.join('?');statements.push({query,values});
  if(query.includes('RETURNING event.id')){if(state==='sent')return [];state='processing';return [{id:1,event_name:'purchase',dedupe_key:'cs_test_example123',payload:{event_id:'purchase:cs_test_example123'},created_at:'2026-09-18T00:00:00.000Z',attempts:++attempts}];}
  if(query.includes("SET status = 'sent'")){state='sent';return [];}
  if(query.includes("SET status = 'failed'")){state='failed';return [];}
  if(query.includes('AS exhausted'))return [{exhausted}];
  throw new Error('Unexpected outbox SQL');
 };sql.begin=fn=>fn(sql);return {sql,statements,state:()=>state};
}
test('collector failure retries with the same durable ID then no longer claims a sent event',async t=>{
 const db=fixture(),keys=[];let calls=0;
 t.mock.method(console,'error',()=>{});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{keys.push(opts.headers['Idempotency-Key']);return {ok:++calls>1,status:calls===1?503:204};});
 assert.equal((await dispatchAnalyticsOutbox({sql:db.sql,environment})).failed,1);assert.equal(db.state(),'failed');
 assert.equal((await runAnalyticsWorker({sql:db.sql,environment})).sent,1);assert.equal(db.state(),'sent');
 assert.equal((await runAnalyticsWorker({sql:db.sql,environment})).claimed,0);assert.equal(new Set(keys).size,1);
 const failed=db.statements.find(s=>s.query.includes("SET status = 'failed'"));assert.equal(failed.values[0],30);
 assert.match(failed.query,/AND attempts =/);assert.match(db.statements.find(s=>s.query.includes("SET status = 'sent'")).query,/AND attempts =/);
});
test('worker fails closed without collector and signals exhausted rows without exposing records',async t=>{
 assert.deepEqual(await runAnalyticsWorker({environment:{}}),{configured:false,exhausted:null,exitCode:1});
 t.mock.method(globalThis,'fetch',async()=>({ok:true,status:204}));
 const result=await runAnalyticsWorker({sql:fixture(2).sql,environment});assert.equal(result.exhausted,2);assert.equal(result.exitCode,1);assert.equal(JSON.stringify(result).includes('cs_test'),false);
});
