import Phaser from 'phaser';

// Tombol sederhana: kotak membulat + teks. onClick dipanggil saat pointerup di atas tombol.
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const width = opts.width ?? 260;
  const height = opts.height ?? 56;
  const fill = opts.fill ?? 0xf2c14e;
  const textColor = opts.textColor ?? '#1b1b1f';

  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (color) => {
    bg.clear();
    bg.fillStyle(color, 1).fillRoundedRect(-width / 2, -height / 2, width, height, 12);
  };
  draw(fill);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: opts.fontSize ?? '22px',
      fontStyle: 'bold',
      color: textColor,
      align: 'center',
    })
    .setOrigin(0.5);
  container.add([bg, text]);
  container.setSize(width, height);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );
  container.on('pointerdown', () => draw(Phaser.Display.Color.IntegerToColor(fill).darken(15).color));
  container.on('pointerout', () => draw(fill));
  container.on('pointerup', () => {
    draw(fill);
    onClick();
  });
  container.label = text;
  return container;
}

export const TEXT_STYLE = {
  fontFamily: 'Arial, sans-serif',
  color: '#ffffff',
};
