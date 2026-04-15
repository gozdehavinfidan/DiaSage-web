# DiaSage — STL 3D Model Assets

This branch holds the 3D model files for the DiaSage smartwatch viewer. Assets are served to the public website (deployed from the `main` branch via GitHub Pages) through `raw.githubusercontent.com` URLs, which provide permissive CORS headers required for browser-based `STLLoader` fetches.

## Files

| File | Size | Role |
|---|---|---|
| `case_body.stl` | 6.4 MB | Kasa / case body |
| `esp_board.stl` | 38 MB | ESP32-S3 LCD module |
| `battery.stl` | 2.6 MB | Li-ion 3.7 V 500 mAh battery |
| `sensor_mlx.stl` | 1.5 MB | MLX90614 temperature sensor |
| `sensor_max30100.stl` | 2.3 MB | MAX30100 pulse / SpO2 sensor |
| `bands_only_rotated_90degX.stl` | 2.8 MB | Combined wristbands |

## URL format

```
https://raw.githubusercontent.com/gozdehavinfidan/DiaSage-web/assets/<filename>.stl
```

Consumers: `src/config/stl-manifest.js` and `smartwatch_exploded_animation.html` on the `main` branch.
