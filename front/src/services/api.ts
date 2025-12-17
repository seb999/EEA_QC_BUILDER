const API_BASE_URL = 'http://localhost:5000'

export interface ParsedQCRule {
  metadata: {
    table: string
    field: string
    code: string
    name: string
    description: string
    message: string
    type: string
    level: string
    creation_mode: boolean
    status: boolean
    valid: boolean
  }
  expression: {
    raw_sql: string
    has_sql: boolean
    sql_analysis: {
      parsed_successfully: boolean
      tables?: string[]
      columns?: string[]
      joins?: Array<{ type: string; table: string; on_condition: string }>
      where_conditions?: Array<{ condition: string; type: string }>
      select_expressions?: Array<{ expression: string; alias?: string; type: string }>
      aggregations?: Array<{ function: string; argument: string }>
      functions?: string[]
      operators?: string[]
      literals?: Array<{ value: string; type: string }>
      subquery_count?: number
      complexity_score?: number
      error?: string
      error_type?: string
    } | null
  }
  semantic_analysis?: {
    category: string
    subcategory: string
    constraints: Array<{ type: string; field?: string; value?: any }>
    fields_checked: string[]
    reference_tables: string[]
    description: string
  }
}

export interface TableSummary {
  table_name: string
  table_filename: string
  rules_count: number
  rules_with_sql: number
  rules_without_sql: number
  by_level: { [key: string]: number }
  by_type: { [key: string]: number }
}

export interface ParseResponse {
  success: boolean
  qc_filename: string
  total_tables: number
  total_qc_rules: number
  tables: Array<{
    table_name: string
    table_filename: string
    summary: TableSummary
    qc_rules: ParsedQCRule[]
  }>
  error?: string
  error_type?: string
}

export async function parseQCAndTables(
  qcFile: File,
  tableFiles: File[]
): Promise<ParseResponse> {
  const formData = new FormData()
  formData.append('qc_file', qcFile)

  tableFiles.forEach(file => {
    formData.append('table_files[]', file)
  })

  const response = await fetch(`${API_BASE_URL}/api/v1/parse`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to parse files')
  }

  return response.json()
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    const data = await response.json()
    return data.status === 'healthy'
  } catch {
    return false
  }
}

// Dataset generation types
export interface GeneratedDataset {
  headers: string[]
  rows: string[][]
  format: string
  description: string
  violations?: string[]
}

export interface DatasetGenerationResponse {
  success: boolean
  table_name: string
  valid_dataset: GeneratedDataset
  invalid_dataset: GeneratedDataset
  metadata: {
    num_qc_rules: number
    num_valid_rows: number
    num_invalid_rows: number
  }
  error?: string
  error_type?: string
}

export async function generateDatasets(
  tableData: ParseResponse['tables'][0],
  numValidRows: number = 10,
  numInvalidRows: number = 10
): Promise<DatasetGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/generate-datasets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      table_data: tableData,
      num_valid_rows: numValidRows,
      num_invalid_rows: numInvalidRows,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to generate datasets')
  }

  return response.json()
}

export async function downloadDataset(
  datasetType: 'valid' | 'invalid',
  tableName: string,
  dataset: GeneratedDataset
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/download-dataset/${datasetType}/${tableName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        headers: dataset.headers,
        rows: dataset.rows,
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to download dataset')
  }

  // Create blob and download
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tableName}_${datasetType.toUpperCase()}.csv`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
