# Employee Badge Generator

A React + Tailwind CSS application for generating standardized employee ID badges with automated PSD processing.

## Features

- **Standardized Image Processing**: Upload and crop photos to exact specifications
  - Employee photos: 2421 × 3292 px
  - Signatures: 420 × 123 px
- **AI Background Removal**: Automatic background removal for employee photos
- **Interactive Photo Editor**: Drag-to-pan positioning and zoom controls
- **Automated Badge Generation**: Worker-based PSD processing with MRZ and PERFO digit handling

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── App.tsx                    # Main application component
│   │   ├── IdGeneratorStep.tsx        # Badge generation form
│   │   └── components/
│   │       ├── photo-editor.tsx       # Reusable photo cropping component
│   │       ├── figma/                 # Figma-imported components
│   │       └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── badgeMapping.ts            # Data model and field mappings
│   │   └── supabase.ts                # Supabase client configuration
│   └── styles/
│       ├── fonts.css                  # Font imports (add fonts here only)
│       ├── globals.css                # Global styles
│       ├── tailwind.css               # Tailwind v4 base
│       └── theme.css                  # Design tokens and theme
├── worker/
│   ├── worker.js                      # Main PSD processing worker
│   ├── job-adapter.js                 # Job queue adapter
│   ├── EMPLOYEEID_LAYER_MAP.json      # PSD layer mappings
│   └── scripts/
│       ├── run_employeeid_job.jsx     # Photoshop automation script
│       ├── verify_template.jsx        # Template verification
│       ├── test_employeeid_job.jsx    # Worker testing script
│       └── font_preflight.jsx         # Font availability check
├── docs/
│   ├── setup/                         # Setup and environment docs
│   ├── alignment/                     # Data model alignment docs
│   ├── backend/                       # Worker and Codex documentation
│   │   └── card-generator/            # Legacy card generator tools
│   ├── design/                        # Design specs and mockups
│   └── archive/                       # Historical reference files
├── scripts/
│   ├── check-env.cjs                  # Environment validation
│   └── test-supabase-connection.cjs   # Supabase connection test
├── tests/
│   └── mapping-verification.test.cjs  # Field mapping tests
└── guidelines/
    └── Guidelines.md                  # Design system guidelines

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
