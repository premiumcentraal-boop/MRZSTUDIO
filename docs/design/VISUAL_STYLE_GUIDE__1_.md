# Visual Style Guide: Glassmorphism & Animated Spectral Background

This document contains all the technical specifications needed to recreate the exact visual style of the minimalist ambient weather dashboard, featuring Apple-style glassmorphism panels and a subtle animated spectral gradient background.

---

## 1. Background: Animated Spectral Gradient

### Overview
A continuous, subtle rainbow spectrum animation that flows across a white/near-white base. The colors are low-opacity and move organically using WebGL shader mathematics.

### Technical Specifications

#### Base Configuration
- **Canvas rendering**: WebGL (hardware accelerated)
- **Animation**: Continuous loop using `requestAnimationFrame`
- **Base color**: Black (`#000000`) rendered on canvas
- **Final opacity**: Low (controlled via HSV brightness modulation)

#### Color Control Parameters

For a **minimal white with rainbow spectrum** effect, use these values:

```javascript
// Default color controls (hex format)
const shaderColors = [
  '#0000ff',  // Color 1: Controls HUE SHIFT (pure blue = no shift)
  '#ff00ff',  // Color 2: Controls SATURATION (magenta = high saturation)
  '#ffffff'   // Color 3: Controls BRIGHTNESS (white = full brightness)
];
```

**To achieve LOW OPACITY rainbow effect**, adjust:
- **Brightness Control (Color 3)**: Use `#808080` (50% gray) instead of `#ffffff`
- **Saturation Control (Color 2)**: Use `#ff80ff` (75% saturation) for softer colors

#### GLSL Shader Code

**Vertex Shader:**
```glsl
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
```

**Fragment Shader:**
```glsl
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uHueShift;
uniform float uSaturation;
uniform float uBrightness;

// Spectral wavelength to RGB conversion (400-700nm range)
vec3 spectral_colour(float l) {
  float r=0.0,g=0.0,b=0.0;
  if ((l>=400.0)&&(l<410.0)) { float t=(l-400.0)/(410.0-400.0); r=+(0.33*t)-(0.20*t*t); }
  else if ((l>=410.0)&&(l<475.0)) { float t=(l-410.0)/(475.0-410.0); r=0.14-(0.13*t*t); }
  else if ((l>=545.0)&&(l<595.0)) { float t=(l-545.0)/(595.0-545.0); r=+(1.98*t)-(t*t); }
  else if ((l>=595.0)&&(l<650.0)) { float t=(l-595.0)/(650.0-595.0); r=0.98+(0.06*t)-(0.40*t*t); }
  else if ((l>=650.0)&&(l<700.0)) { float t=(l-650.0)/(700.0-650.0); r=0.65-(0.84*t)+(0.20*t*t); }
  if ((l>=415.0)&&(l<475.0)) { float t=(l-415.0)/(475.0-415.0); g=+(0.80*t*t); }
  else if ((l>=475.0)&&(l<590.0)) { float t=(l-475.0)/(590.0-475.0); g=0.8+(0.76*t)-(0.80*t*t); }
  else if ((l>=585.0)&&(l<639.0)) { float t=(l-585.0)/(639.0-585.0); g=0.82-(0.80*t); }
  if ((l>=400.0)&&(l<475.0)) { float t=(l-400.0)/(475.0-400.0); b=+(2.20*t)-(1.50*t*t); }
  else if ((l>=475.0)&&(l<560.0)) { float t=(l-475.0)/(560.0-475.0); b=0.7-(t)+(0.30*t*t); }
  return vec3(r,g,b);
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 p = (2.0*fragCoord.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
  p *= 2.0;
  
  // Organic motion through 8 iterations
  for(int i=0;i<8;i++) {
    vec2 newp = vec2(
      p.y + cos(p.x + iTime) - sin(p.y * cos(iTime * 0.2)),
      p.x - sin(p.y - iTime) - cos(p.x * sin(iTime * 0.3))
    );
    p = newp;
  }
  
  // Get spectral color based on position and time
  vec3 spectralColor = spectral_colour(p.y * 50.0 + 500.0 + sin(iTime * 0.6));
  
  // Convert to HSV for modulation
  vec3 hsv = rgb2hsv(spectralColor);
  
  // Apply custom modulations
  hsv.x = fract(hsv.x + uHueShift);              // Hue shift
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);  // Saturation
  hsv.z = clamp(hsv.z * uBrightness, 0.0, 1.0);  // Brightness
  
  // Convert back to RGB
  vec3 finalColor = hsv2rgb(hsv);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
```

#### Animation Parameters
- **Time multiplier**: `time * 0.001` (converts milliseconds to seconds)
- **Cosine motion speed**: `iTime * 0.2` and `iTime * 0.3`
- **Wavelength oscillation**: `sin(iTime * 0.6)`

#### Recommended Settings for Minimal Effect

**JavaScript uniform values:**
```javascript
// For LOW OPACITY rainbow on white background
gl.uniform1f(hueShiftLocation, 0.0);      // No hue shift
gl.uniform1f(saturationLocation, 1.0);    // Medium saturation (0.5-1.5 range)
gl.uniform1f(brightnessLocation, 0.8);    // Reduced brightness (0.5-1.0 for subtle)
```

---

## 2. Glassmorphism Panels (Apple Glass Style)

### Overview
Two frosted glass panels with subtle borders, backdrop blur, and semi-transparent backgrounds that allow the animated gradient to show through softly.

### Panel Specifications

#### Main Weather Panel (Top)
**Positioning:**
- Horizontal: Centered (`left: 50%; transform: translateX(-50%)`)
- Vertical: `top: 32px` (2rem)
- Width: `502px`
- Padding: Horizontal `42px`, Vertical `32px` (8 * 4px)

**Glass Effect (Tailwind CSS):**
```css
backdrop-blur-[64.036px]
backdrop-filter
bg-[rgba(81,81,81,0.24)]
rounded-[48px]
```

**CSS Translation:**
```css
{
  backdrop-filter: blur(64.036px);
  background-color: rgba(81, 81, 81, 0.24);
  border-radius: 48px;
}
```

**Border:**
```css
border: 1px solid rgba(255, 255, 255, 0.12)
border-radius: 48px
```

**Full CSS:**
```css
.glass-panel-top {
  position: absolute;
  top: 32px;
  left: 50%;
  transform: translateX(-50%);
  width: 502px;
  padding: 32px 42px;
  
  /* Glass effect */
  backdrop-filter: blur(64.036px);
  -webkit-backdrop-filter: blur(64.036px);
  background-color: rgba(81, 81, 81, 0.24);
  border-radius: 48px;
  
  /* Border as separate layer */
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}
```

#### Locations Panel (Bottom)
**Positioning:**
- Horizontal: Centered (`left: 50%; transform: translateX(-50%)`)
- Vertical: `bottom: -60px` (extends below viewport)
- Width: `502px`
- Padding: Top `40px`, Bottom `16px`, Horizontal `48px`

**Glass Effect (Tailwind CSS):**
```css
backdrop-blur-[64.036px]
backdrop-filter
bg-[rgba(81,81,81,0.24)]
rounded-[48px]
```

**Full CSS:**
```css
.glass-panel-bottom {
  position: absolute;
  bottom: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 502px;
  padding: 40px 48px 16px 48px;
  
  /* Glass effect */
  backdrop-filter: blur(64.036px);
  -webkit-backdrop-filter: blur(64.036px);
  background-color: rgba(81, 81, 81, 0.24);
  border-radius: 48px;
  
  /* Border as separate layer */
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}
```

### Key Glass Properties Breakdown

| Property | Value | Purpose |
|----------|-------|---------|
| `backdrop-filter` | `blur(64.036px)` | Creates frosted glass effect by blurring background |
| `background-color` | `rgba(81, 81, 81, 0.24)` | Semi-transparent gray (24% opacity) |
| `border-radius` | `48px` | Heavy rounding for modern Apple aesthetic |
| `border` | `1px solid rgba(255, 255, 255, 0.12)` | Subtle white border (12% opacity) |

### Browser Compatibility

Add vendor prefixes for maximum compatibility:
```css
backdrop-filter: blur(64.036px);
-webkit-backdrop-filter: blur(64.036px);
```

---

## 3. Typography & Content Styling

### Font Stack
```css
font-family: 'Geist Mono', monospace, sans-serif;
```

### Text Rendering (Global)
```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

### Text Styles

**Primary Text (City Names, Times):**
```css
font-family: 'Geist Mono', sans-serif;
font-weight: 400;
font-size: 18px;
letter-spacing: -0.36px;
text-transform: uppercase;
color: #ffffff;              /* Pure white, 100% opacity */
line-height: 0;
```

**Secondary Text (Dates, Time Zones):**
```css
font-family: 'Geist Mono', sans-serif;
font-weight: 400;
font-size: 18px;
letter-spacing: -0.36px;
text-transform: uppercase;
color: rgba(255, 255, 255, 0.32);  /* 32% opacity */
line-height: 0;
```

**Muted Text (Location Details):**
```css
opacity: 0.6;
color: #e2e2e2;
```

---

## 4. Layout Specifications

### Viewport Container
```css
.viewport {
  width: 600px;
  height: 800px;
  position: relative;
  background: black;
  overflow: hidden;
}
```

### Hamburger Menu Icon
**Positioning:**
```css
position: absolute;
right: 42px;
top: 32px;
width: 24px;
height: 24px;
color: white;
```

---

## 5. Color Palette

### Background Gradient Colors
| Element | Color | Usage |
|---------|-------|-------|
| Canvas base | `#000000` | WebGL render target |
| Spectral range | 400-700nm wavelength | Converted to RGB via shader |
| Hue modulation | 0.0 (default) | No shift = natural spectrum |
| Saturation | 1.0-1.5 | Controls color intensity |
| Brightness | 0.5-1.0 | Lower = more subtle |

### Glass Panel Colors
| Element | Color | Purpose |
|---------|-------|---------|
| Background | `rgba(81, 81, 81, 0.24)` | Semi-transparent gray |
| Border | `rgba(255, 255, 255, 0.12)` | Subtle white outline |
| Text primary | `#ffffff` (100%) | High contrast |
| Text secondary | `rgba(255, 255, 255, 0.32)` | Subdued info |
| Text muted | `#e2e2e2` at 60% opacity | Background text |

---

## 6. Implementation Checklist

### For Background Animation:
- [ ] Set up WebGL canvas with viewport dimensions
- [ ] Implement vertex shader (simple passthrough)
- [ ] Implement fragment shader with spectral_colour function
- [ ] Add HSV color space conversion functions
- [ ] Set up uniform variables (iTime, iResolution, uHueShift, uSaturation, uBrightness)
- [ ] Create animation loop with `requestAnimationFrame`
- [ ] Convert color controls from hex to HSL for uniform values
- [ ] Adjust brightness uniform to 0.5-0.8 for LOW OPACITY effect

### For Glassmorphism:
- [ ] Create container with `backdrop-filter: blur(64.036px)`
- [ ] Add `-webkit-backdrop-filter` for Safari support
- [ ] Set background to `rgba(81, 81, 81, 0.24)`
- [ ] Apply `border-radius: 48px`
- [ ] Add border using `box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12)` or standard border
- [ ] Position absolutely within viewport container
- [ ] Ensure z-index allows content to appear above background canvas

---

## 7. Performance Considerations

### WebGL Optimization
- Use `requestAnimationFrame` for smooth 60fps animation
- Compile shaders once on component mount
- Reuse buffer data across frames
- Only update uniforms that change

### CSS Optimization
- Use `will-change: transform` sparingly for animated elements
- Leverage GPU acceleration with `transform: translateZ(0)` if needed
- Avoid animating blur values (keep static at 64.036px)

---

## 8. Quick Start Code Snippets

### Minimal HTML Structure
```html
<div class="viewport">
  <canvas id="shader-background" width="600" height="800"></canvas>
  
  <div class="glass-panel-top">
    <!-- Weather content here -->
  </div>
  
  <div class="glass-panel-bottom">
    <!-- Locations content here -->
  </div>
</div>
```

### CSS Quick Reference
```css
/* Viewport */
.viewport {
  position: relative;
  width: 600px;
  height: 800px;
  background: #000;
  overflow: hidden;
}

/* Canvas (absolute positioning) */
#shader-background {
  position: absolute;
  inset: 0;
  display: block;
}

/* Glass Panel Shared */
.glass-panel-top,
.glass-panel-bottom {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 502px;
  backdrop-filter: blur(64.036px);
  -webkit-backdrop-filter: blur(64.036px);
  background-color: rgba(81, 81, 81, 0.24);
  border-radius: 48px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.glass-panel-top {
  top: 32px;
  padding: 32px 42px;
}

.glass-panel-bottom {
  bottom: -60px;
  padding: 40px 48px 16px 48px;
}
```

### JavaScript Initialization (WebGL)
```javascript
const canvas = document.getElementById('shader-background');
const gl = canvas.getContext('webgl');

// Compile shaders (vertex + fragment from section 1)
// Create program
// Set up uniforms

// Animation loop
function render(time) {
  gl.uniform1f(timeLocation, time * 0.001);
  gl.uniform1f(hueShiftLocation, 0.0);
  gl.uniform1f(saturationLocation, 1.0);
  gl.uniform1f(brightnessLocation, 0.6);  // LOW OPACITY
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
```

---

## 9. Variations & Customization

### To Make Background Even More Subtle:
1. **Decrease saturation**: `uSaturation = 0.5` (50% less vivid)
2. **Decrease brightness**: `uBrightness = 0.4` (40% darker overall)
3. **Increase blur on panels**: `backdrop-blur-[80px]` (more diffused)

### To Add More Color Variation:
1. **Shift hue over time**: `uHueShift = sin(iTime * 0.1) * 0.1`
2. **Vary saturation**: `uSaturation = 1.0 + sin(iTime * 0.05) * 0.3`
3. **Pulse brightness**: `uBrightness = 0.7 + sin(iTime * 0.08) * 0.2`

### Alternative Glass Colors:
- **Warmer glass**: `rgba(100, 90, 80, 0.24)`
- **Cooler glass**: `rgba(70, 80, 90, 0.24)`
- **Lighter glass**: `rgba(120, 120, 120, 0.18)`

---

## 10. Credits & Inspiration

- **Spectral color function**: Based on wavelength-to-RGB conversion algorithms
- **Glass aesthetic**: Inspired by Apple's macOS Big Sur+ design language
- **Shader mathematics**: Organic motion patterns using trigonometric functions

---

## Final Notes

This style creates a **balanced, minimal aesthetic** where:
1. The background provides **subtle visual interest** without overwhelming
2. Glass panels **float elegantly** with proper depth perception
3. Typography remains **crystal clear** against the frosted backdrop
4. The overall effect is **calming and ambient**, perfect for a dashboard

**Key to achieving "not as strong" rainbow effect:**
- Keep `uBrightness` between **0.4 and 0.7**
- Use `uSaturation` around **0.7 to 1.2**
- Never exceed these values for a minimal white aesthetic

Copy this entire document to any AI assistant to recreate the exact visual style.
