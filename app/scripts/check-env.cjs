#!/usr/bin/env node

/**
 * Environment Configuration Checker
 * 
 * Validates that .env files are configured correctly
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('Environment Configuration Checker');
console.log('========================================\n');

let allChecksPass = true;

// Check 1: Frontend .env exists
console.log('Check 1: Frontend .env file');
const frontendEnvPath = path.join(__dirname, '.env');
if (fs.existsSync(frontendEnvPath)) {
  console.log('✅ .env file exists');
  
  const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  
  // Check VITE_SUPABASE_URL
  if (frontendEnv.includes('VITE_SUPABASE_URL=https://hadssmwwclzxfujrpatd.supabase.co')) {
    console.log('✅ VITE_SUPABASE_URL configured');
  } else {
    console.log('❌ VITE_SUPABASE_URL not configured correctly');
    allChecksPass = false;
  }
  
  // Check VITE_SUPABASE_ANON_KEY format
  const anonKeyMatch = frontendEnv.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
  if (anonKeyMatch) {
    const anonKey = anonKeyMatch[1].trim();
    if (anonKey.startsWith('eyJ')) {
      console.log('✅ VITE_SUPABASE_ANON_KEY format looks correct (JWT token)');
    } else if (anonKey.startsWith('sb_secret_')) {
      console.log('⚠️  WARNING: VITE_SUPABASE_ANON_KEY appears to be a secret key, not anon key');
      console.log('   Anon keys should start with "eyJ", not "sb_secret_"');
      console.log('   See SUPABASE_SECURITY_WARNING.md for details');
      allChecksPass = false;
    } else {
      console.log('❌ VITE_SUPABASE_ANON_KEY format unrecognized');
      allChecksPass = false;
    }
  } else {
    console.log('❌ VITE_SUPABASE_ANON_KEY not found');
    allChecksPass = false;
  }
  
  // Check VITE_MOCK_ID_GENERATOR
  if (frontendEnv.includes('VITE_MOCK_ID_GENERATOR=false')) {
    console.log('✅ VITE_MOCK_ID_GENERATOR=false (production mode)');
  } else if (frontendEnv.includes('VITE_MOCK_ID_GENERATOR=true')) {
    console.log('ℹ️  VITE_MOCK_ID_GENERATOR=true (mock mode enabled)');
  } else {
    console.log('⚠️  VITE_MOCK_ID_GENERATOR not configured');
  }
  
} else {
  console.log('❌ .env file not found');
  allChecksPass = false;
}

console.log('');

// Check 2: Worker .env exists
console.log('Check 2: Worker .env file');
const workerEnvPath = path.join(__dirname, 'worker', '.env');
if (fs.existsSync(workerEnvPath)) {
  console.log('✅ worker/.env file exists');
  
  const workerEnv = fs.readFileSync(workerEnvPath, 'utf8');
  
  // Check SUPABASE_URL
  if (workerEnv.includes('SUPABASE_URL=https://hadssmwwclzxfujrpatd.supabase.co')) {
    console.log('✅ SUPABASE_URL configured');
  } else {
    console.log('❌ SUPABASE_URL not configured correctly');
    allChecksPass = false;
  }
  
  // Check SUPABASE_SERVICE_KEY format
  const serviceKeyMatch = workerEnv.match(/SUPABASE_SERVICE_KEY=(.+)/);
  if (serviceKeyMatch) {
    const serviceKey = serviceKeyMatch[1].trim();
    if (serviceKey.startsWith('eyJ')) {
      console.log('✅ SUPABASE_SERVICE_KEY format looks correct (JWT token)');
    } else if (serviceKey.startsWith('sb_secret_')) {
      console.log('⚠️  WARNING: SUPABASE_SERVICE_KEY appears to use non-standard format');
      console.log('   Service role keys typically start with "eyJ"');
      console.log('   See SUPABASE_SECURITY_WARNING.md for details');
      allChecksPass = false;
    } else {
      console.log('❌ SUPABASE_SERVICE_KEY format unrecognized');
      allChecksPass = false;
    }
  } else {
    console.log('❌ SUPABASE_SERVICE_KEY not found');
    allChecksPass = false;
  }
  
  // Check WORKER_ID
  if (workerEnv.includes('WORKER_ID=photoshop-worker-01')) {
    console.log('✅ WORKER_ID configured');
  } else {
    console.log('⚠️  WORKER_ID may need customization');
  }
  
} else {
  console.log('❌ worker/.env file not found');
  allChecksPass = false;
}

console.log('');

// Check 3: .gitignore protects .env files
console.log('Check 3: Git ignore configuration');
const gitignorePath = path.join(__dirname, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  console.log('✅ .gitignore file exists');
  
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (gitignore.includes('.env')) {
    console.log('✅ .env files are protected from git commits');
  } else {
    console.log('⚠️  .env may not be gitignored');
  }
} else {
  console.log('⚠️  .gitignore file not found');
}

console.log('');

// Check 4: Key security
console.log('Check 4: Security check');
if (frontendEnvPath && workerEnvPath && fs.existsSync(frontendEnvPath) && fs.existsSync(workerEnvPath)) {
  const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  const workerEnv = fs.readFileSync(workerEnvPath, 'utf8');
  
  const frontendKeyMatch = frontendEnv.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
  const workerKeyMatch = workerEnv.match(/SUPABASE_SERVICE_KEY=(.+)/);
  
  if (frontendKeyMatch && workerKeyMatch) {
    const frontendKey = frontendKeyMatch[1].trim();
    const workerKey = workerKeyMatch[1].trim();
    
    if (frontendKey === workerKey) {
      console.log('❌ CRITICAL: Frontend and worker are using the SAME key!');
      console.log('   This is a major security vulnerability.');
      console.log('   Frontend should use ANON key, worker should use SERVICE ROLE key.');
      console.log('   Read: SUPABASE_SECURITY_WARNING.md');
      allChecksPass = false;
    } else {
      console.log('✅ Frontend and worker use different keys (correct)');
    }
  }
}

console.log('');
console.log('========================================');

if (allChecksPass) {
  console.log('✅ All checks passed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Navigate to: Custom Tools → ID Generator');
  console.log('3. Setup Supabase database: cat SUPABASE_SETUP.md');
} else {
  console.log('⚠️  Some checks failed');
  console.log('');
  console.log('Action required:');
  console.log('1. Read: SUPABASE_SECURITY_WARNING.md');
  console.log('2. Get correct keys from Supabase Dashboard');
  console.log('3. Update .env files');
  console.log('4. Run this check again: node check-env.js');
}

console.log('========================================\n');

process.exit(allChecksPass ? 0 : 1);
