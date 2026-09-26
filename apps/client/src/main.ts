import Phaser from "phaser";
import { auth, initApi, setToken } from "./api";
import { LoginScene } from "./scenes/login-scene";
import { session } from "./session";
import { CombatScene } from "./scenes/combat-scene";
import { DeckBuilderScene } from "./scenes/deck-builder-scene";
import { ArmoryScene } from "./scenes/armory-scene";
import { DeckSelectScene } from "./scenes/deck-select-scene";
import { GachaScene } from "./scenes/gacha-scene";
import { HeroesScene } from "./scenes/heroes-scene";
import { MissionsScene } from "./scenes/missions-scene";
import { ShopScene } from "./scenes/shop-scene";
import { MasteryScene } from "./scenes/mastery-scene";
import { RunScene } from "./scenes/run-scene";
import { DESIGN_HEIGHT, DESIGN_WIDTH, RENDER_SCALE } from "./ui/theme";

initApi(session.data);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  // Canvas is RENDER_SCALE× the design size; scenes zoom their camera to match.
  width: DESIGN_WIDTH * RENDER_SCALE,
  height: DESIGN_HEIGHT * RENDER_SCALE,
  backgroundColor: "#0b1026",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    LoginScene, DeckSelectScene, DeckBuilderScene, MasteryScene, GachaScene, ShopScene, HeroesScene, MissionsScene, ArmoryScene,
    CombatScene, RunScene,
  ],
});

// A refused or expired session anywhere sends the player back to sign in.
auth.onUnauthorized = () => {
  setToken(null);
  session.online = false;
  const active = game.scene.getScenes(true)[0];
  if (active && active.scene.key !== "login") active.scene.start("login");
};
