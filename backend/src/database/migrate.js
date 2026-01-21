const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    // Créer la table de suivi des migrations si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Vérifier si le schéma de base existe
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sites'
      );
    `);
    
    const schemaExists = rows[0].exists;
    
    if (!schemaExists) {
      console.log('📋 Applying base schema...');
      const schemaSQL = fs.readFileSync(
        path.join(__dirname, 'schema.sql'),
        'utf8'
      );
      await pool.query(schemaSQL);
      await pool.query(`
        INSERT INTO schema_migrations (migration_name) 
        VALUES ('001_base_schema') 
        ON CONFLICT (migration_name) DO NOTHING;
      `);
      console.log('✅ Base schema created');
      
      console.log('📋 Applying seed data...');
      const seedSQL = fs.readFileSync(
        path.join(__dirname, 'seed.sql'),
        'utf8'
      );
      await pool.query(seedSQL);
      console.log('✅ Seed data inserted');
    }
    
    // Appliquer les migrations incrémentales
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      for (const file of files) {
        const migrationName = file.replace('.sql', '');
        
        // Vérifier si la migration a déjà été appliquée
        const { rows: migrationRows } = await pool.query(
          'SELECT * FROM schema_migrations WHERE migration_name = $1',
          [migrationName]
        );
        
        if (migrationRows.length === 0) {
          console.log(`📋 Applying migration: ${migrationName}...`);
          const migrationSQL = fs.readFileSync(
            path.join(migrationsDir, file),
            'utf8'
          );
          await pool.query(migrationSQL);
          await pool.query(
            'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
            [migrationName]
          );
          console.log(`✅ Migration ${migrationName} applied`);
        } else {
          console.log(`⏭️  Migration ${migrationName} already applied`);
        }
      }
    }
    
    console.log('✅ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
