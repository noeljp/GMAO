const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    await pool.query(schemaSQL);
    console.log('✅ Schema created successfully');
    
    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'seed.sql'),
      'utf8'
    );
    
    await pool.query(seedSQL);
    console.log('✅ Seed data inserted successfully');
    
    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
