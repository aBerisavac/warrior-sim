# Weather, time, and media

- Idle time advances five game seconds per real second, rounded into whole game minutes for the visible clock. Travel retains its road-cell timing.
- Weather repeats every 60 minutes of real play: 15 minutes fair, 5 minutes of stable streak clouds, 5 minutes of darkening cloud before rain, 20 minutes of rain, 5 minutes of clearing, and 10 minutes fair. `src/weather.js` defines these phases. Weather elapsed time is saved without changing the map JSON.
- The map tint interpolates from dawn through afternoon, sepia evening, and night using the in-game clock. Cloud motion and rain are overlays and do not modify any map tile.
- Rain uses one CC0 recording at three volumes: outdoors, open market, and indoors. Source and license details are in `public/audio/CREDITS.md`.
- Browser audio still requires a user gesture on iOS. The settings panel has an Enable sound control. Active Ogg effects have MP3 alternatives for browsers that cannot decode Ogg.
- PNG images larger than their display needs were reduced proportionally. Portraits are capped at 480 pixels; large scene art at 1200 pixels; smaller map art at 600 pixels. Original files were copied to the local ignored `.tmp/image-backup/` folder before resizing. Image URLs and map positions did not change.
- Avatar choices are listed in `src/data/avatars.json`. Add an image to `public/images/profile/` and list its URL there to offer it at the new-game opening.
