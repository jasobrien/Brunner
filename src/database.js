const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function setupDatabase() {
  const dbPath = path.join(__dirname, '..', 'results.db');
  console.log(`Setting up database at ${dbPath}`);
  
  // Check if we can write to the database location
  try {
    const testDir = path.dirname(dbPath);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Test we can write to the directory
    const testFile = path.join(testDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    console.error(`Cannot write to database location ${path.dirname(dbPath)}:`, error);
    throw new Error(`Database directory not writable: ${error.message}`);
  }
  
  // Create/open the database
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_name TEXT NOT NULL,
      environment TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      error_message TEXT
    );
    
    CREATE TABLE IF NOT EXISTS request_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id INTEGER NOT NULL,
      request_name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      error_message TEXT,
      FOREIGN KEY (result_id) REFERENCES results (id)
    );
  `);
  
  // Simply log the count without inserting test data
  const count = db.prepare('SELECT COUNT(*) as count FROM results').get().count;
  console.log(`Database contains ${count} results`);
  
  return db;
}

function saveResult(db, collectionName, environment, status, durationMs, errorMessage = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO results (collection_name, environment, status, duration_ms, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(collectionName, environment, status, durationMs, errorMessage);
    console.log(`Saved result: ${collectionName}/${environment} - ${status} (${durationMs}ms) - ID: ${info.lastInsertRowid}`);
    return info.lastInsertRowid;
  } catch (error) {
    console.error('Error saving result:', error);
    throw error;
  }
}

function saveRequestResult(db, resultId, requestName, status, durationMs, errorMessage = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO request_results (result_id, request_name, status, duration_ms, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(resultId, requestName, status, durationMs, errorMessage);
    console.log(`Saved request result: ${requestName} for result ID ${resultId} - ${status} (${durationMs}ms)`);
    return info.lastInsertRowid;
  } catch (error) {
    console.error('Error saving request result:', error);
    throw error;
  }
}

function getResults(db) {
  try {
    return db.prepare('SELECT * FROM results ORDER BY timestamp DESC').all();
  } catch (error) {
    console.error('Error getting results:', error);
    throw error;
  }
}

function getRequestResults(db, resultId) {
  try {
    // Also get the parent result to access collection-level error info
    const parentResult = db.prepare('SELECT * FROM results WHERE id = ?').get(resultId);
    console.log(`Retrieved parent result for ID ${resultId}:`, parentResult);
    
    const requestResults = db.prepare('SELECT * FROM request_results WHERE result_id = ?').all(resultId);
    
    // If we have no request results but have a collection error, create a dummy request result
    if (requestResults.length === 0 && parentResult && parentResult.error_message) {
      console.log(`Creating dummy request result for collection error in ID ${resultId}`);
      return [{
        id: -1,
        result_id: parseInt(resultId),
        request_name: 'Collection Error',
        status: 'error',
        duration_ms: parentResult.duration_ms,
        error_message: parentResult.error_message
      }];
    }
    
    return requestResults;
  } catch (error) {
    console.error(`Error getting request results for ID ${resultId}:`, error);
    throw error;
  }
}

module.exports = {
  setupDatabase,
  saveResult,
  saveRequestResult,
  getResults,
  getRequestResults
};
