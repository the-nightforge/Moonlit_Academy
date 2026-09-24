import Phaser from "phaser";
import { CombatScene } from "./scenes/combat-scene";
import { TeamSelectScene } from "./scenes/team-select-scene";

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#0b1026",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TeamSelectScene, CombatScene],
});
