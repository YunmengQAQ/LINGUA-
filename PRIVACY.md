# Privacy

## Screen capture

LINGUA captures the screen region you select in memory only, for OCR. It does
not write screenshots to disk and does not create a screenshot folder.

For auto-translation mode, frames are read repeatedly in memory and replaced by
newer frames. They are not saved to disk.

## Text sent to translation services

Only text recognized by OCR (or text entered in the text-translation tab) is
sent to the translation provider selected in Settings:

- MyMemory: https://mymemory.translated.net/
- A user-configured OpenAI-compatible endpoint (for example DeepSeek)

Screenshots themselves are not uploaded.

## API keys and settings

API keys and preferences are stored locally in:

```text
%APPDATA%\LINGUA\settings.json
```

and in Chromium's local storage for the app's local origin. The key is stored in
plain text on the local computer. It is not included in the application folder,
the source repository, or release archives.

## Logs

The desktop app writes a small local log to `%APPDATA%\LINGUA\lingua-main.log`.
It is used for startup and hotkey diagnostics and is not uploaded by LINGUA.

## No telemetry

LINGUA does not include analytics or telemetry. Network requests are limited to
the translation API selected by the user and the OCR engine assets loaded by
Tesseract.js.

## Removing local data

To remove local settings and keys, delete `%APPDATA%\LINGUA`. The application
folder can be removed separately. Uninstalling an installed build does not
delete `%APPDATA%\LINGUA`, so settings survive an uninstall.
