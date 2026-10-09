# PantryPilot 🥫

Scan your grocery receipts, track what's in your kitchen, plan meals.
Runs on your own server. Takes about 2 minutes to set up.

---

## 🟠 Install on Unraid

**Step 1.** Click the `>_` icon (top right of Unraid) to open the Terminal.

**Step 2.** Copy this whole thing, paste it in, hit Enter:

```bash
mkdir -p /mnt/user/appdata/pantrypal && wget -O /boot/config/plugins/dockerMan/templates-user/my-PantryPal.xml https://raw.githubusercontent.com/Lloir/PantryPilot/main/unraid/my-PantryPal.xml
```

**Step 3.** Click the **Docker** tab, then **Add Container**.

**Step 4.** At the top, open the **Template** dropdown and pick **my-PantryPal**.

**Step 5.** Click **Apply**. Wait for it to finish.

**Step 6.** Open your browser and go to:

```
http://YOUR-UNRAID-IP:3000
```

Done. 🎉

> Got "access denied" when it pulls the image? Tell whoever shared this with you
> to make the package public (see the bottom of this page).

---

## 🐳 Install with Docker (not Unraid)

Copy, paste, Enter:

```bash
docker run -d --name pantrypal --restart unless-stopped -p 3000:3000 -p 3443:3443 -v pantrypal-data:/app/data ghcr.io/lloir/pantrypilot:latest
```

Then go to `http://localhost:3000`. Done. 🎉

---

## 🤖 Do I need a Gemini key?

**No.** The app works without it.

A key just turns on the AI extras (smarter receipt scanning, recipe ideas).
Get a free one at https://aistudio.google.com/apikey, then:

- **Unraid:** paste it in the **Gemini API Key** box when adding the container.
- **Docker:** add `-e GEMINI_API_KEY=your_key_here` to the command above.

---

## 📷 Camera for scanning (phones)

Browsers only let a web page use the camera on a **secure (https)** address. Plain
`http://YOUR-UNRAID-IP:3000` can't, and the browser won't even ask. PantryPal also runs on a
second, secure port:

```
https://YOUR-UNRAID-IP:3443
```

Use that address on your phone when you want to scan. The first time, the browser warns that
the certificate isn't trusted (PantryPal made it itself): tap **Advanced**, then **Continue**.
After that the camera asks for permission like normal.

- Unraid: the template has a **Secure (https) Port** (3443). If you installed earlier, run Step 2 again,
  then edit the container and Apply, or just add a port mapping `3443 -> 3443`.
- No camera or don't want the warning? **Scan Receipt -> Take Photo** opens your phone's camera app
  and works on the normal `http` address too.
- Optional: set `HTTPS_HOSTNAMES` to your server's IP so the certificate matches the address you type.
  Turn the secure port off with `HTTPS_DISABLED=true`.

---

## 📱 Put it on your phone like an app

PantryPal is a web app that can install itself on a phone's home screen (no app store, no APK).
Use the menu (the three lines next to the logo) -> **Install app**. It tells you exactly what your phone needs.

Browsers only offer "install" and the camera on **https** addresses, so on plain `http://YOUR-UNRAID-IP:3000` you have three choices:

1. **A trusted https address** (best, works on every phone): for example Tailscale (`tailscale serve --bg 3000`), or a domain with Nginx Proxy Manager / SWAG.
2. **A one-time Chrome setting on each Android phone**: in Chrome open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enable it, add your PantryPal address, relaunch. The Install guide in the app shows the exact address to paste.
3. **Add to Home screen** from Chrome's menu: a shortcut only (no camera on plain http).

---

## 🏠 Everything else it does for the household

- **Staples:** on an item, set **Keep at least**. Below that it shows as *Low*, appears under *Running low* on the shopping list, and the Cost tab shows what restocking will cost.
- **Throwing food out:** removing an item asks *Threw it out / Used it up / Added by mistake*. "Threw it out" is counted as waste on the Cost tab.
- **Prices:** each purchase records its price (and store, from receipts). Open an item to see its price history and cheapest store; the Cost tab lists items whose price moved 10% or more.
- **Budget:** set a monthly budget on the Cost tab and watch *Total Spent MTD* against it.
- **Duplicate receipts:** scanning a receipt with the same store, date and total as one already added warns you first.
- **Recipes:** **Import recipe** from a link (or paste text, using the AI), **Cook mode** with big steps, timers and the screen kept awake, calories per serving when items have nutrition info, and red flags for foods on your *avoid* list (menu -> People & household).
- **Shopping list:** shown in store-aisle order; Share, Print, Clear checked.
- **Requests:** comments on requests, plus a *Household activity* feed.
- **Backup & data** (menu): automatic daily backups, one-click backup, download everything or the pantry as a spreadsheet, restore.
- **Calendar & alerts** (menu): subscribe your phone's calendar to the meal plan, and get one morning message (via [ntfy](https://ntfy.sh) or a webhook) about food expiring, staples running low and today's meals. Set the container's `TZ` (Timezone) so the time is right.

---

## 🏷️ Barcode lookup

Barcodes are looked up in the free [Open Food Facts](https://world.openfoodfacts.org) database (worldwide,
crowd-sourced) and UPCitemdb. The server needs internet access for this. Anything you confirm is remembered,
so a missing product only needs filling in once. Optional: set `BARCODE_LOOKUP_API_KEY` to also use
[barcodelookup.com](https://www.barcodelookup.com/api) (paid key).

---

## 🔐 Logging in, and sharing with your household

PantryPal asks for a username and password. **Everyone who signs in shares the same
pantry, recipes, meal planner and shopping list.** Changes show up on everyone's
screen within a few seconds.

The first time it starts, it makes one login for you and prints it in the logs:

```bash
docker logs pantrypal
```

Look for `username: admin` and `password: ...`.

**Add family members** from the menu (the three lines next to the logo) -> **People & household**.
Pick what each person can do:

| Role | Can do |
|---|---|
| **Admin** | Everything, plus add/remove people and reset passwords |
| **Member** | Look at and change the pantry, recipes, planner and shopping list |
| **View only** | Look at everything and leave **Requests** (like "we're out of oat milk" or "can we have lasagna Friday?"). Cannot change anything |

Requests show up on the **Requests** tab. Admins and members can turn a request into a
shopping list item or a planned meal with one tap.

The logins live in a plain text file in your data folder: `users.txt`
(Unraid: `/mnt/user/appdata/pantrypal/users.txt`). One per line, and you can edit it by hand too:

```
admin:your-password [admin]
her-name:her-password [member]
kid:kid-password [viewer]
```

> Want no login at all? Add the variable `AUTH_DISABLED=true`.

**Dark mode:** menu -> Theme -> Light, Dark, or Match device. This is per device.

---

## 🔄 Update

**Unraid:** Docker tab -> click the PantryPilot icon -> **Force Update**.

**Docker:**

```bash
docker pull ghcr.io/lloir/pantrypilot:latest
docker rm -f pantrypal
docker run -d --name pantrypal --restart unless-stopped -p 3000:3000 -p 3443:3443 -v pantrypal-data:/app/data ghcr.io/lloir/pantrypilot:latest
```

Your data is kept. It lives in the volume.

---

## 🆘 Something broke

| Problem | Fix |
|---|---|
| Page won't load | Wait 30 seconds, refresh. Check the IP and `:3000`. |
| Port 3000 already used | Change the **WebUI Port** to `8085` (Unraid) or use `-p 8085:3000` (Docker), then go to `:8085`. |
| "Access denied" pulling image | Package is private. See below. |
| See what's wrong | `docker logs pantrypal` |

---

## 🛠 For the person who owns the repo

The image builds itself and goes to `ghcr.io/lloir/pantrypilot` every time you push to `main`.

**One-time:** make it public so friends can pull it.
GitHub -> your profile -> **Packages** -> **pantrypilot** -> **Package settings** -> **Change visibility** -> **Public**.

More Unraid options (Compose etc.): see [UNRAID.md](UNRAID.md).
