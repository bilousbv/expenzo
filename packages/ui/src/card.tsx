import { cardClass, type CardProps } from './card.styles';

export function Card({ children, className, testID }: CardProps) {
  return (
    <div data-testid={testID} className={cardClass(className)}>
      {children}
    </div>
  );
}
