# Turn off signup confirmation emails

New students currently have to click a link in a confirmation email before they can log in. This change makes accounts active immediately after signup.

## What changes

- Enable auto-confirm for email signups in the backend auth settings, so no confirmation email is sent and new accounts are usable right away.
- Update the signup page so that after a successful signup the student goes straight into the profile setup flow instead of seeing the "check your email" screen.

## Technical notes

- Call `supabase--configure_auth` with `auto_confirm_email: true` (leaving signups enabled, anonymous users off, leaked-password protection on).
- In `src/routes/signup.tsx`, the `checkEmail` fallback branch stays as a safety net if no session is returned, but with auto-confirm the signup response includes a session and navigates to `/profile-setup`.
- Password reset emails are unaffected.

## Trade-off

Anyone can sign up with an email address they don't own, since ownership is no longer verified.
