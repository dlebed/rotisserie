import { expect, test } from 'vitest';
import { reduce } from '../../src/core/reduce';
import type { Event, EventBody } from '../../src/core/events';

let n = 0;
function ev(body: EventBody, actor: 'agent' | 'user' = 'agent'): Event {
  n += 1;
  return { ...body, ts: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(), actor };
}
const skip = (qid: string) => ev({ type: 'response_marked', qid, response: { kind: 'skip' } }, 'user');
const send = () => ev({ type: 'batch_sent' }, 'user');
const resolve = (qid: string, assumed: boolean) =>
  ev({ type: 'question_resolved', qid, decision: 'D', assumed, reason: 'because' });

const base = [ev({type:'session_created',v:1,id:'rt-1',title:'T'}),
  ev({type:'questions_posted',questions:[{id:'Q1',title:'a',body:''},{id:'Q2',title:'b',body:''}]})];

test('orders follow-ups under their parent', () => {
  const s = reduce([...base, ev({type:'questions_posted',questions:[{id:'Q1a',parentId:'Q1',title:'c',body:''}]})]);
  expect(s.order).toEqual(['Q1','Q1a','Q2']); expect(s.questions.Q1!.childIds).toEqual(['Q1a']);
});

test('order is depth-first with children in posting order', () => {
  const s = reduce([...base,
    ev({type:'questions_posted',questions:[{id:'Q1a',parentId:'Q1',title:'c',body:''},{id:'Q1b',parentId:'Q1',title:'d',body:''}]}),
    ev({type:'questions_posted',questions:[{id:'Q1a1',parentId:'Q1a',title:'e',body:''}]}),
    ev({type:'questions_posted',questions:[{id:'Q3',title:'f',body:''}]})]);
  expect(s.order).toEqual(['Q1','Q1a','Q1a1','Q1b','Q2','Q3']);
});

test('done then sent', () => {
  const marked = [...base, ev({type:'response_marked',qid:'Q1',response:{kind:'skip'}},'user')];
  expect(reduce(marked).questions.Q1!.status).toBe('done'); expect(reduce(marked).unsentCount).toBe(1);
  const sent = reduce([...marked, ev({type:'batch_sent'},'user')]);
  expect(sent.questions.Q1!.status).toBe('sent'); expect(sent.unsentCount).toBe(0); expect(sent.pendingWake).toBe(true);
});

test('ack clears pendingWake', () => {
  const e = [...base, ev({type:'response_marked',qid:'Q1',response:{kind:'skip'}},'user'), ev({type:'batch_sent'},'user')];
  expect(reduce([...e, ev({type:'updates_acked',through:e.length})]).pendingWake).toBe(false);
});

test('an ack that stops short of the batch leaves pendingWake set', () => {
  const e = [...base, skip('Q1'), send()];
  expect(reduce([...e, ev({type:'updates_acked',through:e.length - 1})]).pendingWake).toBe(true);
});

test('revision after send', () => {
  const s = reduce([...base, skip('Q1'), send(),
    ev({type:'response_marked',qid:'Q1',response:{kind:'answer',optionIds:['a']}},'user')]);
  expect(s.questions.Q1!.status).toBe('done');
  expect(s.questions.Q1!.isRevision).toBe(true);
  expect(s.questions.Q1!.response).toEqual({kind:'answer',optionIds:['a']});
  expect(s.unsentCount).toBe(1);
});

test('a first response is not a revision', () => {
  expect(reduce([...base, skip('Q1')]).questions.Q1!.isRevision).toBe(false);
});

test('revision of a resolved question', () => {
  const e = [...base, resolve('Q1', true)];
  expect(reduce(e).questions.Q1!.status).toBe('assumed');
  const revised = reduce([...e, skip('Q1')]);
  expect(revised.questions.Q1!.status).toBe('done');
  expect(revised.questions.Q1!.isRevision).toBe(true);
  expect(revised.unsentCount).toBe(1);
  expect(reduce([...e, skip('Q1'), send(), resolve('Q1', false)]).questions.Q1!.status).toBe('settled');
});

test('a revision edited again before it is sent stays a revision', () => {
  const again = (text: string) => ev({type:'response_marked',qid:'Q1',response:{kind:'answer',optionIds:[],text}},'user');
  const s = reduce([...base, skip('Q1'), send(), again('one'), again('two')]);
  expect(s.questions.Q1!.status).toBe('done');
  expect(s.questions.Q1!.isRevision).toBe(true);
  expect(s.questions.Q1!.response).toEqual({kind:'answer',optionIds:[],text:'two'});
  const ofResolved = reduce([...base, resolve('Q1', true), again('one'), again('two')]);
  expect(ofResolved.questions.Q1!.isRevision).toBe(true);
  // a first answer edited before sending is still not a revision
  expect(reduce([...base, again('one'), again('two')]).questions.Q1!.isRevision).toBe(false);
});

test('an unsent response is done whatever a later resolution says', () => {
  const e = [...base, resolve('Q1', false), skip('Q1'), resolve('Q1', true)];
  const s = reduce(e);
  expect(s.questions.Q1!.status).toBe('done');
  expect(s.questions.Q1!.isRevision).toBe(true);
  expect(s.questions.Q1!.response).toEqual({kind:'skip'});
  expect(s.unsentCount).toBe(1);
  const sent = reduce([...e, send()]);
  expect(sent.questions.Q1!.status).toBe('sent');
  expect(sent.unsentCount).toBe(0);
  // once sent, a resolution later than the send decides again
  expect(reduce([...e, send(), resolve('Q1', false)]).questions.Q1!.status).toBe('settled');
  // a first answer, unsent, is not overridden either
  expect(reduce([...base, skip('Q2'), resolve('Q2', false)]).questions.Q2!.status).toBe('done');
});

test('clearing an unsent response', () => {
  const marked = [...base, skip('Q1')];
  const clear = () => ev({type:'response_cleared',qid:'Q1'},'user');
  expect(reduce([...marked, clear()]).questions.Q1!.status).toBe('open');
  expect(reduce([...marked, clear()]).questions.Q1!.response).toBeUndefined();
  const sent = [...marked, send()];
  const revised = [...sent, ev({type:'response_marked',qid:'Q1',response:{kind:'invalid',reason:'x'}},'user')];
  const back = reduce([...revised, clear()]);
  expect(back.questions.Q1!.status).toBe('sent');
  expect(back.questions.Q1!.isRevision).toBe(false);
  expect(back.questions.Q1!.response).toEqual({kind:'skip'});
  expect(back.unsentCount).toBe(0);
  // a response that was already sent cannot be cleared
  expect(reduce([...sent, clear()]).questions.Q1!.status).toBe('sent');
  // clearing a revision of a resolved question returns it to the resolution
  const res = reduce([...base, resolve('Q1', true), skip('Q1'), clear()]);
  expect(res.questions.Q1!.status).toBe('assumed');
});

test('a revision after the summary returns the phase to active', () => {
  const sum = ev({type:'summary_posted',html:'<p>h</p>',markdown:'m',abstract:'a'});
  const e = [...base, skip('Q1'), send(), sum];
  expect(reduce(e).phase).toBe('summary');
  const s = reduce([...e, skip('Q1')]);
  expect(s.phase).toBe('active');
  expect(s.summary).toEqual({html:'<p>h</p>',markdown:'m',abstract:'a'});
  const posted = reduce([...e, ev({type:'questions_posted',questions:[{id:'Q3',title:'x',body:''}]})]);
  expect(posted.phase).toBe('active');
  expect(reduce([...e, ev({type:'status_set',text:'working'})]).phase).toBe('summary');
});

test('assumed, settled, retracted precedence and progress', () => {
  const s = reduce([...base,
    ev({type:'questions_posted',questions:[{id:'Q3',title:'c',body:''},{id:'Q4',title:'d',body:''},{id:'Q5',title:'e',body:''}]}),
    skip('Q1'), send(),
    resolve('Q2', true),
    resolve('Q3', false),
    ev({type:'question_retracted',qid:'Q4',reason:'moot'}),
    resolve('Q4', false), skip('Q4'),
    skip('Q5')]);
  const st = (id: string) => s.questions[id]!.status;
  expect([st('Q1'), st('Q2'), st('Q3'), st('Q4'), st('Q5')]).toEqual(['sent','assumed','settled','retracted','done']);
  expect(s.questions.Q3!.decision).toBe('D');
  expect(s.questions.Q3!.reason).toBe('because');
  expect(s.progress).toEqual({total:4, sent:3, done:1, open:0, newCount:0, totalAtLastBatch:5});
  expect(s.unsentCount).toBe(1);
});

test('once the response is sent, the later of resolution and response decides', () => {
  const s = reduce([...base, skip('Q1'), send(), resolve('Q1', false)]);
  expect(s.questions.Q1!.status).toBe('settled');
  expect(reduce([...base, resolve('Q1', false), skip('Q1'), send()]).questions.Q1!.status).toBe('sent');
});

test('isNew only for questions posted after the latest batch', () => {
  const s = reduce([...base, skip('Q1'), send(),
    ev({type:'questions_posted',questions:[{id:'Q3',title:'c',body:''}]})]);
  expect(s.questions.Q3!.isNew).toBe(true);
  expect(s.questions.Q2!.isNew).toBe(false);
  expect(s.progress.newCount).toBe(1);
  const answered = reduce([...base, send(),
    ev({type:'questions_posted',questions:[{id:'Q3',title:'c',body:''}]}), skip('Q3')]);
  expect(answered.questions.Q3!.isNew).toBe(false);
});

test('phase transitions', () => {
  const sum = ev({type:'summary_posted',html:'h',markdown:'m',abstract:'a'});
  expect(reduce(base).phase).toBe('active');
  expect(reduce([...base, sum]).phase).toBe('summary');
  const confirmed = reduce([...base, sum, ev({type:'session_confirmed'},'user')]);
  expect(confirmed.phase).toBe('confirmed');
  expect(confirmed.pendingWake).toBe(true);
  const reopened = reduce([...base, sum, ev({type:'session_confirmed'},'user'), ev({type:'session_reopened',note:'n'},'user')]);
  expect(reopened.phase).toBe('active');
  expect(reopened.pendingWake).toBe(true);
});

test('session fields, status and notes', () => {
  const s = reduce([ev({type:'session_created',v:1,id:'rt-2',title:'Tt',parentSessionId:'rt-1'}),
    ev({type:'status_set',text:'thinking'}),
    ev({type:'note_added',markdown:'hello'})]);
  expect(s).toMatchObject({v:1,id:'rt-2',title:'Tt',parentSessionId:'rt-1',agentStatus:'thinking',eventCount:3,pendingWake:false});
  expect(s.notes).toEqual([{ts:expect.any(String),markdown:'hello'}]);
});

test('progress counts open questions and totalAtLastBatch is null before any batch', () => {
  const s = reduce(base);
  expect(s.progress).toEqual({total:2, sent:0, done:0, open:2, newCount:2, totalAtLastBatch:null});
});

test('unknown qid is ignored', () => {
  const before = reduce(base);
  const after = reduce([...base,
    ev({type:'response_marked',qid:'Q9',response:{kind:'skip'}},'user'),
    ev({type:'response_cleared',qid:'Q9'},'user'),
    resolve('Q9', false),
    ev({type:'question_retracted',qid:'Q9',reason:'x'})]);
  expect(after.questions).toEqual(before.questions);
  expect(after.order).toEqual(before.order);
  expect(after.unsentCount).toBe(0);
  expect(after.eventCount).toBe(base.length + 4);
});

test('agentStatus clears when the agent posts questions or a summary, and a later status_set sets it again', () => {
  const set = ev({type:'status_set',text:'thinking'});
  expect(reduce([...base, set]).agentStatus).toBe('thinking');
  const posted = ev({type:'questions_posted',questions:[{id:'Q9',title:'x',body:''}]});
  expect(reduce([...base, set, posted]).agentStatus).toBeUndefined();
  const sum = ev({type:'summary_posted',html:'<p>h</p>',markdown:'m',abstract:'a'});
  expect(reduce([...base, set, sum]).agentStatus).toBeUndefined();
  expect(reduce([...base, set, posted, ev({type:'status_set',text:'again'})]).agentStatus).toBe('again');
});
