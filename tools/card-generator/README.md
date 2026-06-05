# Company Card PSD Editor

Local editor for the template file `Example page.psb`.

Run the dashboard:

```powershell
node card-psd-editor.js
```

Then open:

```text
http://127.0.0.1:8787
```

Batch mode:

```powershell
node card-psd-editor.js --json card-data.example.json
```

Edited files are saved as classic `.psd` files in `output/cards/`.

The template file is `Example page.psb`, but the output is saved by Photoshop itself as a classic Photoshop PSD. This avoids fragile manual PSD rewriting. The editor updates editable Photoshop text layers and keeps the existing layer placement, font styling, sizing, transforms, and effects. It first looks for exact layer names like `CODE`, `DOCNMBR`, `FIRST`, and `MRZ`. For the included sample it can also auto-map the existing sample layers by their current text and position.

Photoshop must be able to run scripts. If the dashboard reports that Photoshop did not finish the save, close any open Photoshop error dialogs or restart Photoshop, then click Create again.

If Windows COM automation is unavailable, the dashboard creates a `.jsx` script in `output/automation/`. Open Photoshop, choose `File > Scripts > Browse`, and select that script. Adobe documents this as the supported way to run a script from another location.

Photopea mode:

- Click `Create and download PSD`.
- The browser runs Photopea in a hidden embedded frame and starts a PSD download after verification.
- Turn on `Show editor` or click `Open editor` when you want to watch or manually inspect the Photopea workspace.
- The app sends `Example page.psb` to Photopea through Live Messaging.
- Photopea runs a generated script, updates the text layers, exports a PSD, and returns it to the app.
- The app saves and verifies the returned PSD in `output/cards/`; the visible download link stays available as a fallback.

Hosted setup:

- Host this Node app behind HTTPS.
- Keep the template endpoint available at `/api/template`.
- Keep `/api/photopea-session` for generating the script from user input.
- Keep `/api/photopea-output` for receiving the PSD returned by Photopea.
- No Photopea API key is required for this iframe + Live Messaging setup.

Target layer names:

```text
CODE, DOCNMBR, VALID, ENDVALID, BIRTHDATE, YEAR, FIRST, LAST,
GENDER, COUNTRY, CITYBIRTH, LOCATION, HEIGHT, MRZ
```

Font notes:

- The dashboard reports fonts detected in the PSD/PSB.
- If a font is missing, Photoshop may substitute it.
- The import button saves font files into `fonts/` so they travel with the project, but Windows or Photoshop may still need the font installed to render it exactly.

Use this for legitimate internal company card templates only.
