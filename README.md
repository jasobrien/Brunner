# Brunner

Brunner is a powerful tool for running [Bruno](https://www.usebruno.com/) API collections across multiple environments, tracking results, and visualizing performance in a dashboard.

## Features

- **Automated Collection Execution**

  - Automatically discovers and runs Bruno collections
  - Configurable execution frequency (1 min to 24 hours)
  - Support for multiple environments per collection
  - Collection-level and request-level result tracking

- **Comprehensive Dashboard**
  - Environment-grouped results
  - Real-time status of all collections
  - Pass/fail statistics for environments and collections
  - Request-level details with timing information
  - Filter results by environment
- **Advanced Visualization**
  - Environment-based organization
  - Request-level timing analysis
  - Collection pass/fail status
  - Error highlighting and display
- **Execution Control**

  - Adjustable run frequency via UI
  - Execution history tracking
  - Collection grouping by environment

- **Deployment Options**
  - Run as a standalone Node.js application
  - Deploy using Docker for easy containerization
  - Persistent storage of results across restarts

## Prerequisites

- Node.js 14 or higher (for standalone deployment)
- npm or yarn (for standalone deployment)
- Docker and Docker Compose (for Docker deployment)
- Bruno CLI (installed automatically)

## Installation

### Standalone Installation

1. Clone this repository:

   ```
   git clone https://github.com/jasobrien/brunner.git
   cd brunner
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Ensure the Bruno CLI is executable (done automatically in postinstall):
   ```
   chmod +x node_modules/.bin/bru
   ```
4. Run application

```
 npm start
```

### Docker Installation

1. Clone this repository:

   ```
   git clone https://github.com/jasobrien/brunner.git
   cd brunner
   ```

2. Build and start the Docker container:
   ```
   docker-compose up -d
   ```

## Setup Collections

1. Place your Bruno collections in the `Collections` folder:

   ```
   Collections/
     ├── MyCollection1/
     ├── MyCollection2/
     └── ...
   ```

2. Ensure each collection has an `environments` folder with one or more environment files:

   ```
   Collections/
     └── MyCollection/
         └── environments/
             ├── dev.env
             ├── staging.env
             └── prod.env
   ```

   Note: Collections without environment files will be skipped.

## Usage

### Starting the Application

#### Standalone Mode

Run the following command to start Brunner:
