# How to Use the Codex Prompt

## Quick Start

You have everything ready to generate the exact Photoshop automation code for your employee badge template.

## Step 1: Prepare Your PSD File

You need to provide information about your actual `EmployeeID.psd` file. Choose ONE of these options:

### Option A: Attach the PSD File (Recommended)
- If your PSD file is under 10MB, attach it directly to your AI conversation
- The AI can analyze the layer structure automatically

### Option B: Provide Layer Screenshots
- Open your `EmployeeID.psd` in Photoshop
- Expand all layer groups in the Layers panel
- Take screenshots showing the complete layer hierarchy
- Attach the screenshots to your AI conversation

### Option C: Run the Inspector Script (Most Detailed)
1. Open Photoshop
2. Open your `EmployeeID.psd` template
3. Run: File → Scripts → Browse → Select `/worker/scripts/inspect_employeeid_layers.jsx`
4. Find the output: `C:/EmployeeBadgeAutomation/logs/employeeid_layer_report.json`
5. Copy the contents of this JSON file to share with the AI

## Step 2: Start a New AI Conversation

Open a new conversation with Claude (or your preferred AI assistant) and do this:

### 2a. Attach Your PSD Information
- Attach your PSD file, screenshots, or paste the layer report JSON

### 2b. Paste the Codex Prompt
- Open `/workspaces/default/code/CODEX_PROMPT.md`
- Copy the ENTIRE contents
- Paste into the AI conversation

### 2c. Add This Request
```
Please analyze my PSD file and generate all the required Photoshop 
automation scripts based on the specifications above. I need:

1. run_employeeid_job.jsx - Main production script
2. verify_template.jsx - Template validation script
3. test_job.jsx - Dry-run test with sample data
4. debug_layers.jsx - Layer hierarchy inspector
5. PHOTOSHOP_SETUP.md - Setup and testing guide
6. LAYER_PATH_CORRECTIONS.md - Any corrections needed

Make sure the scripts match my ACTUAL layer structure, not the 
documented structure if there are differences.
```

## Step 3: Review the Generated Scripts

The AI will provide:
- ✅ Complete JSX scripts ready to use
- ✅ Setup instructions
- ✅ Test procedures
- ✅ Any corrections needed for layer paths

## Step 4: Install and Test

1. Copy the generated scripts to `C:\EmployeeBadgeAutomation\scripts\`
2. Follow the setup instructions provided
3. Run the test script first:
   ```
   "C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" 
   "C:\EmployeeBadgeAutomation\scripts\test_job.jsx"
   ```
4. Check the output in `C:\EmployeeBadgeAutomation\output\test-job\`
5. Verify all fields appear correctly

## Step 5: Integration

Once the scripts work:
1. Replace `/worker/scripts/run_employeeid_job.jsx` with the new version
2. Update any layer paths in `EMPLOYEEID_LAYER_MAP.json` if needed
3. Run the mapping verification test:
   ```bash
   node tests/mapping-verification.test.cjs
   ```
4. Test end-to-end with a real badge job

## What the AI Will Do

The AI will:
1. ✅ Analyze your actual PSD layer structure
2. ✅ Compare it to the expected structure
3. ✅ Generate scripts that match YOUR exact layer names and paths
4. ✅ Handle any differences from the documented structure
5. ✅ Provide corrected layer mappings if needed
6. ✅ Create test scripts for validation
7. ✅ Give you specific setup instructions

## Common Issues and Solutions

### "My PSD has different layer names"
✅ The AI will detect this and generate scripts using your actual layer names
✅ You'll get a LAYER_PATH_CORRECTIONS.md file showing the differences

### "I don't have all 13 text layers"
✅ The AI will work with whatever layers you have
✅ It will note which fields cannot be filled
✅ You can choose to add missing layers to your PSD or skip those fields

### "My Smart Objects are structured differently"
✅ The AI will analyze your Smart Object internal structure
✅ It will generate code that matches your actual setup
✅ Just make sure MAIN_PHOTO and SIGNATURE_AREA exist

### "The generated script doesn't work"
1. Check the error in Photoshop's ExtendScript Toolkit
2. Verify fonts are installed (run font_preflight.jsx)
3. Verify layer structure (run debug_layers.jsx)
4. Share the error with the AI for a fix

## Files the AI Will Reference

The AI has access to all these project files:
- ✅ `/src/lib/badgeMapping.ts` - Field definitions
- ✅ `/reference/EMPLOYEEID_BACKBONE.md` - PSD structure spec
- ✅ `/worker/EMPLOYEEID_LAYER_MAP.json` - Layer mapping
- ✅ `/worker/job-adapter.js` - Input structure
- ✅ `/FIELD_MAPPING_REFERENCE.md` - Quick reference
- ✅ `/DATA_MODEL_ALIGNMENT_SUMMARY.md` - Complete docs

## Example Conversation Flow

**You:** [Attach EmployeeID.psd] + [Paste CODEX_PROMPT.md contents] + 
"Please analyze my PSD and generate all required scripts"

**AI:** "I've analyzed your PSD file. I found the following layer structure: 
[analysis]. Here are the 5 scripts you requested: [scripts]. Note that 
your layer FIRST is at path X instead of Y, so I've adjusted the code 
accordingly."

**You:** "Great! Can you also create a test with data for 'Jane Doe' 
instead of 'John Smith'?"

**AI:** "Sure, here's an updated test_job.jsx with Jane Doe as the test 
employee..."

## Support Files Created

- **CODEX_PROMPT.md** - The complete prompt (use this)
- **HOW_TO_USE_CODEX_PROMPT.md** - This file
- **FIELD_MAPPING_REFERENCE.md** - Quick field reference
- **DATA_MODEL_ALIGNMENT_SUMMARY.md** - Complete system docs

## Ready to Generate!

You now have everything you need:
1. ✅ Complete data model documented
2. ✅ Comprehensive prompt prepared
3. ✅ All reference files in place
4. ✅ Validation tests ready

Just attach your PSD file, paste the prompt, and let the AI generate 
production-ready Photoshop automation scripts tailored to your exact 
template structure!
