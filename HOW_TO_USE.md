# Lift Ledger: How to Use It

## Best Setup

Use GitHub Pages. After setup, the gym workflow is simple:

1. Tap the `Lift Ledger` icon on your iPhone.
2. Log load and reps.
3. Close the app.

No computer server is needed at the gym.

## One-Time GitHub Login

A PowerShell window should be open with GitHub login running.

If not, open PowerShell and run:

```powershell
& "C:\Users\benji\Tools\gh\bin\gh.exe" auth login --hostname github.com --git-protocol https --web
```

Follow the browser/device-code instructions and sign into GitHub.

## One-Time Publish

After GitHub login succeeds, run this from PowerShell:

```powershell
Set-Location "C:\Users\benji\Downloads\New project"
PowerShell -ExecutionPolicy Bypass -File .\publish-github-pages.ps1
```

The script will print a URL like:

```text
https://YOUR-GITHUB-USERNAME.github.io/lift-ledger/
```

## Add To iPhone Home Screen

1. Open the printed URL in Safari on your iPhone.
2. Tap Share.
3. Tap `Add to Home Screen`.
4. Name it `Lift Ledger`.
5. Tap `Add`.

From then on, use the Home Screen icon.

## Normal Gym Use

1. Open `Lift Ledger`.
2. Select the week.
3. Select the workout.
4. Tap an exercise.
5. Enter load and reps for each set.
6. Add notes if useful.

The app saves automatically on your iPhone.

## What The App Shows

- This week's workout.
- The set and rep prescription from your spreadsheet.
- The target to beat from your previous logged performance.
- Weekly volume.
- Rep improvement.
- Progress charts.

## Backups

Your workout history lives on your iPhone, not GitHub.

Every so often:

1. Tap `OUT`.
2. Save the JSON backup in Files or iCloud Drive.

To restore:

1. Tap `IN`.
2. Pick the saved JSON file.

## Programming Tools Installed

Installed under `C:\Users\benji\Tools`:

- GitHub CLI: `gh`
- Node.js and npm
- Java 21 JDK

Already present:

- Git
- Python

Also installed:

- Visual Studio Code

Open a new PowerShell window after installation so `gh`, `node`, `npm`, `java`, and `code` are available from PATH.
