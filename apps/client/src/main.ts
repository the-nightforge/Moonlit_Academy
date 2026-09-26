import Phaser from "phaser";
import { CombatScene } from "./scenes/combat-scene";
import { DeckBuilderScene } from "./scenes/deck-builder-scene";
import { DeckSelectScene } from "./scenes/deck-select-scene";
import { MasteryScene } from "./scenes/mastery-scene";
import { RunScene } from "./scenes/run-scene";
import { TeamSelectScene } from "./scenes/team-select-scene";
import { DESIGN_HEIGHT, DESIGN_WIDTH, RENDER_SCALE } from "./ui/theme";

new Phaser.Game({
  type: Phaser.AUTO,
  // Canvas is RENDER_SCALE× the design size; scenes zoom their camera to match.
  width: DESIGN_WIDTH * RENDER_SCALE,
  height: DESIGN_HEIGHT * RENDER_SCALE,
  backgroundColor: "#0b1026",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TeamSelectScene, DeckSelectScene, DeckBuilderScene, MasteryScene, CombatScene, RunScene],
});
