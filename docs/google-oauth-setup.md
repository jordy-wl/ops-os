# Google OAuth Setup Guide

This guide walks through setting up Google OAuth 2.0 for Ops OS, enabling Gmail, Calendar, and Drive integrations.

## Prerequisites

- Google account with access to [Google Cloud Console](https://console.cloud.google.com/)
- Access to Ops OS environment variables (`.env.local` for dev, Vercel dashboard for prod)

---

## Step 1: Create or Select a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project selector dropdown in the top navigation bar
3. Click **New Project** (or select an existing project)
4. Enter project name (e.g., `ops-os`), select your organization (if any)
5. Click **Create**, then select the new project from the dropdown

---

## Step 2: Enable Required APIs

1. Navigate to **APIs & Services > Library** (or search "API Library" in the top search bar)
2. Search for and enable each API:
   - **Gmail API** — click, then click **Enable**
   - **Google Calendar API** — click, then click **Enable**
   - **Google Drive API** — click, then click **Enable**
3. Verify all three are enabled at **APIs & Services > Enabled APIs & services**

---

## Step 3: Configure the OAuth Consent Screen

> **Note (2025+ UI change):** Google restructured the console navigation. The consent screen is now under **Google Auth platform** in the sidebar. If you don't see it, look under **APIs & Services > OAuth consent screen** (legacy path).

### 3a: App Information (Branding)

Navigate to: Sidebar > **Google Auth platform** > **Branding**

1. Click **Get Started** or **Configure Consent Screen**
2. Select **User Type: External**
3. Fill in:
   - **App name:** `Ops OS`
   - **User support email:** Your Google email
   - **App home page:** `https://ops-os-gamma.vercel.app`
   - **Privacy policy URL:** `https://ops-os-gamma.vercel.app/privacy` (create this page or use a placeholder)
   - **Terms of service URL:** `https://ops-os-gamma.vercel.app/terms`
   - **Authorized domains:** `ops-os-gamma.vercel.app`
   - **Developer contact email:** Your email
4. Save and continue

### 3b: Scopes (Data Access)

Navigate to: **Google Auth platform > Data Access**

Click **Add or Remove Scopes** and add these three scopes:

| Scope | Tier | Purpose |
|-------|------|---------|
| `https://www.googleapis.com/auth/gmail.send` | Sensitive | Send emails via workflow actions |
| `https://www.googleapis.com/auth/calendar.events` | Sensitive | Create/read calendar events |
| `https://www.googleapis.com/auth/drive.file` | Non-sensitive | Read/write files created by Ops OS |

Save and continue.

> **Important: We intentionally omit `gmail.readonly`.** This scope is classified as **restricted** by Google, which triggers a mandatory third-party CASA security assessment ($4,000-$15,000+) with annual recertification. The `gmail.send` scope (sensitive tier) covers our workflow email actions. We can add `gmail.readonly` later when budget allows for the CASA process.

### 3c: Test Users (Audience)

Navigate to: **Google Auth platform > Audience**

1. Your app starts in **Testing** publishing status
2. Click **Add users** and add email addresses of all team members and testers (up to 100 users in testing mode)
3. Save

> **Testing mode limitation:** Only users explicitly added as test users can complete the OAuth flow. For production, you'll need to submit for Google verification (the "sensitive" tier review takes 1-4 weeks).

---

## Step 4: Create OAuth 2.0 Client ID

Navigate to: **Google Auth platform > Clients** (or **APIs & Services > Credentials**)

1. Click **Create Client** (or **+ Create Credentials > OAuth client ID**)
2. Application type: **Web application**
3. Name: `Ops OS Web Client`
4. **Authorized JavaScript origins:**
   - `http://localhost:3000` (development)
   - `https://ops-os-gamma.vercel.app` (production)
5. **Authorized redirect URIs:**
   - `http://localhost:3000/api/auth/google/callback` (development)
   - `https://ops-os-gamma.vercel.app/api/auth/google/callback` (production)
6. Click **Create**
7. A dialog shows your **Client ID** and **Client Secret** — copy both immediately

> **Security:** The Client Secret is shown only once in this dialog. You can always re-access it from the Credentials page, but store it securely now.

---

## Step 5: Set Environment Variables

### Local Development (`.env.local`)

Add these three lines to your `.env.local` file in the project root:

```bash
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Production (Vercel Dashboard)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select the **ops-os** project
3. Navigate to **Settings > Environment Variables**
4. Add each variable for the **Production** environment:

| Key | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | `your-client-id-here.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-your-secret-here` |
| `GOOGLE_REDIRECT_URI` | `https://ops-os-gamma.vercel.app/api/auth/google/callback` |

5. Click **Save** for each
6. **Redeploy** the production deployment for the new env vars to take effect

---

## Step 6: Test the Connection

1. Start the dev server: `npm run dev`
2. Log in to Ops OS
3. Navigate to **Settings > Integrations** (or the Integrations page)
4. Click **Connect Google**
5. You should be redirected to Google's consent screen
6. Grant the requested permissions
7. You should be redirected back to `/integrations?google=connected`
8. Verify the connection is active in the integrations list

### Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `oauth/init-failed` (500) | Missing env vars | Check all 3 env vars are set and restart the dev server |
| `auth/unauthenticated` (401) | Not logged in | Sign in to Ops OS first |
| `auth/no-org` (403) | No org membership | Create or join an organization in Clerk |
| Google shows "Access blocked" | App not verified | Add your email as a test user in Google Cloud Console |
| Redirect URI mismatch | Wrong redirect URI | Ensure the URI in Google Console exactly matches the env var (including trailing slash or lack thereof) |
| `google=no_refresh` redirect | No refresh token returned | Ensure `prompt=consent` and `access_type=offline` are in the auth URL (they are by default) |
| `google=denied` redirect | User clicked "Don't allow" | User must grant permissions to connect |

---

## 2026 Policy Notes

### Granular OAuth Consent (Effective January 7, 2026)

Google now allows users to **selectively approve or deny individual scopes**. When a user connects Google in Ops OS, they may uncheck some permissions. The app handles this gracefully — features requiring denied scopes are disabled rather than erroring.

### Scope Tiers and Verification

| Tier | Scopes | Verification Required |
|------|--------|----------------------|
| Non-sensitive | `drive.file` | Basic verification (quick) |
| Sensitive | `gmail.send`, `calendar.events` | Standard verification (1-4 weeks) |
| Restricted | `gmail.readonly` (deferred) | CASA security assessment ($4k-$15k+, annual) |

For launch, we stay in the **sensitive** tier. The CASA assessment for `gmail.readonly` can be pursued after revenue milestones.

### Publishing Status

- **Testing:** Up to 100 test users. No verification needed. Tokens expire after 7 days.
- **In production:** Requires verification. Submit via Google Cloud Console > OAuth consent screen > Publish app.

---

## Architecture Reference

| Component | File |
|-----------|------|
| OAuth client library | `src/lib/integrations/google-client.ts` |
| OAuth initiation route | `src/app/api/auth/google/route.ts` |
| OAuth callback route | `src/app/api/auth/google/callback/route.ts` |
| Connect button UI | `src/components/integrations/google-connect.tsx` |
| Connector storage | `integration_connectors` table (Supabase) |
