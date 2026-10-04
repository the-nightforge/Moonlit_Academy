import { expect, it } from "vitest";
import { testServer, register, accountIdOf, giveStarterDeck } from "./helpers";

it("old pending settlement must reattach on sync after a new match and reconnect", async () => {
  const server = await testServer();
  const a = await register(server, "review_a");
  const b = await register(server, "review_b");
  await giveStarterDeck(server, await accountIdOf(server,a.token), ["m05","f04","m06"]);
  await giveStarterDeck(server, await accountIdOf(server,b.token), ["m05","f04","m06"]);
  await server.app.ready();
  async function connect(token: string) {
    const socket = await server.app.injectWS("/api/ws");
    const inbox: any[] = [];
    socket.on("message", raw => inbox.push(JSON.parse(raw.toString())));
    const send = (m: unknown) => socket.send(JSON.stringify(m));
    send({type:"hello",token,dataVersion:server.version});
    await settle();
    return {socket,inbox,send,last:(type:string)=>inbox.filter(m=>m.type===type).at(-1)};
  }
  async function settle() { for(let i=0;i<30;i++) await new Promise(resolve=>setImmediate(resolve)); }
  const wa = await connect(a.token), wb = await connect(b.token);
  wa.send({type:"room.create",mode:"pvp",deckId:"d1"}); await settle();
  wb.send({type:"room.join",code:wa.last("room.created").code,deckId:"d1"}); await settle();
  const old = wa.last("match.start").matchId;
  const realTx = server.db.transaction.bind(server.db);
  let release!:()=>void;
  const gate = new Promise<void>(r=>release=r);
  server.db.transaction = (async(fn:any)=>{await gate;return realTx(fn);}) as any;
  wa.send({type:"match.resign",matchId:old}); await settle();
  server.db.transaction = realTx;
  wa.send({type:"practice.start",mode:"pvp",deckId:"d1"}); await settle();
  const fresh = wa.last("match.start").matchId;
  expect(fresh).not.toBe(old);
  wa.socket.terminate(); await settle();
  const recovered = await connect(a.token);
  expect(recovered.last("welcome").activeMatch.matchId).toBe(fresh);
  recovered.send({type:"match.sync",matchId:old}); await settle();

  release(); await settle();

  expect(recovered.last("match.snapshot")?.matchId).toBe(old);
  expect(recovered.inbox.filter(m=>m.type==="match.end" && m.matchId===old)).toHaveLength(1);
  recovered.socket.terminate(); wb.socket.terminate(); await server.app.close();
}, 60000);


