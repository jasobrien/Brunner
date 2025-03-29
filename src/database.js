const fs = require('fs');
const path = require('path');

// Directory for storing flat files
const DATA_DIR = path.join(__dirname, '..', 'data');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

// Ensure data files exist and are initialized
function ensureDataFiles() {
  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`Creating data directory at: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // Initialize results file if it doesn't exist
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log(`Creating results file at: ${RESULTS_FILE}`);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify([]));
  }
  
  // Initialize requests file if it doesn't exist
  if (!fs.existsSync(REQUESTS_FILE)) {
    console.log(`Creating requests file at: ${REQUESTS_FILE}`);
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify([]));
  }
}

// Set up database (file structure)
function setupDatabase() {
  console.log(`Setting up flat file storage at ${DATA_DIR}`);
  
  try {
    ensureDataFiles();
    const results = loadResults();
    console.log(`Storage contains ${results.length} results`);
  } catch (error) {
    console.error(`Error setting up data files: ${error.message}`);
    // Create empty data files if there was an error loading them
    console.log('Creating empty data files');
    ensureDataFiles();
  }
}

// Load all results from file
function loadResults() {
  try {
    ensureDataFiles();
    const data = fs.readFileSync(RESULTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading results:', error);
    return [];
  }
}

// Load all request results from file
function loadRequestResults() {
  try {
    ensureDataFiles();
    const data = fs.readFileSync(REQUESTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading request results:', error);
    return [];
  }
}

// Save results to file
function saveAllResults(results) {
  try {
    ensureDataFiles();
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error saving results:', error);
    throw error;
  }
}

// Save request results to file
function saveAllRequestResults(requests) {
  try {
    ensureDataFiles();
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Error saving request results:', error);
    throw error;
  }
}

// Save a single result and return its ID
function saveResult(unused, collectionName, environment, status, durationMs, errorMessage = null) {
  try {
    ensureDataFiles();
    const results = loadResults();
    
    // Generate a new ID (use timestamp + random to ensure uniqueness)
    const id = Date.now() + Math.floor(Math.random() * 1000);
    
    // Create the new result object
    const newResult = {
      id,
      collection_name: collectionName,
      environment,
      timestamp: new Date().toISOString(),
      status,
      duration_ms: durationMs,
      error_message: errorMessage
    };
    
    // Add to results array
    results.push(newResult);
    
    // Save the updated results
    saveAllResults(results);
    
    console.log(`Saved result: ${collectionName}/${environment} - ${status} (${durationMs}ms) - ID: ${id}`);
    return id;
  } catch (error) {
    console.error('Error saving result:', error);
    throw error;
  }
}

// Save a single request result
function saveRequestResult(unused, resultId, requestName, status, durationMs, errorMessage = null) {
  try {
    ensureDataFiles();
    const requests = loadRequestResults();
    
    // Generate a new ID
    const id = Date.now() + Math.floor(Math.random() * 1000);
    
    // Create the new request result object
    const newRequest = {
      id,
      result_id: resultId,
      request_name: requestName,
      status,
      duration_ms: durationMs,
      error_message: errorMessage
    };
    
    // Add to requests array
    requests.push(newRequest);
    
    // Save the updated requests
    saveAllRequestResults(requests);
    
    console.log(`Saved request result: ${requestName} for result ID ${resultId} - ${status} (${durationMs}ms)`);
    return id;
  } catch (error) {
    console.error('Error saving request result:', error);
    throw error;
  }
}

// Get all results, sorted by timestamp descending
function getResults() {
  try {
    ensureDataFiles();
    const results = loadResults();
    // Sort by timestamp (newest first)
    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('Error getting results:', error);
    throw error;
  }
}

// Get request results for a specific result ID
function getRequestResults(unused, resultId) {
  try {
    ensureDataFiles();
    const resultIdNum = parseInt(resultId);
    
    // Find the parent result
    const results = loadResults();
    const parentResult = results.find(r => r.id === resultIdNum);
    console.log(`Retrieved parent result for ID ${resultId}:`, parentResult);
    
    // Get all requests for this result ID
    const requests = loadRequestResults();
    const requestResults = requests.filter(r => r.result_id === resultIdNum);
    
    // If we have no request results but have a collection error, create a dummy request result
    if (requestResults.length === 0 && parentResult && parentResult.error_message) {
      console.log(`Creating dummy request result for collection error in ID ${resultId}`);
      return [{
        id: -1,
        result_id: resultIdNum,
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

// Get all request results for all collections
function getAllRequestResults() {
  try {
    ensureDataFiles();
    // Get all results
    const results = loadResults();
    const requests = loadRequestResults();
    
    // Map requests to include collection info
    const allRequests = [];
    
    results.forEach(result => {
      const resultRequests = requests.filter(req => req.result_id === result.id);
      
      resultRequests.forEach(request => {
        allRequests.push({
          ...request,
          collection_name: result.collection_name,
          environment: result.environment,
          timestamp: result.timestamp
        });
      });
    });
    
    console.log(`Returning ${allRequests.length} request results`);
    return allRequests;
  } catch (error) {
    console.error('Error getting all request results:', error);
    throw error;
  }
}

module.exports = {
  setupDatabase,
  saveResult,
  saveRequestResult,
  getResults,
  getRequestResults,
  getAllRequestResults
};
