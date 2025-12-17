/**
 * Node.js Backend Example
 *
 * Shows how your Node.js backend can:
 * 1. Download files from R3 API
 * 2. Upload to Python QC Parser Service
 * 3. Return results to React frontend
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Configuration
const R3_API_URL = 'https://r3-api.example.com'; // Your R3 API URL
const QC_PARSER_SERVICE_URL = 'http://localhost:5000'; // Python service URL

/**
 * Download files from R3 API
 */
async function downloadFromR3(dataflowId) {
  try {
    // Download QC file
    const qcResponse = await axios.get(`${R3_API_URL}/dataflows/${dataflowId}/qc`, {
      responseType: 'arraybuffer'
    });

    // Download Table schema file
    const tableResponse = await axios.get(`${R3_API_URL}/dataflows/${dataflowId}/table`, {
      responseType: 'arraybuffer'
    });

    return {
      qcFile: Buffer.from(qcResponse.data),
      tableFile: Buffer.from(tableResponse.data),
      qcFilename: 'QC.csv',
      tableFilename: 'AggregatedDataByWaterBody.csv' // Or extract from response headers
    };
  } catch (error) {
    throw new Error(`Failed to download from R3: ${error.message}`);
  }
}

/**
 * Parse QC files using Python service
 */
async function parseQCFiles(qcFileBuffer, tableFileBuffer, qcFilename, tableFilename) {
  try {
    const formData = new FormData();

    // Append files as buffers with filenames
    formData.append('qc_file', qcFileBuffer, {
      filename: qcFilename,
      contentType: 'text/csv'
    });

    formData.append('table_file', tableFileBuffer, {
      filename: tableFilename,
      contentType: 'text/csv'
    });

    // Send to Python service
    const response = await axios.post(
      `${QC_PARSER_SERVICE_URL}/api/v1/parse`,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Parser service error: ${error.response.data.error || error.message}`);
    }
    throw new Error(`Failed to parse QC files: ${error.message}`);
  }
}

/**
 * Main function - combines download and parse
 */
async function processDataflow(dataflowId) {
  try {
    console.log(`Processing dataflow: ${dataflowId}`);

    // Step 1: Download files from R3
    console.log('Downloading files from R3 API...');
    const { qcFile, tableFile, qcFilename, tableFilename } = await downloadFromR3(dataflowId);
    console.log(`Downloaded: ${qcFilename} (${qcFile.length} bytes)`);
    console.log(`Downloaded: ${tableFilename} (${tableFile.length} bytes)`);

    // Step 2: Parse with Python service
    console.log('Parsing QC rules...');
    const result = await parseQCFiles(qcFile, tableFile, qcFilename, tableFilename);

    // Step 3: Return results
    console.log('Parse complete!');
    console.log(`- Table: ${result.table_name}`);
    console.log(`- Total QC rules: ${result.summary.total_qc_rules}`);
    console.log(`- Rules for this table: ${result.summary.rules_for_this_table}`);
    console.log(`- With SQL: ${result.summary.rules_with_sql}`);
    console.log(`- By level:`, result.summary.by_level);

    return result;
  } catch (error) {
    console.error('Error processing dataflow:', error.message);
    throw error;
  }
}

// =============================================================================
// Express.js API Endpoint Example
// =============================================================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

/**
 * API endpoint for React frontend
 * POST /api/parse-dataflow
 * Body: { dataflowId: "12345" }
 */
app.post('/api/parse-dataflow', async (req, res) => {
  try {
    const { dataflowId } = req.body;

    if (!dataflowId) {
      return res.status(400).json({ error: 'dataflowId is required' });
    }

    // Process the dataflow
    const result = await processDataflow(dataflowId);

    // Return to React frontend
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node.js backend running on port ${PORT}`);
});

// =============================================================================
// Testing locally (without R3 API)
// =============================================================================

/**
 * Test function using local files
 */
async function testWithLocalFiles() {
  try {
    console.log('Testing with local files...');

    // Read local files
    const qcFile = fs.readFileSync('data/QC.csv');
    const tableFile = fs.readFileSync('data/AggregatedDataByWaterBody.csv');

    // Parse
    const result = await parseQCFiles(
      qcFile,
      tableFile,
      'QC.csv',
      'AggregatedDataByWaterBody.csv'
    );

    console.log('Success!');
    console.log(JSON.stringify(result.summary, null, 2));
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Uncomment to test locally
// testWithLocalFiles();

module.exports = {
  processDataflow,
  parseQCFiles,
  downloadFromR3
};
