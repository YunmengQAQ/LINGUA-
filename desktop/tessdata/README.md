# Tesseract OCR language data

These files are the compressed `tessdata_fast` language packs used by the
desktop app's local OCR:

- `chi_sim.traineddata.gz`
- `eng.traineddata.gz`
- `jpn.traineddata.gz`
- `kor.traineddata.gz`
- `fra.traineddata.gz`
- `deu.traineddata.gz`
- `spa.traineddata.gz`
- `rus.traineddata.gz`

Source: https://github.com/tesseract-ocr/tessdata_fast

License: Apache-2.0. The license text is in
`third_party/apache-2.0/LICENSE.txt` at the repository root.

Tesseract.js uses these files locally. The OCR engine does not send images or
recognized text to Tesseract; recognized text is only sent to the translation
provider selected by the user.
