# Changelog

## 2026-10-08 (5)

### Added
- **Real barcode lookup.** Scanned or typed barcodes are now looked up in [Open Food Facts](https://world.openfoodfacts.org) (a free worldwide product database; UK, US, Europe and more), then UPCitemdb, and barcodelookup.com if you set `BARCODE_LOOKUP_API_KEY`. EAN-8, UPC-A and EAN-13 all work, and the same product is matched whether or not the number has leading zeros. Before this it only knew about 13 built-in products and called everything else "Grocery Item".
- **PantryPal remembers your barcodes.** When you confirm an item with a barcode, the name, category, size, price and shelf life you confirmed are saved, and the next scan fills them in ("Saved by your household").
- **Add & scan next** button: adds the item and stays in the scanner for the next one.
- **Start over** link to clear the scanner form.

### Changed
- If a barcode isn't found anywhere, the form is left empty with a message, instead of inventing "Grocery Item (#1234) / Generic Store Brand / 2.99". Prices are only filled in when a database actually has one (never from an AI guess), and the price field is optional.
- The barcode form and a scanned receipt are kept on your device until you add them or start over, so leaving the page, closing the app or reloading no longer loses them.

### Fixed
- Camera scanning could never detect **EAN-8** barcodes (common on UK and EU products); it now asks the browser for every product barcode type it supports.
- Typing or scanning a new barcode while an old one was still in the box appended to it; the box now selects its contents when you click into it.

## 2026-10-08 (4)

### Fixed
- **Camera never starting.** Browsers only allow the camera on https pages, so on `http://<server-ip>:3000` the camera was simply unavailable and the browser never asked for permission. The app now explains this instead of a vague error, and links to the secure address.

### Added
- **Secure (https) port 3443** with a self-made certificate (kept in the data folder, renewed automatically). Open `https://<server-ip>:3443` on your phone, accept the one-time certificate warning, and the camera works. The Unraid template, Dockerfile and compose file expose it; `HTTPS_HOSTNAMES` adds your server's IP to the certificate and `HTTPS_DISABLED=true` turns it off.
- **Take Photo** on the receipt scanner: opens the phone's camera app and sends the photo back, which works on plain http too.
- Clearer camera messages: permission blocked, no camera found, camera in use.

## 2026-10-08 (3)

### Added
- **Shared household.** Everyone who signs in shares one pantry, recipe book, meal planner and shopping list. Changes appear on other people's screens within a few seconds. If two people save at the same moment, both sets of changes are kept (merged by item) instead of the later save wiping the earlier one.
- **More users, from the app.** Menu -> People & household: admins add people, choose their role, reset passwords and remove people. Everyone can change their own password. Roles: Admin (manages people), Member (edits everything), View only (looks and makes requests). Logins are still the plain `users.txt` file, now with an optional role on each line (`name:password [member]`).
- **Requests.** New Requests tab: anyone, including view-only people, can ask for a shopping item, a meal on a day, a recipe idea or anything else. Admins and members can turn a request into a shopping list item or a planned meal in one tap, mark it done, or decline it.
- **Dark mode and light theme.** Menu -> Theme: Light, Dark, or Match device (follows your phone or computer). It is remembered per device.

### Changed
- View-only people don't see edit buttons (add, scan, delete, cook, plan and so on), and the server refuses their changes and AI calls as well.
- The pantry now saves with a version number. Clearing a list on one device now reaches the others (previously an empty list was ignored when loading from the server).
- `npm run dev` and `npm run build` regenerate the dark theme styles (`scripts/generate-dark-theme.mjs`).

### Fixed
- The pantry value card on the Pantry tab showed a doubled currency symbol (`$£22.00`).

## 2026-10-08 (2)

### Added
- **Currency choice.** Pick your currency from the menu (USD, GBP, CAD, EUR, AUD, NZD, CHF, JPY and more). Every price in the app is shown in it, form labels use its symbol, and receipt scanning is told which currency you use. This only changes how amounts are displayed; existing amounts are not converted.

### Changed
- Updated the Docker publish workflow to the Node 24 versions of its GitHub Actions (checkout v7, setup-buildx v4, login v4, metadata v6, build-push v7), which clears the Node 20 deprecation warning.

## 2026-10-08

### Added
- **Autofill when adding an item by hand.** Start typing a name and your pantry items are suggested; press Tab (or click) to fill in the name, category, unit and location. The form now says plainly when a name matches an existing item and will be added to it.
- **Using rewards points.** A "Use" button next to "Add" subtracts points you spend. You can't use more than your balance.
- **Menu.** The top-bar Unraid and Android APK buttons, Sign out and the Measure by switch now live in a hamburger menu next to the logo.
- **Total Spent MTD** on Cost & Savings (replaces Estimated Savings): everything bought so far this calendar month.

### Changed
- **Expiration dates are tracked per purchase.** When you add more of an item you already have, each purchase keeps its own expiration date. The item shows the soonest one that hasn't passed yet, and moves on to the next one once it has. Using the item up draws from the soonest-expiring stock first. Setting a date by hand in the edit dialog replaces the per-purchase dates.
- **Shopping list quantity and unit are optional** for items you type in.
- **Shopping list prices come from your pantry.** The price is what you last paid for the exact same item name, scaled to the quantity. If the item isn't in your pantry (or there's no quantity), no price is shown instead of a made-up one. The auto-generated list no longer guesses prices either.
- Manual "Add Item" cost is optional. Left blank, it uses the pantry's price for that item instead of counting it as free.
- The recipe tag bar only shows tags that are on a recipe. Removing a tag no longer asks for confirmation, and the "Restore removed" button is gone.
- The app now uses today's real date everywhere (planner week, expiry warnings, default purchase and expiry dates, AI prompts) instead of a fixed October 5.

### Fixed
- **Quantities below 1** (for example 0.75 l) can now be typed in every quantity and price field. The old fields rounded to 0.1 steps, rejected values like 0.75 on submit, and replaced an emptied box with 1 while typing.
- Planning a meal from a recipe's detail view now starts at the servings you had selected instead of a stale number.
- Meal planner week no longer risks showing the wrong dates in time zones ahead of UTC.

### Not changed
- Cooking history servings: cooking from the recipe view (4 servings) and from the planner (3 servings) both log the right count in testing. If you still see 1, tell us which screen you cooked from.

## 2026-10-07

### Added
- **Login screen.** Usernames and passwords live in a plain text file, `users.txt`, in the data folder (one `user:password` per line, edits apply without a restart). On first start a random `admin` password is created and printed in the container logs. Set `AUTH_DISABLED=true` to turn the login off.
- **Rewards points.** New Rewards section in Cost & Savings with a running balance and manual earned/redeemed entries. Points printed on a scanned receipt are read automatically and can be edited before saving.
- **Meal prep in the planner.** "Populate next X days" (up to 14) when planning a meal: cook once, then leftovers fill the following days. Ingredients are deducted once, when the batch is cooked.
- **Spending history.** Monthly spend bars (3 / 6 / 12 months or all time), average per month, and a monthly average per category, shown next to the current pantry value. Receipts, manual and barcode adds, and shopping-list purchases are all recorded. Past months are seeded from existing pantry purchase dates.
- **Weight / volume mode.** A "Measure by" switch in the nav bar. The app never converts between weight and volume.
- **Delete recipes.** Trash icon on each recipe card and a Delete button in the recipe details.
- **Remove tags.** An ✕ on each tag in the filter bar removes it from every recipe and from the suggestion list, with a "Restore removed" link.

### Changed
- **Standardized units.** Every unit field is now a dropdown limited to the current measure mode. Older spellings ("Ounce", "lbs") are converted to `oz`, `lb`, etc.
- **Adding an ingredient you already have** adds to its quantity and cost instead of creating a second row. Units convert (16 oz + 1 lb = 2 lb) and the earlier expiration date is kept. Existing duplicates are merged once on first load.
- AI recipe and receipt prompts are told which units to use.
- The app waits for the server copy to load before saving, so it can't overwrite saved data with an empty local copy.

### Fixed
- **AI recipe generation no longer adds the same recipe repeatedly.** The server used to return one hard-coded fallback recipe whenever Gemini was unavailable. It now returns an error, sends existing recipe names to the model, and drops repeats. Saving a recipe with a name you already have is refused.

