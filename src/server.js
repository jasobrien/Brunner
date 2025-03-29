const express = require('express');
const path = require('path');
const { getResults, getRequestResults, getAllRequestResults } = require('./database');
const { getFrequency, setFrequency } = require('./settings');

function startServer(scheduleRunsFunc) {
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Parse JSON request bodies
  app.use(express.json());
  
  // Serve static files
  app.use(express.static(path.join(__dirname, '..', 'public')));
  
  // API endpoint to get all results
  app.get('/api/results', (req, res) => {
    try {
      const results = getResults();
      console.log(`Fetched ${results.length} results from storage`);
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
      const requestResults = getRequestResults(null, id);
      console.log(`Fetched ${requestResults.length} request results for result ID ${id}`);
      res.json(requestResults);
    } catch (error) {
      console.error(`Error fetching request results for ID ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // API endpoint to get all request results
  app.get('/api/all-request-results', (req, res) => {
    try {
      console.log('Fetching all request results...');
      const allRequestResults = getAllRequestResults();
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
