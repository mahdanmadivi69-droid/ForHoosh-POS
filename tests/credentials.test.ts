// tests/credentials.test.ts
import { hashPassword, verifyPassword, constantTimeCompare } from '../src/services/credentials';

async function runCredentialsTests() {
  console.log('\n--- Running Credentials & Password Hashing Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Constant-time compare
  assert(constantTimeCompare('secret', 'secret') === true, 'Matching strings match in constantTimeCompare');
  assert(constantTimeCompare('secret', 'wrong') === false, 'Different strings fail in constantTimeCompare');
  assert(constantTimeCompare('secret', 'secrets') === false, 'Different length strings fail in constantTimeCompare');

  // 2. Hash generation
  const cred = await hashPassword('SpecialtyCoffee#100');
  assert(cred.v === 1, 'Credential version is 1');
  assert(cred.algo === 'PBKDF2-SHA256', 'Algorithm is PBKDF2-SHA256');
  assert(cred.iter === 120000, 'Iterations is 120,000');
  assert(typeof cred.salt === 'string' && cred.salt.length > 0, 'Salt is base64 string');
  assert(typeof cred.hash === 'string' && cred.hash.length > 0, 'Hash is base64 string');

  // 3. Verification
  const valid = await verifyPassword('SpecialtyCoffee#100', cred);
  assert(valid === true, 'Correct password verifies successfully');

  const invalid = await verifyPassword('WrongPassword', cred);
  assert(invalid === false, 'Wrong password fails verification');

  // 4. Salt randomness
  const cred2 = await hashPassword('SpecialtyCoffee#100');
  assert(cred.salt !== cred2.salt, 'Unique salt generated per hash');
  assert(cred.hash !== cred2.hash, 'Different hashes produced due to unique salts');

  console.log(`\nCredentials Tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runCredentialsTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
