# Changelog

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

### Known issues
- The app still treats "today" as 2026-10-05 in the planner and shopping-list purchases.
