# R3 QC Builder

A full-stack application for parsing and analyzing Quality Control (QC) rules from CSV files. Features a React frontend with a Python Flask backend that uses sqlglot for SQL parsing and semantic analysis.

## Architecture

```
┌────────────────────────────────────────┐
│   Frontend (React + TypeScript)       │
│   - Upload Table CSV files            │
│   - Upload QC CSV file                │
│   - Display tables and rules          │
│   - Trigger JSON generation           │
│   - View parsed results & analysis    │
└───────────────┬────────────────────────┘
                │ HTTP/REST API
                ▼
┌────────────────────────────────────────┐
│   Backend (Python Flask)               │
│   - Parse QC CSV + Table CSV           │
│   - Use sqlglot for SQL parsing        │
│   - Generate JSON with semantic        │
│     analysis and complexity scores     │
└────────────────────────────────────────┘
```

## Features

### Frontend
- **Multiple CSV Upload**: Drag & drop support for table CSV files
- **QC Rules Upload**: Single file upload for QC rules
- **Live Preview**: View uploaded CSV data in tabbed interface
- **JSON Generation**: Click-button integration with Python backend
- **Parsed Results Display**:
  - Summary statistics (total rules, SQL counts, severity levels)
  - Color-coded severity levels (BLOCKER, ERROR, WARNING)
  - Semantic categories for each rule
  - SQL complexity scores
  - Sortable and filterable views

### Backend
- **SQL Parsing**: Uses sqlglot to parse SQL queries (99.2% success rate)
- **Semantic Analysis**: Categorizes rules into 14 types:
  - NULL_CHECK, RANGE_CHECK, UNIQUENESS, REFERENTIAL_INTEGRITY
  - CARDINALITY, DATA_TYPE, VALUE_LIST, PATTERN_MATCH
  - CONSISTENCY, OUTLIER, CROSS_FIELD, TEMPORAL, MANDATORY, CONFLICT
- **Complexity Scoring**: Calculates query complexity (0-100+)
- **Multi-table Support**: Parse multiple table schemas in one request
- **RESTful API**: CORS-enabled endpoints

## Getting Started

### Prerequisites
- **Node.js** 16+ (for frontend)
- **Python** 3.12+ (for backend)

### First-Time Setup

#### Backend Setup

1. **Navigate to backend directory**
   ```powershell
   cd back
   ```

2. **Create Python virtual environment** (if not already created)
   ```powershell
   py -m venv venv
   ```

3. **Activate the virtual environment** (VSCode integrated terminal)
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   .\venv\Scripts\Activate.ps1
   ```

   You should see `(venv)` appear at the start of your prompt.

4. **Install Python dependencies**
   ```powershell
   pip install -r requirements.txt
   ```

#### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd front
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

### Quick Start (After Setup)

#### 1. Start the Backend

```powershell
cd back
.\venv\Scripts\Activate.ps1
python main.py
```

The backend will be available at `http://127.0.0.1:5000`

**Note**: If you encounter PowerShell execution policy errors, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

#### 2. Start the Frontend

```bash
cd front
npm run dev
```

The frontend will be available at `http://localhost:5174` (or another port if 5174 is taken)

#### 3. Use the Application

1. **Open browser**: Navigate to http://localhost:5174
2. **Upload Table CSV(s)**: Click on the blue upload area to select one or more table CSV files
3. **Upload QC Rules CSV**: Click on the purple upload area to select your QC rules CSV file
4. **Generate JSON**: Once both are uploaded, click the green "Generate JSON with Python Backend" button
5. **View Results**: Parsed results will appear in new green tabs showing:
   - Summary statistics
   - All rules with semantic analysis
   - SQL complexity scores
   - Categorized by severity and type

## Project Structure

```
r3-qc-builder/
├── front/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx         # Top navigation bar
│   │   │   ├── TableUploader.tsx  # CSV table uploader
│   │   │   ├── QCRulesUploader.tsx # QC rules uploader
│   │   │   └── TableViewer.tsx    # Main viewer with tabs
│   │   ├── services/
│   │   │   └── api.ts             # Backend API client
│   │   ├── App.tsx                # Main app component
│   │   └── main.tsx               # App entry point
│   ├── package.json
│   └── vite.config.ts
│
├── back/                           # Python backend
│   ├── qc_parser_service.py       # Flask REST API
│   ├── qc_parser.py               # Core parser logic
│   ├── qc_semantic_analyzer.py    # Semantic categorization
│   ├── requirements.txt           # Python dependencies
│   ├── data/                      # Sample data
│   │   ├── QC.csv                 # 257 QC rules
│   │   └── table/                 # 3 table schemas
│   └── venv/                      # Python virtual environment
│
└── README.md                       # This file
```

## API Documentation

### POST /api/v1/parse

Parse QC and table CSV files to generate JSON with semantic analysis.

**Request** (multipart/form-data):
```
qc_file: File (CSV with QC rules)
table_files[]: File[] (One or more CSV files with table schemas)
```

**Response** (application/json):
```json
{
  "success": true,
  "qc_filename": "QC.csv",
  "total_tables": 3,
  "total_qc_rules": 257,
  "tables": [
    {
      "table_name": "AggregatedData",
      "table_filename": "AggregatedData.csv",
      "summary": {
        "rules_count": 95,
        "rules_with_sql": 90,
        "rules_without_sql": 5,
        "by_level": { "BLOCKER": 30, "ERROR": 40, "WARNING": 25 },
        "by_type": { "FIELD": 60, "RECORD": 35 }
      },
      "qc_rules": [
        {
          "metadata": {
            "table": "AggregatedData",
            "field": "waterBodyIdentifier",
            "code": "FC77",
            "name": "Field cardinality",
            "level": "BLOCKER",
            "type": "FIELD"
          },
          "expression": {
            "raw_sql": "SELECT ...",
            "has_sql": true,
            "sql_analysis": {
              "parsed_successfully": true,
              "tables": ["dataset_74231.aggregateddata"],
              "columns": ["record_id", "resultuom"],
              "complexity_score": 15
            }
          },
          "semantic_analysis": {
            "category": "CARDINALITY",
            "subcategory": "mandatory_field",
            "constraints": [
              { "type": "not_null", "field": "waterBodyIdentifier" }
            ]
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

## Sample Data

The backend includes sample data:
- [back/data/QC.csv](back/data/QC.csv) - 257 QC rules
- [back/data/table/AggregatedData.csv](back/data/table/AggregatedData.csv) - 95 rules
- [back/data/table/AggregatedDataByWaterBody.csv](back/data/table/AggregatedDataByWaterBody.csv) - 102 rules
- [back/data/table/DisaggregatedData.csv](back/data/table/DisaggregatedData.csv) - 60 rules

You can test the application by uploading these files through the UI.

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** for styling
- **Fetch API** for backend communication

### Backend
- **Flask 3.0+** for REST API
- **sqlglot 25.0+** for SQL parsing
- **Flask-CORS** for CORS support
- **Python 3.12+**

## Development

### Frontend Development

```bash
cd front
npm install           # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend Development

```powershell
cd back
py -m venv venv                              # Create virtual environment (if needed)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process  # Allow script execution
.\venv\Scripts\Activate.ps1                  # Activate venv (Windows PowerShell)
pip install -r requirements.txt              # Install dependencies
python main.py                               # Start server
```

## Features in Detail

### CSV Upload
- Multiple table files supported
- Client-side CSV parsing for preview
- Original File objects preserved for backend API calls

### JSON Generation
- Click button to send files to Python backend
- Loading spinner during processing
- Error handling with user-friendly messages
- Automatic tab switching to results

### Results Display
- Color-coded severity levels:
  - 🔴 BLOCKER (red)
  - 🟠 ERROR (orange)
  - 🟡 WARNING (yellow)
- Semantic categories (purple badges)
- Complexity scores:
  - 🟢 Simple (< 10)
  - 🟡 Medium (10-30)
  - 🔴 Complex (> 30)
- Summary statistics cards
- Scrollable table with sticky header

## Configuration

### Backend Port
Change in [back/qc_parser_service.py](back/qc_parser_service.py:160):
```python
parser.add_argument('--port', type=int, default=5000)
```

### Frontend API URL
Change in [front/src/services/api.ts](front/src/services/api.ts:1):
```typescript
const API_BASE_URL = 'http://localhost:5000'
```

### CORS Settings
Configured in [back/qc_parser_service.py](back/qc_parser_service.py:16):
```python
CORS(app)  # Allows all origins by default
```

## Troubleshooting

### PowerShell Script Execution Error
If you get an error about unsigned scripts when activating the virtual environment:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\venv\Scripts\Activate.ps1
```
This only affects the current terminal session and is safe.

### Backend doesn't start
- Make sure Python 3.12+ is installed (check with `py --version`)
- Activate the virtual environment: `.\venv\Scripts\Activate.ps1`
- Install dependencies: `pip install -r requirements.txt`
- Check if port 5000 is already in use
- Verify you're in the `back` directory

### Frontend can't connect to backend
- Verify backend is running at http://127.0.0.1:5000
- Check [front/src/services/api.ts](front/src/services/api.ts) has correct URL
- Look for CORS errors in browser console
- Ensure Flask-CORS is installed in backend

### "Generate JSON" button doesn't appear
- Make sure both table CSV(s) and QC CSV are uploaded
- Check browser console for errors
- Verify files are CSV format

## Testing

### Test Backend Directly

```bash
cd back
python test_service.py
```

### Test with curl

```bash
curl -X POST http://localhost:5000/api/v1/parse \
  -F "qc_file=@data/QC.csv" \
  -F "table_files[]=@data/table/AggregatedData.csv"
```

## Performance

- **Parse Speed**: ~1-2 seconds for 257 rules
- **SQL Parse Success**: 99.2% (255/257 rules)
- **Frontend Load**: < 1 second
- **CSV Display Limit**: First 50 rows (for performance)

## Future Enhancements

- [ ] Export parsed JSON to file
- [ ] Filter rules by category, level, or type
- [ ] Search functionality within rules
- [ ] Detailed SQL analysis view (expandable rows)
- [ ] Download individual rule details
- [ ] LLM-based dataset generator (planned)
- [ ] Production deployment guides

## License

Part of the EEA R3 QC Builder project.

## Support

For issues or questions, check the browser console and backend logs for detailed error messages.
