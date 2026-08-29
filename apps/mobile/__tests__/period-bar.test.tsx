import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PeriodBar } from '@expenzo/ui';

type Step = (months: number) => void;
type Open = () => void;

const labels = {
  openLabel: 'Change period',
  previousLabel: 'Previous month',
  nextLabel: 'Next month',
};

// The native half of the same component, reached through the shared barrel.
describe('PeriodBar (native)', () => {
  it('shows the name over the exact dates', () => {
    render(
      <PeriodBar label="This month" dates="01.03.2026" onOpen={jest.fn<Open>()} {...labels} />,
    );

    expect(screen.getByTestId('period-label')).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getByText('01.03.2026')).toBeTruthy();
  });

  it('steps back and forward a month', () => {
    const onStep = jest.fn<Step>();
    render(
      <PeriodBar label="Mar 26" dates="…" onStep={onStep} onOpen={jest.fn<Open>()} {...labels} />,
    );

    fireEvent.press(screen.getByTestId('period-previous'));
    fireEvent.press(screen.getByTestId('period-next'));

    expect(onStep.mock.calls).toEqual([[-1], [1]]);
  });

  // The arrows step whole months, so they only exist while the period is one.
  it('hides the arrows when the period is not steppable', () => {
    render(<PeriodBar label="Custom" dates="…" onOpen={jest.fn<Open>()} {...labels} />);

    expect(screen.queryByTestId('period-previous')).toBeNull();
    expect(screen.queryByTestId('period-next')).toBeNull();
  });

  it('opens the picker from the centre', () => {
    const onOpen = jest.fn<Open>();
    render(<PeriodBar label="This month" dates="…" onOpen={onOpen} {...labels} />);

    fireEvent.press(screen.getByTestId('period-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
