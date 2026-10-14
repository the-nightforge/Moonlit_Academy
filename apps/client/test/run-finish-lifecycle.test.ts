import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { createRun,starterDeck } from 'rules';
vi.mock('../src/api',async importOriginal=>({...await importOriginal<typeof import('../src/api')>(),api:vi.fn()}));
vi.mock('../src/ui/theme',()=>({API_ERROR_TEXT:{},CURRENCY_LABELS:{}}));
import {api,auth,ApiError} from '../src/api';
import {session,type Team} from '../src/session';
import {submitRun,type RunTicket} from '../src/run-session';
import {StaleRequestError} from '../src/request-context';
const apiMock=vi.mocked(api),team:Team=['m05','f04','m06'];
const setup={heroIds:team,seed:7,deckCardIds:starterDeck(session.data,team)};
const fields=['ticket','run','runSubmitted','lastGains','lastRewards','profile','rev'] as const;
let saved:Record<string,unknown>,generation:number,token:string|null,storage:Map<string,string>;
function deferred(){let resolve!:(value:unknown)=>void,reject!:(error:unknown)=>void;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
const reply=()=>({profile:session.profile,rev:session.rev+1,gains:[{heroId:'m05',xp:20,levelBefore:0,levelAfter:0}],rewards:{moonJade:10,darkIron:0,firstWinOfDay:false,achievements:[]}});
beforeEach(()=>{saved=Object.fromEntries(fields.map(k=>[k,session[k]]));generation=auth.generation;token=auth.token;auth.token='test';storage=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});session.ticket={runId:'old',setup,actions:[]};session.run={...createRun(session.data,setup).run,status:'lost'};session.runSubmitted=false;session.lastGains=null;session.lastRewards=null;apiMock.mockReset();});
afterEach(()=>{for(const k of fields)(session as unknown as Record<string,unknown>)[k]=saved[k];auth.generation=generation;auth.token=token;vi.unstubAllGlobals();});
it('an account change cannot receive the old run receipt or clear its saved ticket',async()=>{const pending=deferred();apiMock.mockReturnValue(pending.promise);const work=submitRun();auth.generation++;const newTicket:RunTicket={runId:'new',setup,actions:[]};session.ticket=newTicket;storage.set('vong-nguyet.run','new-account-ticket');pending.resolve(reply());await expect(work).rejects.toBeInstanceOf(StaleRequestError);expect(session.ticket).toBe(newTicket);expect(session.runSubmitted).toBe(false);expect(session.lastGains).toBeNull();expect(storage.get('vong-nguyet.run')).toBe('new-account-ticket');});
it('a late rejection for an old ticket cannot clear a replacement run',async()=>{const pending=deferred();apiMock.mockReturnValue(pending.promise);const work=submitRun();const newTicket:RunTicket={runId:'new',setup,actions:[]};session.ticket=newTicket;pending.reject(new ApiError(409,'run closed'));await expect(work).rejects.toBeInstanceOf(StaleRequestError);expect(session.ticket).toBe(newTicket);});
it('a matching run still records its verified reward exactly once',async()=>{apiMock.mockResolvedValue(reply());await submitRun();expect(session.ticket).toBeNull();expect(session.runSubmitted).toBe(true);expect(session.lastRewards?.moonJade).toBe(10);expect(apiMock).toHaveBeenCalledTimes(1);});
