#!/usr/bin/env node

/**
 * Supabase Connection Test
 *
 * Verifies connection to existing Supabase project and checks:
 * 1. badge_jobs table exists and is accessible
 * 2. worker_heartbeat table exists and is accessible
 * 3. badge-inputs bucket exists
 * 4. badge-outputs bucket exists
 * 5. RLS policies are configured
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('========================================');
console.log('Supabase Connection Test');
console.log('========================================\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('❌ Missing Supabase credentials in .env file');
  console.log('   Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('Configuration:');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseAnonKey.substring(0, 20)}...`);
console.log('');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

let allTestsPass = true;

async function runTests() {
  // Test 1: Check badge_jobs table
  console.log('Test 1: Checking badge_jobs table...');
  try {
    const { data, error } = await supabase
      .from('badge_jobs')
      .select('id')
      .limit(1);

    if (error) {
      console.log(`❌ Error accessing badge_jobs: ${error.message}`);
      if (error.message.includes('does not exist')) {
        console.log('   → Table does not exist. Run SQL from SUPABASE_SETUP.md');
      } else if (error.message.includes('permission denied')) {
        console.log('   → Permission denied. Check RLS policies.');
      }
      allTestsPass = false;
    } else {
      console.log('✅ badge_jobs table accessible');
      console.log(`   Found ${data ? data.length : 0} rows (limited to 1)`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
    allTestsPass = false;
  }
  console.log('');

  // Test 2: Check worker_heartbeat table
  console.log('Test 2: Checking worker_heartbeat table...');
  try {
    const { data, error } = await supabase
      .from('worker_heartbeat')
      .select('worker_id')
      .limit(1);

    if (error) {
      console.log(`❌ Error accessing worker_heartbeat: ${error.message}`);
      if (error.message.includes('does not exist')) {
        console.log('   → Table does not exist. Run SQL from SUPABASE_SETUP.md');
      }
      allTestsPass = false;
    } else {
      console.log('✅ worker_heartbeat table accessible');
      console.log(`   Found ${data ? data.length : 0} workers`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
    allTestsPass = false;
  }
  console.log('');

  // Test 3: Check badge-inputs bucket
  console.log('Test 3: Checking badge-inputs storage bucket...');
  try {
    const { data, error } = await supabase
      .storage
      .from('badge-inputs')
      .list('', { limit: 1 });

    if (error) {
      console.log(`❌ Error accessing badge-inputs bucket: ${error.message}`);
      if (error.message.includes('not found')) {
        console.log('   → Bucket does not exist. Create in Supabase Dashboard → Storage');
      } else if (error.message.includes('permission denied')) {
        console.log('   → Permission denied. Check bucket policies.');
      }
      allTestsPass = false;
    } else {
      console.log('✅ badge-inputs bucket accessible');
      console.log(`   Bucket is ${data && data.length > 0 ? 'not empty' : 'empty'}`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
    allTestsPass = false;
  }
  console.log('');

  // Test 4: Check badge-outputs bucket
  console.log('Test 4: Checking badge-outputs storage bucket...');
  try {
    const { data, error } = await supabase
      .storage
      .from('badge-outputs')
      .list('', { limit: 1 });

    if (error) {
      console.log(`❌ Error accessing badge-outputs bucket: ${error.message}`);
      if (error.message.includes('not found')) {
        console.log('   → Bucket does not exist. Create in Supabase Dashboard → Storage');
      }
      allTestsPass = false;
    } else {
      console.log('✅ badge-outputs bucket accessible');
      console.log(`   Bucket is ${data && data.length > 0 ? 'not empty' : 'empty'}`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
    allTestsPass = false;
  }
  console.log('');

  // Test 5: Test job creation (insert)
  console.log('Test 5: Testing job creation (insert into badge_jobs)...');
  try {
    const testPayload = {
      template: 'EmployeeID.psd',
      company_name: 'Test Corp',
      issuer_code: 'TEST',
      department: 'IT',
      first_name: 'Test',
      last_name: 'User',
      doc_number: 'TEST123',
      personal_number: '999999999',
      valid_from: '2024-01-01',
      expires: '2025-01-01',
      birth_date: '1990-01-01',
      birth_year: '1990',
      gender: 'Male',
      export_format: 'png',
      assets: {
        employee_photo_path: 'test/photo.jpg',
        signature_image_path: 'test/signature.png'
      },
      meta: {
        created_from: 'connection-test',
        intended_use: 'internal_company_badge'
      }
    };

    const { data, error } = await supabase
      .from('badge_jobs')
      .insert({
        status: 'queued',
        template: 'EmployeeID.psd',
        input_json: testPayload,
        employee_photo_path: 'test/photo.jpg',
        signature_image_path: 'test/signature.png',
      })
      .select()
      .single();

    if (error) {
      console.log(`❌ Cannot create test job: ${error.message}`);
      if (error.message.includes('permission denied')) {
        console.log('   → RLS policy may be blocking inserts');
        console.log('   → Check policies in SUPABASE_SETUP.md');
      }
      allTestsPass = false;
    } else {
      console.log('✅ Successfully created test job');
      console.log(`   Job ID: ${data.id}`);

      // Clean up test job
      console.log('   Cleaning up test job...');
      const { error: deleteError } = await supabase
        .from('badge_jobs')
        .delete()
        .eq('id', data.id);

      if (deleteError) {
        console.log(`   ⚠️  Could not delete test job: ${deleteError.message}`);
      } else {
        console.log('   ✅ Test job deleted');
      }
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
    allTestsPass = false;
  }
  console.log('');

  // Test 6: Test signed URL creation
  console.log('Test 6: Testing signed URL creation from badge-outputs...');
  try {
    // Try to create a signed URL for a non-existent file (just to test the API)
    const { data, error } = await supabase
      .storage
      .from('badge-outputs')
      .createSignedUrl('test/nonexistent.png', 60);

    if (error) {
      console.log(`❌ Cannot create signed URL: ${error.message}`);
      if (error.message.includes('Object not found')) {
        console.log('   ℹ️  This is expected - file does not exist');
        console.log('   ✅ Signed URL API is accessible');
      } else {
        console.log('   → Check bucket policies');
        allTestsPass = false;
      }
    } else {
      console.log('✅ Signed URL API accessible');
      console.log(`   URL format: ${data.signedUrl?.substring(0, 50)}...`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
    allTestsPass = false;
  }
  console.log('');

  // Summary
  console.log('========================================');
  if (allTestsPass) {
    console.log('✅ All connection tests passed!');
    console.log('');
    console.log('Your Supabase project is ready.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Navigate to: Custom Tools → ID Generator');
    console.log('3. Create a test badge job');
  } else {
    console.log('⚠️  Some tests failed');
    console.log('');
    console.log('Action required:');
    console.log('1. Check that all tables exist');
    console.log('2. Check that all storage buckets exist');
    console.log('3. Review RLS policies');
    console.log('4. See SUPABASE_SETUP.md for complete setup');
  }
  console.log('========================================\n');

  process.exit(allTestsPass ? 0 : 1);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
