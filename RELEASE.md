# Release Packaging

This repository contains source code. Large runtimes and installers should be
published as GitHub Release assets, not committed to the repository.

## GitHub limits

- Maximum size for a file committed to a repository: 100 MB
- Maximum size for a Release asset: 2 GB
- `LINGUA.exe` is about 188 MB and must not be committed directly.
- A full portable folder is about 310 MB; publish it as a ZIP Release asset.

## What to publish

Recommended Release assets:

1. `LINGUA-portable-<version>.zip` — the packaged desktop app.
2. `LINGUA-Setup-<version>.exe` — optional installer.
3. `SHA256SUMS.txt` — checksums for the assets.

The source repository can stay small; `desktop/tessdata/` is about 80 MB and is
kept here because each language file is below GitHub's per-file limit. If you
prefer a smaller repository, move `tessdata` to a Release asset and add a
download step to the build instructions.

## Include these notices in every release

Put these files next to the application files in the portable ZIP and in the
installer payload:

```text
LICENSE
THIRD_PARTY_NOTICES.md
third_party/electron/LICENSE
third_party/chromium/LICENSES.chromium.html
third_party/apache-2.0/LICENSE.txt
```

Electron's packaged runtime already contains `LICENSE` and
`LICENSES.chromium.html`; keep them in the release.

## Pre-release checklist

1. Do not include `settings.json`, `lingua-main.log`, or any `%APPDATA%` data.
2. Confirm no API key appears in the release:

   ```powershell
   Select-String -Path . -Pattern 'sk-[A-Za-z0-9]' -Recurse -ErrorAction SilentlyContinue
   ```

   This may match documentation examples; inspect any hits manually.

3. Confirm the app launches on a clean Windows user profile.
4. Check that OCR language files are present under `web\tessdata` (packaged
   build) or `desktop\tessdata` (source).
5. Test both translation flows with a user-supplied key or MyMemory.
6. Include the third-party notices listed above.
7. Generate checksums:

   ```powershell
   Get-FileHash .\LINGUA-portable-*.zip -Algorithm SHA256
   Get-FileHash .\LINGUA-Setup-*.exe -Algorithm SHA256
   ```

## Code signing

Builds are currently unsigned. Windows SmartScreen may show an unknown-publisher
warning. Signing is recommended for broad public distribution, but is optional.

## Suggested Git workflow

```powershell
git init
git add .
git commit -m "Initial LINGUA source release"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

Create the GitHub Release through the web UI or GitHub CLI and upload the ZIP,
installer and checksums there.
