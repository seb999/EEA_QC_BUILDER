# QC Dataset Generator Design

## Goal
Generate synthetic datasets using LLM that either pass or fail specific QC rules.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dataset Generator Service                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      1. Parse QC Rules                   │
        │      (reuse existing qc_parser.py)       │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      2. Analyze Table Schema             │
        │      - Read table CSV                    │
        │      - Extract column types              │
        │      - Identify constraints              │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      3. Generate Data Specification      │
        │      - Build prompt for LLM              │
        │      - Include all QC constraints        │
        │      - Specify pass/fail mode            │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      4. LLM Data Generation              │
        │      - Send prompt to Claude/OpenAI      │
        │      - Generate realistic data           │
        │      - Return structured JSON            │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      5. Validate Generated Data          │
        │      - Execute QC SQL against data       │
        │      - Verify pass/fail expectations     │
        │      - Report validation results         │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │      6. Export Dataset                   │
        │      - Convert to CSV                    │
        │      - Generate validation report        │
        │      - Return files                      │
        └─────────────────────────────────────────┘
```

## Components

### 1. Schema Analyzer (`qc_schema_analyzer.py`)
**Purpose**: Understand table structure and constraints

**Input**: Table CSV file
**Output**: Schema specification

```python
{
  "table_name": "AggregatedData",
  "columns": [
    {
      "name": "waterBodyIdentifier",
      "type": "VARCHAR",
      "nullable": False,
      "unique": False,
      "constraints": ["not_empty", "max_length:50"]
    },
    {
      "name": "monitoringSiteIdentifier",
      "type": "VARCHAR",
      "nullable": True,
      "unique": False
    },
    {
      "name": "resultObservedValue",
      "type": "NUMERIC",
      "nullable": False,
      "constraints": ["min:0", "max:100"]
    }
  ],
  "row_count_estimate": 100
}
```

### 2. Constraint Interpreter (`qc_constraint_interpreter.py`)
**Purpose**: Convert parsed QC rules into generation instructions

**Input**: Parsed QC rules with semantic analysis
**Output**: Generation constraints

```python
[
  {
    "qc_code": "FC77",
    "field": "waterBodyIdentifier",
    "category": "CARDINALITY",
    "constraint_type": "not_null",
    "severity": "BLOCKER",
    "instruction": "waterBodyIdentifier must always have a value (never null/empty)"
  },
  {
    "qc_code": "VT25",
    "field": "resultObservedValue",
    "category": "RANGE_CHECK",
    "constraint_type": "min_max",
    "severity": "ERROR",
    "min": 0,
    "max": 100,
    "instruction": "resultObservedValue must be between 0 and 100"
  }
]
```

### 3. LLM Data Generator (`qc_llm_generator.py`)
**Purpose**: Use LLM to generate realistic test data

**Input**:
- Schema specification
- Generation constraints
- Mode: "pass_all" or "fail_specific"
- Number of rows
- Rules to violate (if fail mode)

**LLM Prompt Template**:
```
You are a data generator for environmental quality control testing.

Generate {num_rows} rows of realistic data for the {table_name} table.

SCHEMA:
{schema_json}

CONSTRAINTS TO FOLLOW:
{constraints_list}

MODE: {mode}
{failure_instructions}

Generate realistic environmental monitoring data that:
1. Uses real-world patterns (e.g., real water body identifiers, realistic dates, etc.)
2. Maintains logical consistency (e.g., if parameter is "Temperature", value should be reasonable)
3. {pass_or_fail_instruction}

Return ONLY a JSON array of objects, one per row. Example:
[
  {"waterBodyIdentifier": "GB123456", "monitoringSiteIdentifier": "SITE001", ...},
  ...
]
```

**Modes**:

**Pass Mode**: Generate data that satisfies ALL QC rules
```python
mode = "pass_all"
failure_instructions = ""
```

**Fail Mode**: Generate data that violates specific QC rules
```python
mode = "fail_specific"
failure_instructions = """
DELIBERATELY VIOLATE these rules:
- FC77: Include 10 rows with null/empty waterBodyIdentifier
- VT25: Include 5 rows with resultObservedValue > 100
- VT26: Include 5 rows with resultObservedValue < 0

For all other rules, the data should be VALID.
"""
```

### 4. Data Validator (`qc_data_validator.py`)
**Purpose**: Execute QC SQL against generated data to verify correctness

**Input**:
- Generated dataset (CSV)
- QC rules (parsed)
- Expected outcome (pass/fail)

**Process**:
1. Load data into in-memory database (DuckDB or SQLite)
2. Execute each QC SQL rule
3. Collect violations
4. Compare with expectations

**Output**:
```python
{
  "overall_status": "PASSED" | "FAILED",
  "total_rows": 100,
  "total_qc_rules": 95,
  "rules_executed": 95,
  "violations": [
    {
      "qc_code": "FC77",
      "qc_name": "Field cardinality",
      "severity": "BLOCKER",
      "violated_rows": [5, 12, 23, 34, 45, 56, 67, 78, 89, 90],
      "violation_count": 10,
      "expected": True,  # Was this violation expected?
      "status": "EXPECTED" | "UNEXPECTED"
    }
  ],
  "summary": {
    "blockers": 1,
    "errors": 2,
    "warnings": 0,
    "expected_violations": 3,
    "unexpected_violations": 0
  }
}
```

### 5. Dataset Generator Service (`qc_dataset_generator.py`)
**Purpose**: Orchestrate the entire generation process

**REST API Endpoint**: `POST /api/v1/generate-dataset`

**Request**:
```json
{
  "qc_file": "<uploaded file>",
  "table_file": "<uploaded file>",
  "mode": "pass" | "fail",
  "num_rows": 100,
  "rules_to_violate": ["FC77", "VT25"],  // Only for fail mode
  "llm_provider": "anthropic" | "openai",
  "llm_api_key": "sk-...",
  "llm_model": "claude-3-5-sonnet-20241022" | "gpt-4"
}
```

**Response**:
```json
{
  "success": true,
  "dataset_file": "generated_data.csv",
  "validation_report": {
    "overall_status": "FAILED",
    "violations": [...],
    "summary": {...}
  },
  "generation_metadata": {
    "rows_generated": 100,
    "llm_provider": "anthropic",
    "llm_model": "claude-3-5-sonnet-20241022",
    "generation_time_seconds": 5.2
  }
}
```

## LLM Integration

### Anthropic Claude
```python
import anthropic

client = anthropic.Anthropic(api_key=api_key)
message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=8000,
    messages=[{
        "role": "user",
        "content": prompt
    }]
)
generated_data = json.loads(message.content[0].text)
```

### OpenAI GPT
```python
import openai

client = openai.OpenAI(api_key=api_key)
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": prompt
    }],
    response_format={"type": "json_object"}
)
generated_data = json.loads(response.choices[0].message.content)
```

## Data Validation with DuckDB

Why DuckDB?
- In-memory SQL database
- Excellent CSV support
- PostgreSQL compatible
- Fast and lightweight
- No setup required

```python
import duckdb

# Create in-memory database
con = duckdb.connect(':memory:')

# Load generated CSV
con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{csv_path}')")

# Execute QC SQL
for qc_rule in qc_rules:
    sql = qc_rule['expression']['raw_sql']
    # Adapt SQL to work with DuckDB (replace dataset_xxx with table name)
    adapted_sql = adapt_sql_for_duckdb(sql, table_name)

    # Execute and collect violations
    violations = con.execute(adapted_sql).fetchall()

    # Store results
    results.append({
        'qc_code': qc_rule['metadata']['code'],
        'violations': violations
    })
```

## File Structure

```
qc_schema_analyzer.py         # Analyze table schema
qc_constraint_interpreter.py  # Convert QC to constraints
qc_llm_generator.py            # LLM data generation
qc_data_validator.py           # Validate with DuckDB
qc_dataset_generator.py        # Main orchestrator
qc_dataset_service.py          # REST API service
test_generator.py              # Test script
```

## Example Workflow

### Generate Passing Dataset
```bash
curl -X POST http://localhost:5005/api/v1/generate-dataset \
  -F "qc_file=@data/QC.csv" \
  -F "table_file=@data/table/AggregatedData.csv" \
  -F "mode=pass" \
  -F "num_rows=100" \
  -F "llm_provider=anthropic" \
  -F "llm_api_key=sk-..."
```

Result: CSV file with 100 rows that pass all 95 QC rules

### Generate Failing Dataset
```bash
curl -X POST http://localhost:5005/api/v1/generate-dataset \
  -F "qc_file=@data/QC.csv" \
  -F "table_file=@data/table/AggregatedData.csv" \
  -F "mode=fail" \
  -F "num_rows=100" \
  -F 'rules_to_violate=["FC77", "VT25", "VT26"]' \
  -F "llm_provider=anthropic" \
  -F "llm_api_key=sk-..."
```

Result: CSV file with 100 rows that violates FC77, VT25, VT26 but passes all other rules

## Security Considerations

1. **API Key Handling**: Never log or store API keys
2. **SQL Injection**: Use parameterized queries when executing QC SQL
3. **File Size Limits**: Limit generated dataset size
4. **Rate Limiting**: Implement rate limiting for LLM calls
5. **Validation**: Validate all inputs before processing

## Cost Estimation

For 100 rows of data with 10 columns:
- **Anthropic Claude 3.5 Sonnet**: ~$0.01-0.05 per dataset
- **OpenAI GPT-4**: ~$0.02-0.10 per dataset

Factors:
- Schema complexity
- Number of QC rules
- Data realism requirements
- Model used

## Next Steps

1. Implement schema analyzer
2. Implement constraint interpreter
3. Implement LLM generator with Anthropic integration
4. Implement DuckDB validator
5. Create REST API service
6. Test with sample data
7. Add OpenAI support
8. Add error handling and retries
9. Create comprehensive tests
10. Update documentation
