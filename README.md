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
docker run -d --name pantrypal --restart unless-stopped -p 3000:3000 -v pantrypal-data:/app/data ghcr.io/lloir/pantrypilot:latest
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

## 🔐 Logging in

PantryPal asks for a username and password.

The first time it starts, it makes one login for you and prints it in the logs:

```bash
docker logs pantrypal
```

Look for `username: admin` and `password: ...`.

The logins live in a plain text file in your data folder: `users.txt`
(Unraid: `/mnt/user/appdata/pantrypal/users.txt`). One per line:

```
admin:your-password
her-name:her-password
```

Edit it any time to add people or change passwords. No restart needed.

> Want no login at all? Add the variable `AUTH_DISABLED=true`.

---

## 🔄 Update

**Unraid:** Docker tab -> click the PantryPilot icon -> **Force Update**.

**Docker:**

```bash
docker pull ghcr.io/lloir/pantrypilot:latest
docker rm -f pantrypal
docker run -d --name pantrypal --restart unless-stopped -p 3000:3000 -v pantrypal-data:/app/data ghcr.io/lloir/pantrypilot:latest
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
