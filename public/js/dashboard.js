// State
let resultsData = [];
let requestResults = [];
let requestsModal;
let selectedEnvironments = new Set(); // Track selected environments for filtering
let allEnvironments = []; // Store all available environments

// Charts
let environmentCharts = {}; // Store environment charts

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard initialized');
  
  // Initialize Bootstrap modal
  requestsModal = new bootstrap.Modal(document.getElementById('requestsModal'));
  
  // Add status display element
  const container = document.querySelector('.container');
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status';
  statusDiv.className = 'alert alert-info my-3';
  statusDiv.textContent = 'Loading results...';
  container.prepend(statusDiv);
  
  // Setup "All Environments" checkbox handler
  document.getElementById('env-filter-all').addEventListener('change', function() {
    const isChecked = this.checked;
    document.querySelectorAll('.env-filter-checkbox:not(#env-filter-all)').forEach(checkbox => {
      checkbox.checked = isChecked;
      
      // Update selected environments set
      const env = checkbox.value;
      if (isChecked) {
        selectedEnvironments.add(env);
      } else {
        selectedEnvironments.delete(env);
      }
    });
    
    updateVisibleEnvironments();
  });
  
  // Setup frequency dropdown handler
  setupFrequencyControl();
  
  // Fetch data and initialize dashboard
  fetchResults();
  
  // Set up refresh interval (every 30 seconds)
  setInterval(fetchResults, 30000);
});

// Setup frequency control
function setupFrequencyControl() {
  const frequencySelect = document.getElementById('frequency-select');
  const frequencyStatus = document.getElementById('frequency-status');
  
  // Load current frequency setting
  fetch('/api/settings/frequency')
    .then(response => response.json())
    .then(data => {
      frequencySelect.value = data.frequency;
      console.log(`Current frequency: ${data.frequency}`);
    })
    .catch(error => {
      console.error('Error loading frequency setting:', error);
    });
  
  // Handle frequency change
  frequencySelect.addEventListener('change', async () => {
    const newFrequency = frequencySelect.value;
    
    // Show loading indicator
    frequencyStatus.innerHTML = '<small class="text-info">Updating...</small>';
    
    try {
      const response = await fetch('/api/settings/frequency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frequency: newFrequency }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update frequency');
      }
      
      const data = await response.json();
      console.log(`Frequency updated to: ${data.frequency}`);
      
      // Show success message that fades out
      frequencyStatus.innerHTML = '<small class="text-success">Updated</small>';
      setTimeout(() => {
        frequencyStatus.innerHTML = '';
      }, 2000);
    } catch (error) {
      console.error('Error updating frequency:', error);
      frequencyStatus.innerHTML = '<small class="text-danger">Error</small>';
      setTimeout(() => {
        frequencyStatus.innerHTML = '';
      }, 2000);
    }
  });
}

// Fetch results from API
async function fetchResults() {
  const statusDiv = document.getElementById('status');
  statusDiv.className = 'alert alert-info my-3';
  statusDiv.textContent = 'Loading results...';
  
  try {
    console.log('Fetching results from API...');
    const response = await fetch('/api/results');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    resultsData = await response.json();
    console.log(`Received ${resultsData.length} results from API`);
    
    // Fetch all request results for charts
    await fetchAllRequestResults();
    
    if (resultsData.length === 0) {
      statusDiv.className = 'alert alert-warning my-3';
      statusDiv.textContent = 'No results found. Make sure collections are running and each has environment files.';
    } else {
      statusDiv.className = 'alert alert-success my-3';
      statusDiv.textContent = `Displaying ${resultsData.length} test runs.`;
    }
    
    // Update UI
    updateEnvironmentFilters();
    updateExecutionSummary();
    updateResultsTable();
  } catch (error) {
    console.error('Error fetching results:', error);
    statusDiv.className = 'alert alert-danger my-3';
    statusDiv.textContent = `Error fetching results: ${error.message}`;
  }
}

// Fetch all request results for all collections
async function fetchAllRequestResults() {
  requestResults = [];
  console.log('Fetching all request results...');
  
  try {
    // Use the more efficient all-request-results endpoint
    const response = await fetch('/api/all-request-results');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch all request results: ${response.statusText}`);
    }
    
    requestResults = await response.json();
    console.log(`Fetched a total of ${requestResults.length} request results`);
    
    // Debug: Log a sample of requestResults to verify data structure
    if (requestResults.length > 0) {
      console.log('Sample request result:', requestResults[0]);
    }
  } catch (error) {
    console.error('Error fetching all request results:', error);
    // Fallback to fetching individual results if the all-request-results endpoint fails
    try {
      // Process the latest 20 results to avoid too many requests
      const recentResults = resultsData.slice(0, 20);
      
      for (const result of recentResults) {
        try {
          console.log(`Fetching request results for result ID ${result.id}...`);
          const response = await fetch(`/api/results/${result.id}/requests`);
          
          if (!response.ok) {
            console.warn(`Failed to fetch request results for ID ${result.id}`);
            continue;
          }
          
          const requests = await response.json();
          console.log(`Got ${requests.length} request results for result ID ${result.id}`);
          
          // Add collection info to each request result for easy filtering later
          for (const request of requests) {
            requestResults.push({
              ...request,
              collection_name: result.collection_name,
              environment: result.environment,
              timestamp: result.timestamp
            });
          }
        } catch (error) {
          console.error(`Error fetching request results for ID ${result.id}:`, error);
        }
      }
    } catch (fallbackError) {
      console.error('Error in fallback request fetch:', fallbackError);
    }
  }
}

// Update environment filters
function updateEnvironmentFilters() {
  // Extract unique environments from results
  allEnvironments = [...new Set(resultsData.map(result => result.environment))].sort();
  
  // Get filter container and remove all checkboxes except "All"
  const filtersContainer = document.getElementById('environment-filters');
  const allCheckbox = document.getElementById('env-filter-all');
  
  // Remove old environment filters except the "All" checkbox
  Array.from(filtersContainer.children).forEach(child => {
    if (child.querySelector('#env-filter-all') === null) {
      filtersContainer.removeChild(child);
    }
  });
  
  // If this is first load, initialize selectedEnvironments with all environments
  if (selectedEnvironments.size === 0) {
    allEnvironments.forEach(env => selectedEnvironments.add(env));
  }
  
  // Create checkbox for each environment
  allEnvironments.forEach(env => {
    const checkboxDiv = document.createElement('div');
    checkboxDiv.className = 'form-check form-check-inline';
    
    const id = `env-filter-${env.replace(/\s+/g, '-').toLowerCase()}`;
    
    checkboxDiv.innerHTML = `
      <input class="form-check-input env-filter-checkbox" type="checkbox" id="${id}" value="${env}" ${selectedEnvironments.has(env) ? 'checked' : ''}>
      <label class="form-check-label env-filter-label" for="${id}">${env}</label>
    `;
    
    filtersContainer.appendChild(checkboxDiv);
    
    // Add event listener to the newly created checkbox
    const checkbox = checkboxDiv.querySelector('input');
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        selectedEnvironments.add(this.value);
      } else {
        selectedEnvironments.delete(this.value);
        // Uncheck "All" checkbox if any environment is unchecked
        allCheckbox.checked = false;
      }
      
      // Check if all environments are selected, then check the "All" checkbox
      if (selectedEnvironments.size === allEnvironments.length) {
        allCheckbox.checked = true;
      }
      
      updateVisibleEnvironments();
    });
  });
  
  // Update "All" checkbox state based on if all environments are selected
  allCheckbox.checked = selectedEnvironments.size === allEnvironments.length;
}

// Update visible environments based on filter
function updateVisibleEnvironments() {
  // Show/hide environment sections based on selected environments
  document.querySelectorAll('.environment-section').forEach(section => {
    const env = section.getAttribute('data-environment');
    if (selectedEnvironments.has(env)) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });
  
  // Update table rows
  document.querySelectorAll('#resultsTable tbody tr').forEach(row => {
    const env = row.querySelector('td:nth-child(2)').textContent;
    if (selectedEnvironments.has(env)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
  
  // Show/hide no executions message
  const noExecutionsMessage = document.getElementById('noExecutionsMessage');
  const visibleSections = document.querySelectorAll('.environment-section:not(.hidden)').length;
  
  if (visibleSections === 0 && allEnvironments.length > 0) {
    noExecutionsMessage.style.display = 'block';
    noExecutionsMessage.innerHTML = '<p>No executions visible with current filter settings.</p>';
  } else if (allEnvironments.length === 0) {
    noExecutionsMessage.style.display = 'block';
    noExecutionsMessage.innerHTML = '<p>No executions found. Run collections to see execution results.</p>';
  } else {
    noExecutionsMessage.style.display = 'none';
  }
}

// Update execution summary
function updateExecutionSummary() {
  const summaryContainer = document.getElementById('executionSummaryContainer');
  const noExecutionsMessage = document.getElementById('noExecutionsMessage');
  
  // Remove all existing environment sections
  Array.from(summaryContainer.children).forEach(child => {
    if (child.id !== 'noExecutionsMessage') {
      summaryContainer.removeChild(child);
    }
  });
  
  if (resultsData.length === 0) {
    noExecutionsMessage.style.display = 'block';
    noExecutionsMessage.innerHTML = '<p>No executions found. Run collections to see execution results.</p>';
    return;
  }
  
  // Group results by environment and then by collection
  const executionsByEnvironment = {};
  
  // First, group by environment
  allEnvironments.forEach(env => {
    executionsByEnvironment[env] = {
      collections: {},
      totalRuns: 0,
      passCount: 0,
      failCount: 0
    };
  });
  
  // Then find the latest execution for each collection in each environment
  resultsData.forEach(result => {
    const env = result.environment;
    const collection = result.collection_name;
    const envData = executionsByEnvironment[env];
    
    envData.totalRuns++;
    if (result.status === 'pass') {
      envData.passCount++;
    } else {
      envData.failCount++;
    }
    
    if (!envData.collections[collection] || 
        new Date(result.timestamp) > new Date(envData.collections[collection].timestamp)) {
      envData.collections[collection] = result;
    }
  });
  
  // Sort environments for consistent order
  const sortedEnvironments = [...allEnvironments].sort((a, b) => {
    // First, try to get the environment "type" by removing numbers (dev1, dev2 -> dev)
    const typeA = a.replace(/[0-9]+$/, '').toLowerCase();
    const typeB = b.replace(/[0-9]+$/, '').toLowerCase();
    
    // If types are different, sort by type
    if (typeA !== typeB) {
      return typeA.localeCompare(typeB);
    }
    
    // If types are the same, sort by the full name
    return a.localeCompare(b);
  });
  
  // Group environments by type (dev, staging, prod, etc.)
  const environmentGroups = {};
  
  sortedEnvironments.forEach(env => {
    // Get base type by removing trailing numbers
    const envType = env.replace(/[0-9]+$/, '').toLowerCase();
    
    if (!environmentGroups[envType]) {
      environmentGroups[envType] = [];
    }
    
    environmentGroups[envType].push(env);
  });
  
  // Create sections for each environment group
  Object.entries(environmentGroups).forEach(([groupType, groupEnvironments]) => {
    // Skip if all environments in this group are filtered out
    if (!groupEnvironments.some(env => selectedEnvironments.has(env))) {
      return;
    }
    
    // Create environment group section
    const groupSection = document.createElement('div');
    groupSection.className = 'environment-group mb-4';
    
    // Create group header if there's more than one environment in the group
    if (groupEnvironments.length > 1) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'environment-group-header';
      groupHeader.innerHTML = `<h2 class="h4 mb-3">${groupType.charAt(0).toUpperCase() + groupType.slice(1)} Environments</h2>`;
      groupSection.appendChild(groupHeader);
    }
    
    // Add each environment in the group
    groupEnvironments.forEach(env => {
      const envData = executionsByEnvironment[env];
      const collections = Object.values(envData.collections);
      
      // Skip if this environment is filtered out
      if (!selectedEnvironments.has(env)) {
        return;
      }
      
      // Sort collections alphabetically
      collections.sort((a, b) => a.collection_name.localeCompare(b.collection_name));
      
      // Create environment section
      const environmentSection = document.createElement('div');
      environmentSection.className = `environment-section`;
      environmentSection.setAttribute('data-environment', env);
      
      // Create header with environment name and stats
      const header = document.createElement('div');
      header.className = 'environment-header';
      header.innerHTML = `
        <h3 class="h5 mb-0">${env}</h3>
        <div>
          <span class="badge bg-success me-1">${envData.passCount} Passed</span>
          <span class="badge bg-danger me-1">${envData.failCount} Failed</span>
          <span class="badge bg-info">${envData.totalRuns} Total Runs</span>
        </div>
      `;
      
      // Create row for collection cards
      const row = document.createElement('div');
      row.className = 'row';
      
      // Determine card size based on collection count
      let colClass = 'col-md-3 col-sm-6 mb-3'; // Default for <10 collections
      
      if (collections.length > 20) {
        colClass = 'col-md-2 col-sm-4 col-6 mb-2'; // Extra small for many collections
      } else if (collections.length > 15) {
        colClass = 'col-md-2 col-sm-4 mb-2'; // Very small for lots of collections
      } else if (collections.length > 10) {
        colClass = 'col-lg-2 col-md-3 col-sm-4 mb-2'; // Smaller for more collections
      }
      
      // Add collection cards to the row
      collections.forEach(execution => {
        // Get all requests for this execution
        const executionRequests = requestResults.filter(req => 
          req.collection_name === execution.collection_name && 
          req.environment === execution.environment &&
          new Date(req.timestamp).getTime() === new Date(execution.timestamp).getTime()
        );
        
        const requestCount = executionRequests.length;
        const passedCount = executionRequests.filter(req => req.status === 'pass').length;
        const failedCount = requestCount - passedCount;
        
        const col = document.createElement('div');
        col.className = colClass;
        
        col.innerHTML = `
          <div class="card execution-card ${execution.status === 'pass' ? 'pass' : 'fail'}">
            <div class="card-body">
              <h5 class="card-title collection-title">${execution.collection_name}</h5>
              <p class="execution-info">
                <strong>Last:</strong> ${moment(execution.timestamp).format('MMM DD, HH:mm')}
              </p>
              <p class="execution-info">
                <strong>Time:</strong> ${execution.duration_ms}ms
              </p>
              <p class="execution-info">
                <strong>Requests:</strong> ${requestCount} 
                (${passedCount}/${failedCount})
              </p>
              <span class="status-badge ${execution.status}">${execution.status.toUpperCase()}</span>
              <button class="btn btn-sm btn-outline-primary float-end btn-view mt-2" 
                data-result-id="${execution.id}">Details</button>
            </div>
          </div>
        `;
        
        row.appendChild(col);
      });
      
      // Append header and row to the environment section
      environmentSection.appendChild(header);
      environmentSection.appendChild(row);
      
      // Append environment section to the group
      groupSection.appendChild(environmentSection);
    });
    
    // Add the group section to the container
    summaryContainer.appendChild(groupSection);
  });
  
  // If no visible sections were created, show the no executions message
  if (summaryContainer.children.length === 1) { // Only the noExecutionsMessage
    noExecutionsMessage.style.display = 'block';
    noExecutionsMessage.innerHTML = '<p>No executions visible with current filter settings.</p>';
  } else {
    noExecutionsMessage.style.display = 'none';
  }
  
  // Add event listeners to the view buttons
  document.querySelectorAll('.btn-view').forEach(button => {
    button.addEventListener('click', async (e) => {
      const resultId = e.target.getAttribute('data-result-id');
      await showRequestResults(resultId);
    });
  });
}

// Update results table
function updateResultsTable() {
  const tableBody = document.querySelector('#resultsTable tbody');
  tableBody.innerHTML = '';
  
  resultsData.forEach(result => {
    const row = document.createElement('tr');
    
    const timestamp = moment(result.timestamp).format('YYYY-MM-DD HH:mm:ss');
    const statusClass = result.status === 'pass' ? 'status-pass' : 'status-fail';
    
    row.innerHTML = `
      <td>${result.collection_name}</td>
      <td>${result.environment}</td>
      <td>${timestamp}</td>
      <td><span class="${statusClass}">${result.status.toUpperCase()}</span></td>
      <td>${result.duration_ms}</td>
      <td>
        <button class="btn btn-sm btn-primary btn-view" data-result-id="${result.id}">
          View Requests
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  // Add event listeners to view buttons
  document.querySelectorAll('.btn-view').forEach(button => {
    button.addEventListener('click', async (e) => {
      const resultId = e.target.getAttribute('data-result-id');
      await showRequestResults(resultId);
    });
  });
  
  // After creating the table rows, update their visibility based on filters
  updateVisibleEnvironments();
}

// Show request results in modal
async function showRequestResults(resultId) {
  try {
    const response = await fetch(`/api/results/${resultId}/requests`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch request results: ${response.statusText}`);
    }
    
    const requests = await response.json();
    console.log('Request results:', requests);
    
    // Find the related collection result to show any collection-level errors
    const collectionResult = resultsData.find(r => r.id === parseInt(resultId));
    
    const tableBody = document.querySelector('#requestsTable tbody');
    tableBody.innerHTML = '';
    
    if (requests.length === 0) {
      // No request-level results, but we might have collection-level error
      if (collectionResult && collectionResult.error_message) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td colspan="4">No individual request details available</td>
          <td>${collectionResult.error_message || 'Unknown error'}</td>
        `;
        tableBody.appendChild(row);
      } else {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4">No request details available</td>`;
        tableBody.appendChild(row);
      }
    } else {
      // Show individual request results
      requests.forEach(request => {
        const row = document.createElement('tr');
        const statusClass = request.status === 'pass' ? 'status-pass' : 'status-fail';
        
        row.innerHTML = `
          <td>${request.request_name}</td>
          <td><span class="${statusClass}">${request.status.toUpperCase()}</span></td>
          <td>${request.duration_ms}</td>
          <td class="text-break">${request.error_message || ''}</td>
        `;
        
        tableBody.appendChild(row);
      });
      
      // If there's a collection-level error but no request has an error, show it as an extra row
      if (collectionResult && 
          collectionResult.error_message && 
          !requests.some(r => r.error_message)) {
        const row = document.createElement('tr');
        row.className = 'table-danger';
        row.innerHTML = `
          <td>Collection Error</td>
          <td><span class="status-fail">ERROR</span></td>
          <td>-</td>
          <td class="text-break">${collectionResult.error_message}</td>
        `;
        tableBody.appendChild(row);
      }
    }
    
    // Update modal title to include collection name
    if (collectionResult) {
      document.querySelector('.modal-title').textContent = 
        `Request Results - ${collectionResult.collection_name} (${collectionResult.environment})`;
    }
    
    requestsModal.show();
  } catch (error) {
    console.error('Error fetching request results:', error);
    alert(`Error fetching request details: ${error.message}`);
  }
}

// Update charts
function updateCharts() {
  if (resultsData.length === 0 && requestResults.length === 0) {
    console.log('No data available for charts');
    return;
  }
  
  try {
    updateEnvironmentCharts();
  } catch (error) {
    console.error('Error updating charts:', error);
    // If there's an error with the charts, let's try to destroy them and recreate
    try {
      destroyCharts();
      updateEnvironmentCharts();
    } catch (retryError) {
      console.error('Failed to recreate charts after error:', retryError);
    }
  }
}

// Safely destroy existing charts
function destroyCharts() {
  // Destroy environment charts
  Object.keys(environmentCharts).forEach(env => {
    try {
      if (environmentCharts[env]) {
        environmentCharts[env].destroy();
        environmentCharts[env] = null;
      }
    } catch (error) {
      console.warn(`Error destroying environment chart for ${env}:`, error);
    }
  });
  
  // Reset environment charts object
  environmentCharts = {};
}

// Update environment charts
function updateEnvironmentCharts() {
  // Get unique environments
  const environments = [...new Set(requestResults.map(result => result.environment))];
  console.log(`Found ${environments.length} unique environments:`, environments);
  
  // Hide message if we have environments
  document.getElementById('noEnvironmentsMessage').style.display = 
    environments.length > 0 ? 'none' : 'block';
  
  // Clear previous charts
  const chartsRow = document.getElementById('environmentChartsRow');
  
  // Remove all existing chart containers except the no environments message
  Array.from(chartsRow.children).forEach(child => {
    if (child.id !== 'noEnvironmentsMessage') {
      chartsRow.removeChild(child);
    }
  });
  
  // Update the no environments message to be more informative
  if (environments.length === 0) {
    const noEnvMessage = document.getElementById('noEnvironmentsMessage');
    noEnvMessage.style.display = 'block';
    noEnvMessage.innerHTML = `
      <p>No environments found. Make sure:</p>
      <ul class="text-start">
        <li>Collections have an 'environments' folder</li>
        <li>Environment files are placed in this folder</li>
        <li>Collections have been run at least once</li>
      </ul>
    `;
    console.log('No environments found, skipping chart creation');
    return;
  }
  
  // Create column width based on number of environments
  const colWidth = Math.max(3, Math.min(12 / environments.length, 4));
  
  // Create a chart for each environment
  environments.forEach(env => {
    // Create container for this environment's chart
    const colDiv = document.createElement('div');
    colDiv.className = `col-md-${colWidth} col-sm-6 environment-chart-container`;
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'environment-chart-title';
    titleDiv.textContent = env;
    
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    
    const canvas = document.createElement('canvas');
    canvas.id = `env-chart-${env.replace(/\s+/g, '-').toLowerCase()}`;
    
    canvasContainer.appendChild(canvas);
    colDiv.appendChild(titleDiv);
    colDiv.appendChild(canvasContainer);
    chartsRow.appendChild(colDiv);
    
    // Get pass/fail data for this environment based on individual requests
    const envRequests = requestResults.filter(result => result.environment === env);
    
    // Skip if no requests for this environment
    if (envRequests.length === 0) {
      console.log(`No request data for environment ${env}, skipping chart`);
      return;
    }
    
    const passCount = envRequests.filter(result => result.status === 'pass').length;
    const failCount = envRequests.filter(result => result.status !== 'pass').length;
    
    // Create chart
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (environmentCharts[env]) {
      environmentCharts[env].destroy();
    }
    
    environmentCharts[env] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Pass', 'Fail'],
        datasets: [{
          data: [passCount, failCount],
          backgroundColor: ['#198754', '#dc3545'],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: {
                size: 10
              }
            }
          },
          title: {
            display: true,
            text: `${envRequests.length} Requests`
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.formattedValue;
                const total = passCount + failCount;
                const percentage = Math.round((context.raw / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  });
}

// Generate color based on index
function getColorForIndex(index) {
  const colors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];
  
  return colors[index % colors.length];
}

// Clean up before page unload
window.addEventListener('beforeunload', () => {
  destroyCharts();
});
