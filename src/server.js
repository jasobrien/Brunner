const express = require('express');
const path = require('path');
const { getResults, getRequestResults } = require('./database');
const { getFrequency, setFrequency } = require('./settings');

function startServer(db, scheduleRunsFunc) {
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Store db in global for scheduler access
  global.db = db;
  
  // Parse JSON request bodies
  app.use(express.json());
  
  // Serve static files
  app.use(express.static(path.join(__dirname, '..', 'public')));
  
  // API endpoint to get all results
  app.get('/api/results', (req, res) => {
    try {
      const results = getResults(db);
      console.log(`Fetched ${results.length} results from database`);
      res.json(results);
    } catch (error) {
      console.error('Error fetching results:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // API endpoint to get request results for a specific collection run
  app.get('/api/results/:id/requests', (req, res) => {
    try {
      const { id } = req.params;
      const requestResults = getRequestResults(db, id);
      console.log(`Fetched ${requestResults.length} request results for result ID ${id}`);
      res.json(requestResults);
    } catch (error) {
      console.error(`Error fetching request results for ID ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // New API endpoint to get all request results
  app.get('/api/all-request-results', (req, res) => {
    try {
      console.log('Fetching all request results...');
      
      // Get all results
      const results = getResults(db);
      
      // For each result, get the request results and add the collection info
      const allRequestResults = [];
      
      results.forEach(result => {
        try {
          const requestResults = getRequestResults(db, result.id);
          
          requestResults.forEach(request => {
            allRequestResults.push({
              ...request,
              collection_name: result.collection_name,
              environment: result.environment,
              timestamp: result.timestamp
            });
          });
        } catch (error) {
          console.error(`Error getting request results for ID ${result.id}:`, error);
        }
      });
      
      console.log(`Returning ${allRequestResults.length} request results`);
      res.json(allRequestResults);
    } catch (error) {
      console.error('Error fetching all request results:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get current frequency setting
  app.get('/api/settings/frequency', (req, res) => {
    try {
      const frequency = getFrequency();
      res.json({ frequency });
    } catch (error) {
      console.error('Error getting frequency setting:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update frequency setting
  app.post('/api/settings/frequency', (req, res) => {
    try {
      const { frequency } = req.body;
      
      // Validate frequency
      const validFrequencies = ['1min', '5min', '15min', '30min', '1hr', '4hr', '6hr', '12hr', '24hr'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({ error: 'Invalid frequency value' });
      }
      
      // Update frequency
      setFrequency(frequency);
      
      // Reschedule runs with new frequency
      if (scheduleRunsFunc) {
        scheduleRunsFunc(frequency);
      }
      
      res.json({ success: true, frequency });
    } catch (error) {
      console.error('Error updating frequency setting:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Home route
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });
  
  // Start server
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = { startServer };
