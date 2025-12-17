import { useState } from 'react'
import { generateDatasets, downloadDataset, type ParseResponse, type DatasetGenerationResponse } from '../services/api'

interface TableData {
  id: string
  name: string
  headers: string[]
  rows: string[][]
  file?: File
}

interface QCRulesData {
  fileName: string
  headers: string[]
  rules: Array<{ [key: string]: string }>
  file?: File
}

interface TableViewerProps {
  tables: TableData[]
  qcRules: QCRulesData | null
  parseResult: ParseResponse | null
  onParseRequest: (result: ParseResponse | null) => void
  generatedDatasets: Map<string, DatasetGenerationResponse>
  onDatasetsGenerated: (datasets: Map<string, DatasetGenerationResponse>) => void
  onTablesChange: (tables: TableData[]) => void
}

export default function TableViewer({ tables, qcRules, parseResult, onParseRequest, generatedDatasets, onDatasetsGenerated, onTablesChange }: TableViewerProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [isGeneratingDatasets, setIsGeneratingDatasets] = useState(false)
  const [datasetError, setDatasetError] = useState<string | null>(null)

  const hasData = tables.length > 0 || qcRules !== null

  const handleGenerateDatasets = async (tableData: ParseResponse['tables'][0]) => {
    setIsGeneratingDatasets(true)
    setDatasetError(null)

    try {
      const result = await generateDatasets(tableData, 10, 10)

      // Update the datasets map
      const newDatasets = new Map(generatedDatasets)
      newDatasets.set(tableData.table_name, result)
      onDatasetsGenerated(newDatasets)

      // Switch to datasets tab
      setActiveTab(`datasets-${tableData.table_name}`)
    } catch (err) {
      setDatasetError(err instanceof Error ? err.message : 'Failed to generate datasets')
      console.error('Dataset generation error:', err)
    } finally {
      setIsGeneratingDatasets(false)
    }
  }

  const handleDownloadDataset = async (
    datasetType: 'valid' | 'invalid',
    tableName: string,
    response: DatasetGenerationResponse
  ) => {
    try {
      const dataset = datasetType === 'valid' ? response.valid_dataset : response.invalid_dataset
      await downloadDataset(datasetType, tableName, dataset)
    } catch (err) {
      console.error('Download error:', err)
      alert(`Failed to download dataset: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (!hasData) {
    return (
      <div className="w-full p-6">
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-gray-600">No data loaded yet</p>
          <p className="mt-1 text-sm text-gray-500">Upload CSV files to view their structure</p>
        </div>
      </div>
    )
  }

  // Set the first item as active if no tab is selected
  const defaultTab = parseResult ? `parsed-${parseResult.tables[0]?.table_name}` : qcRules ? 'qc-rules' : tables[0]?.id
  const currentTab = activeTab || defaultTab
  const currentTable = tables.find(t => t.id === currentTab)
  const showingQC = currentTab === 'qc-rules'
  const showingParsed = currentTab?.startsWith('parsed-')
  const parsedTable = parseResult?.tables.find(t => currentTab === `parsed-${t.table_name}`)

  return (
    <div className="w-full h-full flex flex-col">

      {/* Tabs */}
      <div className="bg-white shadow-md">
        <div className="flex overflow-x-auto scrollbar-thin px-6">
          {/* QC Rules Tab */}
          {qcRules && (
            <button
              onClick={() => setActiveTab('qc-rules')}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-3 transition-all relative ${
                currentTab === 'qc-rules'
                  ? 'text-purple-600 border-b-4 border-purple-500 bg-purple-50'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>QC Rules</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  currentTab === 'qc-rules'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {qcRules.rules.length} rules
                </span>
              </div>
            </button>
          )}

          {/* Table Tabs */}
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => setActiveTab(table.id)}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-3 transition-all relative ${
                currentTab === table.id
                  ? 'text-blue-600 border-b-4 border-blue-500 bg-blue-50'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{table.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  currentTab === table.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {table.headers.length} × {table.rows.length}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onTablesChange(tables.filter(t => t.id !== table.id))
                  }}
                  className="ml-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-colors cursor-pointer"
                  title={`Remove ${table.name}`}
                  role="button"
                  aria-label={`Remove ${table.name}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </div>
            </button>
          ))}

          {/* Parsed Result Tabs */}
          {parseResult?.tables.map(table => (
            <button
              key={`parsed-${table.table_name}`}
              onClick={() => setActiveTab(`parsed-${table.table_name}`)}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-3 transition-all relative ${
                currentTab === `parsed-${table.table_name}`
                  ? 'text-green-600 border-b-4 border-green-500 bg-green-50'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{table.table_name} (Parsed)</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  currentTab === `parsed-${table.table_name}`
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {table.summary.rules_count} rules
                </span>
              </div>
            </button>
          ))}

          {/* Generated Dataset Tabs */}
          {Array.from(generatedDatasets.entries()).map(([tableName, dataset]) => (
            <button
              key={`datasets-${tableName}`}
              onClick={() => setActiveTab(`datasets-${tableName}`)}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-3 transition-all relative ${
                currentTab === `datasets-${tableName}`
                  ? 'text-indigo-600 border-b-4 border-indigo-500 bg-indigo-50'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span>{tableName} (Datasets)</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  currentTab === `datasets-${tableName}`
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {dataset.metadata.num_valid_rows + dataset.metadata.num_invalid_rows} rows
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* QC Rules Content */}
      {showingQC && qcRules && (
        <div className="flex-1 bg-white overflow-auto">
          <div className="p-6">
            <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-200">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <svg className="h-5 w-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {qcRules.fileName}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {qcRules.rules.length} quality check rules
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <tr>
                      {qcRules.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-6 py-4 text-left text-xs font-bold text-purple-900 uppercase tracking-wider border-r border-purple-200 last:border-r-0"
                        >
                          <div className="flex items-center space-x-1">
                            <svg className="h-3 w-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span>{header}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {qcRules.rules.slice(0, 50).map((rule, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-purple-50 transition-colors">
                        {qcRules.headers.map((header, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-purple-100 last:border-r-0"
                          >
                            {rule[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {qcRules.rules.length > 50 && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-t border-purple-200">
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">
                      Showing first 50 of <span className="text-purple-600 font-bold">{qcRules.rules.length}</span> rules
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Parsed Results Content */}
      {showingParsed && parsedTable && (
        <div className="flex-1 bg-white overflow-auto">
          <div className="p-6">
            <div className="bg-white rounded-xl shadow-lg border border-green-200 overflow-hidden">
              {/* Summary Stats */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-200">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-3">
                  <svg className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {parsedTable.table_name} - Parsed Results
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="text-xs text-gray-600 font-medium">Total Rules</div>
                    <div className="text-2xl font-bold text-green-600">{parsedTable.summary.rules_count}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="text-xs text-gray-600 font-medium">With SQL</div>
                    <div className="text-2xl font-bold text-blue-600">{parsedTable.summary.rules_with_sql}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="text-xs text-gray-600 font-medium">Without SQL</div>
                    <div className="text-2xl font-bold text-gray-600">{parsedTable.summary.rules_without_sql}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="text-xs text-gray-600 font-medium">By Level</div>
                    <div className="text-xs mt-1">
                      {Object.entries(parsedTable.summary.by_level).map(([level, count]) => (
                        <div key={level} className="flex justify-between">
                          <span className="text-gray-700">{level}:</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules Table */}
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-green-50 to-emerald-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Level</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">Complexity</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">SQL</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedTable.qc_rules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-green-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{rule.metadata.code}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{rule.metadata.field}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={rule.metadata.name}>
                          {rule.metadata.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            rule.metadata.level === 'BLOCKER' ? 'bg-red-100 text-red-700' :
                            rule.metadata.level === 'ERROR' ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {rule.metadata.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{rule.metadata.type}</td>
                        <td className="px-4 py-3 text-sm">
                          {rule.semantic_analysis && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              {rule.semantic_analysis.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {rule.expression.sql_analysis?.complexity_score !== undefined && (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              rule.expression.sql_analysis.complexity_score < 10 ? 'bg-green-100 text-green-700' :
                              rule.expression.sql_analysis.complexity_score < 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {rule.expression.sql_analysis.complexity_score}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {rule.expression.has_sql ? (
                            <svg className="h-5 w-5 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Generate Datasets Button */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-t border-green-200">
                <button
                  onClick={() => handleGenerateDatasets(parsedTable)}
                  disabled={isGeneratingDatasets || generatedDatasets.has(parsedTable.table_name)}
                  className={`w-full px-6 py-3 text-white font-semibold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                    isGeneratingDatasets
                      ? 'bg-gray-400 cursor-not-allowed'
                      : generatedDatasets.has(parsedTable.table_name)
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isGeneratingDatasets ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Generating Datasets with LLM...</span>
                    </>
                  ) : generatedDatasets.has(parsedTable.table_name) ? (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Datasets Already Generated - View in Datasets Tab</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      <span>Generate Test Datasets with LLM</span>
                    </>
                  )}
                </button>
                {datasetError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <div className="flex items-center space-x-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{datasetError}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Datasets Content */}
      {currentTab?.startsWith('datasets-') && (() => {
        const tableName = currentTab.replace('datasets-', '')
        const datasetResponse = generatedDatasets.get(tableName)
        if (!datasetResponse) return null

        return (
          <div className="flex-1 bg-white overflow-auto">
            <div className="p-6">
              {/* Summary Section */}
              <div className="bg-white rounded-xl shadow-lg border border-indigo-200 overflow-hidden mb-6">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-3">
                    <svg className="h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    {tableName} - Generated Test Datasets
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-600 font-medium">QC Rules Used</div>
                      <div className="text-2xl font-bold text-indigo-600">{datasetResponse.metadata.num_qc_rules}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-600 font-medium">Valid Rows</div>
                      <div className="text-2xl font-bold text-green-600">{datasetResponse.metadata.num_valid_rows}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-600 font-medium">Invalid Rows</div>
                      <div className="text-2xl font-bold text-red-600">{datasetResponse.metadata.num_invalid_rows}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Valid Dataset */}
              <div className="bg-white rounded-xl shadow-lg border border-green-200 overflow-hidden mb-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 flex items-center">
                      <svg className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Valid Dataset (Passes QC Checks)
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">{datasetResponse.valid_dataset.description}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadDataset('valid', tableName, datasetResponse)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-all flex items-center space-x-2 shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-green-50 to-emerald-50 sticky top-0">
                      <tr>
                        {datasetResponse.valid_dataset.headers.map((header, idx) => (
                          <th key={idx} className="px-4 py-3 text-left text-xs font-bold text-green-900 uppercase">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {datasetResponse.valid_dataset.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-green-50 transition-colors">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invalid Dataset */}
              <div className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 border-b border-red-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-semibold text-gray-800 flex items-center">
                      <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Invalid Dataset (Fails QC Checks)
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">{datasetResponse.invalid_dataset.description}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadDataset('invalid', tableName, datasetResponse)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all flex items-center space-x-2 shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-red-50 to-pink-50 sticky top-0">
                      <tr>
                        {datasetResponse.invalid_dataset.headers.map((header, idx) => (
                          <th key={idx} className={`px-4 py-3 text-left text-xs font-bold uppercase ${
                            header === 'violated_rule' ? 'text-red-900 bg-red-100' : 'text-red-900'
                          }`}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {datasetResponse.invalid_dataset.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-red-50 transition-colors">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className={`px-4 py-3 text-sm whitespace-nowrap ${
                              cellIdx === row.length - 1 ? 'text-red-700 font-mono font-semibold bg-red-50' : 'text-gray-900'
                            }`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Table Content */}
      {!showingQC && !showingParsed && !currentTab?.startsWith('datasets-') && currentTable && (
        <div className="flex-1 bg-white overflow-auto">
          <div className="p-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      {currentTable.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                        >
                          <div className="flex items-center space-x-1">
                            <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span>{header}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentTable.rows.slice(0, 50).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-blue-50 transition-colors">
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-100 last:border-r-0"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {currentTable.rows.length > 50 && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">
                      Showing first 50 of <span className="text-blue-600 font-bold">{currentTable.rows.length}</span> rows
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
