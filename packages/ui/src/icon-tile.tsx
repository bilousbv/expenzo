import { iconTileClass, iconTileStyle, type IconTileProps } from './icon-tile.styles';

export function IconTile({ children, color, className, testID }: IconTileProps) {
  return (
    <div
      data-testid={testID}
      aria-hidden
      className={iconTileClass(className)}
      style={iconTileStyle(color)}
    >
      {children}
    </div>
  );
}
