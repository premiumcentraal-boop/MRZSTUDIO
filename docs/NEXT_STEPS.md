# Next Steps - Generate Your Photoshop Automation Code

## You're All Set! Here's What You Have

✅ **Complete data model** - Aligned with Internal Employee Badge Studio  
✅ **Frontend form** - Collects all 19 badge fields  
✅ **Worker infrastructure** - Ready to process jobs  
✅ **Validation system** - Ensures data consistency  
✅ **Comprehensive documentation** - Everything is documented  
✅ **Code generation prompt** - Ready to create exact PSD editing scripts  

## What You Need To Do Now

### 🎯 Step 1: Prepare Your PSD Template (5 minutes)

**You have 3 options:**

#### Option A: Attach Your PSD File (Easiest)
```
✅ If your EmployeeID.psd is under 10MB
✅ Just attach it to a new AI conversation
✅ The AI will analyze it automatically
```

#### Option B: Take Screenshots
```
1. Open EmployeeID.psd in Photoshop
2. Expand all layer groups in Layers panel
3. Take screenshots showing complete hierarchy
4. You'll attach these to the AI
```

#### Option C: Run Inspector Script (Most Detailed)
```
1. Open EmployeeID.psd in Photoshop
2. Run: File → Scripts → Browse
3. Select: worker/scripts/inspect_employeeid_layers.jsx
4. Copy the output from logs/employeeid_layer_report.json
5. You'll paste this to the AI
```

**📁 Place your PSD here:**
```
Card_Generator/EmployeeID.psd
```

### 🎯 Step 2: Generate Automation Scripts (2 minutes)

**Open a new conversation with Claude (or any AI) and:**

1. **Attach** your PSD file, screenshots, or layer report
2. **Paste** the entire contents of: `CODEX_PROMPT.md`
3. **Add** this request:

```
Please analyze my PSD file and generate all the required Photoshop 
automation scripts based on the specifications above. I need:

1. run_employeeid_job.jsx - Main production script
2. verify_template.jsx - Template validation
3. test_job.jsx - Dry-run test with sample data
4. debug_layers.jsx - Layer inspector
5. PHOTOSHOP_SETUP.md - Setup guide
6. LAYER_PATH_CORRECTIONS.md - Any corrections needed

Make sure the scripts match my ACTUAL layer structure, not just 
the documented structure.
```

### 🎯 Step 3: Install Generated Scripts (10 minutes)

**On your Windows machine:**

```powershell
# 1. Create folder structure
mkdir C:\EmployeeBadgeAutomation
cd C:\EmployeeBadgeAutomation
mkdir templates, scripts, logs, current-job, output

# 2. Copy files
# - Copy generated scripts to C:\EmployeeBadgeAutomation\scripts\
# - Copy EmployeeID.psd to C:\EmployeeBadgeAutomation\templates\
# - Copy worker.js and job-adapter.js to C:\EmployeeBadgeAutomation\

# 3. Install Node.js dependencies
npm install

# 4. Create .env file (use worker/.env.example as template)
notepad .env
```

### 🎯 Step 4: Test Your Scripts (5 minutes)

```powershell
# Test 1: Verify template structure
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" ^
  "C:\EmployeeBadgeAutomation\scripts\verify_template.jsx"

# Test 2: Check fonts
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" ^
  "C:\EmployeeBadgeAutomation\scripts\font_preflight.jsx"

# Test 3: Run dry-run with sample data
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" ^
  "C:\EmployeeBadgeAutomation\scripts\test_job.jsx"

# Test 4: Check the output
explorer C:\EmployeeBadgeAutomation\output\test-job\
```

### 🎯 Step 5: Integrate with Full System (15 minutes)

```bash
# 1. Set up Supabase (if not done already)
# Follow instructions in: SUPABASE_SETUP.md

# 2. Configure frontend environment
# Create .env file with:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# 3. Start development server
npm run dev

# 4. Start worker on Windows
cd C:\EmployeeBadgeAutomation
node worker.js

# 5. Test end-to-end
# - Navigate to Custom Tools → ID Generator
# - Fill out form with test data
# - Upload test photo
# - Generate badge
# - Verify worker processes job
# - Download result
```

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| **CODEX_PROMPT.md** | Complete prompt to generate PSD editing scripts |
| **HOW_TO_USE_CODEX_PROMPT.md** | Instructions for using the prompt |
| **Card_Generator/README.md** | PSD template requirements |
| **FIELD_MAPPING_REFERENCE.md** | Quick field → PSD layer reference |
| **DATA_MODEL_ALIGNMENT_SUMMARY.md** | Complete system documentation |
| **IMPLEMENTATION_CHECKLIST.md** | Progress tracking |

## 🔍 What the AI Will Generate for You

When you use the Codex prompt, you'll receive:

### 1. run_employeeid_job.jsx
✅ Production-ready main script  
✅ Updates all 13 text layers  
✅ Handles photo and signature Smart Objects  
✅ Exports PNG/PDF/PSD  
✅ Never modifies original template  
✅ Matches YOUR exact layer structure  

### 2. verify_template.jsx
✅ Validates all required layers exist  
✅ Checks layer types (text vs. Smart Object)  
✅ Verifies fonts are available  
✅ Outputs validation report  

### 3. test_job.jsx
✅ Dry-run test with sample data  
✅ No Supabase connection needed  
✅ Tests all fields and exports  
✅ Perfect for development  

### 4. debug_layers.jsx
✅ Outputs complete layer hierarchy  
✅ Shows exact layer paths  
✅ Helps troubleshoot layer issues  

### 5. PHOTOSHOP_SETUP.md
✅ Step-by-step setup instructions  
✅ Font installation guide  
✅ Testing procedures  
✅ Troubleshooting tips  

### 6. LAYER_PATH_CORRECTIONS.md
✅ Lists any differences from expected structure  
✅ Shows actual vs. documented layer paths  
✅ Provides corrected mappings  

## ✅ Validation Checklist

After generating and installing scripts:

- [ ] Template structure verified (`verify_template.jsx`)
- [ ] All fonts installed and detected (`font_preflight.jsx`)
- [ ] Dry-run test successful (`test_job.jsx`)
- [ ] Output PNG shows all fields correctly
- [ ] Photo and signature placed correctly
- [ ] Original formatting preserved (font, size, color)
- [ ] Mapping verification test passes (`node tests/mapping-verification.test.cjs`)
- [ ] End-to-end test with real job successful

## 🆘 Troubleshooting

### "Layer not found" errors
✅ Run `debug_layers.jsx` to see actual structure  
✅ Check LAYER_PATH_CORRECTIONS.md for differences  
✅ Update layer names in PSD or script  

### "Font missing" errors
✅ Run `font_preflight.jsx` to identify missing fonts  
✅ Install missing fonts on Windows  
✅ Restart Photoshop  
✅ Re-run test  

### "Smart Object edit failed"
✅ Verify Smart Objects are embedded (not linked)  
✅ Check internal layer structure matches expectations  
✅ Ensure target layer exists inside Smart Object  

### Script runs but output is wrong
✅ Check that layer names match exactly (case-sensitive)  
✅ Verify text layers haven't been rasterized  
✅ Ensure layer paths include all parent groups  

## 🎓 Learning Resources

**Understanding the System:**
1. Read: `DATA_MODEL_ALIGNMENT_SUMMARY.md` - Complete overview
2. Review: `FIELD_MAPPING_REFERENCE.md` - Quick reference
3. Check: `src/lib/badgeMapping.ts` - Field definitions

**PSD Template Design:**
1. Read: `reference/EMPLOYEEID_BACKBONE.md` - Layer structure spec
2. Review: `Card_Generator/README.md` - Template requirements
3. Study: `worker/EMPLOYEEID_LAYER_MAP.json` - Machine-readable map

**Testing & Validation:**
1. Run: `node tests/mapping-verification.test.cjs` - Data model test
2. Use: `worker/scripts/test_job.jsx` - Photoshop test
3. Check: Output files for correctness

## 💡 Pro Tips

### For Best Results:
✅ **Name layers exactly** as specified (case-sensitive)  
✅ **Organize in groups** as documented  
✅ **Use embedded Smart Objects** (not linked)  
✅ **Install all fonts** before testing  
✅ **Test iteratively** - one feature at a time  

### Save Time:
✅ **Use Option A** (attach PSD) - fastest method  
✅ **Run tests in order** - verify → fonts → test → full run  
✅ **Start with mock mode** - test frontend without backend  
✅ **Use test_job.jsx** - faster than full worker  

### Avoid Issues:
❌ Don't rasterize text layers  
❌ Don't use linked Smart Objects  
❌ Don't rename layers after generating scripts  
❌ Don't skip the validation scripts  
❌ Don't test in production first  

## 🎯 Expected Timeline

| Task | Time | Difficulty |
|------|------|------------|
| Prepare PSD file | 5 min | Easy |
| Generate scripts with AI | 2 min | Easy |
| Install scripts on Windows | 10 min | Easy |
| Test scripts | 5 min | Easy |
| Setup Supabase | 15 min | Medium |
| Configure environment | 5 min | Easy |
| Test end-to-end | 10 min | Easy |
| **Total** | **~1 hour** | **Easy to Medium** |

## 🚀 You're Ready!

Everything is prepared for you to generate production-ready Photoshop automation code:

1. ✅ Data model aligned across all layers
2. ✅ Comprehensive documentation created
3. ✅ Complete prompt prepared
4. ✅ Validation tests ready
5. ✅ Support scripts included

**Next Action:**  
Open `HOW_TO_USE_CODEX_PROMPT.md` and follow the instructions to generate your exact PSD editing scripts!

---

**Questions?**  
- Review: `CODEX_PROMPT.md` - See what the AI will do
- Check: `HOW_TO_USE_CODEX_PROMPT.md` - Step-by-step guide
- Read: `Card_Generator/README.md` - Template requirements
- Test: `node tests/mapping-verification.test.cjs` - Verify data model
