import Phaser from "phaser";

class HelloScene extends Phaser.Scene {
  create() {
    this.add
      .text(640, 360, "Vọng Nguyệt Thư Viện", {
        fontFamily: '"Times New Roman", serif',
        fontSize: "48px",
        color: "#e8e0c8",
      })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#0b1026",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [HelloScene],
});
