import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import ActionRibbon from './components/ActionRibbon'
import TableViewer from './components/TableViewer'
import type { ParseResponse, DatasetGenerationResponse } from './services/api'

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

function App() {
  const [tables, setTables] = useState<TableData[]>([])
  const [qcRules, setQcRules] = useState<QCRulesData | null>(null)
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null)
  const [generatedDatasets, setGeneratedDatasets] = useState<Map<string, DatasetGenerationResponse>>(new Map())
  const [isParsing, setIsParsing] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex flex-col">
      <Navbar />

      {/* Action Ribbon */}
      <ActionRibbon
        tables={tables}
        qcRules={qcRules}
        onTablesChange={setTables}
        onQcRulesChange={setQcRules}
        onParseComplete={setParseResult}
        isParsing={isParsing}
        setIsParsing={setIsParsing}
        parseResult={parseResult}
        generatedDatasets={generatedDatasets}
        onDatasetsGenerated={setGeneratedDatasets}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full px-6 py-6">
          <TableViewer
            tables={tables}
            qcRules={qcRules}
            parseResult={parseResult}
            onParseRequest={setParseResult}
            generatedDatasets={generatedDatasets}
            onDatasetsGenerated={setGeneratedDatasets}
            onTablesChange={setTables}
          />
        </div>
      </main>
    </div>
  )
}

export default App
