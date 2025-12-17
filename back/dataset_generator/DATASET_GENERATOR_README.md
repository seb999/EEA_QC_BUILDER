# LLM-Powered Dataset Generator

Generate test datasets using AI to validate QC rules. This module uses your in-house LLM (EEA GPU) to create both **valid** and **invalid** CSV datasets based on parsed QC rules.

## What It Does

The dataset generator analyzes QC rules and generates two types of test datasets:

1. **Valid Dataset** - Rows that PASS all QC checks
   - Realistic data that satisfies all constraints
   - Proper data types and formats
   - No violations

2. **Invalid Dataset** - Rows that intentionally FAIL QC checks
   - Each row violates specific QC rules
   - Includes `violated_rule` column showing which rule is broken
   - Useful for testing QC validation logic

## Architecture

```
QC Rules (JSON)
      ↓
Dataset Generator
      ↓
  LLM (EEA GPU)
   ↙        ↘
Valid CSV   Invalid CSV
```

## Files

- **[dataset_generator.py](dataset_generator.py)** - Main generator class
- **[LLMSimpleCall.py](LLMSimpleCall.py)** - Simple LLM connection example
- **[.env](.env)** - LLM credentials (API key, model, base URL)

## Setup

### 1. Environment Variables

The `.env` file contains LLM credentials:

```env
EEA_API_KEY=sk-VjCymw92bHGU3EsDJD0sgw
EEA_MODEL=Inhouse-LLM/Mistral-Small-3.1-24B-Instruct-2503
EEA_BASE_URL=https://llmgw.eea.europa.eu/v1
```

### 2. Dependencies

```bash
pip install openai python-dotenv
```

Already included in `requirements.txt`.

## Usage

### Method 1: Via API (Recommended)

**Step 1: Parse QC Rules**
```bash
curl -X POST http://localhost:5000/api/v1/parse \
  -F "qc_file=@data/QC.csv" \
  -F "table_files[]=@data/table/AggregatedData.csv"
```

Save the response to `parsed_qc.json`.

**Step 2: Generate Datasets**
```bash
curl -X POST http://localhost:5000/api/v1/generate-datasets \
  -H "Content-Type: application/json" \
  -d '{
    "table_data": <table data from step 1>,
    "num_valid_rows": 10,
    "num_invalid_rows": 10
  }'
```

**Step 3: Download CSV (Optional)**
```bash
curl -X POST http://localhost:5000/api/v1/download-dataset/valid/AggregatedData \
  -H "Content-Type: application/json" \
  -d '{"headers": [...], "rows": [[...]]}' \
  --output AggregatedData_VALID.csv
```

### Method 2: Command Line

```bash
python dataset_generator.py output/all_tables_qc_rules.json
```

This will generate:
- `output/datasets/{TableName}_VALID.csv`
- `output/datasets/{TableName}_INVALID.csv`
- `output/datasets/{TableName}_metadata.json`

### Method 3: Python API

```python
from dataset_generator import generate_datasets_for_table
import json

# Load parsed QC data
with open('parsed_qc.json') as f:
    data = json.load(f)

# Get first table
table_data = data['tables'][0]

# Generate datasets
result = generate_datasets_for_table(
    table_data,
    num_valid_rows=10,
    num_invalid_rows=10
)

# Access results
print(f"Valid rows: {len(result['valid_dataset']['rows'])}")
print(f"Invalid rows: {len(result['invalid_dataset']['rows'])}")
```

## API Endpoints

### POST /api/v1/generate-datasets

Generate test datasets based on parsed QC rules.

**Request:**
```json
{
  "table_data": {
    "table_name": "AggregatedData",
    "qc_rules": [...]
  },
  "num_valid_rows": 10,
  "num_invalid_rows": 10
}
```

**Response:**
```json
{
  "success": true,
  "table_name": "AggregatedData",
  "valid_dataset": {
    "headers": ["field1", "field2", ...],
    "rows": [["value1", "value2", ...], ...],
    "description": "Valid dataset that passes all QC rules"
  },
  "invalid_dataset": {
    "headers": ["field1", "field2", ..., "violated_rule"],
    "rows": [["value1", "value2", ..., "FC77"], ...],
    "description": "Invalid dataset with violations",
    "violations": ["FC77", "FC78", ...]
  },
  "metadata": {
    "num_qc_rules": 95,
    "num_valid_rows": 10,
    "num_invalid_rows": 10
  }
}
```

### POST /api/v1/download-dataset/:type/:table

Download a dataset as CSV file.

**URL Parameters:**
- `type`: "valid" or "invalid"
- `table`: table name (e.g., "AggregatedData")

**Request:**
```json
{
  "headers": ["field1", "field2", ...],
  "rows": [["value1", "value2", ...], ...]
}
```

**Response:** CSV file download

## How It Works

### 1. QC Rule Analysis

The generator analyzes parsed QC rules to extract:
- Field names and constraints
- Semantic categories (NULL_CHECK, RANGE_CHECK, etc.)
- Validation rules and requirements
- Data type expectations

### 2. Prompt Generation

For each dataset type, a detailed prompt is created:

**Valid Dataset Prompt:**
```
Generate CSV data for table 'X' that PASSES all QC rules:
- Rule 1: Field 'waterBodyIdentifier' must not be empty
- Rule 2: Field 'resultUoM' must be in [mg/l, ug/l]
- Rule 3: Field 'observedValue' must be > 0
...
Requirements:
- Generate exactly N rows
- All rows must satisfy ALL rules
- Use realistic, varied data
```

**Invalid Dataset Prompt:**
```
Generate CSV data that INTENTIONALLY FAILS QC rules:
- Row 1: Violate Rule FC77 (empty waterBodyIdentifier)
- Row 2: Violate Rule FC78 (invalid resultUoM)
- Row 3: Violate Rule FC79 (negative observedValue)
...
Include 'violated_rule' column with rule codes
```

### 3. LLM Generation

The LLM (EEA GPU):
- Receives the prompt
- Generates CSV data
- Returns formatted CSV text

### 4. Parsing & Validation

The generator:
- Parses CSV response
- Validates format
- Extracts headers and rows
- Returns structured data

## Configuration

### Number of Rows

```python
# Generate more data
result = generate_datasets_for_table(
    table_data,
    num_valid_rows=50,    # 1-100
    num_invalid_rows=50   # 1-100
)
```

### LLM Model

Change in `.env`:
```env
EEA_MODEL=Inhouse-LLM/gpt-oss-120b
# or
EEA_MODEL=Inhouse-LLM/Mistral-Small-3.1-24B-Instruct-2503
```

### Temperature

Edit `dataset_generator.py`:
```python
response = self.client.chat.completions.create(
    model=self.model,
    messages=[...],
    temperature=0.7,  # 0.0-1.0 (higher = more creative)
    max_tokens=4000
)
```

## Examples

### Example 1: Generate 5 Valid Rows

```python
from dataset_generator import DatasetGenerator

generator = DatasetGenerator()

result = generator.generate_datasets(
    table_schema={'table_name': 'AggregatedData'},
    qc_rules=parsed_rules,
    num_valid_rows=5,
    num_invalid_rows=0  # Skip invalid
)

print(result['valid_dataset'])
```

### Example 2: Test Specific QC Rule

```python
# Filter for specific rule
specific_rule = [r for r in qc_rules if r['metadata']['code'] == 'FC77']

# Generate data that should fail this rule
result = generator._generate_invalid_dataset(
    'AggregatedData',
    table_schema,
    specific_rule,
    num_rows=10
)
```

### Example 3: Batch Generation for All Tables

```python
import json

with open('output/all_tables_qc_rules.json') as f:
    data = json.load(f)

for table in data['tables']:
    print(f"Generating for {table['table_name']}...")
    result = generate_datasets_for_table(table, 10, 10)

    # Save to files
    table_name = table['table_name']
    with open(f'{table_name}_valid.csv', 'w') as f:
        # Write CSV...
```

## Output Format

### Valid Dataset
```csv
waterBodyIdentifier,monitoringSite,observedValue,resultUoM
WB001,SITE001,12.5,mg/l
WB002,SITE002,8.3,ug/l
WB003,SITE003,15.7,mg/l
```

### Invalid Dataset
```csv
waterBodyIdentifier,monitoringSite,observedValue,resultUoM,violated_rule
,SITE001,12.5,mg/l,FC77
WB002,SITE002,-5.0,mg/l,FC79
WB003,SITE003,15.7,invalid_unit,FC78
```

## Troubleshooting

### LLM Connection Issues

```bash
# Test LLM connection
python LLMSimpleCall.py
```

If this fails:
- Check `.env` file credentials
- Verify VPN/network access to `llmgw.eea.europa.eu`
- Confirm API key is valid

### CSV Parsing Errors

If LLM returns invalid CSV:
- Check prompt clarity
- Lower `temperature` for more deterministic output
- Increase `max_tokens` if output is truncated
- Add more examples in the prompt

### Empty/Missing Fields

The LLM might not understand all field constraints. To improve:
1. Add field type hints in prompts
2. Provide example values
3. Use more descriptive field names in schema

## Performance

- **Valid Dataset**: ~10-30 seconds for 10 rows
- **Invalid Dataset**: ~10-30 seconds for 10 rows
- **API Response Time**: ~20-60 seconds total
- **LLM Model**: Mistral-Small-3.1-24B (fast) or GPT-OSS-120B (higher quality)

## Limitations

1. **Rule Complexity**: Very complex SQL rules might not be fully captured
2. **Row Limit**: Max 100 rows per generation (API limit)
3. **Field Extraction**: Only fields mentioned in QC rules are used
4. **LLM Variability**: Output might vary slightly between runs

## Future Enhancements

- [ ] Schema-aware generation (use table schema CSV)
- [ ] Incremental generation (add more rows to existing dataset)
- [ ] Multi-table datasets with referential integrity
- [ ] Validation feedback loop (re-generate if validation fails)
- [ ] Custom violation patterns
- [ ] CSV preview before download

## Testing

```bash
# Test with sample data
python dataset_generator.py output/all_tables_qc_rules.json

# Verify output
ls output/datasets/
# Should see:
#   AggregatedData_VALID.csv
#   AggregatedData_INVALID.csv
#   AggregatedData_metadata.json
```

## Integration with Frontend

The frontend can call the API to generate datasets on-demand:

```typescript
// After parsing QC rules
const generateDatasets = async (tableData) => {
  const response = await fetch('/api/v1/generate-datasets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_data: tableData,
      num_valid_rows: 10,
      num_invalid_rows: 10
    })
  });

  const result = await response.json();
  // Display datasets or download CSV
};
```

## License

Part of the EEA R3 QC Builder project.
