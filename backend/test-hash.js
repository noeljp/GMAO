const bcrypt = require('bcryptjs');

const hash = '$2a$10$cEQlYmENhU23mCFlZ2jDJ.fku5uznSWNLmpDqAjAr1.HVkzEIN8y6';
const password = 'Admin123!';

console.log('Testing password:', password);
console.log('Against hash:', hash);

bcrypt.compare(password, hash).then(result => {
  console.log('Match result:', result);
  
  if (!result) {
    console.log('\nGenerating new hash for', password);
    bcrypt.hash(password, 10).then(newHash => {
      console.log('New hash:', newHash);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
