# Combat UI Layout and Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thông tin chiến đấu dễ đọc, thao tác rõ ràng và layout hoạt động ở cả PvE/PvP/co-op; hoàn thiện portrait thiếu và kiểm ảnh thật.

**Architecture:** Geometry thuần là nguồn chung cho renderer/animator, với component nhỏ cho Moon HUD, card view và inspector. Dùng display/presentation/settings từ A1–A5; UI query lấy authoritative state và art preload theo cơ chế hiện có.

**Tech Stack:** TypeScript, Phaser 4, Vitest, Playwright; asset PNG/WebP qua pipeline Vite hiện có, không dependency mới.

**Spec:** `combat-screen-review-2026-10-03.md` bảng UI/layout, art và nghiệm thu; master `docs/superpowers/plans/2026-10-03-combat-screen-improvements.md`; `docs/04-glossary.md`, `docs/05-ui-combat-screen.md`, `docs/08-character-prompts.md`. Prerequisite: A1–A5 xanh.

## Global Constraints

- Tuân master; giữ design 1280×720, EXPAND, UI tiếng Việt và gameplay/replay không đổi.
- Font tính theo design px; compact body không dưới 11 px, preview body 14 px. Không tự viết lại nội dung rules trong data chỉ để vừa khung.
- Information visibility theo actual mode/seat, không mở bài draw/hand/pending choice của đối thủ PvP.
- Modal/tooltip clamp theo visibleWorld; keyboard và pointer cùng input lock. Mỗi panel có đường đóng bằng Esc và nút rõ.
- Không tạo 68 tranh lá bài trong đợt này: card art là optional hiện hành, tag/owner design là fallback chủ ý. Hero/enemy/summon thiếu là deliverable bắt buộc U5.
- U5 mới dùng skill imagegen khi tạo bitmap; dùng asset có sẵn làm reference trước khi tạo. Không gọi image generation lúc chỉ viết plan.

## Review Focus

1. Full hand/mulligan và text dài ở 1024×576: đọc được preview, không che nút hành động — U1/U2/U6.
2. Hai summon co-op, nhiều status + seal: không chồng controls/HP hoặc mất tooltip — U3.
3. Đối thủ PvP, partner co-op và effective cost theo seat: không lộ identity hoặc hiển thị cost sai — U2/U4.
4. Resize cao/wide giữa cast, modal mở hoặc target chọn: queue/UI interaction nhất quán — U1/U2/U6.
5. Art thiếu/load lỗi/upgraded form: fallback rõ, không crash; asset đủ inventory — U3/U5.

## File Structure

- Create `apps/client/src/ui/combat-layout.ts`, `moon-hud.ts`, `combat-card-view.ts`, `combat-inspector.ts`.
- Modify `apps/client/src/scenes/combat-scene.ts`, `ui/{theme,card-tooltip,event-animator,hud-art}.ts`, `packages/rules/src/{queries,index}.ts` cho cost breakdown thuần.
- Create `apps/client/test/{combat-layout,moon-hud,combat-card-view,combat-unit-view,combat-inspector,combat-assets}.test.ts`, `packages/rules/test/cost-breakdown.test.ts`.
- Create `apps/client/e2e/helpers/combat.ts`, `e2e/combat-visual.spec.ts`; extend existing `e2e/{pvp,coop}.spec.ts`.
- Add art dưới `apps/client/public/assets/{heroes,enemies,summons}/`; create `docs/combat-visual-assets.md`; update `docs/05-ui-combat-screen.md`, `docs/playtest-notes.md`.

### Task U1: Geometry chung, Moon HUD và panel Chọn Pha

**Files**
- Create `ui/combat-layout.ts`, `moon-hud.ts`; modify combat-scene renderHud/renderMoonChoice/renderHand anchors, theme COMBAT_LAYOUT và event-animator draw destination.
- Test `apps/client/test/combat-layout.test.ts`, `moon-hud.test.ts`.

**Interfaces**
- `Rect = { x: number; y: number; w: number; h: number }` dùng x/y góc trái trên. `CombatLayout = { units: Map<string, Rect>; seats: Map<number, SeatAnchors>; hand: Rect; controls: Rect; moon: Point; phaseSlots: Point[]; phaseLabel: Rect }`.
- `computeCombatLayout(state: CombatState, mySeat: number): CombatLayout`: thuần, không scene/window; unit IDs đúng actual state. `handSlots(count: number, area: Rect, cardWidth?: number): Point[]`: centered, gap=min(120,(area.w-cardWidth)/(count-1)); count 0→[], count 1→center; cardWidth default110.
- `MoonHudModel = { current: number; phases: { index: number; name: string; decreeName: string; description: string }[]; bloodRounds: number }`; `moonHudModel(data: GameData, state: CombatState): MoonHudModel`; `renderMoonHud(scene: Phaser.Scene, model: MoonHudModel, layout: CombatLayout): Phaser.GameObjects.Container`.
- `fitChoicePanel(textHeight: number, visible: Rect): Rect`: width 360, height=min(textHeight+96, visible.h-32), clamp trong visible; nội dung quá cao cuộn, không giảm font. Render đo Text.height thật trước đặt panel.

**Geometry chốt ở design 1280×720**
- Hero PvE/PvP: 136×196, centers x=470/640/810, own y=424 và opposing y=200. Enemy PvE spacing theo số lượng, ở cùng vùng x=300..920; không đi vào cột controls.
- Co-op: Hero 100×148, centers x=300/412/524 cho own, 660/772/884 cho partner, y=424; title nhóm tại y=330. Summon 80×108 tại centers x=1000/1100, y=410; PvP opposing summon tại y=200. Mỗi slot gắn player, không gắn defId.
- Hand area x=130,y=556,w=1010,h=160; centers y=636, fully visible trong trạng thái thường/mulligan/choice. Selected hover center y=600 scale1.15; chỉ selected card được lên lớp cao, đè tạm row own có chủ đích. Partner hand compact nằm x=656..930,y=532, không thêm full hand thứ hai.
- Controls rect x=1154,y=48,w=104,h=652: resource center1206/104; blood pact1206/524 r52; end turn1206/648 r52. Summon right edge1140 < control left1154, bottom464 < blood pact top472.
- Current moon center640/40; 8 phase slots x=464/504/544/584/696/736/776/816,y=40 (icons32); current label rect390/72/500/24. Eight schedule icons đều xem được tooltip phase/decree, current icon có indicator. Blood badge độc lập cạnh current, hiển thị rounds, không thay pha gốc.
- Own seat draw(54,424), discard(54,504), hand(635,636), resource(1206,104), reserve(1206,144). PvP other seat draw(54,168), discard(54,248), hand card-back marker(156,168), resource(1206,248), reserve(1206,288). Co-op partner draw(970,532), discard(1080,532), hand(790,532), resource(1080,316), reserve(1130,316), markers24px. Enemy PvE resource/reserve dùng unitId badge anchors, không giả seat. Animator dùng chính seats map, không thêm hệ tọa độ thứ hai.

- [ ] **Step 1 — Viết tests geometry/Moon.** Dùng fixture N1 và summon thực từ rules. Assertions:

```ts
expect(model.phases).toHaveLength(8);
expect(model.bloodRounds).toBe(2);
expect(model.current).toBe(state.moonIndex);
expect(handSlots(10, layout.hand).every(p => p.x - 55 >= 130 && p.x + 55 <= 1140)).toBe(true);
expect(overlap(summonRect, layout.controls)).toBe(false);
expect(fitChoicePanel(900, { x: 0, y: 0, w: 1280, h: 720 }).h).toBe(688);
```

`overlap(a: Rect,b: Rect): boolean` test helper strict intersection; test all unit rects excluding deliberately hovered card. Current decree label lấy data thật, tooltip đủ8. Panel nhiều dòng cuộn và Esc đóng; layout resize giữa batch được N1 defer, commit rebuild anchors một lần.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-layout.test.ts test/moon-hud.test.ts`.
- [ ] **Step 3 — Implement geometry và Moon HUD.** Thay magic hand/draw/flash positions bằng layout. Giữ background moon socket khi có art: translate Moon HUD theo socket nhưng schedule/label vẫn clamp trong header; không đổi unit/control rect. Phase/decree name label wrap tối đa2 dòng 12px; tooltip giữ toàn văn. Choice đo text/scroll như interface; không dồn font nhỏ. Render/animator dùng cùng Point/Rect/SeatAnchors (import type từ combat-display), xóa COMBAT_LAYOUT field trùng đã migrate.
- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + `pnpm --filter client typecheck`; kiểm cả4viewport và 8phase/blood rounds/long decree/10cards. Screenshot chính thức tại U6.
- [ ] **Step 5 — Commit:** `feat: unify combat layout and expose moon schedule`.

### Task U2: Card readability, cost, ownership và targeting

**Files**
- Create `apps/client/src/ui/combat-card-view.ts`; modify `theme.ts` OWNER_COLORS, `card-tooltip.ts`, combat-scene renderCard/renderPartnerHand/target handlers.
- Modify `packages/rules/src/queries.ts`, `index.ts`; test `packages/rules/test/cost-breakdown.test.ts`, client `test/combat-card-view.test.ts`.

**Interfaces**
- Pure query `CardCostBreakdown = { base: number; effective: number; modifiers: { kind: "phaseOrDecree" | "chosen" | "firstOwn" | "bloodMoon" | "ownTag" | "turnDiscount"; amount: number }[]; floor: number }`; `getCardCostBreakdown(data: GameData, state: CombatState, instanceId: string, player?: number): CardCostBreakdown` export rules.
- Extract existing getEffectiveCost arithmetic đúng thứ tự vào query, `getEffectiveCost` delegate `.effective`. Modifier amount signed: tăng cost positive, discounts negative; floor áp trước discounts như hiện tại. Không đổi behavior/sửa data. Không khẳng định tổng raw modifier bằng final khi có floor/clamp.
- `CombatCardModel = { instanceId: string; ownerNames: string[]; ownerColors: number[]; title: string; fullText: string; baseCost: number; effectiveCost: number; costReasons: string[]; playable: boolean; disabledReason: string | null; category: "hero" | "bond" | "weapon" }`.
- `combatCardModel(data: GameData, state: CombatState, instanceId: string, player?: number): CombatCardModel`: cardOwners/cardDefOf/getCardCostBreakdown/isCardPlayable từ authoritative state. Reason priority: dead→freeze→requiresBloodMoon→insufficientPower→noTarget→turn/choice/done. Translate actual ownerError sang tiếng Việt, không expose English exception.
- `renderCombatCard(scene: Phaser.Scene, model: CombatCardModel, position: Point): Phaser.GameObjects.Container`; compact 110×160 title12/body11/cost16, description tối đa4 dòng có ellipsis, không shrink dưới11. Full preview width320/body14, scroll khi text/keywords cao hơn visible area. `showCardTooltip` thêm optional presentation `{ effectiveCost: number; costReasons: string[]; disabledReason?: string }`, giữ call site ngoài combat tương thích.

- [ ] **Step 1 — Viết tests cost/model.** Fixtures actual chosen/passives/tag/decree/bloodMoon và both seats; assertions:

```ts
expect(getCardCostBreakdown(data, state, id, 1).effective).toBe(getEffectiveCost(data, state, id, 1));
expect(model.effectiveCost).toBe(partnerEffectiveCost);
expect(model.ownerNames).toHaveLength(bondInstance.ownerIds.length);
expect(Object.keys(OWNER_COLORS).sort()).toEqual(Object.keys(data.heroes).sort());
expect(compactBodyFont).toBe(11);
expect(previewBodyFont).toBe(14);
expect(disabledModel.disabledReason).toBe("Chủ lá đang Đóng Băng");
```

Cost test pin expected numeric values trước refactor từ actual rules fixtures, không chỉ assert hai hàm mới delegate nhau. Test floor→discount cho cost0/floor1/discount1 giữ0; first discount đã dùng không áp; selectedcard retained lift, valid targets chỉ getValidTargets trả về; Esc/rightclick clear aim, no dispatch; hover busy cast dùng A3 ownership.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter rules exec vitest run test/cost-breakdown.test.ts`; `pnpm --filter client exec vitest run test/combat-card-view.test.ts`.
- [ ] **Step 3 — Implement query và card component.** Palette đủ20 bằng explicit Record theo Hero IDs, dùng tên/glyph cùng màu; Song Hành hiển thị hai chủ + nhãn, Binh Khí glyph/nhãn riêng. Tooltip dòng đầu dùng effective cost, cost gốc trong ngoặc và reasons từ query; partner tile dùng player.index đúng ghế. Hand đầy vẫn scan được title/cost/owner; hover full preview ở vùng trống, clamp/scroll; selected card giữ lift đến cancel/commit. Aim từ selected card/source tới hovered validtarget, no aim tới invalid; hit area/outline đúng rect. Busy/endturn text `Đang xử lý…`, enemy/opponent/partner turn distinct; disabled appearance phản ánh N4 lock, modal A5 chặn hotkey. Rejection giữ selection nếu vẫn legal và hiện reason gần hand, không chỉ console.
- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + `pnpm test` + `pnpm typecheck` vì đụng pure query. Golden unchanged; kiểm cost tooltip/partner/two-owner same Hero, max text đủ keywords, E/Esc/rightclick và busy click không gửi action.
- [ ] **Step 5 — Commit:** `feat: improve combat card readability and targeting feedback`.

### Task U3: Unit HUD, status overflow và co-op groups

**Files**
- Modify combat-scene renderUnit/renderHero/renderEnemy/renderSummon/renderStatusIcons, `ui/combat-layout.ts`, `event-animator.ts` bounds; test `apps/client/test/combat-unit-view.test.ts`, `combat-layout.test.ts`.

**Interfaces**
- Export từ combat-display `StatusBadgeModel = { id: StatusId | "seal" | "overflow"; label: string; value?: number; hiddenCount?: number }`.
- `statusBadgeModels(state: CombatState, unit: UnitState, width: number): StatusBadgeModel[]`: perRow=floor((width-16)/24), tối đa2 rows; nếu quá capacity giữ capacity-1 badges + overflow `+N`. Theo thứ tự status state, seal cuối; không sort để tránh gợi ý thứ tự xử lý sai. Full tooltip giữ toàn bộ status/source/actual duration.
- `heroProgressLabel(data: GameData, state: CombatState, hero: HeroState): string | null`: counter lấy hero.levelUpCounter; threshold đọc def.levelUp đúng công thức `hero.constellation >= 2 && !hero.pvp ? constellationThreshold : threshold` ở rules/levelup.ts; leveledUp trả null. Test Hero PvP constellation2 vẫn dùng threshold thường, sửa tooltip/frame trace hiện tại cùng công thức. Không phát/tính lại level-up action.
- Unit views expose bounds bằng layout map, dùng A3 bindings để patch HP/armor/status; fallback silhouette + tên + faction/seat không cần asset loaded.

- [ ] **Step 1 — Viết overflow/layout tests.** Fixture13status + sealedBy ở co-op width100 => perRow3, capacity6: giữ5 và overflow9 (tổng14). Assert:

```ts
expect(statusBadgeModels(state, unitWithAllStatusesAndSeal, 100)).toHaveLength(6);
expect(statusBadgeModels(state, unitWithAllStatusesAndSeal, 100).at(-1)?.hiddenCount).toBe(9);
expect(fullTooltipStatusNames).toHaveLength(14);
expect(heroProgressLabel(data, state, upgradedHero)).toBeNull();
expect(overlap(layout.units.get(summon1.id)!, layout.units.get(summon2.id)!)).toBe(false);
expect(fallbackName).toBe(heroDefinition.name);
```

Test summon2 vs controls, enemyname/HP/status rectangles không overlap; guard source link tới đúng unitId/cross-seat; actual view flash bounds100×148/80×108; texture fail vẫn render targetable hit area.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-unit-view.test.ts test/combat-layout.test.ts`.
- [ ] **Step 3 — Implement HUD/status và groups.** HP badge giữ current; maxHP trong tooltip và compact `current/max` khi đủ chỗ. Thức Tỉnh hiển thị counter/threshold ngắn trong reserved footer, có label đầy đủ tooltip. Status tối đa2rows ở vùng footer riêng không phủ HP/name; overflow mở tooltip/inspector list có seal/source. Giảm emitter khi nhiều status: tối đa3 ambient emitters/unit, ưu tiên freeze→burn→guard rồi remaining stateorder; tất cả badges vẫn có, particle không thay thông tin. Guard tether khi hover status, đúng sourceId; không vẽ mọi tether liên tục. Co-op titles `Đội của bạn`/`Đồng đội` + name/ready state; hai summon ở slot của đúng player. Silhouette fallback theo hero/enemy/summon, nhãn đã chết/Thức Tỉnh vẫn rõ.
- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + `pnpm --filter client typecheck`; playtest dense-status6Hero2summon, fallen/revive/guardcrossseat và unavailable texture. Các controls có gap như U1.
- [ ] **Step 5 — Commit:** `feat: clarify combat unit status and coop layout`.

### Task U4: Pile inspector và relic/augment HUD

**Files**
- Create `apps/client/src/ui/combat-inspector.ts`; modify combat-scene HUD/pilehandlers, event-animator trigger handlers; test `apps/client/test/combat-inspector.test.ts`.

**Interfaces**
- `PileModel = { title: string; count: number; cards: { instanceId: string; definition: CardDef }[]; hidden: boolean }`; `pileModel(data: GameData, state: CombatState, player: number, zone: "draw" | "discard", mySeat: number): PileModel`.
- Draw inspector mọi mode chỉ count + thông báo `Thứ tự chồng rút được giữ kín`, không enumerate actual draw order. Discard lấy card public có definition từ state; thiếu identity thì count-only. Không dùng server fullstate trong UI.
- `RelicHudEntry = { id: string; kind: "relic" | "runRelic" | "augment"; name: string; description: string; count?: number }`; `relicHudEntries(data: GameData, state: CombatState, player: number): RelicHudEntry[]`. Gear inventory theo current state; augment list hiển thị như hiện có ở encounter tooltip, không invent augmentTriggered event.
- `InspectorView` có `openPile(model: PileModel): void`, `openRelic(entry: RelicHudEntry): void`, `close(): void`, `destroy(): void`; tạo scene-owned, Esc priority như settings. Trigger anchor map keyed `${player}:${kind}:${id}`, runRelicTriggered/relicTriggered flash đúng entry, weaponTriggered flash Hero weapon icon.

- [ ] **Step 1 — Viết visibility/trigger tests.** Assert:

```ts
expect(pileModel(data, pvpView, otherSeat, "draw", mySeat)).toMatchObject({ hidden: true, cards: [] });
expect(pileModel(data, pve, 0, "draw", 0).cards).toEqual([]);
expect(ownDiscard.cards.map(c => c.instanceId)).toEqual(publicDiscardIds);
expect(triggerAnchor).toBe(anchors.get(`${player}:runRelic:${event.runRelicId}`));
expect(unknownTrigger).not.toThrow();
```

Fixture co-op partner discard public/full view theo rules; opponent missing metadata không lookup static card bằng redacted sentinel. Modal open chặn E/cast, Esc close only; trigger cùng relic ở2seat flash đúng1; unknown removed relic fallback text cóname/khôngcrash.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-inspector.test.ts`.
- [ ] **Step 3 — Implement inspector/HUD.** Icon strip dưới encounter header bên trái (x16..208,y72), 6icons/row, wrap2rows tối đa10 icons hiển thị + overflow inspector; enemy leftedge tối thiểu232 tránh đè strip. Tooltip từng món; trigger flash tại icon rồi label ngắn, không text-only ở giữa màn. Discard inspector scroll full cards/keywords, count khớp state; draw chỉ count, có link về deck composition UI hiện có nếu đó là dữ liệu riêng người chơi biết, không đọc draw identity/order. Close/dispose sạch khi shutdown; overlay không làm renderAll trong queue.
- [ ] **Step 4 — Chạy xanh.** Commands Step 2 + `pnpm --filter client typecheck`; inspect offline run/PvP/co-op, trigger relic/run relic/weapon, kiểm không lộ bài và hotkeymodal.
- [ ] **Step 5 — Commit:** `feat: expose public combat piles and relic feedback`.

### Task U5: Bổ sung art và inventory có kiểm ảnh

**Files**
- Add dưới `apps/client/public/assets/heroes/`: portrait normal cho m06,m07,m08,m10,f08,f05,f06,f07,f09,m09; portrait `{heroId}_up` cho cả20Hero.
- Add dưới `apps/client/public/assets/enemies/`: puppet_guard,shadow_fox,moon_ape,book_wraith,black_guard,fox_king,eclipse_lord,thanh_loan_thi_quan,huyen_vu_thi_quan,bach_lo_thi_quan,khao_hach_chi_linh,hac_y_mat_tham,vo_nguyet_am_sat,vo_nguyet_nghi_si,vo_nguyet_anh_chu.
- Add dưới `apps/client/public/assets/summons/`: tho_ngoc,tho_ngoc_thuc_tinh.
- Modify combat-scene renderSummon/portrait lookup và rounded crop cache; dùng `apps/client/vite.config.ts` virtual manifest hiện có cho preload; create `docs/combat-visual-assets.md`, `apps/client/test/combat-assets.test.ts`.

**Interfaces**
- Dùng lookup hiện có `${category}:${key}`, không service/manifest framework mới. Plugin `assetsManifest()` trong `apps/client/vite.config.ts` scan các thư mục public/assets, tự thêm summons vào `virtual:assets-manifest`; combat preload loop đã load mọi category. Không thêm import.meta.glob/pipeline song song. Một key chỉ có một extension để không bị scan ghi đè.
- `{heroId}_up` là art Thức Tỉnh chung base/alt trong phạm vi này; frame/name vẫn phân biệt form theo data. Không tự tạo40up art; inventory ghi rõ shared art.
- Hero/enemy portrait 2:3, ít nhất768×1152 source PNG/WebP, không chữ baked vào ảnh; head/face nằm trong vùng crop upper2/3. Summon source square tối thiểu512×512, chủ thể không bị cắt trong80×108 view.
- `docs/combat-visual-assets.md`: bảng ID, normal/up path, status, source/tool/reference, dimensions và crop QA; không ghi personal file paths/secret tool payload. Background hiện tại giữ artwork, A4 lighting + UI scrim bảo vệ chữ; không thay art nền nếu không cần.

- [ ] **Step 1 — Viết inventory regression.** Dùng actual data IDs/glob file paths, assert47 file thiếu baseline được lấp (10normal+20up+15enemy+2summon) và tất cả definitions có art hoặc fallback test rõ:

```ts
expect(missingNormalHeroes).toEqual([]);
expect(missingUpHeroes).toEqual([]);
expect(missingEnemies).toEqual([]);
expect(missingSummons).toEqual([]);
expect(duplicateTextureKeys).toEqual([]);
```

Test lookup missing file trả fallback từ U3; không yêu cầu test pixel appearance bằng code. Asset quality phải nhìn ảnh thật Step4.

- [ ] **Step 2 — Chạy đỏ.** `pnpm --filter client exec vitest run test/combat-assets.test.ts`; FAIL inventory đúng IDs trên, không đổi test thành bỏ qua missing.
- [ ] **Step 3 — Tạo art và tích hợp preload.** Đọc skill imagegen và `docs/08-character-prompts.md`; inspect reference Hero m05/f04 hiện có. Style đồng nhất gufeng/anime, jewelry/ornament vàng, màu faction, nhân vật và silhouette nhận biết được; awakened tăng motif/lore, giữ identity. Enemy/summon theo lore actual data. Tạo theo nhóm nhỏ, chọn ảnh đạt crop rồi lưu đúng filename; không ghi đè10normal art có sẵn. Tạo inventory cùng từng asset. Texture cache rounded crop phải phân biệt source key + w/h + form; không reuse cache normal cho up hoặc co-op size.
- [ ] **Step 4 — Chạy xanh + visual QA asset.** Commands Step2 + `pnpm --filter client build`; mở contact sheet và từng asset crop trên136×196,100×148,80×108; so normals/up, kiểm mặt/tay/weapons/chữ dư/texture loaderrors. Visual defects sửa/generate lại trước ghi PASS; contact sheet lưu trong `test-results/combat-visual/assets/`. Nếu tool art không khả dụng, giữ task chưa hoàn thành và ghi đúng blocker, không coi silhouette là đủ U5.
- [ ] **Step 5 — Commit:** `art: complete combat hero enemy and summon portraits`.

### Task U6: Browser nghiệm thu và tài liệu UI

**Files**
- Create `apps/client/e2e/helpers/combat.ts`, `e2e/combat-visual.spec.ts`; extend `e2e/pvp.spec.ts`, `coop.spec.ts` cho recovery/layout.
- Update `docs/05-ui-combat-screen.md`, `docs/playtest-notes.md`; không đổi gameplay docs/data/golden.

**Interfaces**
- E2E helper `clickDesign(page: Page, x: number, y: number): Promise<void>` và `waitIdle(page: Page): Promise<void>` dùng pattern `window.__vn`/camera hiện có, không raw fixedscreen click.
- `setupOfflineCombat(page: Page, scenario: "default" | "denseStatus" | "longChoice" | "summonRevive" | "multiHit"): Promise<void>` dùng actual data/rules/session debug harness hiện có, seed42. Direct state fixture chỉ trong e2e, không thêm cheat route production.
- `CombatProbe = { inputLocked: boolean; busy: boolean; units: { id: string; bounds: Rect; hp: number; armor: number }[]; texts: string[]; temporaryFxCount: number; handCount: number }`; `probeCombat(page: Page): Promise<CombatProbe>` đọc scene objects/bindings, không expose secret authoritative state lên browser.
- `captureCombat(page: Page, viewport: string, scenario: string): Promise<void>` lưu `test-results/combat-visual/<viewport>/<scenario>.png`. Đặt child container name/data-role cho probe ổn định, không phụ thuộc displayList index. Helper không assert animation bằng sleep cố định; polling queue/impact checkpoints với bounded timeout.

- [ ] **Step 1 — Viết browser regression trước polish cuối.** Các4viewport:1280×720,1366×768,1024×576,1280×900. Mỗi viewport chạy hand0/1/8/10cards, denseStatus13+seal, longChoice, co-op6Hero2summon và PvP sameHero ở suite online. Thêm bảng mất mạng/kết quả pending/complete, verify nút thoát và chữ không clipping. Assertions:

```ts
expect(probe.units.every(u => u.bounds.x + u.bounds.w <= 1154)).toBe(true);
expect(probe.temporaryFxCount).toBe(0); // sau queue idle, loại persistent emitters
expect(probe.handCount).toBe(expectedHandCount);
expect(probe.texts).toContain("Đang xử lý…"); // checkpoint trong playback
expect(actionSendCountDuringBusy).toBe(0);
```

Thêm resize trong cast, selectedcard pointerout, Esc/rightclick/modalE, PvP reveal name/style và secret piles, partnercost, rejoinaccepted/unaccepted, late settlement và terminalTTL. Online test fault injection dùng existing server-test harness/transport stub; không thêm endpoint production để chặn frame.

- [ ] **Step 2 — Chạy đỏ nếu còn layout/integration defect.** Vite :5173 cho offline; `pnpm --filter client exec playwright test e2e/combat-visual.spec.ts`. Ghi actual failing scenario/ảnh; không buộc tạo lỗi giả nếu tasks trước đã pass cùng assertion.
- [ ] **Step 3 — Fix integration và cập nhật docs.** Chỉ sửa diff trình bày cần cho failing tests: clamp/wrap/layers/input cleanup/anchors; giữ contracts N/A/U đã chốt. UI docs phản ánh new geometry,8pha,cardfont/cost/piles/status/coop/settings; playtest notes ghi commands, môi trường, timeline, viewport, screenshot paths và giới hạn. Không redefine acceptance để qua test.
- [ ] **Step 4 — Gate toàn bộ.** `pnpm test`, `pnpm typecheck`, `pnpm build`; offline `pnpm --filter client exec playwright test e2e/combat-visual.spec.ts e2e/moon-choice.spec.ts e2e/summon-revive.spec.ts`; online `pnpm --filter client exec playwright test e2e/pvp.spec.ts e2e/coop.spec.ts e2e/arena.spec.ts` với DB dev xác minh trước. Kiểm ảnh thật toàn ma trận: no clipping control/text/tooltip, artcrop ổn, damage/phase/badge đúng. So replay/outcome/golden, review whole branch và sửa finding trước merge; không tự deploy.
- [ ] **Step 5 — Commit:** `test: verify combat visuals across modes and viewports`.

## Nghiệm thu đợt 3

- [ ] 8pha/decree/blood visible, full hand và compact/preview readable; no hidden identity leak.
- [ ] 6Hero2summon/many statuses không che controls; reasons/cost/owner/guard đúng ghế.
- [ ] Pile/relic inspector/settings/aim mở đóng sạch; resize và queue lock đúng.
- [ ] 47missing asset deliverables xong, texture crop/load và fallback đã xem ảnh thật.
- [ ] Commands/golden/timeline/screenshots đều có proof thực tế; mọi đề xuất trong coverage map master có task DONE hoặc blocker ghi rõ, không báo toàn bộ hoàn thành khi art/online QA còn thiếu.
