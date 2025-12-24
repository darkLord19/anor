#!/usr/bin/env node
/**
 * Simple icon generator for Chrome extension
 * Creates basic placeholder icons if ImageMagick is not available
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, 'icons');
const sizes = [16, 48, 128];

// Create icons directory
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Check if ImageMagick is available
let hasImageMagick = false;
try {
  execSync('which convert', { stdio: 'ignore' });
  hasImageMagick = true;
} catch {
  // ImageMagick not available
}

if (hasImageMagick) {
  // Generate icons using ImageMagick
  console.log('Generating icons with ImageMagick...');
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    // Create a simple gradient icon with "A" letter
    execSync(
      `convert -size ${size}x${size} xc:none -fill '#6366f1' -draw 'roundrectangle 0,0 ${size-1},${size-1} 4,4' -fill white -font Arial-Bold -pointsize ${Math.floor(size * 0.6)} -gravity center -annotate +0+0 'A' ${outputPath}`,
      { stdio: 'ignore' }
    );
  }
  console.log('Icons generated successfully!');
} else {
  // Create placeholder SVG that can be converted later
  console.log('ImageMagick not found. Creating placeholder SVG...');
  const svg = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="16" fill="#6366f1"/>
  <text x="64" y="90" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle">A</text>
</svg>`;
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svg);
  console.log('Placeholder SVG created at icons/icon.svg');
  console.log('Please convert it to PNG files (16x16, 48x48, 128x128) or install ImageMagick and run this script again.');
}

