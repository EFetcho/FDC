# Set up the FDC operations dashboard

This is the private dashboard at **dash.firstduecom.com**. It shows the next two weeks of Google Calendar, open Todoist tasks, Gmail drafts, inbox threads that need a reply, and open rows on the Project Tracker sheet.

You do not need to write any code. Work through the steps in order. Each step says what to click and what to copy.

The dashboard never sends email. Checking a draft only hides it on the dashboard. Delete is a separate button and asks you to confirm.

Times are Eastern Time, America/Indianapolis.

---

## What you need before you start

- A computer and the Google account you want to sign in with (`fetcho@fdcav.com` or `fetcho@firstduecom.com`).
- Access to this GitHub repository: `EFetcho/FDC`.
- Access to the Todoist account whose tasks should appear.
- Access to the DNS settings for `firstduecom.com` (wherever the other website records live: GoDaddy, Cloudflare, Google Domains, Network Solutions, or similar).
- Permission to edit the Project Tracker Google Sheet. The Google account you sign in with must be an editor on that sheet.

Have a notes app open so you can paste the client secret, the Todoist token, and the long sign-in password as you create them.

---

## 1. Create the Google connection

Google has to be told that this dashboard is allowed to read the calendar, read and label Gmail, and edit the sheet. You do that once in Google Cloud.

### 1a. Create a project

1. Open [https://console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. In the top bar, click the project dropdown, then **New project**.
3. Name it `FDC Dashboard`.
4. If you see an organization for First Due or FDC, select it. If you do not, leave the organization blank.
5. Click **Create**, then make sure `FDC Dashboard` is the selected project in the top bar.

### 1b. Turn on the three Google services

1. Open the menu (three lines) and go to **APIs & Services → Library**.
2. Search for **Google Calendar API**. Open it and click **Enable**.
3. Go back to the library. Search for **Gmail API**. Enable it.
4. Go back to the library. Search for **Google Sheets API**. Enable it.

### 1c. Set up the consent screen

The consent screen is the page Google shows when you click “Sign in with Google” and choose Allow.

1. Open [Google Auth platform](https://console.cloud.google.com/auth/overview). If the menu still says **APIs & Services → OAuth consent screen**, use that. It is the same setup.
2. If it says the platform is not configured, click **Get started**.
3. App name: `FDC Dashboard`.
4. User support email: your own email.
5. Audience: choose one of these.

**Best choice, if this Google account is a company Google Workspace account you manage:** choose **Internal**. People outside the company cannot sign in, Google will not show an “unverified app” warning, and the connection does not expire every 7 days.

**If Internal is not available:** choose **External**. Leave the app in **Testing**. Do not click Publish. A private tool does not need Google’s public review, and publishing would start a long verification process because Gmail access is restricted.

6. Contact email: your own email.
7. Agree to the user data policy and finish creating the app.

If you chose External:

1. Open **Audience**.
2. Under **Test users**, click **Add users**.
3. Add both `fetcho@fdcav.com` and `fetcho@firstduecom.com`. Save.

Still on External, open **Data Access** (it may be called Scopes) and add these three, using **Add or remove scopes** and the manual entry box if you do not see them in the list:

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/spreadsheets`

Save. You do not need to add a scope for sending mail. The dashboard does not send mail. `gmail.modify` is what lets it read drafts, delete a draft you confirmed, and apply the label `Dashboard/Done`.

### 1d. Create the OAuth client

1. Open **Google Auth platform → Clients** (older menus call this **APIs & Services → Credentials**).
2. Click **Create client**.
3. Application type: **Web application**.
4. Name: `FDC Dashboard web`.
5. Under **Authorized JavaScript origins**, add `https://dash.firstduecom.com`.
6. Under **Authorized redirect URIs**, add exactly:

   `https://dash.firstduecom.com/api/auth/callback`

   If you will try the site on your own computer later, also add `http://localhost:3000/api/auth/callback`. The live site does not need the localhost line.

7. Click **Create**.
8. Copy the **Client ID** and the **Client secret** into your notes immediately. Google may show the secret only once. If you lose it, open the client later and use **Add secret** or **Reset secret**.

The client ID looks like `something.apps.googleusercontent.com`. The secret is a shorter password-like string.

---

## 2. Copy the Todoist token

1. Open Todoist on the web and sign in: [https://app.todoist.com/app/settings/integrations/developer](https://app.todoist.com/app/settings/integrations/developer).
2. If that page does not open, click your picture at the top left, then **Settings → Integrations → Developer**.
3. Click **Copy API token**.
4. Paste it into your notes. Label it Todoist.

Do not click **Issue a new API token** unless you mean to. That signs you out of Todoist everywhere and breaks anything already using the old token.

Anyone with this token can read and change your Todoist. It stays in Vercel’s settings, not in the browser and not in GitHub.

---

## 3. Create the data store (Upstash Redis)

The dashboard has to remember three things on the server: which Gmail drafts you hid, your authenticator secret, and your one-time backup codes. It also stores the Google refresh token there, encrypted. It uses **Upstash Redis**, which is the service Vercel uses for this kind of small database (it replaced the old “Vercel KV” product). You do not need Vercel Postgres.

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub. Approve access to the `EFetcho/FDC` repository if it asks.
2. You can create the Redis database now, or in the next section after the project exists. Easiest path:
   - Open [https://console.upstash.com](https://console.upstash.com) and create a free account.
   - Click **Create database**. Name it `fdc-dashboard`. Pick a US region close to you (for example `us-east-1`). Leave TLS on.
   - Open the database. Find **REST API**, not the `rediss://` URL.
   - Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** into your notes.

If you would rather connect it inside Vercel: after the project exists (next section), open the project → **Storage** or **Integrations** → **Upstash Redis** → connect it to this project. Vercel will fill in the two variables for you. If the names it creates start with `KV_REST_API_` instead of `UPSTASH_REDIS_REST_`, that is fine. The dashboard accepts either pair. Do not invent your own values.

---

## 4. Make a long sign-in secret

The site uses this to lock the sign-in cookie and to encrypt the authenticator secret. It must be at least 32 characters, and it should be random.

In 1Password, Bitwarden, or another password manager, generate a random password of about 40 characters. You will not type it daily. Paste it into your notes and label it `SESSION_SECRET`.

Do not change it later unless you want to set up the authenticator again. Changing it signs you out and makes the saved authenticator unreadable on purpose.

---

## 5. Deploy on Vercel from this GitHub repo

1. In Vercel, click **Add New… → Project**.
2. Import **EFetcho/FDC**. If you do not see it, click **Adjust GitHub App Permissions** and grant this repository.
3. Before you click Deploy, open **Root Directory** and click **Edit**. Select the `dashboard` folder. The site lives in that folder. The rest of the repository is left alone.
4. Framework should say **Next.js**. Leave the build command and output as they are.
5. Open **Environment Variables** and add every row below. Paste the real values. Leave the optional ones blank.

| Name | What to paste | Required? |
| --- | --- | --- |
| `APP_URL` | `https://dash.firstduecom.com` | Yes |
| `GOOGLE_CLIENT_ID` | The client ID from step 1 | Yes |
| `GOOGLE_CLIENT_SECRET` | The client secret from step 1 | Yes |
| `ALLOWED_EMAILS` | `fetcho@fdcav.com,fetcho@firstduecom.com` | Optional. This is already the default if you leave it out. Add another email here only if that person should also be able to sign in. |
| `TODOIST_API_TOKEN` | The token from step 2 | Yes, or the Tasks section shows an error |
| `SESSION_SECRET` | The long random password from step 4 | Yes |
| `UPSTASH_REDIS_REST_URL` | From Upstash | Yes, unless Vercel already added the `KV_REST_API_URL` pair |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash | Yes, unless Vercel already added the `KV_REST_API_TOKEN` pair |
| `DEMO_MODE` | `false` | Yes. Do not set this to `true` on the real site. `true` shows fake data and a button that skips sign-in. |
| `PROJECTS_SHEET_ID` | Leave blank | Optional. Blank uses the Project Tracker sheet already wired in. |
| `PROJECTS_SHEET_TAB` | Leave blank | Optional. Blank uses the tab named `Project Tracker`. |

6. Click **Deploy**. Wait until it says Ready. The first address will be a `vercel.app` link. You can ignore that link for daily use. Sign-in is registered for `dash.firstduecom.com` only.

If a later deploy is needed, Vercel does it when the `dashboard` folder changes on the main branch. You can also open the project and click **Redeploy**.

After you change any environment variable, open **Deployments** and redeploy. New variables do not apply to the copy that is already running until you do.

---

## 6. Add dash.firstduecom.com

### In Vercel

1. Open the Vercel project → **Settings → Domains**.
2. Type `dash.firstduecom.com` and add it.
3. Vercel will say the domain is not verified yet and will show a DNS record. You want a **CNAME** record. The target is `cname.vercel-dns.com`.

### At the firstduecom.com DNS host

This is the same place the other `firstduecom.com` records are edited. It is not inside Vercel.

1. Sign in to the company that hosts the DNS for `firstduecom.com`.
2. Open DNS records for `firstduecom.com`.
3. Add a record:

   | Type | Name / Host | Value / Points to | TTL |
   | --- | --- | --- | --- |
   | CNAME | `dash` | `cname.vercel-dns.com` | Automatic, or 1 hour |

   The host is only `dash`, not `dash.firstduecom.com`, in most control panels. If the panel wants the full name, use `dash.firstduecom.com`.

4. Save. Do not delete the other records for the main website or email.

5. Wait. Often this takes a few minutes. Sometimes it takes a few hours. In Vercel, the domain changes from a warning to a check mark when it is ready. Then open [https://dash.firstduecom.com](https://dash.firstduecom.com).

---

## 7. First sign-in and the authenticator

1. Open [https://dash.firstduecom.com](https://dash.firstduecom.com).
2. Click **Sign in with Google**.
3. Choose `fetcho@fdcav.com` or `fetcho@firstduecom.com`. If both are yours, pick the one that can edit the Project Tracker sheet and that owns the calendar and Gmail you want to see. You can sign out and use the other later. Each account has its own authenticator setup.
4. Google asks you to allow Calendar, Gmail, and Sheets. Click **Allow**. The dashboard asks every time you sign in so the connection stays valid.

If the app is External and still in Testing, Google shows a warning that the app is not verified. That is expected for a private tool:

1. Click **Advanced**.
2. Click **Go to FDC Dashboard (unsafe)**. The word “unsafe” is Google’s standard wording for any app it has not reviewed. This is your own project.
3. Then click **Allow**.

5. The next page is **Set up your authenticator**. On your phone, open Google Authenticator, Microsoft Authenticator, 1Password, or Authy.
6. Add an account and scan the square code. If you cannot scan, type the key shown under the code.
7. The app shows a 6-digit code that changes every 30 seconds. Type the current one and continue.
8. The site then shows **10 backup codes**. Copy them or write them down and store them somewhere that is not the same phone. Each code works once. Check the box that you saved them, then continue.

You land on the dashboard. Summary counts are at the top. Click a count to jump to that section. The FDC logo sits faintly in the bottom corner.

Checking an item:

- **Tasks:** completes the task in Todoist. Undo puts it back. A repeating task jumps to the next date instead of ending forever.
- **Drafts:** hides the draft on the dashboard only. It stays in Gmail. Undo shows it again. **Delete** asks you to confirm, then permanently deletes that draft. It does not send it.
- **Follow-ups:** adds the Gmail label `Dashboard/Done` (the dashboard creates the label the first time) and removes the thread from the list. Undo removes the label. The thread stays in the inbox.
- **Projects:** sets the Status cell to `closed` on the sheet. Undo sets it back to `open`. **Add project** appends a row.
- **Calendar:** view only. Nothing is changed in Google Calendar.

Sign-in lasts about 18 hours, then Google and the authenticator are both required again.

Follow-ups leave out newsletters and marketing mail. They also leave out QuickBooks estimates and invoices for fire departments, police departments, and sheriff’s offices (the emergency-services division). A QuickBooks invoice for an event client still shows up.

---

## 8. If you lose your phone

On the code page, click **Use a backup code instead** and type one saved code. That code cannot be used again.

Then open **Security** on the dashboard:

- **New backup codes** replaces the whole set. Enter a current authenticator code first.
- **Set up a new authenticator** is for a new phone. Enter a current code or a backup code, scan the new square, then enter the new 6-digit code. The old phone stops working. New backup codes are shown. Save them.

If you have neither the phone nor a backup code, the authenticator record has to be deleted so you can enroll again:

1. Open the Upstash database from step 3.
2. Open **Data browser**.
3. Find the key `user:fetcho@fdcav.com` (or the other email, if that is the one you use).
4. Delete that key.
5. Sign in again. Google will ask for permission, then the site will show a new authenticator setup. Your Gmail, calendar, and sheet are not deleted by this. Only the dashboard’s copy of the sign-in is removed.

---

## 9. Share the project sheet

If Projects says Google blocked the request, the Google account you used is not an editor on the sheet.

1. Open the Project Tracker sheet.
2. Click **Share**.
3. Add the same email you use to sign in to the dashboard, as **Editor**.

The sheet id is `1fHUpty80AJtD74MCewGC5yipWzvL3sWcYYgIELQmyOc`, tab `Project Tracker`. Row 1 is the header. The dashboard uses columns A through D: project name, date started, status (`open` or `closed`), and chat link. It lists rows whose status is `open` or blank.

---

## 10. The 7-day Google limit

This only applies when the Google app is **External** and still in **Testing**.

Google expires that permission about 7 days after you click Allow. The dashboard will then say Google access expired. Sign out, sign in, and click Allow again. Your authenticator stays set up. You only repeat the Google Allow screen.

Moving the Google Cloud project to **Internal** (step 1c, Workspace) removes this 7-day limit. Do not click Publish on an External app to try to avoid it. Publishing a private Gmail app starts Google’s verification review.

---

## If something else goes wrong

| What you see | What to do |
| --- | --- |
| “That Google account cannot open this dashboard” | Sign in with `fetcho@fdcav.com` or `fetcho@firstduecom.com`. |
| Google says access is blocked, and the account is not a test user | Add that email under Audience → Test users, or switch the app to Internal. |
| Tasks says the token was not accepted | Copy the Todoist token again. Update `TODOIST_API_TOKEN` in Vercel. Redeploy. |
| The data store is not connected | Check the Upstash URL and token in Vercel, then redeploy. |
| The site opens the `vercel.app` address and Google sign-in fails | Use `https://dash.firstduecom.com` only. |
| A section is empty and shows a red message | Click Refresh. If it stays, the message says which connection failed. |
| Sample data and a yellow bar are showing | `DEMO_MODE` is on. Set it to `false` in Vercel and redeploy. |
| `dash.firstduecom.com` does not open | Check the CNAME from `dash` to `cname.vercel-dns.com`, and the domain status in Vercel. |

Environment variable names, for reference when you are looking at the Vercel list:

`APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `TODOIST_API_TOKEN`, `SESSION_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `DEMO_MODE`, `PROJECTS_SHEET_ID`, `PROJECTS_SHEET_TAB`.
