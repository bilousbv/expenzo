import { View } from 'react-native';

import { cardClass, type CardProps } from './card.styles';

export function Card({ children, className, testID }: CardProps) {
  return (
    <View testID={testID} className={cardClass(className)}>
      {children}
    </View>
  );
}
