# Authentication configuration

Settings only — no keys, secrets or tokens are recorded here.

## Providers

| Provider | State |
| --- | --- |
| Email + password | Enabled — the only provider the app uses |
| Google / Apple / Microsoft / other OAuth | Not enabled |
| Anonymous sign-in | Disabled |
| Phone / SMS | Not used |

## Settings the application depends on

| Setting | Value in the current project | Why it matters |
| --- | --- | --- |
| Public sign-up | Enabled | `/signup` must work for any visitor |
| Confirm email | **Disabled (auto-confirm on)** | Signup goes straight to `/profile-setup`; if you turn confirmation back on, new users land on a "check your email" screen instead |
| Leaked-password protection (HIBP) | Enabled | Weak/breached passwords return 422; `friendlyAuthError()` in `src/lib/auth.tsx` maps this to a readable message |
| Minimum password length | Supabase default (6) | Signup form does not enforce a stricter rule |
| JWT expiry / refresh rotation | Supabase defaults | No app code depends on custom values |

## Redirect / URL configuration

The app passes redirect targets at call time, so the new project's **Site URL** and
**Redirect URLs** allow-list must include the app origins (preview, published
domain, and any custom domain):

| Flow | Redirect used |
| --- | --- |
| Sign-up (`supabase.auth.signUp`) | `${window.location.origin}/dashboard` |
| Password reset (`resetPasswordForEmail`) | `${window.location.origin}/reset-password` |

## Auth-adjacent database objects

- Trigger `on_auth_user_created` on `auth.users` → `public.handle_new_user()` creates the profile row. Recreate it (see `02-functions-triggers.sql`) or profiles will never be created for new users.
- `public.profiles.id` and `public.user_roles.user_id` are foreign keys to `auth.users(id)`.

## Email templates

The project uses Supabase's default transactional templates. No custom templates or custom SMTP configuration is in use. Because confirmation emails are disabled, only the password-recovery template is exercised.
