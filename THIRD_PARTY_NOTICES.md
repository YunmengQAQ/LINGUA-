# Third-Party Notices

LINGUA uses and/or redistributes the following third-party components and
data. Their licenses apply in addition to the project's MIT license.

## Electron

- Project: Electron
- Version: 33.2.0 runtime
- License: MIT
- License text: `third_party/electron/LICENSE`
- Upstream: https://github.com/electron/electron

## Chromium and Electron runtime components

- Project: Chromium / Electron bundled runtime
- License: BSD-style and other open-source licenses
- Notice file: `third_party/chromium/LICENSES.chromium.html`
- This file is also distributed in the packaged app as
  `LICENSES.chromium.html`.

## Tesseract.js

- Project: tesseract.js
- Version: 5.1.1
- License: Apache-2.0
- License text: `third_party/apache-2.0/LICENSE.txt`
- Upstream: https://github.com/naptha/tesseract.js

The app loads the Tesseract.js browser bundle and worker from unpkg at runtime.
No Tesseract.js source bundle is committed to this repository.

## tesseract.js-core

- Project: tesseract.js-core
- License: Apache-2.0
- License text: `third_party/apache-2.0/LICENSE.txt`
- Upstream: https://github.com/naptha/tesseract.js-core

## Tesseract OCR language data

- Data set: tessdata_fast
- License: Apache-2.0
- License text: `third_party/apache-2.0/LICENSE.txt`
- Upstream: https://github.com/tesseract-ocr/tessdata_fast

The eight compressed language packs in `desktop/tessdata/` are used locally by
Tesseract.js for OCR.

## MyMemory translation API

MyMemory is a hosted third-party service used when the user selects it. It is
not distributed with this project. Use of the service is subject to MyMemory's
own terms and quota policies.

## DeepSeek, OpenAI, OpenRouter and other API providers

These are user-selected third-party services. Their SDKs, models and data are
not bundled in this repository. Users supply their own API keys and must follow
the provider's terms.

## UI icons and fonts

The inline SVG interface icons are part of this project's UI source. System
fonts are resolved by the operating system and are not redistributed.

## mpv / FFmpeg / GPU components

Electron bundles runtime components such as FFmpeg, ANGLE, Vulkan and SwiftShader.
Their notices are included in `third_party/chromium/LICENSES.chromium.html`.

## Notes for redistribution

If you publish a portable ZIP or installer built from this project, include:

- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- `third_party/electron/LICENSE`
- `third_party/chromium/LICENSES.chromium.html`
- `third_party/apache-2.0/LICENSE.txt`

Do not bundle a user's `settings.json` or `%APPDATA%\LINGUA` directory.
