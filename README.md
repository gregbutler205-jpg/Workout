# Strength & Cardio Tracker PWA

A mobile-first workout tracker designed around:

- 3 full-body strength workouts each week
- 2 cardio workouts each week
- 2 rest days
- All 16 exercises in the locked order
- 3 sets per exercise
- 20-second automatic rest timer
- Increase / Stay / Decrease / Review recommendations
- Apple Watch post-workout manual entry
- Cardio entry for recumbent bike, walking, elliptical, or combination
- CSV spreadsheet export
- JSON backup and restore
- Offline-capable PWA using local browser storage

## Run locally

Because service workers require HTTP/HTTPS, do not open `index.html` directly from the file system.

### Simple local server

From this folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload all files in this folder.
3. Open repository Settings → Pages.
4. Set the source to the main branch and root folder.
5. Open the published URL on your iPhone.
6. In Safari, tap Share → Add to Home Screen.

## Data storage

Version 1 stores data in the browser's local storage on the device. Use **More → Export Backup JSON** regularly.

## Spreadsheet export

Use **More → Export Spreadsheet CSV**. The CSV uses one row per strength set and one row per cardio activity, making it easy to analyze in Excel or Google Sheets.

## Important MVP limitation

The app does not directly import Apple Health or Apple Watch data. Those values are entered manually after each workout. Direct HealthKit integration requires a native iPhone app.
