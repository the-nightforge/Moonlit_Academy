import Phaser from "phaser";
import { errorText, login, mutate, resumeSession } from "../account";
import { ApiError, serverReachable } from "../api";
import { readLegacyProfile, retireLegacyProfile } from "../profile-store";
import { abandonSavedRun, resumeRun, savedRun } from "../run-session";
import { session } from "../session";
import { LoginView } from "../ui/login-view";
import { useDesignCamera } from "../ui/theme";

/** Scene owns async work; the DOM view owns accessible fields and responsive art. */
export class LoginScene extends Phaser.Scene {
  private view: LoginView | null = null;
  private generation = 0;
  private busy = false;
  private cancelChoice: (() => void) | null = null;

  constructor() { super("login"); }

  create() {
    useDesignCamera(this);
    const generation = ++this.generation;
    this.busy = false;
    this.view = new LoginView();
    this.view.showConnecting();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.cancelChoice?.();
      this.cancelChoice = null;
      this.view?.destroy();
      this.view = null;
    });
    void this.start(generation);
  }

  private current(generation: number): boolean {
    return generation === this.generation && this.view !== null;
  }

  private async start(generation: number) {
    try {
      const resumed = await resumeSession();
      if (!this.current(generation)) return;
      if (resumed) { await this.afterSignIn(generation); return; }
    } catch (error) {
      if (!this.current(generation)) return;
      if (error instanceof ApiError && error.status === 0) { this.showOffline(generation); return; }
      // A refused or expired token returns to the sign-in form.
    }
    const reachable = await serverReachable();
    if (!this.current(generation)) return;
    if (!reachable) { this.showOffline(generation); return; }
    this.view!.showForm((username, password, register) => { void this.submit(username, password, register, generation); });
  }

  private async submit(username: string, password: string, register: boolean, generation: number) {
    if (!this.current(generation) || this.busy) return;
    this.busy = true;
    this.view!.showError("");
    this.view!.setBusy(true);
    try {
      await login(username, password, register);
      if (!this.current(generation)) return;
      this.view!.showConnecting("Đang mở thư viện…");
      await this.afterSignIn(generation);
    } catch (error) {
      if (!this.current(generation)) return;
      if (error instanceof ApiError && error.status === 0) { this.showOffline(generation); return; }
      this.view!.showError(errorText(error));
    } finally {
      if (this.current(generation)) {
        this.busy = false;
        this.view!.setBusy(false);
      }
    }
  }

  /** Offer the existing one-time import and unfinished-run flows after sign-in. */
  private async afterSignIn(generation: number) {
    const legacy = readLegacyProfile();
    if (legacy !== null && !session.profile.flags.localImportDone) {
      const choice = await this.ask("Tiếp nối hành trình", "Có tiến độ cũ trên máy này (Tu Luyện, deck). Nhập vào tài khoản?", ["Nhập", "Bỏ qua"], generation);
      if (!this.current(generation)) return;
      if (choice === 0) {
        try {
          await mutate("POST", "/profile/import", { local: legacy });
          if (!this.current(generation)) return;
          retireLegacyProfile();
        } catch (error) {
          if (!this.current(generation)) return;
          await this.ask("Chưa thể nhập tiến độ", errorText(error), ["Tiếp tục"], generation);
        }
      } else { retireLegacyProfile(); }
    }
    if (!this.current(generation)) return;
    const unfinished = savedRun();
    if (unfinished) {
      const choice = await this.ask("Hành trình còn dang dở", "Có Tầm Nguyệt đang dở trên máy này.", ["Chơi tiếp", "Bỏ hành trình"], generation);
      if (!this.current(generation)) return;
      if (choice === 0 && resumeRun(unfinished)) {
        this.scene.start(session.run!.status === "combat" ? "combat" : "run");
        return;
      }
      this.view!.showConnecting("Đang mở thư viện…");
      await abandonSavedRun(unfinished);
    }
    if (this.current(generation)) this.scene.start("deck-select");
  }

  private showOffline(generation: number) {
    if (!this.current(generation)) return;
    session.online = false;
    // Production is online-only; the local session stays for dev/e2e tooling.
    const options = import.meta.env.DEV ? ["Thử lại", "Chơi offline"] : ["Thử lại"];
    this.view!.showChoice("Tạm mất kết nối", "Không kết nối được server. Vọng Nguyệt cần kết nối để chơi — kiểm tra mạng rồi thử lại.", options, index => {
      if (!this.current(generation)) return;
      if (index === 0) this.scene.restart();
      else this.scene.start("deck-select");
    });
  }

  private ask(title: string, description: string, options: string[], generation: number): Promise<number | null> {
    return new Promise(resolve => {
      if (!this.current(generation)) { resolve(null); return; }
      this.cancelChoice = () => resolve(null);
      this.view!.showChoice(title, description, options, index => {
        this.cancelChoice = null;
        resolve(index);
      });
    });
  }
}
