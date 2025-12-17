import { useState } from 'react'
import Papa from 'papaparse'

interface TableData {
  id: string
  name: string
  headers: string[]
  rows: string[][]
  file?: File
}

interface TableUploaderProps {
  onTablesChange: (tables: TableData[]) => void
}

export default function TableUploader({ onTablesChange }: TableUploaderProps) {
  const [tables, setTables] = useState<TableData[]>([])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newTables: TableData[] = []
    let filesProcessed = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const text = await file.text()

      // Use PapaParse for proper CSV parsing
      Papa.parse(text, {
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            filesProcessed++
            if (filesProcessed === files.length) {
              const updatedTables = [...tables, ...newTables]
              setTables(updatedTables)
              onTablesChange(updatedTables)
            }
            return
          }

          const headers = results.data[0] as string[]
          const rows = results.data.slice(1) as string[][]

          newTables.push({
            id: crypto.randomUUID(),
            name: file.name,
            headers,
            rows,
            file
          })

          filesProcessed++
          if (filesProcessed === files.length) {
            const updatedTables = [...tables, ...newTables]
            setTables(updatedTables)
            onTablesChange(updatedTables)
          }
        },
        error: (error: Error) => {
          console.error('CSV parsing error for', file.name, ':', error)
          filesProcessed++
          if (filesProcessed === files.length) {
            const updatedTables = [...tables, ...newTables]
            setTables(updatedTables)
            onTablesChange(updatedTables)
          }
        }
      })
    }
  }

  const handleRemoveTable = (id: string) => {
    const updatedTables = tables.filter(table => table.id !== id)
    setTables(updatedTables)
    onTablesChange(updatedTables)
  }

  return (
    <div className="w-full px-6 pt-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload CSV Tables
          </h2>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block">
              <div className="flex items-center justify-center w-full">
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-10 h-10 mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm font-semibold text-gray-700">
                      <span className="text-blue-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">CSV files only</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </label>
          </div>

          {tables.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <svg className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Loaded Tables ({tables.length})
              </h3>
              <div className="space-y-2">
                {tables.map(table => (
                  <div
                    key={table.id}
                    className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="bg-blue-100 rounded-lg p-2">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800 block">{table.name}</span>
                        <span className="text-sm text-gray-600">
                          {table.headers.length} columns × {table.rows.length} rows
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveTable(table.id)}
                      className="ml-4 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
