/* Twodo · form validation (Zod). Messages match the app's own wording. */
import { z } from 'zod';
import { USERNAME_RE } from './firebase';

const email = z.string().trim().regex(/^\S+@\S+\.\S+$/, 'Enter a valid email.').max(254, 'Enter a valid email.');
export const SignInForm = z.object({ email, password: z.string().min(1, 'Enter your password.').max(1024) });
export const SignUpForm = z.object({ email, password: z.string().min(8, 'Use at least 8 characters.').max(1024) });
export const CreateAccountForm = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(24),
  partner: z.string().trim().max(24),
  email,
  password: z.string().min(8, 'Use at least 8 characters for your password.').max(1024),
});
export const Username = z.string().regex(USERNAME_RE, 'Use 3–20 letters, numbers, dots or underscores.');
/** first problem as a sentence, or '' when the form is fine */
export const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }): string => (r.success ? '' : r.error!.issues[0].message);
