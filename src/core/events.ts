export const FORMAT_VERSION = 1;
export type OptionInput = { id: string; label: string; consequence?: string; recommended?: boolean };
export type QuestionInput = { id: string; parentId?: string; title: string; body: string;
  recommendation?: string; options?: OptionInput[]; multi?: boolean };
export type UserResponse =          // not "Response": that name is the browser's fetch type
  | { kind: 'answer'; optionIds: string[]; text?: string; note?: string }
  | { kind: 'skip' }
  | { kind: 'invalid'; reason: string };
export type EventBody =
  | { type: 'session_created'; v: number; id: string; title: string; parentSessionId?: string }
  | { type: 'questions_posted'; questions: QuestionInput[] }
  | { type: 'response_marked'; qid: string; response: UserResponse } // user pressed Done / Skip / Invalid
  | { type: 'response_cleared'; qid: string }
  | { type: 'batch_sent' }                                          // user pressed Respond
  | { type: 'updates_acked'; through: number }                      // agent read events [0, through)
  | { type: 'question_resolved'; qid: string; decision: string; assumed: boolean; reason?: string }
  | { type: 'question_retracted'; qid: string; reason: string }
  | { type: 'status_set'; text: string }
  | { type: 'summary_posted'; html: string; markdown: string; abstract: string }
  | { type: 'session_confirmed' }
  | { type: 'session_reopened'; note: string }
  | { type: 'note_added'; markdown: string };
export type Event = EventBody & { ts: string; actor: 'agent' | 'user'; cid?: string };  // cid: client action id, for replay dedup
