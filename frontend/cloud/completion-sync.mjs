import {mergeAwards} from './ledger-merge.mjs';
// Completion RPC adapter. Duplicate means the same award exists on the server:
// it is confirmed, not rejected. Server snapshot is authoritative across devices.
import {reconcile} from './completion-ledger.mjs';
export function parseCompletionId(id) {
  const match=/^(mission|quest):(\d{4}-\d{2}-\d{2}):([A-Za-z0-9_-]{1,64})$/.exec(id||'');
  if(!match) throw new Error('Invalid completion identity');
  return {kind:match[1],weekKey:match[2],slot:match[3]};
}
export async function syncCompletions(client,ledger) {
  if(!client?.rpc) throw new TypeError('Supabase client required');
  let next=ledger;
  const results=[];
  for(const event of ledger.filter(e=>e.status==='pending')) {
    let identity;
    try {identity=parseCompletionId(event.id);} catch(err) {
      next=reconcile(next,[{id:event.id,status:'rejected'}]);
      results.push({id:event.id,status:'rejected',error:err.message});continue;
    }
    try {
      const {data,error}=await client.rpc('submit_completion',{
        p_cycle:event.cycle,p_week_key:identity.weekKey,p_kind:identity.kind,
        p_slot:identity.slot,p_completed_at:event.completedAt
      });
      if(error) {results.push({id:event.id,status:'retry',error:error.message});continue;}
      const result=Array.isArray(data)?data[0]:data;
      if(!result || !['confirmed','duplicate','rejected'].includes(result.outcome)) throw new Error('Unexpected server response');
      const status=result.outcome==='rejected'?'rejected':'confirmed';
      next=reconcile(next,[{id:event.id,status}]);
      results.push({id:event.id,status:result.outcome});
    } catch(err) {results.push({id:event.id,status:'retry',error:String(err.message||err)});}
  }
  return {events:next,results};
}
export async function fetchCompletionAwards(client) {
  if(!client?.from) throw new TypeError('Supabase client required');
  const {data,error}=await client.from('completion_awards').select('cycle,week_key,kind,slot,skill,xp,completed_at');
  if(error) throw error;
  if(!Array.isArray(data)) throw new Error('Invalid completion awards response');
  return data.map(a=>({id:`${a.kind}:${a.week_key}:${a.slot}`,kind:a.kind,skill:a.skill,xp:a.xp,cycle:a.cycle,completedAt:a.completed_at,status:'confirmed'}));
}
export function mergeServerAwards(local,awards,processed=[]) {
  return mergeAwards(local,awards,processed);
}
