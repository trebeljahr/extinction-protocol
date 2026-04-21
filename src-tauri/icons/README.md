# Tauri icons

Before running `npm run tauri build` (and some tauri dev configurations), generate the icon set from a single source PNG:

```bash
npx @tauri-apps/cli icon path/to/logo.png
```

This will populate this directory with `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, and all the other sizes referenced in `tauri.conf.json`.

A 1024×1024 PNG with transparency is ideal as the source.
