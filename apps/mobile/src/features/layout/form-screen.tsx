import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface FormScreenProps {
  children: ReactNode;
}

/**
 * The shell every screen with a form sits in.
 *
 * Three things have to line up or a form becomes unusable the moment the
 * keyboard opens, and each of them fails in a way that looks like a different
 * bug:
 *
 * - `keyboardShouldPersistTaps="handled"`, or the first tap after the keyboard
 *   opens is swallowed by the scroll view dismissing it. The submit button then
 *   needs pressing twice and the first press looks like it did nothing.
 * - `KeyboardAvoidingView`, or the keyboard covers the bottom of the form and
 *   the field being typed into can sit underneath it.
 * - a growing content container, or a short form is pinned to the top with no
 *   room to scroll a covered field into view.
 *
 * `padding` on iOS and `height` on Android: the two platforms resize the window
 * differently, and using one behaviour for both leaves a gap under the keyboard
 * on one of them.
 */
export function FormScreen({ children }: FormScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <KeyboardAvoidingView
        testID="form-keyboard-avoider"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          testID="form-scroll"
          keyboardShouldPersistTaps="handled"
          // Dismisses on a drag rather than on any touch, so scrolling the form
          // puts the keyboard away while tapping a field does not.
          keyboardDismissMode="on-drag"
          contentContainerClassName="grow p-gutter"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
