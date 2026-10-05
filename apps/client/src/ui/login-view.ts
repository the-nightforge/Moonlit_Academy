import assets from "virtual:assets-manifest";
import "./login.css";

/** Native fields retain password manager, keyboard and autofill support. */
export class LoginView {
  private readonly shell = document.createElement("main");
  private readonly card: HTMLElement;
  private readonly layout: HTMLElement;
  private readonly brand: HTMLElement;
  private form: HTMLFormElement | null = null;
  private register = false;
  private readonly onResize = () => this.applyScale();

  constructor() {
    this.shell.className = "vn-login";
    this.shell.setAttribute("aria-label", "Vọng Nguyệt Thư Viện");
    this.shell.style.setProperty("--login-background", `url("${assets.backgrounds?.background ?? ""}")`);
    this.shell.innerHTML = `<div class="vn-login-sky" aria-hidden="true"></div>
      <div class="vn-login-motes" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};left:${8 + (i * 23) % 86}%;top:${12 + (i * 17) % 76}%"></i>`).join("")}</div>
      <div class="vn-login-layout"><header class="vn-login-brand">
        <img class="vn-login-moon" src="${assets.ui?.moon_waxingCrescent ?? ""}" alt="" width="88" height="88">
        <p class="vn-login-eyebrow">THƯ VIỆN DƯỚI ÁNH TRĂNG</p><h1>Vọng Nguyệt<span>Thư Viện</span></h1>
        <div class="vn-login-rule" aria-hidden="true"><span>✦</span></div>
        <p class="vn-login-tagline">Mỗi lá bài mở ra một vận mệnh.</p>
        <p class="vn-login-genre">Thẻ bài <span>·</span> Cổ phong <span>·</span> Nguyệt Luân</p></header>
        <section class="vn-login-card" aria-label="Tài khoản"></section>
        <footer class="vn-login-footer">VỌNG NGUYỆT THƯ VIỆN <span>✦</span> HÀNH TRÌNH BẮT ĐẦU TỪ ĐÂY</footer></div>`;
    this.card = this.shell.querySelector(".vn-login-card")!;
    this.layout = this.shell.querySelector(".vn-login-layout")!;
    this.brand = this.shell.querySelector(".vn-login-brand")!;
    document.body.appendChild(this.shell);
    window.addEventListener("resize", this.onResize);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.shell.addEventListener("pointermove", event => {
      if (reduced.matches) return;
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      this.shell.style.setProperty("--px", (x * 10).toFixed(1));
      this.shell.style.setProperty("--py", (y * 8).toFixed(1));
    });
    this.applyScale();
  }

  /**
   * Scales the whole composition like the canvas' EXPAND fit: the layout is
   * measured at natural size, then zoomed by `min(viewport/natural)` so the
   * login fills any window instead of jumping at breakpoints. The shell's
   * `min-height` is un-zoomed to keep the grid centered.
   */
  private applyScale() {
    const layout = this.layout;
    layout.style.zoom = "1";
    const cs = getComputedStyle(layout);
    const columns = cs.gridTemplateColumns.split(" ").length;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gap = parseFloat(cs.rowGap) || 0;
    const naturalH =
      (columns > 1
        ? Math.max(this.brand.offsetHeight, this.card.offsetHeight)
        : this.brand.offsetHeight + this.card.offsetHeight + gap) + padY + 56;
    const naturalW = layout.offsetWidth;
    const fit = Math.min(this.shell.clientWidth / naturalW, this.shell.clientHeight / naturalH);
    const scale = Math.min(1.45, Math.max(columns > 1 ? 0.6 : 0.75, fit));
    if (Math.abs(scale - 1) < 0.03) {
      layout.style.zoom = "";
      layout.style.minHeight = "";
    } else {
      layout.style.zoom = String(scale);
      layout.style.minHeight = `${this.shell.clientHeight / scale}px`;
    }
  }

  private rescaleSoon() { requestAnimationFrame(this.onResize); }

  showConnecting(message = "Đang kết nối…") {
    this.form = null;
    this.card.innerHTML = `<div class="vn-login-state"><span class="vn-login-spinner" aria-hidden="true"></span><h2>Ánh trăng dẫn lối</h2><p role="status" aria-live="polite"></p><p class="vn-login-muted">Chuẩn bị mở cánh cửa thư viện.</p></div>`;
    this.card.querySelector('[role="status"]')!.textContent = message;
    this.rescaleSoon();
  }

  showForm(onSubmit: (username: string, password: string, register: boolean) => void) {
    this.register = false;
    this.card.innerHTML = `<p class="vn-login-eyebrow">TÀI KHOẢN NGUYỆT THƯ</p><h2>Chào mừng trở lại</h2>
      <p class="vn-login-intro">Đăng nhập để tiếp tục hành trình của bạn.</p>
      <div class="vn-login-tabs" role="tablist" aria-label="Chọn đăng nhập hoặc đăng ký" data-active="0">
        <span class="vn-login-tabs-thumb" aria-hidden="true"></span>
        <button id="vn-login-tab" type="button" role="tab" aria-controls="vn-login-panel" aria-selected="true">Đăng nhập</button>
        <button id="vn-register-tab" type="button" role="tab" aria-controls="vn-login-panel" aria-selected="false" tabindex="-1">Đăng ký</button></div>
      <div id="vn-login-panel" role="tabpanel" aria-labelledby="vn-login-tab"><form class="vn-login-form">
        <label for="vn-username">Tên đăng nhập</label>
        <input id="vn-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Tên đăng nhập" required>
        <label for="vn-password">Mật khẩu</label><div class="vn-login-password">
          <input id="vn-password" name="password" type="password" autocomplete="current-password" placeholder="Mật khẩu" required>
          <button class="vn-login-reveal" type="button" aria-label="Hiện mật khẩu" aria-pressed="false">
            <svg class="vn-eye" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="vn-eye-off" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 6.1A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-2.7 3.4M6.7 6.9A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.2 9.2 0 0 0 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M4 4l16 16"/></svg>
          </button></div>
        <p class="vn-login-caps" hidden>Caps Lock đang bật.</p>
        <p class="vn-login-help">Nhập thông tin tài khoản của bạn.</p>
        <ul class="vn-login-reqs" hidden><li class="req-name">Tên: 3–20 ký tự a–z, 0–9, _</li><li class="req-pass">Mật khẩu: 8–72 ký tự</li></ul>
        <p class="vn-login-error" role="alert" aria-live="assertive"></p>
        <button class="vn-login-primary" type="submit"><span class="vn-login-btn-spinner" aria-hidden="true"></span><span class="vn-btn-text">Đăng nhập</span></button><p class="vn-login-submit-status" role="status" aria-live="polite"></p>
      </form></div><p class="vn-login-password-note">Hãy lưu mật khẩu ở nơi an toàn.<br>Hiện chưa hỗ trợ khôi phục mật khẩu.</p>`;
    const form = this.card.querySelector("form")!;
    this.form = form;
    const username = form.querySelector<HTMLInputElement>("#vn-username")!;
    const password = form.querySelector<HTMLInputElement>("#vn-password")!;
    const help = form.querySelector<HTMLElement>(".vn-login-help")!;
    const caps = form.querySelector<HTMLElement>(".vn-login-caps")!;
    const reqs = form.querySelector<HTMLElement>(".vn-login-reqs")!;
    const reqName = reqs.querySelector<HTMLElement>(".req-name")!;
    const reqPass = reqs.querySelector<HTMLElement>(".req-pass")!;
    const btnText = form.querySelector<HTMLElement>(".vn-btn-text")!;
    const tabsWrap = this.card.querySelector<HTMLElement>(".vn-login-tabs")!;
    // Mirrors the server's normalizeUsername + USERNAME_PATTERN/isValidPassword.
    const NAME_OK = /^[a-z0-9_]{3,20}$/;
    const refreshHints = () => {
      const raw = username.value;
      const nameBad = raw !== "" && !/^[a-zA-Z0-9_]+$/.test(raw);
      reqName.classList.toggle("ok", NAME_OK.test(raw.trim().toLowerCase()));
      reqName.classList.toggle("bad", nameBad);
      const passLength = [...password.value].length;
      reqPass.classList.toggle("ok", password.value !== "" && passLength >= 8 && passLength <= 72);
      reqPass.classList.toggle("bad", passLength > 72);
      if (!this.register) help.textContent = nameBad ? "Tên chỉ gồm a–z, 0–9 và _" : "Nhập thông tin tài khoản của bạn.";
    };
    username.addEventListener("input", refreshHints);
    password.addEventListener("input", refreshHints);
    const checkCaps = (event: KeyboardEvent) => { caps.hidden = !event.getModifierState("CapsLock"); };
    password.addEventListener("keydown", checkCaps);
    password.addEventListener("keyup", checkCaps);
    password.addEventListener("blur", () => { caps.hidden = true; });
    const tabs = [...this.card.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const select = (index: number) => {
      if (form.getAttribute("aria-busy") === "true") return;
      this.register = index === 1;
      tabsWrap.dataset.active = String(index);
      tabs.forEach((tab, i) => { tab.setAttribute("aria-selected", String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      this.card.querySelector("#vn-login-panel")!.setAttribute("aria-labelledby", tabs[index]!.id);
      this.card.querySelector("h2")!.textContent = this.register ? "Mở một hành trình mới" : "Chào mừng trở lại";
      this.card.querySelector(".vn-login-intro")!.textContent = this.register ? "Tạo tài khoản để lưu hành trình của bạn." : "Đăng nhập để tiếp tục hành trình của bạn.";
      password.autocomplete = this.register ? "new-password" : "current-password";
      // Server normalizes names and counts password code points, unlike HTML length constraints.
      username.title = this.register ? "3–20 ký tự a–z, 0–9 hoặc dấu gạch dưới" : "Tên đăng nhập";
      help.hidden = this.register;
      reqs.hidden = !this.register;
      btnText.textContent = this.register ? "Tạo tài khoản" : "Đăng nhập";
      // Switching tabs clears entered credentials — login and register are different flows.
      username.value = "";
      password.value = "";
      password.type = "password";
      reveal.setAttribute("aria-label", "Hiện mật khẩu");
      reveal.setAttribute("aria-pressed", "false");
      caps.hidden = true;
      reqName.classList.remove("ok", "bad");
      reqPass.classList.remove("ok", "bad");
      form.querySelector(".vn-login-submit-status")!.textContent = "";
      this.showError("");
      username.focus({ preventScroll: true });
      this.rescaleSoon();
    };
    tabs.forEach((tab, index) => {
      tab.onclick = () => select(index);
      tab.onkeydown = event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
        select(next); tabs[next]!.focus();
      };
    });
    const reveal = form.querySelector<HTMLButtonElement>(".vn-login-reveal")!;
    reveal.onclick = () => {
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      reveal.setAttribute("aria-label", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      reveal.setAttribute("aria-pressed", String(visible));
    };
    form.onsubmit = event => {
      event.preventDefault();
      if (form.getAttribute("aria-busy") !== "true") onSubmit(username.value, password.value, this.register);
    };
    username.focus({ preventScroll: true });
    this.rescaleSoon();
  }

  setBusy(busy: boolean) {
    if (!this.form) return;
    this.form.setAttribute("aria-busy", String(busy));
    this.card.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach(control => { control.disabled = busy; });
    this.form.querySelector('button[type="submit"]')!.classList.toggle("is-busy", busy);
    this.form.querySelector('[role="status"]')!.textContent = busy ? "Đang xác thực tài khoản…" : "";
  }

  showError(message: string) {
    const error = this.form?.querySelector<HTMLElement>('[role="alert"]');
    if (!error) return;
    error.textContent = message;
    if (message) {
      this.card.classList.remove("vn-login-shake");
      void this.card.offsetWidth;
      this.card.classList.add("vn-login-shake");
    }
  }

  showChoice(title: string, description: string, labels: string[], choose: (index: number) => void) {
    this.form = null;
    this.card.innerHTML = `<div class="vn-login-state"><p class="vn-login-eyebrow">NGUYỆT THƯ</p><h2 tabindex="-1"></h2><p class="vn-login-description"></p><div class="vn-login-actions"></div></div>`;
    const heading = this.card.querySelector<HTMLHeadingElement>("h2")!;
    heading.textContent = title;
    this.card.querySelector(".vn-login-description")!.textContent = description;
    let chosen = false;
    labels.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === 0 ? "vn-login-primary" : "vn-login-secondary";
      button.textContent = label;
      button.onclick = () => {
        if (chosen) return;
        chosen = true;
        this.card.querySelectorAll<HTMLButtonElement>("button").forEach(control => { control.disabled = true; });
        choose(index);
      };
      this.card.querySelector(".vn-login-actions")!.appendChild(button);
    });
    heading.focus({ preventScroll: true });
    this.rescaleSoon();
  }

  destroy() { this.form = null; window.removeEventListener("resize", this.onResize); this.shell.remove(); }
}
