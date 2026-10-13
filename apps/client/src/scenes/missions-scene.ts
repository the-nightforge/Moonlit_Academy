import Phaser from "phaser";
import { dayKey, weekKey } from "rules";
import { applyServerProfile, errorText, mutate, type ProfileReply } from "../account";
import { api, ApiError, auth } from "../api";
import { session } from "../session";
import { achievementRows, claimReadyMissions, missionRows, type MissionTab } from "../ui/missions-presentation";
import { MissionsView } from "../ui/missions-view";
import { useDesignCamera } from "../ui/theme";
import { isModalOpen } from "../ui/widgets";

/** Server-authoritative rewards with a native, accessible mission list. */
export class MissionsScene extends Phaser.Scene {
  private view: MissionsView | null = null;
  private tab: MissionTab = "daily";
  private busy = false;
  private refreshing = false;
  private networkLost = false;
  private needsRefresh = false;
  private generation = 0;
  private error = "";
  private notice = "";
  private periodKey = "";
  private renderedProfile = session.profile;
  private renderedOnline = session.online;

  constructor() { super("missions"); }

  create() {
    useDesignCamera(this);
    this.generation++;
    this.busy = false; this.refreshing = false; this.networkLost = false;
    this.error = ""; this.notice = ""; this.needsRefresh = false;
    this.periodKey = this.currentPeriods();
    this.view = new MissionsView({
      back: () => this.scene.start("deck-select"),
      tab: tab => { this.tab = tab; this.render(); },
      claim: ids => { void this.claim(ids); },
      navigate: destination => this.scene.start(destination),
      refresh: () => { void this.refresh(); },
    });
    const focus = () => { if (document.visibilityState !== "hidden") void this.refresh(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isModalOpen()) { event.preventDefault(); this.scene.start("deck-select"); }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", focus);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      const key = this.currentPeriods();
      if (key !== this.periodKey) { this.periodKey = key; this.needsRefresh = true; this.render(); }
      if (this.needsRefresh && !this.busy && !this.refreshing) void this.refresh();
    } });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      window.removeEventListener("focus", focus); window.removeEventListener("online", focus);
      window.removeEventListener("keydown", escape); document.removeEventListener("visibilitychange", focus);
      this.view?.destroy(); this.view = null;
    });
    this.render();
    void this.refresh();
  }

  update() {
    if (this.view && (session.profile !== this.renderedProfile || session.online !== this.renderedOnline)) this.render();
  }
  private currentPeriods() { return `${dayKey(session.data, Date.now())}:${weekKey(session.data, Date.now())}`; }
  private current(generation: number, account: number) { return this.view !== null && this.generation === generation && auth.generation === account; }
  private render() {
    const now = Date.now(), data = session.data;
    this.renderedProfile = session.profile; this.renderedOnline = session.online;
    this.view?.render({
      tab: this.tab, missions: { daily: missionRows(data, session.profile, "daily", now), weekly: missionRows(data, session.profile, "weekly", now) },
      achievements: achievementRows(data, session.profile), currencies: session.profile.currencies,
      online: session.online && !this.networkLost, busy: this.busy, refreshing: this.refreshing,
      error: this.error, notice: this.notice, resetHour: (data.economyConfig.resetUtcHour + 7) % 24,
      periodKey: this.tab === "achievements" ? "permanent" : this.tab === "daily" ? dayKey(data, now) : weekKey(data, now),
    });
  }

  private async refresh() {
    if (!this.view || this.busy || this.refreshing || !session.online) { this.needsRefresh = false; return; }
    const generation = this.generation, account = auth.generation;
    this.refreshing = true; this.render();
    try {
      const reply = await api<ProfileReply>("GET", "/profile");
      if (!this.current(generation, account)) return;
      // A settlement can update the profile while this read is in flight.
      if (reply.rev >= session.rev) applyServerProfile(reply);
      this.networkLost = false; this.error = "";
    } catch (error) {
      if (!this.current(generation, account)) return;
      this.networkLost = error instanceof ApiError && error.status === 0;
      this.error = errorText(error);
    } finally {
      if (this.current(generation, account)) { this.refreshing = false; this.needsRefresh = false; this.render(); }
    }
  }

  private async claim(ids: string[]) {
    if (!this.view || this.busy || this.refreshing || !session.online || this.networkLost) return;
    const generation = this.generation, account = auth.generation;
    this.busy = true; this.error = ""; this.notice = ""; this.render();
    const result = await claimReadyMissions(session.data, ids, {
      profile: () => session.profile, now: () => Date.now(),
      valid: () => this.current(generation, account) && session.online && !this.networkLost,
      submit: id => mutate("POST", `/missions/${id}/claim`),
    });
    if (!this.current(generation, account)) return;
    this.busy = false;
    if (result.received) this.notice = `+${result.received} Nguyệt Ngọc`;
    if (result.error) {
      this.networkLost = result.error instanceof ApiError && result.error.status === 0;
      this.error = `${errorText(result.error)}. Bạn có thể thử lại phần thưởng còn lại.`;
    }
    this.render();
    if (this.notice) {
      const receipt = this.notice;
      this.time.delayedCall(3500, () => { if (this.current(generation, account) && this.notice === receipt) { this.notice = ""; this.render(); } });
    }
  }
}
