const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { saveResult, saveRequestResult } = require('./database');

async function getEnvironmentFiles(collectionPath) {
  // Look for environment files in the collection's environments directory
  const environmentsPath = path.join(collectionPath, 'environments');
  
  if (!fs.existsSync(environmentsPath)) {
    console.log(`No environments directory found for collection at ${collectionPath}, skipping collection`);
    return []; // Return empty array instead of ['default']
  }
  
  // Get all files in the environments directory (not just .env files)
  const envFiles = fs.readdirSync(environmentsPath)
    .filter(file => fs.statSync(path.join(environmentsPath, file)).isFile())
    .filter(file => !file.startsWith('.')) // Skip hidden files
    .map(file => path.basename(file, path.extname(file))); // Remove file extension
  
  if (envFiles.length === 0) {
    console.log(`No environment files found in ${environmentsPath}, skipping collection`);
    return []; // Return empty array instead of ['default']
  }
  
  console.log(`Found environment files for collection at ${collectionPath}: ${envFiles.join(', ')}`);
  return envFiles;
}

async function runCollections(collectionsPath, db) {
  console.log('Scanning for Bruno collections...');
  
  // Find all Bruno collection directories
  const collections = fs.readdirSync(collectionsPath)
    .filter(file => fs.statSync(path.join(collectionsPath, file)).isDirectory());
  
  console.log(`Found ${collections.length} collections.`);
  
  // Get path to bruno CLI
  const bruCLIPath = path.join(__dirname, '..', 'node_modules', '.bin', 'bru');
  
  for (const collection of collections) {
    const collectionPath = path.join(collectionsPath, collection);
    const environments = await getEnvironmentFiles(collectionPath);
    
    // Skip this collection if no environments were found
    if (environments.length === 0) {
      console.log(`Skipping collection '${collection}' because no environments were found`);
      continue;
    }
    
    for (const env of environments) {
      let startTime = Date.now();
      
      try {
        console.log(`Running collection '${collection}' with environment '${env}'...`);
        
        // Run Bruno collection
        const result = execSync(`"${bruCLIPath}" run "${collectionPath}" --env ${env}`, { 
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'] 
        });
        
        const durationMs = Date.now() - startTime;
        
        // Parse output to extract individual request information
        const outputLines = result.split('\n');
        let hasErrors = false;
        let requests = [];
        
        // Extract request information from the output
        for (let i = 0; i < outputLines.length; i++) {
          const line = outputLines[i].trim();
          
          // Look for lines with request info
          if (line.includes('→') || line.includes('GET') || line.includes('POST') || 
              line.includes('PUT') || line.includes('DELETE') || line.includes('PATCH')) {
            
            // Extract request method and path
            const requestMatch = line.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+(.+?)(?:\s|$)/);
            if (requestMatch) {
              const requestPath = requestMatch[1];
              const requestName = requestPath.split('/').pop() || requestPath;
              
              // Look for status code in the next few lines
              let statusCode = null;
              let requestTime = null;
              let isError = false;
              let errorMessage = null;
              
              for (let j = i + 1; j < Math.min(i + 5, outputLines.length); j++) {
                const nextLine = outputLines[j].trim();
                
                // Extract status code
                const statusMatch = nextLine.match(/(\d{3})\s+/);
                if (statusMatch) {
                  statusCode = parseInt(statusMatch[1]);
                  if (statusCode >= 400) {
                    isError = true;
                    hasErrors = true;
                    errorMessage = `HTTP Status: ${statusCode}`;
                  }
                }
                
                // Extract response time if available
                const timeMatch = nextLine.match(/(\d+)ms/);
                if (timeMatch) {
                  requestTime = parseInt(timeMatch[1]);
                }
                
                // Check for error messages
                if (nextLine.toLowerCase().includes('error') || nextLine.toLowerCase().includes('failed')) {
                  isError = true;
                  hasErrors = true;
                  errorMessage = nextLine;
                }
              }
              
              // Store request info
              requests.push({
                name: requestName,
                path: requestPath,
                isError: isError,
                statusCode: statusCode,
                duration: requestTime || Math.floor(durationMs / (outputLines.length > 0 ? outputLines.length : 1)),
                errorMessage: errorMessage
              });
            }
          }
          
          // Check for collection-level errors
          if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
            hasErrors = true;
          }
        }
        
        // If no requests were identified, but we have output, create a single request
        if (requests.length === 0 && outputLines.length > 0) {
          requests.push({
            name: 'Collection Run',
            path: '/',
            isError: hasErrors,
            statusCode: null,
            duration: durationMs,
            errorMessage: hasErrors ? 'Unknown error in collection' : null
          });
        }
        
        const status = hasErrors ? 'fail' : 'pass';
        
        // Save collection result
        const resultId = saveResult(db, collection, env, status, durationMs);
        
        // Save individual request results
        for (const request of requests) {
          saveRequestResult(
            db, 
            resultId, 
            request.name, 
            request.isError ? 'fail' : 'pass', 
            request.duration, 
            request.errorMessage
          );
        }
        
        console.log(`Completed collection '${collection}' with environment '${env}'. Status: ${status}`);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        saveResult(db, collection, env, 'error', durationMs, error.message);
        console.error(`Error running collection '${collection}' with environment '${env}':`, error.message);
      }
    }
  }
}

module.exports = { runCollections };
