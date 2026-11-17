/* Twodo · text. Every piece of text goes through <Txt>: a type style from the tokens, a tone from the theme,
   Dynamic Type with a cap per style. */
import { Text, type TextProps } from 'react-native';
import { useTheme } from './theme';
import { INK, MAX_SCALE, TYPE, type ColorName, type TypeVariant } from './tokens';

export type Tone = 'label' | 'soft' | 'faint' | 'on' | 'danger';

export interface TxtProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  /** Text in a person's colour (their name, a link): uses the readable ink of that colour. */
  ink?: ColorName;
  /** Numbers that change (counts, times) keep their width. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function Txt({ variant = 'body', tone = 'label', ink, tabular, align, style, ...rest }: TxtProps) {
  const t = useTheme();
  const color = ink ? t.person(ink).ink : tone === 'on' ? INK : tone === 'danger' ? t.n.danger : t.n[tone];
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[TYPE[variant], { color, textAlign: align }, tabular ? { fontVariant: ['tabular-nums'] } : null, style]}
    />
  );
}
