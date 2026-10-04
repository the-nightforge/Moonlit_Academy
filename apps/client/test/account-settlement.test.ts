import { expect, it, vi } from "vitest";
import { createProfile } from "rules";
import { loadGameData } from "data";
vi.stubGlobal("window", { devicePixelRatio: 1, screen: { width:1280,height:720 }, location: { href:"http://localhost/" } });
vi.stubGlobal("localStorage", {getItem:()=>null,setItem:()=>{},removeItem:()=>{}});
const { login, logout, resumeSession, resetAccount } = await import("../src/account");
const { auth, setToken } = await import("../src/api");
const { session } = await import("../src/session");
const { NetMatch } = await import("../src/net/match");
const { fixture, snapshot } = await import("./helpers/combat-fixture");
it.each(["success", "failure"])("old account settlement %s cannot overwrite newly logged in account", async (outcome) => {
  session.notices = [];
  const profileA = createProfile(loadGameData()); profileA.currencies.moonJade = 111;
  const profileB = createProfile(loadGameData()); profileB.currencies.moonJade = 222;
  let release!: (response: Response)=>void;
  const oldRefresh = new Promise<Response>(r=>release=r);
  const reply=(body:any)=>new Response(JSON.stringify(body),{status:200});
  vi.stubGlobal("fetch", vi.fn(async(url:string, opts:any)=>{
    if(url.endsWith("/api/profile")) return oldRefresh;
    if(url.endsWith("/api/auth/logout")) return reply({});
    const {username}=JSON.parse(opts.body);
    return reply({token:username,profile:username==="account_a"?profileA:profileB,rev:1});
  }));
  await login("account_a","password",false);
  const match = new NetMatch({sendMatch:()=>true} as any, snapshot(fixture("pvp").state,0,{matchId:"old_account_match"}));
  const oldRegistry = session.registry!;
  oldRegistry.retain(match);
  oldRegistry.handle({type:"match.end",matchId:match.matchId,result:"won",reason:"combat",profileRev:2});
  await logout();
  await login("account_b","password",false);
  expect(session.profile.currencies.moonJade).toBe(222);
  release(outcome === "success" ? reply({profile:profileA,rev:2}) : new Response(JSON.stringify({error:"network"}),{status:500}));
  for(let i=0;i<30;i++) await new Promise(r=>setImmediate(r));

  expect(session.profile.currencies.moonJade).toBe(222);
  expect(session.rev).toBe(1);
  expect(session.notices).toEqual([]);
  expect(session.notices.some(n=>n.includes("Trận trước"))).toBe(false);
});

it.each(["profile", "logout"])("old %s 401 cannot invalidate an in-flight new login", async (oldRequest) => {
  const data = loadGameData();
  const profileA = createProfile(data), profileB = createProfile(data);
  profileB.currencies.moonJade = 222;
  let releaseOld!: (response: Response) => void, releaseLogin!: (response: Response) => void;
  const oldResponse = new Promise<Response>(resolve => { releaseOld = resolve; });
  const loginResponse = new Promise<Response>(resolve => { releaseLogin = resolve; });
  const reply = (body: unknown) => new Response(JSON.stringify(body), {status:200});
  const previousUnauthorized = auth.onUnauthorized;
  auth.onUnauthorized = vi.fn(() => { resetAccount(); setToken(null); session.online = false; });
  vi.stubGlobal("fetch", vi.fn(async (url: string, opts: any) => {
    if (url.endsWith("/api/profile") || url.endsWith("/api/auth/logout")) return oldResponse;
    return JSON.parse(opts.body).username === "account_a" ? reply({token:"A",profile:profileA,rev:1}) : loginResponse;
  }));
  try {
    await login("account_a", "password", false);
    const old = oldRequest === "profile" ? resumeSession().catch(() => false) : logout();
    const next = login("account_b", "password", false);
    releaseOld(new Response(JSON.stringify({error:"unauthorized"}), {status:401}));
    await old;
    expect(auth.onUnauthorized).not.toHaveBeenCalled();
    releaseLogin(reply({token:"B",profile:profileB,rev:2}));
    await next;
    expect(auth.token).toBe("B");
    expect(session.rev).toBe(2);
    expect(session.profile.currencies.moonJade).toBe(222);
  } finally {
    releaseLogin(reply({token:"B",profile:profileB,rev:2}));
    auth.onUnauthorized = previousUnauthorized;
  }
});

it("current-account profile 401 still invokes unauthorized reset", async () => {
  const previousUnauthorized = auth.onUnauthorized;
  auth.onUnauthorized = vi.fn(() => { resetAccount(); setToken(null); });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({error:"unauthorized"}), {status:401})));
  setToken("current");
  try {
    await expect(resumeSession()).rejects.toMatchObject({status:401});
    expect(auth.onUnauthorized).toHaveBeenCalledOnce();
    expect(auth.token).toBeNull();
  } finally { auth.onUnauthorized = previousUnauthorized; }
});


