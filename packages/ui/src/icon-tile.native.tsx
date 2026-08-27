import { View } from 'react-native';

import { iconTileClass, iconTileStyle, type IconTileProps } from './icon-tile.styles';

export function IconTile({ children, color, className, testID }: IconTileProps) {
  return (
    <View testID={testID} className={iconTileClass(className)} style={iconTileStyle(color)}>
      {children}
    </View>
  );
}
