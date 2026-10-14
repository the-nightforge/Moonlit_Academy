import { loadGameData } from "data";
import { createProfile, starterDeck } from "rules";
import { CoopLobbyView, type CoopLobbyViewState } from "../src/ui/coop-lobby-view";

/** Native-browser regression checks; launched by the local QA entry, not a fake DOM. */
export function runCoopLobbyBrowserChecks(): string[] {
  const data = loadGameData(), profile = createProfile(data);
  const heroIds: [string, string, string] = ["m05", "f04", "m06"];
  profile.decks = [{ id: "d1", name: "Liên Thủ", heroIds, cardIds: starterDeck(data, heroIds) }];
  let state: CoopLobbyViewState = { data, profile, selectedDeckId: "d1", username: "Người kiểm tra", online: true,
    connected: true, assets: "ready", phase: "idle", rewards: { clearsToday: 0, rewardClaimsLeft: 3 }, room: null,
    waitingSeconds: 0, error: "", notice: "", rewardsLoading: false, rewardsError: "", assetFailed: 0 };
  let attempts = 0;
  const view = new CoopLobbyView({ back: () => {}, selectDeck: () => {}, editDeck: () => {}, createDeck: () => {},
    leave: () => {}, reconnect: () => {}, retryAssets: () => {}, retryRewards: () => {}, deckError: () => "Bộ bài thiếu lá",
    start: action => { attempts++; state = { ...state, phase: action === "join-room" ? "joining-room" : "creating-room", error: "" }; view.render(state); return true; },
  });
  const results: string[] = [];
  const check = (name: string, condition: boolean) => results.push((condition ? "PASS: " : "FAIL: ") + name);
  try {
    state = { ...state, phase: "queued" };
    view.render(state);
    const cancel = document.querySelector<HTMLButtonElement>('.vn-coop [data-control="leave"]')!;
    cancel.focus();
    state = { ...state, waitingSeconds: 3 };
    view.render(state);
    check("Timer keeps the same cancel control and focus", cancel.isConnected && document.activeElement === cancel);
    check("Timer displays elapsed time", document.querySelector(".cl-timer")?.textContent === "0:03");
    state = { ...state, phase: "idle" };
    view.render(state);
    document.querySelector<HTMLButtonElement>('.vn-coop [data-control="private"]')!.click();
    const input = document.querySelector<HTMLInputElement>('.vn-coop [data-code]')!;
    input.value = " k7q2mx ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    check("Pasted code is normalized before length validation", input.value === "K7Q2MX");
    document.querySelector<HTMLFormElement>('.vn-coop [data-join]')!.requestSubmit();
    const dialog = document.querySelector<HTMLDialogElement>(".cl-dialog")!;
    check("Room entry stays visible while waiting for server", dialog.open);
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    check("Pending entry cannot dismiss an in-flight request", cancelEvent.defaultPrevented);
    document.querySelector<HTMLFormElement>('.vn-coop [data-join]')!.requestSubmit();
    check("Pending entry cannot submit a duplicate request", attempts === 1);
    state = { ...state, phase: "idle", error: "Mã phòng đã hết hạn" };
    view.render(state);
    check("Room error keeps entered code for correction", dialog.open && input.isConnected && input.value === "K7Q2MX");
    check("Room error is inside the dialog", dialog.textContent?.includes("Mã phòng đã hết hạn") === true);
    state = { ...state, phase: "room", error: "", room: { code: "K7Q2MX", players: [{ username: "Người kiểm tra", ready: true }] } };
    view.render(state);
    check("Server acceptance closes entry and reveals room", !dialog.open && document.querySelector(".cl-room-code")?.textContent?.includes("K7Q2MX") === true);
  } finally { view.destroy(); }
  return results;
}
