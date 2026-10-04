# Combat Animation and VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animation thể hiện đúng lá, đúng ghế, đúng thứ tự và đúng thời điểm thay đổi HP/giáp; đủ nhịp lifecycle, settings và audio.

**Architecture:** Dùng queue/runtime từ N1, thêm metadata công khai và state trình bày riêng. Impact cập nhật UI ngay; cleanup VFX hoàn tất sau đó. Scene chỉ đối chiếu snapshot cuối batch, không chạy rules từ state trình bày.

**Tech Stack:** TypeScript, Phaser 4, Web Audio, Vitest, Playwright hiện có.

**Spec:** `combat-screen-review-2026-10-03.md` lỗi 5–12 và bảng animation/VFX; master `docs/superpowers/plans/2026-10-03-combat-screen-improvements.md`. Prerequisite: N1–N4 đã xanh.

## Global Constraints

- Tuân Global Constraints của master; không đổi CombatEvent/rules damage hoặc RNG chỉ để điều khiển animation.
- Dùng cùng `AnimationRuntime` của N1 cho mọi effect hữu hạn. Persistent unit/status loop thuộc scene, được dispose khi unit/scene mất.
- Không lấy presentation state làm đầu vào action/target/cost validation. Snapshot authoritative vẫn là nguồn chân lý.
- Metadata PvP chỉ chứa card đã xuất hiện trong `cardPlayed`; không gửi hand/draw/pending choice bí mật.
- UI tiếng Việt, không chỉ dùng màu để phân biệt cause/chủ/loại status.

## Review Focus

1. Hai ghế dùng cùng Hero: owner state/VFX/cost phải đúng player — A1.
2. Lá PvP mới công khai rồi Luân Hồi trong cùng batch: vẫn có tên/style, không lộ lá khác — A1.
3. Repeated hit xen reflect/status/death: không gộp mất thứ tự; impact gọi đúng một lần — A2.
4. Summon sinh rồi đánh/chết, Hero chết rồi hồi sinh trong một batch: anchor và presentation đúng — A3/A4.
5. Reduced motion, speed 2, mute hoặc shutdown giữa effect: cùng event order và không leak — A5.

## File Structure

- Create `apps/client/src/ui/combat-display.ts`: card metadata, status label/duration và anchors theo ghế.
- Create `apps/client/src/ui/combat-presentation.ts`: clone/reduce state trình bày; không thực thi gameplay.
- Create `apps/client/src/ui/combat-settings.ts`, `combat-audio.ts`: preferences và cue âm thanh.
- Modify `apps/client/src/ui/{event-animator,vfx,attack-style,animation-runtime,combat-playback}.ts`, `apps/client/src/scenes/combat-scene.ts`, client/server protocol và match-room chỉ cho revealed metadata.
- Tests trong `apps/client/test/`; browser checks ghép vào `apps/client/e2e/combat-visual.spec.ts` do U6 hoàn thiện. Dùng fixture N1; mỗi task có targeted tests độc lập.

### Task A1: Metadata, duration và ghế hiển thị

**Files**
- Create `apps/client/src/ui/combat-display.ts`; modify `ui/event-animator.ts`, `attack-style.ts`, `scenes/combat-scene.ts` renderCard/renderUnit/renderPartnerHand.
- Modify `apps/client/src/net/{protocol,match}.ts`, `ui/combat-playback.ts`; `apps/server/src/realtime/{protocol,match-room}.ts`; `packages/rules/src/index.ts` export `cardOwners`, `DURATION_STATUSES` có sẵn (`displayDuration` đã export); `docs/16-server-api.md`.
- Test `apps/client/test/combat-display.test.ts`, `attack-style.test.ts`; server `apps/server/test/realtime.test.ts`.

**Interfaces**
- Mirror client/server: `PublicPlayedCard = { instance: CardInstance; definition: CardDef }`; optional `revealedCards?: Record<string, PublicPlayedCard>` trên `match.events` và `PlaybackBatch`. Key là instanceId đã có `cardPlayed` trong chính batch.
- `resolvePlayedCard(data: GameData, before: CombatState, after: CombatState, instanceId: string, revealedCards?: Record<string, PublicPlayedCard>): PublicPlayedCard | undefined`: metadata lúc cast được server gửi ưu tiên; fallback before rồi after dùng `cardDefOf`.
- `statusDisplayValue(state: CombatState, unit: UnitState, status: StatusId): number`: gọi query hiện có `displayDuration(state, unit, status)`, chỉ duration status đổi đơn vị; stack giữ nguyên.
- `statusAppliedLabel(state: CombatState, unit: UnitState, status: StatusId, total: number): string`: dựng bản sao statuses của unit với raw total rồi đọc displayDuration, không mutate unit. Stack dùng STATUS_LABELS, ví dụ `Mạnh → 5`; duration dùng keyword name đầy đủ, ví dụ `Đóng Băng → 1 vòng` với PvP raw 2. DURATION_STATUSES (export set có sẵn) quyết định thêm `vòng`; không ghi `+` trước tổng.
- Extend NetMatch callback: `onPush: (events: CombatEvent[], view: CombatState, metadata?: { eventSeq: number; revealedCards?: Record<string, PublicPlayedCard> }) => void`; migrate scene hook để enqueue metadata, callers hai arguments vẫn tương thích.
- `Point = { x: number; y: number }`; `SeatAnchors = { draw: Point; discard: Point; hand: Point; resource: Point; reserve: Point }`; `seatAnchors(player: number, mySeat: number, mode: CombatState["mode"]): SeatAnchors`. A1 dùng vị trí hiện có; U1/U3 sẽ nhận anchors từ layout, giữ cùng type.

- [ ] **Step 1 — Viết regression đúng owner/duration/reveal.** Fixture PvP hai đội cùng m05: ghế 0 leveledUp, ghế 1 chưa; dùng cardOwners trong renderer và assert hai model có trạng thái riêng. Assertion:

```ts
expect(cardOwners(state, seat1Card)[0]?.player).toBe(1);
expect(cardOwners(state, seat1Card)[0]?.leveledUp).toBe(false);
expect(statusDisplayValue(pvp, unitWithFreeze2AndStrength5, "freeze")).toBe(1);
expect(statusDisplayValue(pvp, unitWithFreeze2AndStrength5, "strength")).toBe(5);
expect(statusAppliedLabel(pvp, unitWithFreeze2AndStrength5, "strength", 5)).toBe("Mạnh → 5");
expect(resolvePlayedCard(data, redactedBefore, recycledAfter, playedId, revealed)?.definition.name).toBe(playedDefinition.name);
expect(Object.keys(frame.revealedCards ?? {})).toEqual([playedId]);
```

`seat1Card`, `playedDefinition`, `playedId` lấy từ fixture, không invent card ID. Server test redactedBefore/recycledAfter lấy actual PvP view; khẳng định secret hand instance không xuất hiện trong JSON metadata. Với draw/resource ghế 1, spy effect nhận anchor ghế 1, không local anchor.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-display.test.ts test/attack-style.test.ts`; `pnpm --filter server exec vitest run test/realtime.test.ts`. FAIL ở owner/duration/reveal assertions.
- [ ] **Step 3 — Implement metadata/display helpers và wiring.** Server capture instance/definition công khai từ full before khi action `playCard` tạo cardPlayed, trước khi discard/recycle mất identity. Chỉ attach cardPlayed IDs, không full cards map. NetMatch chuyển metadata vào batch. Animator tách card context khỏi pre-action HP state; cast chưa resolve được phải có nhãn `Lá bài` và spell fallback rõ, không label rỗng. Renderer dùng cardOwners thay lookup chỉ defId. Draw/cardCreated/resource/reserve dùng event.player hoặc default ghế 0 cho event PvE; đối thủ PvP chỉ bay card back theo số lượng, không mở texture/name. Summon attack style client mapping `tho_ngoc`/`tho_ngoc_thuc_tinh` là `moon`.
- [ ] **Step 4 — Chạy xanh.** Lặp Step 2 + `pnpm typecheck`; kiểm PvP ghế 1 dùng same-Hero, first play damaging skill, draw/resource/partner đúng ghế. Không thay rules golden.
- [ ] **Step 5 — Commit:** `fix: resolve combat display metadata by seat and event`.

### Task A2: Multihit và tín hiệu impact

**Files**
- Modify `apps/client/src/ui/event-animator.ts`, `vfx.ts`; tests `apps/client/test/combat-hit-groups.test.ts`, `vfx-impact.test.ts`.

**Interfaces**
- Export từ event-animator `DamageEvent = Extract<CombatEvent, { type: "damageDealt" }>` và `groupDamageEvents(events: readonly CombatEvent[]): CombatEvent[][]`.
- Chỉ gộp damage liên tiếp, cùng source, target khác nhau. Gặp target lặp, source khác hoặc event không damage thì đóng group. Đây là nhóm animation bảo thủ, không tuyên bố tái dựng hitId rules. Không sort/drop event.
- Extend `AttackOptions` hiện có của vfx: `runtime: AnimationRuntime; onImpact?: () => void`. `playAttack` vẫn trả `Promise<void>` khi cleanup hoàn tất; gọi onImpact đúng một lần tại decisive impact dù darts có nhiều projectile. Abort trước impact không gọi; abort sau impact không gọi lần hai.

- [ ] **Step 1 — Viết test group và timing.** Trong test định nghĩa builder `damage(targetId: string): DamageEvent` source `h0`, amount/hpLost 1 blocked 0. Ví dụ:

```ts
expect(groupDamageEvents([damage("a"), damage("b"), damage("a"), damage("b")]).map(g => g.length)).toEqual([2, 2]);
expect(groupDamageEvents([damage("a"), damage("a"), damage("a")]).map(g => g.length)).toEqual([1, 1, 1]);
const trace: string[] = [];
// Fake runtime advances tween checkpoints manually, không dùng wall clock.
expect(trace).toEqual(["impact", "damage", "cleanup"]);
expect(onImpact).toHaveBeenCalledTimes(1);
```

Test slash/ribbon và darts separately: trace được callback ghi tại checkpoints; trước cleanup damage đã xuất hiện. Reflect/status/unitDied xen giữa tạo barrier; flatten group phải deepEqual input. Abort runtime trước/sau impact kiểm call count 0/1.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-hit-groups.test.ts test/vfx-impact.test.ts`; hiện grouping repeated target hoặc impact-after-cleanup FAIL.
- [ ] **Step 3 — Implement grouping + onImpact.** Giữ 14 style và spell; chỉnh từng style phát impact ở đúng collision. Damage text, badge update, hit reaction/flash bắt đầu tại callback cùng frame; phần trail/ribbon thu về chạy tiếp. Các target trong group song song; group tiếp theo chờ impact + nhịp tách 90 ms ở speed 1; cleanup được runtime quản lý và phải drain trước queue commit. Số float chia offset theo target/hit index, không stack một tọa độ. Không tăng projectile để biểu diễn thêm rules hit. Steal/reflect chỉ thể hiện quan hệ khi event/source metadata xác nhận; remove/apply kề nhau chưa đủ kết luận là cướp buff.
- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + `pnpm --filter client typecheck`; playtest Nộ Hỏa Liên Hoàn 3/5 hit, AoE và armor break: từng HP/armor step đọc được, hit count đúng event, reflect/death không bị chuyển thứ tự.
- [ ] **Step 5 — Commit:** `fix: align combat impact feedback and preserve repeated hits`.

### Task A3: Presentation state và cast ownership

**Files**
- Create `apps/client/src/ui/combat-presentation.ts`; modify `ui/event-animator.ts`, `scenes/combat-scene.ts`, `ui/vfx.ts` castCard; tests `apps/client/test/combat-presentation.test.ts`, `combat-cast.test.ts`.

**Interfaces**
- `createPresentation(before: CombatState): CombatState`: deep clone bằng clone helper rules hiện có nếu export, hoặc structuredClone; không mutation before/after.
- `applyPresentationEvent(data: GameData, visual: CombatState, event: CombatEvent, after: CombatState): void`: reducer chỉ dùng giá trị event và public definition/snapshot làm metadata.
- `PresentationBindings = { updateUnit(unitId: string, visual: CombatState): void; updateSeat(player: number, visual: CombatState): void; ensureSummon(unitId: string, visual: CombatState): void; updateMoon(visual: CombatState): void }`.
- Extend AnimContext với `after: CombatState; presentation: CombatState; bindings: PresentationBindings; revealedCards?: Record<string, PublicPlayedCard>; seatAnchors: Map<number, SeatAnchors>`. `state` trong AnimContext được loại bỏ sau migrate, dùng presentation cho visual và after cho metadata; action UI ngoài animator vẫn dùng authoritative scene state.
- `castCard` nhận visual clone thay card interactive thật; source card set input/hover disabled trong cast và biến mất/restore đúng commit/abort. Scene giữ `castingIds: Set<string>`, pointerover/out bỏ qua ID đang cast.

- [ ] **Step 1 — Viết reducer và cast regression.** Test state ban đầu target hp 20/armor 5; event damage amount 8 blocked 5 hpLost 3 rồi armorGained 2:

```ts
applyPresentationEvent(data, visual, { type: "damageDealt", sourceId, targetId, amount: 8, blocked: 5, hpLost: 3 }, after);
expect([target(visual).hp, target(visual).armor]).toEqual([17, 0]);
applyPresentationEvent(data, visual, { type: "armorGained", targetId, amount: 2 }, after);
expect(target(visual).armor).toBe(2);
expect(before).toEqual(originalBefore);
expect(after).toEqual(originalAfter);
```

`target(state)` là test helper lookup unit bằng targetId, không production API. Test statusApplied raw total replace thay vì add; unitDied → heroRevived cập nhật alive/hp; summoned → damage → died vẫn tạo anchor ở lúc summon; mouse pointerout không đổi clone đang cast; shutdown destroy clone và không mutate persistent card bị scene mới quản lý.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-presentation.test.ts test/combat-cast.test.ts`.
- [ ] **Step 3 — Implement reducer/bindings.** Damage trừ blocked khỏi armor và hpLost khỏi HP, không tính lại mitigation; hpLost trừ amount, heal tăng actual amount clamped maxHP; armorRemoved đặt 0; statusApplied đặt tổng và statusRemoved xóa. Resource dùng event.player. unitDied đặt chết; revive dùng event.hp; leveledUp/bossPhase lấy form metadata từ after. Summon mới dựng từ summon definition + event owner/player, không chép hp=0 từ after nếu nó chết về sau. CardsDrawn/Discarded/Recycled/Played cập nhật vùng bài chỉ theo identity công khai; redacted IDs không thành lá có mặt trước. Seed metadata thiếu từ after, không chép toàn bộ cuối state trước event.

Update HP/armor/status tại impact đối với damage, tại nhịp event đối với hiệu ứng khác; patch objects qua bindings, không renderAll giữa batch. Tạo summon view/anchor ngay để summonActed tìm được. Giữ clone cast tách khỏi hover hand. Cuối batch commit snapshot cuối và render đối chiếu; nếu visual khác snapshot vì event không mô tả hết field, authoritative snapshot thắng, không sửa luật. Không emit effect lần hai khi reconciliation.

- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + A1/A2 tests + `pnpm --filter client typecheck`; fixture đã có freeze/reflect/guard + same Hero, lấy từng checkpoint HP và kết quả final bằng after; không mutation/golden diff.
- [ ] **Step 5 — Commit:** `feat: drive combat visuals from event presentation state`.

### Task A4: Intro, lifecycle và các nhịp còn thiếu

**Files**
- Modify `apps/client/src/scenes/combat-scene.ts`, `ui/event-animator.ts`, `vfx.ts`, `hud-art.ts`; test `apps/client/test/combat-lifecycle.test.ts`.

**Interfaces**
- `buildIntroEvents(state: CombatState, initialEvents: readonly CombatEvent[]): CombatEvent[]` export từ event-animator: chỉ chọn combatStarted/moonDecreesRolled/turnStarted/cardsDrawn; gọi một lần mỗi scene instance khi bắt đầu trận mới, không rejoin. Nếu match.start không mang initialEvents, dựng cosmetic combatStarted/moonDecreesRolled từ snapshot công khai; không chạy lại createCombat hoặc giả draw action.
- `HpLossLook = { color: number; label: string }`; `hpLossLook(cause: Extract<CombatEvent, { type: "hpLost" }>["cause"]): HpLossLook` export từ attack-style. Labels từ glossary: burn cam, reflect xanh, bloodMoon/bloodPact đỏ, decree trắng trăng, loseHp tím; chữ nguyên nhân luôn hiện.
- Unit flash lấy w/h từ view/layout bounds; death/revive/level-up dùng bindings A3 và runtime N1. Phase overlay phủ visible design bounds theo camera, không chỉ hình chữ nhật 1280×720 giữa viewport EXPAND.

- [ ] **Step 1 — Viết lifecycle regression.** Assert intro không lặp khi rejoin; cardsDrawn đã có trong snapshot đầu chỉ reveal visual, không push duplicate hand IDs. Spy bindings kiểm:

```ts
expect(trace).toEqual(["summon-view", "summon-hit", "summon-death"]);
expect(finalHero.alive).toBe(true);
expect(finalHero.hp).toBe(reviveEvent.hp);
expect(finalUnitView.alpha).toBe(1);
expect(flashBounds).toEqual(actualUnitBounds);
```

Trace lấy từ animator callbacks của actual events, không hardcode production trace. Assert armorRemoved có badge break; discard/recycle đúng seat anchors; boss/combo banner tới tại event trước endTurn unlock; rejoin không intro; abort giữa phase transition không còn temporary overlay/tween.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-lifecycle.test.ts`.
- [ ] **Step 3 — Implement các nhịp.** Intro 600–800 ms speed 1, mở mulligan sau queue; draw dùng card-back HUD/destination thực thay 70px slot cố định. Discard bay về discard, Luân Hồi nối discard→draw; armorRemoved pop/break tại badge. Death chuyển thành faded fallen view vẫn nhận biết, không fade hết rồi render lại như còn sống; revive sáng lên tại HP event; level-up transition frame/art giữ state chính xác. Boss phase/combo banner là queue event, không thông báo trễ sau batch. Moon shift thường 550 ms, đặc biệt do card 900 ms speed1, tint/lighting crossfade; tên/lệnh cập nhật khi wheel tới badge. Huyết Nguyệt đỏ overlay nhẹ nhưng giữ pha gốc. Mọi temporary object scope-owned.
- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + `pnpm --filter client typecheck`; playtest offline mới/rejoin online, Linh Thú chết theo chủ, Hồi Hồn, Thức Tỉnh, boss phase/combo, Luân Hồi. Không duplicate intro hoặc stale fallen view.
- [ ] **Step 5 — Commit:** `feat: complete combat lifecycle and phase feedback`.

### Task A5: Tốc độ, reduced motion, audio và budget

**Files**
- Create `apps/client/src/ui/combat-settings.ts`, `combat-audio.ts`; modify `animation-runtime.ts`, `vfx.ts`, `event-animator.ts`, combat-scene settings/input; test `apps/client/test/combat-settings.test.ts`, `combat-audio.test.ts`, `combat-timing.test.ts`.

**Interfaces**
- `CombatSettings = { speed: 1 | 2; reducedMotion: boolean; volume: number }`.
- `loadCombatSettings(storage: Pick<Storage, "getItem">, prefersReducedMotion: boolean): CombatSettings`; `saveCombatSettings(storage: Pick<Storage, "setItem">, settings: CombatSettings): void`. Key `vong-nguyet.combat-settings.v1`, invalid JSON/fields fallback speed 1, volume 0.5; reducedMotion mặc định media preference trừ saved explicit bool.
- Extend N1 runtime creator `createAnimationRuntime(scene: Phaser.Scene, signal: AbortSignal, settings?: CombatSettings): AnimationRuntime`; runtime thêm `duration(ms: number): number` = ms/speed; wait/tween tự scale duration đúng một lần, caller không chia thêm. Config bất biến trong batch; settings mới áp dụng batch sau.
- `CombatCue = "cast" | "hit" | "block" | "heal" | "death" | "moon" | "levelUp" | "victory" | "defeat" | "draw"`; `CombatAudio` constructor(settings: CombatSettings), `unlock(): Promise<void>`, `configure(settings: CombatSettings): void`, `play(cue: CombatCue): void`, `dispose(): void`. Procedural Web Audio oscillator/noise, không thêm file âm thanh/dependency; không tạo AudioContext trước user gesture. Terminal cue tại combatEnded hoặc terminal recovery đầu tiên, không lặp khi match.end settlement tới sau đó.
- `ShakeBudget` constructor(reducedMotion: boolean), `allow(durationMs: number): boolean`; mỗi action tối đa 2 lần, tổng ≤120 ms, amplitude ≤0.0025; reducedMotion từ chối tất cả shake.

- [ ] **Step 1 — Viết settings/audio/timing tests.** Fake storage/AudioContext, fake runtime clock và fixture actual enemy-turn events (3 địch × 3 intents). Assertion:

```ts
expect(loadCombatSettings(corruptStorage, true)).toEqual({ speed: 1, reducedMotion: true, volume: 0.5 });
expect(runtime2.duration(300)).toBe(150);
expect(reducedShake.allow(60)).toBe(false);
expect(defaultEnemyTurnMs).toBeLessThanOrEqual(3000);
expect(eventsAtSpeed2).toEqual(eventsAtSpeed1);
expect(mutedAudio.start).not.toHaveBeenCalled();
```

`defaultEnemyTurnMs` đo tổng fake scheduler timeline của animator, không tổng constants; fixture không death/up/combo đặc biệt. Death/up/combo fixture ≤5000 ms. Test autoplay rejection không uncaught; context/node dispose once; speed midbatch không đổi nhịp đang chạy; volume clamp 0..1; no oscillator/node sau shutdown.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-settings.test.ts test/combat-audio.test.ts test/combat-timing.test.ts`.
- [ ] **Step 3 — Implement settings + nhịp.** Settings glyph mở modal tiếng Việt với tốc độ 1×/2×, giảm chuyển động, volume/mute; Esc đóng modal trước hủy target, E không endTurn khi modal mở. Routine cast hold 220–300 ms, flight 120–240 ms, float fade 180–250 ms speed 1; routine intent label 120 ms chạy cùng flight, không cộng thêm hold vào từng intent. Cosmetic floats không giữ từng hit cả fade; runtime drain vẫn cleanup trước commit. Giảm hold lặp để đạt budget, không drop/reorder damage hay abort theo deadline. Reduced motion dùng tint/short fade thay lunge/shake và giảm motes. Audio cue impact cùng callback A2; unlock từ pointer/key gesture, graceful silent nếu audio không khả dụng. Không pause deadline server khi xem modal.
- [ ] **Step 4 — Chạy xanh + gate đợt 2.** Commands Step 2, `pnpm test`, `pnpm typecheck`, `pnpm build`. Playtest settings/speed/reduced/mute và xem timeline default/exceptional fixture. Gameplay/replay golden unchanged; ghi duration đo được trong playtest notes.
- [ ] **Step 5 — Commit:** `feat: add combat motion and audio preferences`.

## Nghiệm thu đợt 2

- [ ] Có regression cho cả 5 Review Focus; đã kiểm visual thật của 14 style + spell ở speed 1/2.
- [ ] Same-Hero/seat 1, public PvP reveal, multihit/reflect/death/revive/summon và stale-abort đều đúng.
- [ ] Không còn effect finite chạy ngoài runtime; persisted settings không chứa state/RNG/action.
- [ ] Queue chưa mở input khi temporary cleanup còn chạy; terminal kết thúc vẫn theo N3/N4.
- [ ] Commit chứa code/tests/docs của task, không user diff; ghi PASS/FAIL thực tế, không dùng baseline review làm proof.
