# QC Parser Service - Backend

Simple Python backend with **2 main functions**:

## 🎯 What It Does

### 1️⃣ Parse CSV → Generate JSON (`parser/` folder)
- Upload QC.csv + Table.csv files
- Parse QC rules with semantic analysis
- Return structured JSON

### 2️⃣ Use LLM → Generate Datasets (`dataset_generator/` folder)
- Take JSON from step 1
- Call EEA GPU (in-house LLM)
- Generate 2 datasets:
  - **Valid dataset**: Data that PASSES all QC checks ✅
  - **Invalid dataset**: Data that FAILS specific QC checks ❌

## 🚀 How to Run

```bash
cd back
venv\Scripts\python.exe main.py --host 127.0.0.1 --port 5000
```

Service runs on `http://localhost:5000`

## 📁 Project Structure (Simplified!)

```
back/
├── parser/                       # 📊 Folder 1: Parse CSV → JSON
│   ├── qc_parser.py             # Parse QC rules
│   └── qc_semantic_analyzer.py  # Semantic analysis
│
├── dataset_generator/            # 🤖 Folder 2: Use LLM → Generate Datasets
│   └── generator.py             # LLM dataset generation
│
├── main.py                       # ⭐ MAIN FILE - Run this!
├── .env                          # LLM credentials
└── requirements.txt
```

### 💡 Quick Tips

- **Want to understand JSON generation?** → Look in `parser/` folder
- **Want to understand LLM datasets?** → Look in `dataset_generator/` folder
- **Want to modify API endpoints?** → Edit `main.py`
- **Want to change LLM prompts?** → Edit `dataset_generator/generator.py`

## For Your Application

### Architecture
```
React UI → Node.js Backend → Python QC Parser Service
               ↓
          R3 API (downloads files)
```

### Node.js Backend Integration
```javascript
// See nodejs_example.js for complete code

const FormData = require('form-data');
const axios = require('axios');

// 1. Download files from R3 API
const qcFile = await downloadFromR3(`/dataflows/${dataflowId}/qc`);
const tableFile = await downloadFromR3(`/dataflows/${dataflowId}/table`);

// 2. Upload to Python service
const formData = new FormData();
formData.append('qc_file', qcFile, 'QC.csv');
formData.append('table_file', tableFile, 'Table.csv');

const response = await axios.post(
  'http://localhost:5000/api/v1/parse',
  formData,
  { headers: formData.getHeaders() }
);

// 3. Return to React
return response.data;
```

### React Frontend Integration
```javascript
// See react_example.jsx for complete component

const response = await fetch('/api/parse-dataflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dataflowId })
});

const result = await response.json();
// Display results: result.summary, result.qc_rules
```

## API Reference

### POST /api/v1/parse

Parse uploaded QC and table CSV files.

**Request** (multipart/form-data):
- `qc_file`: CSV file with QC rules
- `table_files[]`: One or more CSV files with table schemas (can also use single `table_file` for backward compatibility)

**Response**:
```json
{
  "success": true,
  "total_qc_rules": 257,
  "tables": [
    {
      "table_name": "AggregatedData",
      "qc_count": 95,
      "summary": {
        "total_rules": 95,
        "by_severity": {
          "BLOCKER": 30,
          "ERROR": 40,
          "WARNING": 25
        },
        "by_category": {
          "RANGE_CHECK": 35,
          "DATA_TYPE": 20,
          "NULL_CHECK": 15
        }
      },
      "qc_rules": [
        {
          "metadata": {
            "table": "AggregatedData",
            "field": "waterBodyIdentifier",
            "code": "FC77",
            "name": "Field cardinality",
            "description": "Checks if the field is missing or empty",
            "message": "The value must not be missing or empty",
            "type": "FIELD",
            "level": "BLOCKER"
          },
          "expression": {
            "raw_sql": "SELECT ...",
            "has_sql": true,
            "sql_analysis": {
              "parsed_successfully": true,
              "tables": ["dataset_74231.aggregateddata"],
              "columns": ["record_id", "resultuom"],
              "joins": [],
              "where_conditions": [...],
              "functions": ["And", "Or"],
              "complexity_score": 15
            }
          },
          "semantic_analysis": {
            "category": "CARDINALITY",
            "subcategory": "mandatory_field",
            "constraints": [
              {"type": "not_null", "field": "waterBodyIdentifier"}
            ],
            "fields_checked": ["waterBodyIdentifier"],
            "reference_tables": [],
            "description": "Validates mandatory field requirements"
          }
        }
      ]
    }
  ]
}
```

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "QC Parser Service",
  "version": "1.0.0"
}
```

## Features

### SQL Analysis

For each SQL-based QC rule, the parser extracts:

- **Tables**: All referenced tables with schemas
- **Columns**: All column references
- **Joins**: JOIN operations with conditions
- **WHERE Conditions**: Parsed conditions
- **Functions**: SQL functions used (COALESCE, CAST, etc.)
- **Operators**: Comparison operators (=, <, >, IN, etc.)
- **Aggregations**: COUNT, SUM, AVG, MIN, MAX
- **Complexity Score**: Calculated metric (0-100+)

### Semantic Analysis (NEW)

Automatically categorizes QC rules into 14 types:

1. **NULL_CHECK** - Validates that values are not null or empty
2. **RANGE_CHECK** - Validates that values are within acceptable ranges
3. **UNIQUENESS** - Validates that values are unique within a dataset
4. **REFERENTIAL_INTEGRITY** - Validates relationships between tables
5. **CARDINALITY** - Validates required fields are present
6. **DATA_TYPE** - Validates data type and format
7. **VALUE_LIST** - Validates against a list of allowed values
8. **PATTERN_MATCH** - Validates against a pattern or format
9. **CONSISTENCY** - Validates logical consistency between fields
10. **OUTLIER** - Detects statistical outliers or unusual values
11. **CROSS_FIELD** - Validates relationships between multiple fields
12. **TEMPORAL** - Validates date/time constraints
13. **MANDATORY** - Validates mandatory field requirements
14. **CONFLICT** - Detects conflicting or contradictory values

Each rule includes:
- Category and subcategory
- Extracted constraints
- Fields being checked
- Reference tables (for FK checks)
- Human-readable description

## Test Results

Tested with all 3 tables:
- ✅ 257 total QC rules parsed
- ✅ AggregatedData: 95 rules
- ✅ AggregatedDataByWaterBody: 102 rules
- ✅ DisaggregatedData: 60 rules
- ✅ 99.2% parse success rate (255/257 rules)
- ✅ Semantic categorization: RANGE_CHECK (87), DATA_TYPE (60), CONSISTENCY (26), MANDATORY (22), etc.

## Production Deployment

### With Gunicorn
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 main:app
```

### With Docker
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "main:app"]
```

## Additional Tools

### inspect_qc.py
CLI tool to inspect individual QC rules:
```bash
python inspect_qc.py FC77
python inspect_qc.py list
```

### example_usage.py
Python examples showing programmatic usage:
```bash
python example_usage.py
```

## Dependencies

### Python
- sqlglot >= 25.0.0 (SQL parsing)
- flask >= 3.0.0 (REST API)
- flask-cors >= 4.0.0 (CORS support)

### Node.js (for integration)
- axios (HTTP client)
- form-data (File uploads)
- express (API server)
- cors (CORS middleware)

## Configuration

Edit `main.py` to customize:
- `MAX_CONTENT_LENGTH`: Max file size (default: 50MB)
- `ALLOWED_EXTENSIONS`: File types (default: csv)
- Host and port via command line arguments

## Examples

See complete working examples:
- **[nodejs_example.js](nodejs_example.js)** - Node.js backend with Express
- **[react_example.jsx](react_example.jsx)** - React UI component

## License

Part of the R3 QC Generator project.
