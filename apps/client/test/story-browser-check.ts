import { loadGameData } from "data";
import { StoryView } from "../src/ui/story-view";
import { DialogueView } from "../src/ui/dialogue-view";

/** Native-browser checks launched by a disposable local QA entry. */
export async function runStoryBrowserChecks(): Promise<string[]> {
  const data = loadGameData(), results: string[] = [];
  const check = (name: string, ok: boolean) => results.push(`${ok ? "PASS" : "FAIL"}: ${name}`);
  let started = "", retries = 0;
  const state = { data, progress: { cleared: ["arc1_s01"], unlocked: ["arc1_s02"] }, online: true, loading: false, error: "", notice: "" };
  const view = new StoryView({ back: () => {}, retry: () => retries++, start: id => { started = id; } });
  try {
    view.render(state);
    document.querySelector<HTMLButtonElement>('.vn-story [data-action="start"]')!.click();
    check("Continue forwards the server-open stage", started === "arc1_s02");
    document.querySelector<HTMLButtonElement>('.vn-story [data-id="arc1_s03"]')!.click();
    check("Locked stage has no available start action", document.querySelector('.vn-story [data-action="start"]') === null && started === "arc1_s02");
    check("Selecting a stage preserves focus", (document.activeElement as HTMLElement)?.dataset.control === "stage-arc1_s03");
    document.querySelector<HTMLButtonElement>('.vn-story [data-id="arc2"]')!.click();
    check("Locked chapter explains its real prerequisite", document.querySelector(".st-requirement")?.textContent === "Hoàn thành chương Vọng Nguyệt để mở");
    document.querySelector<HTMLButtonElement>('.vn-story [data-id="arc1"]')!.click();
    document.querySelector<HTMLButtonElement>('.vn-story [data-id="arc1_s01"]')!.click();
    check("Cleared rewards are marked claimed", document.querySelector(".st-rewards.claimed") !== null);
    const sceneSources = new Set<string>();
    let fullScenes = true;
    for (const arc of Object.values(data.storyArcs)) {
      document.querySelector<HTMLButtonElement>(`.vn-story [data-action="arc"][data-id="${arc.id}"]`)!.click();
      for (const id of arc.stageIds) {
        document.querySelector<HTMLButtonElement>(`.vn-story [data-action="stage"][data-id="${id}"]`)!.click();
        const image = document.querySelector<HTMLImageElement>(".st-backdrop img");
        if (!image) { fullScenes = false; continue; }
        if (!image.complete) await new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve(); });
        const css = getComputedStyle(image), box = image.getBoundingClientRect();
        const width = box.width - +css.borderLeftWidth.replace("px", "") - +css.borderRightWidth.replace("px", "");
        const height = box.height - +css.borderTopWidth.replace("px", "") - +css.borderBottomWidth.replace("px", "");
        const source = image.getAttribute("src") ?? "";
        sceneSources.add(source);
        fullScenes &&= image.naturalWidth > 0 && source.includes(`/story/${id}.webp`) && css.objectFit === "contain"
          && css.padding === "0px" && +css.borderTopWidth.replace("px", "") > 0
          && Math.abs(width / height - image.naturalWidth / image.naturalHeight) < 0.003;
      }
    }
    check("Every stage has its own complete, correctly framed scene", fullScenes && sceneSources.size === Object.keys(data.storyStages).length);
    view.render({ ...state, error: "Không thể tải tiến độ" });
    document.querySelector<HTMLButtonElement>('.vn-story [data-action="retry"]')!.click();
    check("Retry is actionable in the load error state", retries === 1);
  } finally { view.destroy(); }
  let next = 0, skipped = 0;
  const dialogue = new DialogueView({ next: () => next++, skip: () => skipped++ });
  try {
    dialogue.render(data, "Nhập Học", { speaker: "f04", text: "Lời thoại kiểm tra" }, 0, 2);
    const img = document.querySelector<HTMLImageElement>(".sd-main img")!;
    if (!img.complete) await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    const style = getComputedStyle(img), rect = img.getBoundingClientRect();
    const horizontal = +style.borderLeftWidth.replace("px", "") + +style.borderRightWidth.replace("px", "");
    const vertical = +style.borderTopWidth.replace("px", "") + +style.borderBottomWidth.replace("px", "");
    check("Dialogue portrait keeps its full natural ratio", img.naturalWidth > 0 && style.objectFit === "contain" && Math.abs((rect.width - horizontal) / (rect.height - vertical) - img.naturalWidth / img.naturalHeight) < 0.002);
    document.querySelector<HTMLButtonElement>('.vn-story-dialogue [data-action="next"]')!.click();
    document.querySelector<HTMLButtonElement>('.vn-story-dialogue [data-action="skip"]')!.click();
    check("Dialogue next and skip fire once each", next === 1 && skipped === 1);
    check("Dialogue buttons have a rounded visible border", Array.from(document.querySelectorAll<HTMLButtonElement>(".vn-story-dialogue button")).every(button => { const css = getComputedStyle(button); return +css.borderTopWidth.replace("px", "") > 0 && +css.borderRadius.replace("px", "") > 0; }));
    const speech = document.querySelector(".sd-speech")!;
    const nextButton = document.querySelector<HTMLButtonElement>('.vn-story-dialogue [data-action="next"]')!;
    nextButton.focus();
    dialogue.render(data, "Nhập Học", { speaker: "m05", text: "Lời thoại tiếp theo" }, 1, 2);
    check("Dialogue retains its live speech region and focused control", speech.isConnected && speech.getAttribute("aria-live") === "polite" && speech.textContent?.includes("Lời thoại tiếp theo") === true && document.activeElement === nextButton);
  } finally { dialogue.destroy(); }
  return results;
}
