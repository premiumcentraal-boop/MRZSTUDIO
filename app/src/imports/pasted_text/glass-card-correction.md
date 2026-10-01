You are working directly inside the existing Figma website editor.

The current result is still wrong. It looks like dark translucent cards on top of the rainbow background. It does not look like Apple Liquid Glass.

Important:
The rainbow background is correct. Do not change or remove it.

The issue is the card surface. The cards are not visibly acting like glass lenses.

The current technical approach may be limited by Figma Make or browser support. Do not keep chasing invisible SVG displacement if the visual result is not obvious. Prioritize the final visual effect over the theoretical technique.

Main correction:
Stop relying only on SVG displacement and backdrop-filter. Build a convincing Apple-style glass illusion using controlled layers, duplicated backdrop sampling, rim masks, and highlights.

The goal:
The cards should look like clear rounded glass panels over the existing rainbow background.

They need:
- brighter, clearer glass
- much less black/dark overlay
- stronger white rim highlights
- a visible inner bevel band
- edge-only background compression
- corner lensing highlights
- stable readable center
- no smoky grey vignette
- no flat dark glassmorphism

Critical problem to fix:
The current card center is too dark and the edge distortion is not visible enough. The card needs to feel like it has thickness.

New implementation strategy:
Use a “fake physical lens” approach if real SVG backdrop displacement does not render clearly.

Layer architecture:

1. Base clear glass layer
- very transparent fill
- light blur only
- increased brightness and saturation
- do not cover the rainbow with a grey wash
- center must stay readable but clear

2. Background clone/refraction layer
- create a duplicate of the page background or a matching background layer inside each card
- position it so it lines up with the actual page background
- clip it to the card
- scale it slightly larger than the card
- shift it slightly toward the nearest edge
- this creates visible optical bending even if true backdrop displacement fails
- this layer must be strongest only in the inner edge band, not the center

3. Inner 10% edge lens band
- create a mask/ring around the inside perimeter of the card
- this band should occupy around 10% of the card’s inner edge area
- within this band, show the shifted/scaled background clone
- the center should mask this out so text stays calm
- corners should have the strongest shift and brightness

4. Beveled rim layer
- add a crisp white 1px inner rim
- stronger highlight on top and left/right sides
- very subtle darker lower edge
- avoid thick grey borders

5. Specular glass highlight
- add a thin glossy streak along the upper curve
- add small corner glints
- keep it controlled and Apple-like, not cloudy

6. Chromatic edge split
- only inside the edge band and corners
- use tiny cyan/magenta offsets
- do not create a rainbow overlay
- it should feel like optical separation caused by curved glass

Very important:
The effect must be visible even in Figma Make preview. If CSS/SVG displacement is not visually working, use the background-clone technique instead.

Variant mapping:
- Passport = soft
- ID Card = balanced
- Custom Tools = strong

Variant A / Soft:
- clear center
- subtle cloned-background edge shift
- thin glossy rim
- minimal chromatic split

Variant B / Balanced:
- clear center
- obvious edge band refraction
- more visible shifted background in the inner perimeter
- stronger rim highlight
- practical Apple-like default

Variant C / Strong:
- strongest background clone shift/scale in the edge band
- strongest corner compression
- clearest chromatic split
- bright crystal rim
- still readable center

Specific visual tuning:
- Make all card centers lighter and more transparent.
- Remove the dark smoky fill.
- Reduce black overlay significantly.
- Increase top rim brightness.
- Add a clearly visible inner bevel band.
- Make the edge band look like it is bending the rainbow background.
- Make the strong variant obviously different from the soft one.
- Keep the effect clipped inside the rounded card.

Do not:
- do not change the background
- do not add full-card rainbow gradients
- do not make the card dark grey
- do not make smoky edges
- do not rely on an effect that is technically present but visually invisible
- do not cover the refraction with opacity layers

Acceptance criteria:
- The cards look like clear glass, not dark translucent panels.
- The existing rainbow background appears bent near the card edges.
- The inner 10% perimeter is visibly different from the center.
- The top and side rims look bright, glossy, and Apple-like.
- Corners show the strongest glass thickness.
- The center stays readable and calm.
- Variant A, B, and C are clearly different in intensity.
- The result should be visually obvious in the Figma Make preview, not only theoretically correct in code.