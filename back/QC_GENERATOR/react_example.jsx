/**
 * React Frontend Example
 *
 * Shows how your React UI can interact with the Node.js backend
 * to parse QC rules for a selected dataflow.
 */

import React, { useState } from 'react';

const QCParserComponent = () => {
  const [dataflowId, setDataflowId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleParse = async () => {
    if (!dataflowId) {
      setError('Please select a dataflow');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call your Node.js backend
      const response = await fetch('http://localhost:3000/api/parse-dataflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataflowId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse QC rules');
      }

      setResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qc-parser-container">
      <h1>QC Rule Parser</h1>

      {/* Dataflow Selection */}
      <div className="dataflow-selector">
        <label>
          Select Dataflow:
          <select
            value={dataflowId}
            onChange={(e) => setDataflowId(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Select Dataflow --</option>
            <option value="12345">Dataflow 12345 - Water Quality</option>
            <option value="67890">Dataflow 67890 - Aggregated Data</option>
          </select>
        </label>

        <button onClick={handleParse} disabled={loading || !dataflowId}>
          {loading ? 'Parsing...' : 'Parse QC Rules'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading">
          <p>Processing dataflow...</p>
          <p>Downloading files from R3 API...</p>
          <p>Parsing QC rules...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="results">
          <h2>Parse Results</h2>

          {/* Summary */}
          <div className="summary">
            <h3>Summary</h3>
            <table>
              <tbody>
                <tr>
                  <td>Table Name:</td>
                  <td><strong>{result.table_name}</strong></td>
                </tr>
                <tr>
                  <td>Total QC Rules:</td>
                  <td>{result.summary.total_qc_rules}</td>
                </tr>
                <tr>
                  <td>Rules for This Table:</td>
                  <td><strong>{result.summary.rules_for_this_table}</strong></td>
                </tr>
                <tr>
                  <td>With SQL:</td>
                  <td>{result.summary.rules_with_sql}</td>
                </tr>
                <tr>
                  <td>Without SQL:</td>
                  <td>{result.summary.rules_without_sql}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* By Level */}
          <div className="by-level">
            <h3>Rules by Level</h3>
            <ul>
              {Object.entries(result.summary.by_level).map(([level, count]) => (
                <li key={level}>
                  <span className={`badge badge-${level.toLowerCase()}`}>
                    {level}
                  </span>
                  : {count} rules
                </li>
              ))}
            </ul>
          </div>

          {/* By Type */}
          <div className="by-type">
            <h3>Rules by Type</h3>
            <ul>
              {Object.entries(result.summary.by_type).map(([type, count]) => (
                <li key={type}>
                  <strong>{type}</strong>: {count} rules
                </li>
              ))}
            </ul>
          </div>

          {/* QC Rules List */}
          <div className="qc-rules">
            <h3>QC Rules ({result.qc_rules.length})</h3>
            <table className="rules-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Field</th>
                  <th>Name</th>
                  <th>Level</th>
                  <th>Type</th>
                  <th>Has SQL</th>
                </tr>
              </thead>
              <tbody>
                {result.qc_rules.map((rule, index) => (
                  <tr key={index}>
                    <td><code>{rule.metadata.code}</code></td>
                    <td>{rule.metadata.field}</td>
                    <td>{rule.metadata.name}</td>
                    <td>
                      <span className={`badge badge-${rule.metadata.level.toLowerCase()}`}>
                        {rule.metadata.level}
                      </span>
                    </td>
                    <td>{rule.metadata.type}</td>
                    <td>
                      {rule.expression.has_sql ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span className="badge badge-secondary">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export Button */}
          <div className="actions">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `qc-rules-${result.table_name}.json`;
                a.click();
              }}
            >
              Download JSON
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .qc-parser-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dataflow-selector {
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .dataflow-selector select {
          padding: 8px;
          font-size: 14px;
          min-width: 300px;
        }

        .dataflow-selector button {
          padding: 8px 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .dataflow-selector button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .loading {
          padding: 20px;
          background-color: #f0f0f0;
          border-radius: 4px;
        }

        .error {
          padding: 20px;
          background-color: #f8d7da;
          color: #721c24;
          border-radius: 4px;
        }

        .results {
          margin-top: 20px;
        }

        .summary table {
          width: 100%;
          max-width: 600px;
          border-collapse: collapse;
        }

        .summary td {
          padding: 8px;
          border-bottom: 1px solid #ddd;
        }

        .by-level, .by-type {
          margin-top: 20px;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: bold;
        }

        .badge-blocker {
          background-color: #dc3545;
          color: white;
        }

        .badge-warning {
          background-color: #ffc107;
          color: black;
        }

        .badge-info {
          background-color: #17a2b8;
          color: white;
        }

        .badge-error {
          background-color: #ff5722;
          color: white;
        }

        .badge-success {
          background-color: #28a745;
          color: white;
        }

        .badge-secondary {
          background-color: #6c757d;
          color: white;
        }

        .rules-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .rules-table th,
        .rules-table td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        .rules-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }

        .rules-table tr:hover {
          background-color: #f5f5f5;
        }

        .actions {
          margin-top: 20px;
        }

        .actions button {
          padding: 10px 20px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default QCParserComponent;
