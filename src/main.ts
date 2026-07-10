import Phaser from 'phaser';
import './styles.css';
import { TableScene } from './game/scenes/TableScene';
import { bindHud } from './ui/hud';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#06170f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  render: {
    antialias: true,
    pixelArt: false
  },
  scene: [TableScene]
};

new Phaser.Game(config);
bindHud();
