# PantryPilot

A self-hosted grocery receipt scanner, pantry inventory manager and recipe cost meal planner.

- Live pantry inventory with expiry tracking
- Receipt OCR scanning (powered by Gemini, optional)
- Barcode lookup for packaged foods
- Weekly meal planner with ingredient depletion forecasting
- Cooking cost tracking and household analytics

## Install on Unraid (easiest)

1. Open the Unraid **Terminal** and run:
   ```bash
   mkdir -p /mnt/user/appdata/pantrypal && \
   wget -O /boot/config/plugins/dockerMan/templates-user/my-PantryPal.xml \
     https://raw.githubusercontent.com/Lloir/PantryPilot/main/unraid/my-PantryPal.xml
   ```
2. **Docker** tab -> **Add Container** -> choose **my-PantryPal** from the Template dropdown.
3. Optionally paste a Gemini API key, then click **Apply**.
4. Open `http://YOUR-UNRAID-IP:3000`.

More options (Compose, `docker run`) are in [UNRAID.md](UNRAID.md).

## Run with Docker

```bash
docker run -d --name pantrypal --restart unless-stopped \
  -p 3000:3000 \
  -v pantrypal-data:/app/data \
  -e GEMINI_API_KEY= \
  ghcr.io/lloir/pantrypilot:latest
```

Or with Compose: `docker compose up -d` (uses `docker-compose.yml`).

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _empty_ | Optional. Enables receipt OCR and AI recipe suggestions. |
| `PORT` | `3000` | Port the app listens on inside the container. |
| `DATA_DIR` | `/app/data` | Where data is stored. Mount a volume here to keep it. |
| `NODE_ENV` | `production` | Node environment. |

## The Docker image

Images are built and published to `ghcr.io/lloir/pantrypilot` by
`.github/workflows/docker-publish.yml` on every push to `main` and on `v*` tags
(tags: `latest`, version, commit SHA). It can also be run manually from the Actions tab.

If a pull is denied, the package is still private: the repo owner must set it to
**Public** under GitHub -> Packages -> pantrypilot -> Package settings.

## Development

```bash
bun install        # or npm install
npm run dev        # starts server.ts with Vite
npm run build      # production frontend build
npm run lint       # type check
```

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` for local OCR.
