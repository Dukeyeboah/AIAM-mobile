// src/utils/colorUtils.ts
// Utility to convert HSL color strings to rgba for React Native

export function hslToRgba(hslString: string): string {
  // Parse HSL string like "hsla(400, 100%, 86%, 0.78)"
  // Note: Some hue values are > 360, so we'll use modulo 360
  const match = hslString.match(
    /hsla?\((\d+),\s*(\d+)%,\s*(\d+)%,\s*([\d.]+)\)/
  );
  if (!match) {
    return 'rgba(200, 200, 200, 0.5)'; // fallback
  }

  const h = parseInt(match[1], 10) % 360; // Normalize hue to 0-360
  const s = parseInt(match[2], 10) / 100;
  const l = parseInt(match[3], 10) / 100;
  const a = parseFloat(match[4]);

  // Convert HSL to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
