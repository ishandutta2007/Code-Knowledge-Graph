import { setupDatabase } from './db.js';
import { indexCodebase } from './indexer.js';
import { startMcpServer } from './mcp.js';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'index') {
    const targetDir = args[1] || process.cwd();
    const dbPath = path.join(process.cwd(), '.ckg-index.db');
    
    console.log(`Indexing ${targetDir}...`);
    const db = await setupDatabase(dbPath);
    
    // Clear existing data for fresh index (optional, but good for MVP)
    await db.run('DELETE FROM nodes');
    await db.run('DELETE FROM edges');
    
    await indexCodebase(targetDir, db);
    console.log(`Indexing complete. Index saved to ${dbPath}`);
    await db.close();
  } else if (command === 'query') {
    const query = args[1];
    const dbPath = path.join(process.cwd(), '.ckg-index.db');
    const db = await setupDatabase(dbPath);
    
    const nodes = await db.all('SELECT * FROM nodes WHERE name LIKE ?', `%${query}%`);
    console.table(nodes);
    await db.close();
  } else if (command === 'mcp') {
    const dbPath = path.join(process.cwd(), '.ckg-index.db');
    await startMcpServer(dbPath);
  } else {
    console.log('Usage: ckg index [directory]');
    console.log('       ckg query [name]');
    console.log('       ckg mcp');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
