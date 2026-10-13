# Server test timeouts

Ngày 13/10/2026. Lệnh: `pnpm --filter server exec vitest run --maxWorkers 1 --no-file-parallelism`. Kết quả: 15 timeout 5000 mili giây, 53 kiểm tra qua. Không sửa mã server hoặc nới timeout.

-  test/economy.test.ts > economy routes > gives the starter gift at registration, and at sign-in to accounts made before it existed
-  test/economy.test.ts > economy routes > unlocking a card counts toward missions
-  test/playtest-replay.test.ts > playtest replay export > reconstructs completed PvP order, seats and pseudonyms; counts rejects
-  test/playtest-replay.test.ts > playtest replay export > a stored replay row is immutable across exports and version changes
-  test/playtest-replay.test.ts > playtest replay export > excludes bot seats from human action-fit but keeps them as participants
-  test/playtest-replay.test.ts > playtest replay capture > captures a validated run when the flag is on; flag off writes nothing
-  test/playtest-replay.test.ts > playtest replay capture > failed validation stores a rejected row but no accepted replay
-  test/playtest-replay.test.ts > playtest replay capture > a capture-storage failure cannot change rewards or settlement
-  test/playtest-replay.test.ts > playtest replay capture > captures story finishes for both win and loss
-  test/playtest-replay.test.ts > playtest replay capture > a story finish through the route stores one row; retries do not duplicate
-  test/realtime.test.ts > realtime > T235 sau mỗi Action mỗi người nhận góc nhìn riêng: tay đối thủ chỉ còn số lượng
-  test/realtime.test.ts > realtime > T236/T237 match.end ghi DB một transaction; replayMatch tái hiện trận; phòng xóa sau 60 s
-  test/runs.test.ts > run tickets > T178: one open ticket per account; a ticket expires after 7 days; another data version is refused
-  test/runs.test.ts > run tickets > T179: a verified run grants XP once; a tampered one is rejected and grants nothing
-  test/runs.test.ts > run tickets > T325 (phần server): a legal discardCard replays; out-of-decree decree actions are rejected
