const path = require('path');
const { setupDatabase } = require('./database');
const { runCollections } = require('./runner');
const { startServer } = require('./server');
const { getFrequency, setFrequency } = require('./settings');

// Setup paths
const collectionsPath = path.join(__dirname, '..', 'Collections');

// Frequency periods in milliseconds
const FREQUENCY_OPTIONS = {
  '1min': 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1hr': 60 * 60 * 1000,
  '4hr': 4 * 60 * 60 * 1000,
  '6hr': 6 * 60 * 60 * 1000,
  '12hr': 12 * 60 * 60 * 1000,
  '24hr': 24 * 60 * 60 * 1000
};

// Variable to store the current timer
let scheduledTimer = null;

// Function to schedule collection runs
function scheduleRuns(frequency) {
  // Clear any existing scheduled timer
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
  }
  
  // Get interval duration in milliseconds
  const interval = FREQUENCY_OPTIONS[frequency] || FREQUENCY_OPTIONS['1hr'];
  
  // Set up new scheduled timer
  scheduledTimer = setInterval(async () => {
    try {
      console.log(`Running scheduled collection run (${frequency} interval)...`);
      await runCollections(collectionsPath);
      console.log('Scheduled collection run completed.');
    } catch (error) {
      console.error('Error in scheduled collection run:', error);
    }
  }, interval);
  
  console.log(`Scheduled runs set to every ${frequency}`);
}

async function main() {
  try {
    console.log('Initializing Brunner...');
    
    // Initialize storage
    console.log('Setting up storage...');
    setupDatabase();
    
    // Start web server first so it's ready when tests complete
    console.log('Starting web server...');
    startServer(scheduleRuns);
    
    // Run all collections
    console.log('Running collections...');
    await runCollections(collectionsPath);
    console.log('Initial collection run completed.');
    
    // Get current frequency from settings
    const frequency = getFrequency() || '1hr';
    console.log(`Setting up scheduled runs (every ${frequency})...`);
    
    // Schedule periodic collection runs
    scheduleRuns(frequency);
    
    console.log('Brunner initialization complete.');
  } catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
  }
}

// Export the scheduler for API access
module.exports = { scheduleRuns, FREQUENCY_OPTIONS };

// Add unhandled error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

main().catch(error => {
  console.error('Fatal error in main process:', error);
  process.exit(1);
});
