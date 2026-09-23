// Single source of truth for the password rule, kept in step with the
// Supabase Auth setting (Authentication → Email → minimum length 8,
// "Letters and digits"). Checking it here first means people get a
// clear message in their own language instead of Supabase's English
// "weak password" error after they submit.
export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordStrongEnough(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}
