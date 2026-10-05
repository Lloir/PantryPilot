# Hosting PantryPal on Unraid (Docker)

## Quick start (about 1 minute)

1. Open the Unraid **Terminal** (top-right `>_`) and paste:
   ```bash
   mkdir -p /mnt/user/appdata/pantrypal && \
   wget -O /boot/config/plugins/dockerMan/templates-user/my-PantryPal.xml \
     https://raw.githubusercontent.com/Lloir/PantryPilot/main/unraid/my-PantryPal.xml
   ```
2. Go to the **Docker** tab -> **Add Container** -> pick **my-PantryPal** from the Template dropdown.
3. (Optional) paste a Gemini API key for receipt scanning, then click **Apply**.
4. Open `http://YOUR-UNRAID-IP:3000`.

The image is pulled automatically from `ghcr.io/lloir/pantrypilot:latest`.
If the pull is denied, the repo owner needs to set the package to **Public** on GitHub.

Prefer one command? `docker run -d --name pantrypal --restart unless-stopped -p 3000:3000 -v /mnt/user/appdata/pantrypal:/app/data -e GEMINI_API_KEY= ghcr.io/lloir/pantrypilot:latest`

---

## More detail

PantryPal is fully optimized for self-hosting on **Unraid OS** via Docker. It supports persistent data storage, multi-user household syncing, and low resource usage.

---

## Method 1: Unraid Community Applications Template (Recommended)

1. Open your Unraid Flash drive or terminal:
   ```bash
   # Copy the template file to Unraid's user templates folder:
   cp my-PantryPal.xml /boot/config/plugins/dockerMan/templates-user/
   ```
   *(Or download `my-PantryPal.xml` directly from the in-app Unraid dialog).*

2. In the Unraid WebGUI, navigate to the **Docker** tab and click **Add Container**.
3. In the **Template** dropdown at the top, select **my-PantryPal**.
4. Configure the settings:
   - **Name**: `pantrypal`
   - **Repository**: `ghcr.io/lloir/pantrypilot:latest`
   - **WebUI Port**: `3000` (can map to any free port, e.g. `8085`)
   - **Appdata Storage**: `/mnt/user/appdata/pantrypal` $\rightarrow$ `/app/data`
   - **GEMINI_API_KEY**: *(Optional)* Your Gemini API key for receipt OCR & recipe AI.
5. Click **Apply**. Unraid will start the container. Access the app at `http://YOUR-UNRAID-IP:3000`.

---

## Method 2: Unraid Docker Compose (via Docker Compose Manager Plugin)

If you use the **Compose.Manager** plugin on Unraid:

1. Create a new stack named `pantrypal`.
2. Paste the `docker-compose.yml`:
   ```yaml
   services:
     pantrypal:
       image: ghcr.io/lloir/pantrypilot:latest
       container_name: pantrypal
       restart: unless-stopped
       ports:
         - "3000:3000"
       volumes:
         - /mnt/user/appdata/pantrypal:/app/data
       environment:
         - NODE_ENV=production
         - PORT=3000
         - DATA_DIR=/app/data
         - GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   ```
3. Click **Compose Up**.

---

## Method 3: Direct Unraid Terminal (`docker run`)

Open the Unraid web terminal and run:

```bash
docker run -d \
  --name=pantrypal \
  --restart=unless-stopped \
  -p 3000:3000 \
  -v /mnt/user/appdata/pantrypal:/app/data \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e GEMINI_API_KEY="YOUR_KEY_HERE" \
  pantrypal:latest
```

---

## Persistent Data & Household Syncing

- **Data location on Unraid:** All inventory items, recipes, planned meals, and cost logs are saved to `/mnt/user/appdata/pantrypal/pantry-db.json`.
- **Backups:** Your data is safely stored on your Unraid array/cache pool and will never be lost when updating the Docker container.
- **Multi-Device Household:** Any device on your local network (phones, tablets, PCs) can access `http://YOUR-UNRAID-IP:3000` to share the same synchronized pantry inventory.
