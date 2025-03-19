# Web Viewer Extension

A Chrome extension that allows you to view any website in a side panel.

## Features

- View websites in the browser's side panel
- Mobile/Desktop view toggle
- Bypasses many X-Frame-Options restrictions
- Special handling for Twitter/X and YouTube

## Setup

Before loading the extension, you need to generate the icon files:

1. Open the `generate_icon.html` file in your browser
2. Click the "Generate PNG" button
3. Right-click on the image and select "Save Image As..."
4. Save as:
   - `icons/icon16.png` - resize to 16x16
   - `icons/icon48.png` - resize to 48x48
   - `icons/icon128.png` - keep as 128x128

Alternatively, you can create your own icon files and place them in the `icons` directory.

## Usage

1. Click on the extension icon in your browser toolbar
2. Click the "Open Side Panel" button in the popup
3. Enter a URL in the side panel and click "Go"
4. Toggle between mobile and desktop views using the button

## Troubleshooting

If a website doesn't load in the side panel:
- Check the browser console for errors
- Some websites intentionally block being displayed in iframes
- Try using the mobile view option which may work better for some sites