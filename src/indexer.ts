import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite';
import { glob } from 'glob';

export async function indexCodebase(rootPath: string, db: Database) {
  const files = await glob('**/*.{ts,js}', { 
    cwd: rootPath, 
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
    absolute: true 
  });

  console.log(`Found ${files.length} files to index.`);

  for (const file of files) {
    await indexFile(file, rootPath, db);
  }
}

async function indexFile(filePath: string, rootPath: string, db: Database) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const relativePath = path.relative(rootPath, filePath);
  
  // Insert file node
  const fileResult = await db.run(
    'INSERT INTO nodes (name, type, path, content) VALUES (?, ?, ?, ?)',
    path.basename(filePath),
    'file',
    relativePath,
    content
  );
  const fileId = fileResult.lastID;

  const nodesToProcess: ts.Node[] = [];
  function collectNodes(node: ts.Node) {
    if ((ts.isFunctionDeclaration(node) && node.name) ||
        (ts.isClassDeclaration(node) && node.name) ||
        (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name))) {
      nodesToProcess.push(node);
    }
    ts.forEachChild(node, collectNodes);
  }

  collectNodes(sourceFile);

  for (const node of nodesToProcess) {
    let name = '';
    let type = '';
    
    if (ts.isFunctionDeclaration(node) && node.name) {
      name = node.name.text;
      type = 'function';
    } else if (ts.isClassDeclaration(node) && node.name) {
      name = node.name.text;
      type = 'class';
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      name = node.name.text;
      type = 'method';
    }

    if (name && type) {
      const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      
      const nodeResult = await db.run(
        'INSERT INTO nodes (name, type, path, startLine, endLine) VALUES (?, ?, ?, ?, ?)',
        name,
        type,
        relativePath,
        startLine + 1,
        endLine + 1
      );
      
      if (fileId) {
        await db.run(
          'INSERT INTO edges (from_id, to_id, type) VALUES (?, ?, ?)',
          fileId,
          nodeResult.lastID,
          'contains'
        );
      }
    }
  }
}
