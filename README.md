# Lift Ledger

Static workout tracker generated from `The_Bodybuilding_Transformation_System_-_Beginner.xlsx`.

## Phone-first use

This app does not need a backend. Host this folder on any static HTTPS host, then open the URL on your iPhone and use Share > Add to Home Screen.

Good free options:

- GitHub Pages
- Netlify
- Cloudflare Pages

Your workout data is stored in the browser/app storage on the phone. Use `OUT` to export a backup JSON file and `IN` to restore it.

## Local preview

From this folder:

```powershell
python -m http.server 8765
```

Then open:

```text
http://localhost:8765
```

For gym use, deploy the folder to HTTPS instead of relying on your computer.
