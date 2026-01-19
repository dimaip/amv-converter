# AMV Converter

A simple Mac app to convert videos to AMV format for Digma M5 and similar MP4 players.

![AMV Converter Screenshot](https://img.shields.io/badge/platform-macOS-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Download

**[Download AMV Converter for Mac (Apple Silicon)](https://github.com/dimaip/amv-converter/releases/latest)**

## Features

- Drag & drop or click to upload videos
- Supports MP4, AVI, MKV, WebM, MOV, M4V, FLV, WMV input formats
- Converts to AMV format (320x240, 14fps)
- Progress tracking during conversion
- Handles videos with or without audio tracks

## Usage

1. Download the DMG from [Releases](https://github.com/dimaip/amv-converter/releases)
2. Open the DMG and drag the app to Applications
3. Launch AMV Converter
4. Upload your video file (up to 1GB)
5. Wait for conversion to complete
6. Download the converted .amv file
7. Transfer to your Digma M5 or compatible device

## Technical Specs

The converter outputs files with these specifications:

| Property | Value |
|----------|-------|
| Video codec | AMV |
| Resolution | 320x240 |
| Frame rate | 14 fps |
| Audio codec | ADPCM IMA AMV |
| Audio | Mono, 22050 Hz |

## Building from Source

```bash
# Clone the repo
git clone https://github.com/dimaip/amv-converter.git
cd amv-converter

# Install dependencies
npm install

# Run in development
npm run server

# Build Mac app
npm run build:dmg
```

## License

MIT
