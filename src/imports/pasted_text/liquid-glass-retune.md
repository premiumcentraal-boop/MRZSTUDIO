The current implementation is technically clever, but visually it is going in the wrong direction.

It now looks like dark frosted grey cards with smoky edges. That is not the Apple Liquid Glass look we are targeting.

Do not remove the current technical system completely, but visually re-tune it toward the real iOS 26 notification glass reference.

Main correction:
The cards must become much clearer, brighter, more transparent, more polished, and more lens-like.

The current problems:
- The cards are too grey and too opaque.
- The center fill is too heavy.
- The background is not visible enough through the cards.
- The edge effect looks like smoke or dark blur instead of glass refraction.
- The rim is too soft and cloudy.
- The cards look like dark glassmorphism, not Apple Liquid Glass.
- The 3 intensity variants are not visually different enough.
- The actual background bending is not obvious because the glass is covering too much of the source background.

Do not change:
- the page background
- the rainbow background
- the section layout
- the card text
- the card hierarchy
- the 3-card comparison structure

Only retune the glass system.

New visual target:
The cards should look like clear curved glass lenses placed over the existing page background.

They should have:
- a clearer transparent center
- less grey opacity
- stronger visible background sampling
- brighter white rim highlights
- sharper glossy bevels
- stronger edge bending
- more visible color displacement only near the inner rim
- less smoky dark vignette
- less full-card fog
- more “wet polished glass” feeling

Important:
The Apple look is not dark smoky glass. It is bright, clear, refractive, and glossy.

Retune the layer system as follows:

Layer 1 — Center frost:
- Make the center much more transparent.
- Reduce dark grey fill strongly.
- Keep enough blur for readability, but do not cover the background with a grey wash.
- The center should feel like clear frosted glass, not a grey panel.

Layer 2 — Edge lens band:
- Keep the 10% inner perimeter refraction band.
- Make the edge band brighter and more glass-like.
- Reduce smoky blur.
- Increase visible background displacement only in this band.
- The band should look like the background is being compressed/bent around the rim.

Layer 3 — Chromatic edge:
- Keep chromatic separation subtle but visible.
- It should only happen near curved corners and rim.
- Use small cyan/magenta/blue separation, not a full rainbow overlay.
- The color should feel caused by refraction, not painted on top.

Layer 4 — Bevel/rim:
- Make the top and side rim sharper and brighter.
- Add a thin white inner highlight.
- Add a very subtle dark lower edge only for depth.
- Do not create thick grey borders.

Layer 5 — Specular highlight:
- Add a glossy highlight that feels like light reflecting off curved glass.
- It should be thin, bright, and controlled.
- Avoid large cloudy white patches.

Very important:
The cards need colorful content behind them to show the refraction. If the current card area is mostly over black background, the effect cannot be judged properly. Without changing the actual page background design, make sure the glass effect is tested where the existing rainbow/color field is visible behind or near the cards. The cards should visibly bend the colorful background, not just sit on black.

Variant behavior:
Keep 3 variants, but make the differences much clearer.

Passport = Soft Liquid:
- clearest and most minimal
- light blur
- subtle edge bending
- thin glossy rim
- very transparent center

ID Card = Balanced Refraction:
- Apple-like default
- clearly visible edge lensing
- brighter rim
- stronger background bend
- still very clean and readable

Custom Tools = Strong Crystal Glass:
- strongest refraction
- most visible edge compression
- strongest corner bending
- clearer chromatic edge split
- still transparent and premium, not smoky or grey

Specific visual changes to make now:
- Reduce grey/dark center overlay opacity.
- Reduce full-card shadow/vignette.
- Increase card transparency.
- Increase rim brightness.
- Make the edge band sharper and more optical.
- Move away from “dark frosted panel.”
- Move toward “clear rounded glass lens.”
- Make the existing rainbow/background visibly pass through and bend near the edges.
- Make each variant obviously different in intensity.

Acceptance criteria:
- The cards no longer look like grey smoky panels.
- The background is clearly visible through the card.
- The center is readable but much more transparent.
- The inner 10% rim visibly bends the background.
- The top/side rim has a crisp Apple-like glass highlight.
- The bottom edge has only subtle depth, not a heavy dark vignette.
- The strong variant visibly looks like curved glass, not just blur.
- The effect feels closer to the iOS notification screenshot: clear, glossy, refractive, and bright.