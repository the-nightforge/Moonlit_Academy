import Phaser from "phaser";
import { errorText, login, mutate, resumeSession } from "../account";
import { ApiError, serverReachable } from "../api";
import { readLegacyProfile, retireLegacyProfile } from "../profile-store";
import { abandonSavedRun, resumeRun, savedRun } from "../run-session";
import { session } from "../session";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";

const WIDTH = 1280;

/**
 * Sign in / register (`15` §6). The form is plain HTML over the canvas so the
 * browser handles typing and password managers; later prompts use Phaser.
 */
export class LoginScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private form: HTMLDivElement | null = null;

  constructor() {
    super("login");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeForm());
    addText(this, this.root, WIDTH / 2, 120, "Vọng Nguyệt Thư Viện", 34, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 170, "Đang kết nối…", 16, COLORS.dimText).setOrigin(0.5);
    void this.start();
  }

  private async start() {
    try {
      if (await resumeSession()) {
        await this.afterSignIn();
        return;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        this.showOffline();
        return;
      }
      // Token refused or expired: fall through to the form.
    }
    if (!(await serverReachable())) {
      this.showOffline();
      return;
    }
    this.showForm();
  }

  private showForm(message = "") {
    this.root.removeAll(true);
    addText(this, this.root, WIDTH / 2, 120, "Vọng Nguyệt Thư Viện", 34, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 560, "Không có khôi phục mật khẩu — hãy ghi nhớ mật khẩu của mình.", 12, COLORS.dimText).setOrigin(0.5);
    this.removeForm();
    const form = document.createElement("div");
    form.style.cssText =
      "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;gap:10px;" +
      "width:280px;padding:20px;background:#141b33;border:1px solid #f4d35e;font-family:sans-serif;color:#e8ecf8";
    const field = (placeholder: string, type: string, autocomplete: AutoFill) => {
      const input = document.createElement("input");
      input.placeholder = placeholder;
      input.type = type;
      input.autocomplete = autocomplete;
      input.style.cssText = "padding:8px;font-size:15px;background:#0b1026;color:#e8ecf8;border:1px solid #4a5a8a";
      form.appendChild(input);
      return input;
    };
    const username = field("Tên đăng nhập", "text", "username");
    const password = field("Mật khẩu", "password", "current-password");
    const error = document.createElement("div");
    error.style.cssText = "min-height:18px;font-size:13px;color:#ff8080";
    error.textContent = message;
    const button = (label: string, register: boolean) => {
      const element = document.createElement("button");
      element.textContent = label;
      element.style.cssText = "padding:8px;font-size:15px;cursor:pointer;background:#2c3e6e;color:#e8ecf8;border:1px solid #f4d35e";
      element.onclick = async () => {
        error.textContent = "";
        try {
          await login(username.value, password.value, register);
          this.removeForm();
          await this.afterSignIn();
        } catch (failure) {
          if (failure instanceof ApiError && failure.status === 0) {
            this.removeForm();
            this.showOffline();
            return;
          }
          error.textContent = errorText(failure);
        }
      };
      form.appendChild(element);
    };
    button("Đăng nhập", false);
    button("Đăng ký tài khoản mới", true);
    form.appendChild(error);
    password.addEventListener("keydown", (event) => {
      if (event.key === "Enter") (form.querySelector("button") as HTMLButtonElement).click();
    });
    document.body.appendChild(form);
    this.form = form;
    username.focus();
  }

  private removeForm() {
    this.form?.remove();
    this.form = null;
  }

  /** Signed in: offer the one-time import, then an unfinished run, then the deck screen. */
  private async afterSignIn() {
    const legacy = readLegacyProfile();
    if (legacy !== null && !session.profile.flags.localImportDone) {
      const choice = await this.ask("Có tiến độ cũ trên máy này (Tu Luyện, deck). Nhập vào tài khoản?", ["Nhập", "Bỏ qua"]);
      if (choice === 0) {
        try {
          await mutate("POST", "/profile/import", { local: legacy });
          retireLegacyProfile();
        } catch (error) {
          window.alert(errorText(error));
        }
      } else {
        retireLegacyProfile();
      }
    }
    const unfinished = savedRun();
    if (unfinished) {
      const choice = await this.ask("Có lượt chơi đang dở trên máy này.", ["Chơi tiếp", "Bỏ lượt này"]);
      if (choice === 0 && resumeRun(unfinished)) {
        this.scene.start(session.run!.status === "combat" ? "combat" : "run");
        return;
      }
      await abandonSavedRun(unfinished);
    }
    this.scene.start("deck-select");
  }

  private showOffline() {
    this.root.removeAll(true);
    session.online = false;
    addText(this, this.root, WIDTH / 2, 120, "Vọng Nguyệt Thư Viện", 34, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 260, "Không kết nối được server.", 18).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 290, "Chế độ offline chỉ có Trận lẻ; lượt chơi và tiến độ cần server.", 14, COLORS.dimText).setOrigin(0.5);
    addButton(this, this.root, WIDTH / 2 - 110, 360, 200, "Thử lại", () => this.scene.restart());
    addButton(this, this.root, WIDTH / 2 + 110, 360, 200, "Chơi offline", () => this.scene.start("deck-select"));
  }

  /** A question with buttons; resolves with the index of the one clicked. */
  private ask(question: string, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.root.removeAll(true);
      addText(this, this.root, WIDTH / 2, 260, question, 18).setOrigin(0.5);
      options.forEach((label, index) => {
        const x = WIDTH / 2 + (index - (options.length - 1) / 2) * 220;
        addButton(this, this.root, x, 340, 200, label, () => resolve(index));
      });
    });
  }
}
