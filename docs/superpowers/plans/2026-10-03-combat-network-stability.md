# Combat Network Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giữ event/snapshot đúng thứ tự và phục hồi được action, kết quả, phần thưởng khi mất mạng hoặc chuyển scene.

**Architecture:** Queue đơn ở client, runtime sở hữu tween/timer/FX để hủy có kiểm soát. Snapshot server chứa sequence ghế và trạng thái settlement; registry nhận terminal frame độc lập scene. Không replay action chưa xác nhận một cách tự động sau reconnect.

**Tech Stack:** TypeScript, Phaser, Fastify/WebSocket, Vitest/pg-mem, Playwright hiện có.

**Spec:** `combat-screen-review-2026-10-03.md` lỗi 1–4/13; master `docs/superpowers/plans/2026-10-03-combat-screen-improvements.md`; `docs/16-server-api.md`.

## Global Constraints

- Tuân toàn bộ Global Constraints của master: không đổi gameplay/RNG/replay/economy, không dependency mới, không production DB.
- UI tiếng Việt; TypeScript strict. Client/server mirror protocol phải cùng field/type.
- Chỉ một action local đang chờ xác nhận; không xếp offline match action vào generic outbox.
- Không award/settle lại để phục hồi UI; recovery chỉ đọc kết quả đã có.
- Mọi completion sau abort/shutdown không được commit vào scene mới.

## Review Focus

- Push B trong lúc A phát: commit [A,B], lock tới cuối — N1.
- Animation reject/resize/rejoin/shutdown: cleanup và không stale completion — N1.
- Action đã gửi nhưng server chưa nhận / đã nhận nhưng reply mất: next sequence phục hồi — N2.
- Trận kết thúc trước hoặc trong reconnect, kể cả room hết retention: có đường về lobby — N3.
- Settlement tới sau chuyển scene hoặc lặp frame: refresh/notice đúng một lần — N4.

## File Structure và test setup

Các file mới: `ui/combat-playback.ts`, `ui/animation-runtime.ts`, `net/match-registry.ts`. Các test mới dưới `apps/client/test/` tương ứng; server mở rộng `apps/server/test/realtime.test.ts`, `coop.test.ts`; e2e mở rộng PvP/co-op.

Tạo fixture cùng N1: `apps/client/test/helpers/combat-fixture.ts` export `fixture(mode: "pve" | "pvp" | "coop" = "pve"): { data: GameData; state: CombatState }`, seed 42, đội m05/f04/m06 ở cả hai ghế khi online, encounter đầu theo tier hợp lệ. Dùng `loadGameData`, `createCombat/createPvpCombat/createCoopCombat`, không fake đầy đủ state bằng ép kiểu. Export `snapshot(state: CombatState, you = 0): MatchSnapshot` và `deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void }`. Khi N2/N3 thêm field, cập nhật builder này. Vitest test runtime mock Phaser API cần thiết; production module dùng type-only Phaser import khi được. Module phụ thuộc theme/window phải `vi.stubGlobal("window", { devicePixelRatio: 1, screen: { width: 1280, height: 720 } })` trước dynamic import và cleanup sau test; không thêm jsdom/dependency.

### Task N1: Queue batch và lifecycle hủy được

**Files**
- Create: `apps/client/src/ui/combat-playback.ts`, `animation-runtime.ts`.
- Modify: `apps/client/src/scenes/combat-scene.ts` create/onNetPush/dispatch/playEvents/renderAll/shutdown; `ui/event-animator.ts`; `ui/vfx.ts`.
- Test: `apps/client/test/combat-playback.test.ts`, `animation-runtime.test.ts`, fixture ở trên.

**Interfaces**
- Export `PlaybackBatch = { before: CombatState; after: CombatState; events: CombatEvent[]; eventSeq?: number }`.
- Export `PlaybackHooks = { play(batch: PlaybackBatch, signal: AbortSignal): Promise<void>; commit(batch: PlaybackBatch): void; busy(value: boolean): void; failed(error: unknown, latest: CombatState): void }`.
- Export class `CombatPlayback`: constructor(hooks: PlaybackHooks); `enqueue(batch: PlaybackBatch): void`; `reset(): void`; `dispose(): void`; readonly getter `busy: boolean`.
- Export `AnimationRuntime`: `wait(ms: number): Promise<void>`; `tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void>`; `track<T extends Phaser.GameObjects.GameObject>(object: T): T`; `assertActive(): void`; `drain(): Promise<void>`; `dispose(): void`. Runtime giữ pending finite operations; drain chờ chúng hoàn tất trước batch commit. Effects được chạy song song phải có rejection handler, không fire-and-forget promise chưa bắt lỗi.
- `createAnimationRuntime(scene: Phaser.Scene, signal: AbortSignal): AnimationRuntime`; abort rejects awaited operations with exported `AnimationAbortedError`, kills only runtime-owned tweens/timers and destroys only tracked temporary FX.
- Extend `AnimContext` with `runtime: AnimationRuntime`, giữ `state`/maps hiện tại tới A3. Tất cả VFX dùng runtime nhận qua parameter/AttackOptions; không còn delayedCall không được scope sở hữu cho temporary FX.

- [ ] **Step 1 — Viết regression queue và runtime.** Test queue bằng deferred play và marker `after.round`; test fake scene bằng timer/tween handles có spies. Assertion chính:

```ts
expect(play.mock.calls.map(([b]) => b.after.round)).toEqual([1]);
a.resolve();
await flushMicrotasks();
expect(play.mock.calls.map(([b]) => b.after.round)).toEqual([1, 2]);
expect(committed).toEqual([1]);
expect(queue.busy).toBe(true);
b.resolve();
await flushMicrotasks();
expect(committed).toEqual([1, 2]);
expect(queue.busy).toBe(false);
```

Trong file test định nghĩa `flushMicrotasks(): Promise<void>` với 4 lượt `await Promise.resolve()`. Thêm “reset rejects wait and skips stale commit”, “dispose destroys temporary FX but not unit view”, “rejected batch reports error and renders latest snapshot”, “resize request is deferred during playback”.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-playback.test.ts test/animation-runtime.test.ts`; phải FAIL do module/behavior chưa có.
- [ ] **Step 3 — Implement interfaces và wiring.** Queue giữ FIFO và epoch; before của B là after của A đã enqueue, không lấy state đang render cũ. Offline và online đi chung enqueue; only drain mở input. Rejoin/reset/shutdown abort scope trước dựng UI; status connection chỉ đổi overlay, không destroy unit giữa queue. Resize/debug request redraw chờ drain. Kiểm signal trước/ sau mỗi await; catch lỗi thật có thông báo và resync latest snapshot, không để input treo. Runtime cleanup không xóa looping tween của persistent status; các FX loops phải bị hủy theo scope khi thuộc batch.
- [ ] **Step 4 — Chạy xanh + typecheck client.** Commands Step 2 và `pnpm --filter client typecheck`; tất cả PASS. Playtest resize trong cast và shutdown sang deck-select: không nhảy về state cũ, không uncaught rejection. Full suite tại gate đợt 1.
- [ ] **Step 5 — Commit** chỉ các file task: `fix: serialize combat playback and cancel stale effects`.

### Task N2: Sequence phục hồi và action acknowledgement

**Files**
- Modify: client `net/{protocol,match,socket}.ts`, combat dispatch; server `realtime/{protocol,match-room,hub}.ts`; `docs/16-server-api.md`.
- Test: `apps/client/test/net-match.test.ts`, `net-socket.test.ts`; server `test/realtime.test.ts`.

**Interfaces**
- Thêm required `nextActionSeq: number` vào MatchSnapshot và `match.events` của receiver; thêm vào `match.rejected`.
- Thêm client frame `{ type: "match.sync"; matchId: string }` vào zod union và server frame `{ type: "match.snapshot" } & MatchSnapshot`.
- `NetMatch.rejoin(snapshot: MatchSnapshot): void` đồng bộ next sequence, xóa pending, nhận view/eventSeq/deadline; `NetMatch.handle` nhận snapshot cả khi eventSeq bằng hiện tại.
- `NetSocket.sendMatch(message: { type: "match.action" | "match.resign" | "match.emote" | "match.sync"; [key: string]: unknown }): boolean` chỉ gửi khi connected/OPEN, trả false nếu offline, không thêm generic outbox. Các frame queue/lobby khác giữ hành vi hiện tại.
- `NetMatch.sendAction(action: Action): boolean` không tăng sequence khi không gửi; không nhận action mới khi pending. Acknowledgement là `nextActionSeq > pending.seq` từ server. Thêm `NetMatch.requestSync(): boolean`, gửi match.sync qua sendMatch, không tăng action sequence.

- [ ] **Step 1 — Viết test mất action, mất reply, duplicate và reload.** Dùng fixture/snapshot của N1 và fake transport; ví dụ:

```ts
match.sendAction({ type: "endTurn" }); // seq 1, chưa tới server
match.rejoin({ ...start, nextActionSeq: 1 });
match.sendAction({ type: "endTurn" });
expect(sent.map(m => m.seq)).toEqual([1, 1]);
match.rejoin({ ...start, nextActionSeq: 4 });
match.sendAction({ type: "endTurn" });
expect(sent.at(-1)?.seq).toBe(4);
```

Server tests: accepted seq 1 → snapshot.nextActionSeq=2; duplicate seq 1 không apply lần hai và trả snapshot; bad seq trả expected sequence. Socket disconnected không enqueue match.action; welcome không flush action cũ trước rejoin. Frame có matchId cũ sau start trận mới không được áp lên room mới; sync room không thuộc account bị từ chối.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/net-match.test.ts test/net-socket.test.ts`; `pnpm --filter server exec vitest run test/realtime.test.ts`; assertions sequence/duplicate recovery FAIL.
- [ ] **Step 3 — Implement protocol + reconcile.** `snapshotFor(seat)` lấy `seats[seat].nextSeq`; từng push dùng nextSeq riêng, không broadcast một ghế cho cả hai. Hub kiểm message.matchId đúng room cho action/resign/emote, không chỉ lookup account. match.sync dùng matches.get(matchId), kiểm seatOf(accountId), cho phép retained terminal room của chính account; không truy cập room người khác. Duplicate trả snapshot, high seq trả rejection với expected seq; client request sync rồi rejoin. Sau rejoin, action chưa được server chấp nhận bị bỏ khỏi pending và hiện “Thao tác chưa được xác nhận, hãy thử lại.”; action đã accepted không gửi lại. Không tự áp action cũ trên phase/target mới.
- [ ] **Step 4 — Chạy xanh** Step 2 + `pnpm typecheck`. E2E reload khi đã đánh nhiều action và disconnect ngay sau send: action tiếp theo được nhận đúng một lần.
- [ ] **Step 5 — Commit:** `fix: reconcile match action sequence on recovery`.

### Task N3: Terminal snapshot và reconnect sau khi trận kết thúc

**Files**
- Modify: `apps/client/src/net/{protocol,socket,match}.ts`, `apps/client/src/scenes/{combat-scene,arena-scene,coop-lobby-scene}.ts`; `apps/server/src/realtime/{protocol,match-room,hub}.ts` (snapshotFor/attach/finish/hello).
- Test: `apps/client/test/{net-match,net-socket}.test.ts`, `apps/server/test/{realtime,coop}.test.ts`; `apps/client/e2e/{pvp,coop}.spec.ts`.
- Docs: `docs/16-server-api.md`.

**Interfaces**
- Export trong cả protocol mirror `MatchSettlement = { result: "won" | "lost" | "draw"; reason: string; rating?: { before: number; after: number }; rewards?: { honor?: number; moonJade?: number; moonDust?: number; firstWin?: boolean }; profileRev?: number }`.
- Export `SettlementState = { status: "playing" | "pending" } | { status: "complete"; end: MatchSettlement } | { status: "failed"; error: string }`; thêm required `settlement: SettlementState` vào MatchSnapshot.
- Server `MatchRoom` lưu per-seat settlement sau finish; complete/failed giữ room 60_000 ms như retention hiện hành, deadline terminal=null. Recovery đọc snapshot, không gọi lại award.
- Socket callback property `onRecovery: (snapshot: MatchSnapshot | null) => void` chạy trên mọi welcome, thay `onRejoin` và migrate arena/combat/co-op handlers; null là không còn room, không phải “đã phục hồi trận cũ”.

- [ ] **Step 1 — Viết test terminal reconnect trước/sau TTL và settlement lỗi.**

```ts
expect(rejoined.settlement.status).toBe("complete");
expect(rejoined.deadline).toBeNull();
expect(awardCalls).toBe(1); // hello/sync lần hai không trả thưởng lại
expect(afterRetention.activeMatch).toBeUndefined();
expect(startScene).toHaveBeenCalledWith("arena"); // PvP fixture, welcome không còn activeMatch
expect(refreshProfile).toHaveBeenCalledTimes(1);
```

`startScene` và `refreshProfile` là spies của `scene.start` và `account.resumeSession`. Thêm failed DB settlement không để pending mãi; co-op result receiver đúng ghế; callback null khi không có trận trước đó không tự navigate lobby hoặc refresh vô cớ.

- [ ] **Step 2 — Chạy đỏ:** client net tests + `pnpm --filter server exec vitest run test/realtime.test.ts test/coop.test.ts`; terminal recovery assertions FAIL.
- [ ] **Step 3 — Implement.** Welcome/sync trả cả ended snapshot còn retention, attach terminal socket để nhận settlement đang pending nhưng không arm clock. Pending → complete/failed cập nhật đúng một lần; không tự retry award nếu transaction outcome không rõ. Khi welcome không còn room, abort playback, refresh profile và về arena/coop lobby với “Trận đã kết thúc.”. Failed hiển thị “Không nhận được thông tin thưởng; hồ sơ sẽ được cập nhật lại.” và có đường thoát. Giữ result provisional từ terminal view khi settlement pending.
- [ ] **Step 4 — Chạy xanh + e2e:** disconnect hết reconnect window, nối lại; nối lại sau room cleanup; settlement fault bằng test dependencies. Mọi luồng có exit, không crash/award hai lần.
- [ ] **Step 5 — Commit:** `fix: recover terminal matches after reconnect`.

### Task N4: Settlement độc lập scene và gate online

**Files**
- Create: `apps/client/src/net/match-registry.ts`.
- Modify: `apps/client/src/session.ts`, `account.ts`, `net/socket.ts`, `scenes/{combat-scene,arena-scene,coop-lobby-scene}.ts`; `apps/server/test/{realtime,coop}.test.ts` cho delay settlement.
- Test: `apps/client/test/match-registry.test.ts`; `apps/client/e2e/{pvp,coop}.spec.ts`.

**Interfaces**
- `MatchRegistry`: constructor(onSettled: (matchId: string, settlement: MatchSettlement) => Promise<void>); `retain(match: NetMatch): void`; `handle(message: ServerMessage): boolean`; `recover(snapshot: MatchSnapshot | null): void`; `release(matchId: string): void`; `dispose(): void`.
- Session giữ registry trong lifetime account; socket route match frame tới registry trước scene handler. `match.start` vẫn cho lobby navigate; các frame đã handle không dispatch hai lần.
- onSettled refresh bằng `account.resumeSession` nếu profileRev mới, đưa notice tiếng Việt vào `session.notices`; dedup theo matchId. release khi terminal processed nhưng giữ completed-ID tombstone tới logout để frame lặp không lọt vào scene handler. Callback async được catch/record failure, không unhandled rejection. Chuyển scene chỉ unbind visual callbacks, không xóa registry entry đang pending. Khi welcome, socket gọi registry.recover trước scene onRecovery: rejoin retained active match đúng một lần, requestSync từng pending retained ID khác (kể cả activeMatch là trận mới). Scene recovery chỉ reset/render view đã reconcile, hoặc tạo/retain NetMatch chưa biết; không rejoin cùng snapshot lần hai. Retained room attach socket mà không arm clock để nhận settlement về sau. Logout dispose registry, không dùng entry account cũ.

- [ ] **Step 1 — Test settlement sau exit và lặp frame.**

```ts
registry.retain(match);
unbindCombatCallbacks();
registry.handle(endFrame);
registry.handle(endFrame);
await flushMicrotasks();
expect(refresh).toHaveBeenCalledTimes(1);
expect(notices).toHaveLength(1);
```

`unbindCombatCallbacks` ở test chỉ reset hooks NetMatch như scene shutdown. Thêm chuyển lobby → match mới → late end của match cũ không thay state trận mới; rejected action không unlock queue đang busy.

- [ ] **Step 2 — Chạy đỏ:** `pnpm --filter client exec vitest run test/match-registry.test.ts`; late frame/dedup FAIL.
- [ ] **Step 3 — Implement registry và result UI.** Bảng kết quả cho về lobby trong pending, có dòng “Đang nhận kết quả thưởng…”; notification/profile vẫn cập nhật sau exit. Scene input lock tổng hợp pending action + queue.busy + terminal + disconnected, không mỗi callback tự bật/tắt boolean tùy ý.
- [ ] **Step 4 — Gate:** `pnpm test`, `pnpm typecheck`, `pnpm build`; online e2e PvP/co-op/arena với DB dev. Delay settlement >2 giây trong server test, không thay config production. PASS toàn bộ, golden không đổi; ghi bằng chứng vào playtest notes.
- [ ] **Step 5 — Commit:** `fix: retain match settlement beyond combat scene`.

## Self-review

N1/N2/N3/N4 phủ đầy đủ lỗi online trong review; từng task có outcome test được. Runtime scope là interface duy nhất cho cancellation ở các plan sau. Chưa tự nâng user authorization thành deploy/merge; các frame recovery không đổi luật trận hoặc award lại.

