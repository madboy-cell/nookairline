# NEORA Lobby Reference Asset Pack

This pack contains individual PNG crops from the supplied NEORA lobby triptych.

## Folders
- `reference/`: original reference image
- `screens/`: the three complete screen panels
- `components/`: major UI areas and room cards
- `avatars/`: visible avatar crops
- `game_tiles/`: game selector tiles
- `controls/`: buttons, privacy options, and status badges
- `asset_manifest.json`: machine-readable dimensions, source bounding boxes, and descriptions
- `ASSET_INDEX.csv`: spreadsheet-friendly asset index

## Important limitations
The source is a flattened raster mockup, not a layered Figma/PSD file. Crops preserve visible pixels but do not magically separate overlapping elements or restore hidden pixels. Many crops include original background and surrounding context. They are suitable as visual references for an implementation agent, but not all are production-ready transparent sprites.

## Recommended agent workflow
1. Read `asset_manifest.json`.
2. Use the complete screen crops as layout references.
3. Rebuild UI controls as HTML/CSS/SVG components where possible instead of using screenshot crops as final UI.
4. Use avatar crops as visual references; create isolated transparent sprites for production use.
5. Keep responsive text and buttons native to the web app for accessibility and scaling.
