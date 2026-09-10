# MRZ Studio V7

Updated MRZ Studio release **V7** (7.0.0).

---

# Employee Badge Generator

A React + Tailwind CSS application for generating standardized employee ID badges with automated PSD processing.

## Features

- **Standardized Image Processing**: Upload and crop photos to exact specifications
  - Employee photos: 2421 Ã— 3292 px
  - Signatures: 420 Ã— 123 px
- **AI Background Removal**: Automatic background removal for employee photos
- **Interactive Photo Editor**: Drag-to-pan positioning and zoom controls
- **Automated Badge Generation**: Worker-based PSD processing with MRZ and PERFO digit handling

## Project Structure

```
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ App.tsx                    # Main application component
â”‚   â”‚   â”œâ”€â”€ IdGeneratorStep.tsx        # Badge generation form
â”‚   â”‚   â””â”€â”€ components/
â”‚   â”‚       â”œâ”€â”€ photo-editor.tsx       # Reusable photo cropping component
â”‚   â”‚       â”œâ”€â”€ figma/                 # Figma-imported components
â”‚   â”‚       â””â”€â”€ ui/                    # shadcn/ui components
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ badgeMapping.ts            # Data model and field mappings
â”‚   â”‚   â””â”€â”€ supabase.ts                # Supabase client configuration
â”‚   â””â”€â”€ styles/
â”‚       â”œâ”€â”€ fonts.css                  # Font imports (add fonts here only)
â”‚       â”œâ”€â”€ globals.css                # Global styles
â”‚       â”œâ”€â”€ tailwind.css               # Tailwind v4 base
â”‚       â””â”€â”€ theme.css                  # Design tokens and theme
â”œâ”€â”€ worker/
â”‚   â”œâ”€â”€ worker.js                      # Main PSD processing worker
â”‚   â”œâ”€â”€ job-adapter.js                 # Job queue adapter
â”‚   â”œâ”€â”€ EMPLOYEEID_LAYER_MAP.json      # PSD layer mappings
â”‚   â””â”€â”€ scripts/
â”‚       â”œâ”€â”€ run_employeeid_job.jsx     # Photoshop automation script
â”‚       â”œâ”€â”€ verify_template.jsx        # Template verification
â”‚       â”œâ”€â”€ test_employeeid_job.jsx    # Worker testing script
â”‚       â””â”€â”€ font_preflight.jsx         # Font availability check
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ setup/                         # Setup and environment docs
â”‚   â”œâ”€â”€ alignment/                     # Data model alignment docs
â”‚   â”œâ”€â”€ backend/                       # Worker and Codex documentation
â”‚   â”‚   â””â”€â”€ card-generator/            # Legacy card generator tools
â”‚   â”œâ”€â”€ design/                        # Design specs and mockups
â”‚   â””â”€â”€ archive/                       # Historical reference files
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ check-env.cjs                  # Environment validation
â”‚   â””â”€â”€ test-supabase-connection.cjs   # Supabase connection test
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ mapping-verification.test.cjs  # Field mapping tests
â””â”€â”€ guidelines/
    â””â”€â”€ Guidelines.md                  # Design system guidelines

```

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Development

The Vite dev server runs automatically in this environment. Access the preview surface to view changes.

**Important**: 
- Do NOT run `vite build` or `npm run build`
- Do NOT create `index.html` - entrypoint is auto-generated
- Do NOT manually start dev server

### Environment Setup

Copy and configure environment variables:

```bash
# See docs/setup/SUPABASE_SETUP.md for configuration
cp .env.example .env
```

Run setup verification:

```bash
node scripts/check-env.cjs
node scripts/test-supabase-connection.cjs
```

## Key Technologies

- **React 18** - UI framework
- **Tailwind CSS v4** - Styling
- **Vite 6** - Build tool
- **Supabase** - Backend and database
- **@imgly/background-removal** - AI background removal
- **shadcn/ui** - Component library

## Important Guidelines

### Fonts
- **Font imports MUST only be added to `/src/styles/fonts.css`**
- Always add font imports to the top of the file
- Do not add font imports in any other CSS files

### Components
- Edit existing `src/app/App.tsx` for main component
- Create new components in `src/app/components/` as `.tsx` files
- Only create `.tsx` files (never `.html`, `.js`, or `.jsx`)

### Styling
- Use Tailwind CSS v4 classes
- Default styles for common elements defined in `/src/styles/theme.css`
- Do not update tokens unless user requests specific design style
- Do not create `tailwind.config.js` (using Tailwind v4)

## Worker Backend

The `/worker` directory contains the Photoshop automation backend:

- **Source of Truth**: All worker files in `/worker/` (not `/src/imports/`)
- **Processing**: Handles PSD generation with MRZ and PERFO digits
- **Layer Mappings**: `EMPLOYEEID_LAYER_MAP.json` maps data fields to PSD layers

See `docs/backend/` for detailed worker documentation.

## Documentation

- **Setup**: `docs/setup/` - Environment and Supabase configuration
- **Alignment**: `docs/alignment/` - Data model and field mappings
- **Backend**: `docs/backend/` - Worker architecture and Codex integration
- **Design**: `docs/design/` - Visual specifications and mockups
- **Guidelines**: `guidelines/Guidelines.md` - Design system and tokens

## Testing

Run mapping verification tests:

```bash
node tests/mapping-verification.test.cjs
```

## Attributions

See `docs/ATTRIBUTIONS.md` for third-party library credits.

