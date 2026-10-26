import Phaser from 'phaser';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    this.add.text(20, 20, 'Game over: ' + JSON.stringify(data), { color: '#fff' });
    this.input.once('pointerup', () => this.scene.start('GameScene', { helmet: data.helmet }));
  }
}
