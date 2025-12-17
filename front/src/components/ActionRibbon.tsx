import { useState } from 'react'
import { parseQCAndTables, generateDatasets } from '../services/api'
import type { ParseResponse, DatasetGenerationResponse } from '../services/api'

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

interface ActionRibbonProps {
  tables: TableData[]
  qcRules: QCRulesData | null
  onTablesChange: (tables: TableData[]) => void
  onQcRulesChange: (rules: QCRulesData | null) => void
  onParseComplete: (result: ParseResponse) => void
  isParsing: boolean
  setIsParsing: (isParsing: boolean) => void
  parseResult: ParseResponse | null
  generatedDatasets: Map<string, DatasetGenerationResponse>
  onDatasetsGenerated: (datasets: Map<string, DatasetGenerationResponse>) => void
}

export default function ActionRibbon({
  tables,
  qcRules,
  onTablesChange,
  onQcRulesChange,
  onParseComplete,
  isParsing,
  setIsParsing,
  parseResult,
  generatedDatasets,
  onDatasetsGenerated
}: ActionRibbonProps) {
  const [isGeneratingDatasets, setIsGeneratingDatasets] = useState(false)

  const handleTableUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newTables: TableData[] = []
    let filesProcessed = 0

    // Use PapaParse
    import('papaparse').then((Papa) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        file.text().then((text) => {
          Papa.default.parse(text, {
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data.length > 0) {
                const headers = results.data[0] as string[]
                const rows = results.data.slice(1) as string[][]

                newTables.push({
                  id: crypto.randomUUID(),
                  name: file.name,
                  headers,
                  rows,
                  file
                })
              }

              filesProcessed++
              if (filesProcessed === files.length) {
                onTablesChange([...tables, ...newTables])
              }
            }
          })
        })
      }
    })
  }

  const handleQcUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    file.text().then((text) => {
      import('papaparse').then((Papa) => {
        Papa.default.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const headers = results.meta.fields || []
            const rules = results.data as Array<{ [key: string]: string }>

            onQcRulesChange({
              fileName: file.name,
              headers,
              rules,
              file
            })
          }
        })
      })
    })
  }

  const handleParseJSON = async () => {
    if (!qcRules || tables.length === 0) {
      alert('Please upload QC rules and at least one table first')
      return
    }

    setIsParsing(true)
    try {
      const result = await parseQCAndTables(qcRules.file!, tables.map(t => t.file!))
      onParseComplete(result)
    } catch (error) {
      console.error('Parse error:', error)
      alert('Failed to parse: ' + (error as Error).message)
    } finally {
      setIsParsing(false)
    }
  }

  const handleClearAll = () => {
    if (confirm('Clear all uploaded files and results?')) {
      onTablesChange([])
      onQcRulesChange(null)
      onParseComplete(null as any)
    }
  }

  const handleGenerateDatasets = async () => {
    if (!parseResult || parseResult.tables.length === 0) {
      alert('Please parse your data first before generating datasets')
      return
    }

    setIsGeneratingDatasets(true)
    try {
      // Generate datasets for the first parsed table
      const firstTable = parseResult.tables[0]
      const result = await generateDatasets(firstTable, 10, 10)

      // Update the datasets map
      const newDatasets = new Map(generatedDatasets)
      newDatasets.set(firstTable.table_name, result)
      onDatasetsGenerated(newDatasets)
    } catch (error) {
      console.error('Dataset generation error:', error)
      alert('Failed to generate datasets: ' + (error as Error).message)
    } finally {
      setIsGeneratingDatasets(false)
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Upload Actions */}
          <div className="flex items-center space-x-2">
            {/* Upload Tables Button */}
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer transition-colors shadow-sm">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Upload Tables</span>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleTableUpload}
                className="hidden"
              />
            </label>

            {/* Upload QC Rules Button */}
            <label className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg cursor-pointer transition-colors shadow-sm">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Upload QC Rules</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleQcUpload}
                className="hidden"
              />
            </label>

            <div className="h-8 w-px bg-gray-300 mx-2"></div>

            {/* Parse JSON Button */}
            <button
              onClick={handleParseJSON}
              disabled={!qcRules || tables.length === 0 || isParsing}
              className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors shadow-sm ${
                !qcRules || tables.length === 0 || isParsing
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              style={!qcRules || tables.length === 0 || isParsing ? undefined : { backgroundColor: '#16a34a' }}
            >
              {isParsing ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Parsing...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span>Parse to JSON</span>
                </>
              )}
            </button>

            {/* Generate Datasets Button */}
            <button
              onClick={handleGenerateDatasets}
              disabled={!parseResult || parseResult.tables.length === 0 || isGeneratingDatasets}
              className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors shadow-sm ${
                !parseResult || parseResult.tables.length === 0 || isGeneratingDatasets
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-60'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
              style={!parseResult || parseResult.tables.length === 0 || isGeneratingDatasets ? undefined : { backgroundColor: '#4f46e5' }}
            >
              {isGeneratingDatasets ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  <span>Generate Datasets</span>
                </>
              )}
            </button>
          </div>

          {/* Center: Status Info */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Tables:</span>
              <span className={`px-2 py-1 rounded-full font-semibold ${
                tables.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tables.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">QC Rules:</span>
              <span className={`px-2 py-1 rounded-full font-semibold ${
                qcRules ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {qcRules ? qcRules.rules.length : 0}
              </span>
            </div>
          </div>

          {/* Right: Clear Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearAll}
              disabled={tables.length === 0 && !qcRules}
              className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors shadow-sm h-[42px] ${
                tables.length === 0 && !qcRules
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-2 border-red-500 text-red-600 hover:bg-red-50 bg-white'
              }`}
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear All</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
