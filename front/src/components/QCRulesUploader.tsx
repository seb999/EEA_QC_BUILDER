import { useState } from 'react'
import Papa from 'papaparse'

interface QCRule {
  [key: string]: string
}

interface QCRulesData {
  fileName: string
  headers: string[]
  rules: QCRule[]
  file?: File
}

interface QCRulesUploaderProps {
  onRulesChange: (rules: QCRulesData | null) => void
}

export default function QCRulesUploader({ onRulesChange }: QCRulesUploaderProps) {
  const [qcRules, setQcRules] = useState<QCRulesData | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()

    // Use PapaParse for proper CSV parsing with multi-line support
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        const rules = results.data as QCRule[]

        const rulesData: QCRulesData = {
          fileName: file.name,
          headers,
          rules,
          file
        }

        setQcRules(rulesData)
        onRulesChange(rulesData)
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
        alert('Error parsing CSV file: ' + error.message)
      }
    })
  }

  const handleRemoveRules = () => {
    setQcRules(null)
    onRulesChange(null)
  }

  return (
    <div className="w-full px-6 pt-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <svg className="h-6 w-6 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Upload QC Rules
          </h2>
        </div>

        <div className="p-6">
          {!qcRules ? (
            <div className="mb-6">
              <label className="block">
                <div className="flex items-center justify-center w-full">
                  <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-purple-300 border-dashed rounded-lg cursor-pointer bg-purple-50 hover:bg-purple-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-10 h-10 mb-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mb-2 text-sm font-semibold text-gray-700">
                        <span className="text-purple-600">Click to upload</span> QC rules file
                      </p>
                      <p className="text-xs text-gray-500">CSV file with quality check rules</p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </label>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <svg className="h-5 w-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                QC Rules Loaded
              </h3>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="bg-purple-100 rounded-lg p-2">
                      <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800 block">{qcRules.fileName}</span>
                      <span className="text-sm text-gray-600">
                        {qcRules.rules.length} rules with {qcRules.headers.length} fields
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveRules}
                    className="ml-4 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
