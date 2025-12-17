"""
Dataset Generator - Uses LLM to generate test datasets based on QC rules

Generates two types of datasets:
1. Valid datasets that PASS all QC checks
2. Invalid datasets that FAIL specific QC checks
"""

import json
import csv
import io
import os
import sys
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import openai

# Fix Windows console encoding for Unicode characters
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

# Load environment variables
load_dotenv()

EEA_API_KEY = os.getenv("EEA_API_KEY")
EEA_MODEL = os.getenv("EEA_MODEL", "Inhouse-LLM/Mistral-Small-3.1-24B-Instruct-2503")
EEA_BASE_URL = os.getenv("EEA_BASE_URL", "https://llmgw.eea.europa.eu/v1")


class DatasetGenerator:
    """Generate test datasets based on QC rules using LLM."""

    def __init__(self):
        """Initialize the LLM client."""
        self.client = openai.OpenAI(
            api_key=EEA_API_KEY,
            base_url=EEA_BASE_URL
        )
        self.model = EEA_MODEL

    def generate_datasets(
        self,
        table_schema: Dict[str, Any],
        qc_rules: List[Dict[str, Any]],
        num_valid_rows: int = 10,
        num_invalid_rows: int = 10
    ) -> Dict[str, Any]:
        """
        Generate both valid and invalid datasets for a table.

        Args:
            table_schema: Schema information (headers, types, etc.)
            qc_rules: List of parsed QC rules for this table
            num_valid_rows: Number of valid rows to generate
            num_invalid_rows: Number of invalid rows to generate

        Returns:
            Dictionary containing both datasets and metadata
        """
        # Extract table information
        table_name = table_schema.get('table_name', 'Unknown')

        print(f"\n{'#'*60}")
        print(f"# 📊 Dataset Generation Started")
        print(f"# Table: {table_name}")
        print(f"# QC Rules: {len(qc_rules)}")
        print(f"# Valid rows to generate: {num_valid_rows}")
        print(f"# Invalid rows to generate: {num_invalid_rows}")
        print(f"{'#'*60}\n")

        # Generate valid dataset
        print(f"🟢 Step 1/2: Generating {num_valid_rows} VALID rows for {table_name}...")
        valid_dataset = self._generate_valid_dataset(
            table_name, table_schema, qc_rules, num_valid_rows
        )

        # Generate invalid dataset
        print(f"\n🔴 Step 2/2: Generating {num_invalid_rows} INVALID rows for {table_name}...")
        invalid_dataset = self._generate_invalid_dataset(
            table_name, table_schema, qc_rules, num_invalid_rows
        )

        print(f"\n{'#'*60}")
        print(f"# ✅ Dataset Generation Complete!")
        print(f"# Valid rows generated: {len(valid_dataset['rows'])}")
        print(f"# Invalid rows generated: {len(invalid_dataset['rows'])}")
        print(f"{'#'*60}\n")

        return {
            'table_name': table_name,
            'valid_dataset': valid_dataset,
            'invalid_dataset': invalid_dataset,
            'metadata': {
                'num_qc_rules': len(qc_rules),
                'num_valid_rows': len(valid_dataset['rows']),
                'num_invalid_rows': len(invalid_dataset['rows'])
            }
        }

    def _generate_valid_dataset(
        self,
        table_name: str,
        table_schema: Dict[str, Any],
        qc_rules: List[Dict[str, Any]],
        num_rows: int
    ) -> Dict[str, Any]:
        """Generate a dataset that PASSES all QC rules."""

        # Build prompt for valid data
        prompt = self._build_valid_dataset_prompt(
            table_name, table_schema, qc_rules, num_rows
        )

        # Call LLM with streaming
        response = self._call_llm(prompt, f"VALID dataset for {table_name}")

        # Parse CSV response
        dataset = self._parse_csv_response(response)

        return {
            'headers': dataset['headers'],
            'rows': dataset['rows'],
            'format': 'csv',
            'description': f'Valid dataset that passes all {len(qc_rules)} QC rules'
        }

    def _generate_invalid_dataset(
        self,
        table_name: str,
        table_schema: Dict[str, Any],
        qc_rules: List[Dict[str, Any]],
        num_rows: int
    ) -> Dict[str, Any]:
        """Generate a dataset that FAILS specific QC rules."""

        # Build prompt for invalid data
        prompt = self._build_invalid_dataset_prompt(
            table_name, table_schema, qc_rules, num_rows
        )

        # Call LLM with streaming
        response = self._call_llm(prompt, f"INVALID dataset for {table_name}")

        # Parse CSV response
        dataset = self._parse_csv_response(response)

        return {
            'headers': dataset['headers'],
            'rows': dataset['rows'],
            'format': 'csv',
            'description': f'Invalid dataset that intentionally fails QC rules',
            'violations': self._extract_violations_from_response(response)
        }

    def _build_valid_dataset_prompt(
        self,
        table_name: str,
        table_schema: Dict[str, Any],
        qc_rules: List[Dict[str, Any]],
        num_rows: int
    ) -> str:
        """Build prompt for generating valid data."""

        # Summarize QC rules
        rule_summary = self._summarize_qc_rules(qc_rules)

        # Extract field information
        fields_info = self._extract_fields_info(qc_rules)

        prompt = f"""You are a data generation expert. Generate a CSV dataset for the table '{table_name}' that PASSES all quality control checks.

## Table Information
- Table Name: {table_name}
- Number of rows to generate: {num_rows}

## Fields (extracted from QC rules)
{fields_info}

## Quality Control Rules (MUST ALL PASS)
{rule_summary}

## Requirements
1. Generate EXACTLY {num_rows} rows of data
2. Each row MUST satisfy ALL QC rules listed above
3. Data should be realistic and varied
4. Follow proper data types and formats
5. Ensure no violations of any constraints

## Output Format
Return ONLY a CSV with:
- First line: column headers (comma-separated)
- Following lines: data rows (one per line)
- No markdown formatting, no code blocks, no explanations
- Just pure CSV data

Generate the CSV now:"""

        return prompt

    def _build_invalid_dataset_prompt(
        self,
        table_name: str,
        table_schema: Dict[str, Any],
        qc_rules: List[Dict[str, Any]],
        num_rows: int
    ) -> str:
        """Build prompt for generating invalid data."""

        # Summarize QC rules
        rule_summary = self._summarize_qc_rules(qc_rules)

        # Extract field information
        fields_info = self._extract_fields_info(qc_rules)

        # Select rules to violate (different ones per row)
        rules_to_violate = self._select_rules_to_violate(qc_rules, num_rows)

        prompt = f"""You are a data generation expert. Generate a CSV dataset for the table '{table_name}' that INTENTIONALLY FAILS specific quality control checks for testing purposes.

## Table Information
- Table Name: {table_name}
- Number of rows to generate: {num_rows}

## Fields (extracted from QC rules)
{fields_info}

## Quality Control Rules (to be violated)
{rule_summary}

## Requirements
1. Generate EXACTLY {num_rows} rows of data
2. Each row should violate at least ONE different QC rule (vary the violations)
3. Violations should be clear and intentional:
   - Missing required values
   - Invalid formats
   - Out of range values
   - Constraint violations
4. Include a 'violated_rule' column at the end indicating which rule code is violated
5. Make violations realistic but obvious

## Violations to Create (distribute across rows)
{rules_to_violate}

## Output Format
Return ONLY a CSV with:
- First line: column headers + 'violated_rule' (comma-separated)
- Following lines: data rows with intentional violations
- No markdown formatting, no code blocks, no explanations
- Just pure CSV data

Generate the CSV now:"""

        return prompt

    def _summarize_qc_rules(self, qc_rules: List[Dict[str, Any]]) -> str:
        """Create a concise summary of QC rules for the LLM prompt."""
        summary_lines = []

        for i, rule in enumerate(qc_rules[:20], 1):  # Limit to first 20 rules
            metadata = rule.get('metadata', {})
            semantic = rule.get('semantic_analysis', {})

            code = metadata.get('code', 'N/A')
            field = metadata.get('field', 'N/A')
            name = metadata.get('name', 'N/A')
            level = metadata.get('level', 'N/A')
            category = semantic.get('category', 'N/A')
            description = metadata.get('description', 'N/A')

            summary_lines.append(
                f"{i}. [{code}] {field} - {name} ({level}, {category})\n"
                f"   Description: {description}"
            )

        if len(qc_rules) > 20:
            summary_lines.append(f"\n... and {len(qc_rules) - 20} more rules")

        return "\n".join(summary_lines)

    def _extract_fields_info(self, qc_rules: List[Dict[str, Any]]) -> str:
        """Extract field information from QC rules."""
        fields = {}

        for rule in qc_rules:
            metadata = rule.get('metadata', {})
            semantic = rule.get('semantic_analysis', {})

            field = metadata.get('field', '')
            if field and field not in fields:
                fields[field] = {
                    'constraints': [],
                    'type': metadata.get('type', 'FIELD')
                }

            # Add constraint info
            if field:
                constraints = semantic.get('constraints', [])
                for constraint in constraints:
                    constraint_type = constraint.get('type', 'unknown')
                    fields[field]['constraints'].append(constraint_type)

        # Format fields info
        lines = []
        for field_name, info in fields.items():
            constraints_str = ', '.join(set(info['constraints'])) if info['constraints'] else 'No specific constraints'
            lines.append(f"- {field_name}: {constraints_str}")

        return "\n".join(lines) if lines else "No specific fields identified"

    def _select_rules_to_violate(self, qc_rules: List[Dict[str, Any]], num_rows: int) -> str:
        """Select which rules to violate for each row."""
        violations = []

        # Distribute violations across different rules
        for i in range(min(num_rows, len(qc_rules))):
            rule = qc_rules[i % len(qc_rules)]
            metadata = rule.get('metadata', {})

            code = metadata.get('code', f'RULE_{i}')
            field = metadata.get('field', 'Unknown')
            name = metadata.get('name', 'Unknown rule')

            violations.append(f"Row {i+1}: Violate [{code}] {field} - {name}")

        return "\n".join(violations)

    def _call_llm(self, prompt: str, dataset_type: str = "dataset") -> str:
        """Call the LLM and return the response with streaming."""
        try:
            print(f"\n{'='*60}")
            print(f"🤖 LLM Streaming - Generating {dataset_type}")
            print(f"{'='*60}")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a data generation expert. Generate realistic CSV data exactly as requested. Return ONLY the CSV data without any markdown formatting or explanations."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=4000,
                stream=True
            )

            full_response = ""
            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    print(content, end='', flush=True)

            print(f"\n{'='*60}")
            print(f"✅ {dataset_type} generation complete!")
            print(f"{'='*60}\n")

            return full_response.strip()

        except Exception as e:
            print(f"\n❌ Error: {str(e)}\n")
            raise Exception(f"LLM API call failed: {str(e)}")

    def _parse_csv_response(self, response: str) -> Dict[str, Any]:
        """Parse CSV response from LLM."""
        # Remove markdown code blocks if present
        response = response.replace('```csv', '').replace('```', '').strip()

        # Parse CSV
        try:
            csv_reader = csv.reader(io.StringIO(response))
            rows = list(csv_reader)

            if len(rows) < 2:
                raise ValueError("CSV must have at least headers and one data row")

            headers = rows[0]
            data_rows = rows[1:]

            return {
                'headers': headers,
                'rows': data_rows
            }

        except Exception as e:
            raise Exception(f"Failed to parse CSV response: {str(e)}\nResponse: {response[:500]}")

    def _extract_violations_from_response(self, response: str) -> List[str]:
        """Extract violation information from the response."""
        # If there's a 'violated_rule' column, extract those values
        try:
            csv_reader = csv.reader(io.StringIO(response.replace('```csv', '').replace('```', '').strip()))
            rows = list(csv_reader)

            if len(rows) > 1:
                headers = rows[0]
                if 'violated_rule' in headers:
                    idx = headers.index('violated_rule')
                    return [row[idx] for row in rows[1:] if len(row) > idx]

        except:
            pass

        return []


def generate_datasets_for_table(
    parsed_table_data: Dict[str, Any],
    num_valid_rows: int = 10,
    num_invalid_rows: int = 10
) -> Dict[str, Any]:
    """
    Generate datasets for a single table.

    Args:
        parsed_table_data: Parsed QC data from qc_parser (single table)
        num_valid_rows: Number of valid rows to generate
        num_invalid_rows: Number of invalid rows to generate

    Returns:
        Dictionary with both valid and invalid datasets
    """
    generator = DatasetGenerator()

    table_schema = {
        'table_name': parsed_table_data.get('table_name'),
        'table_filename': parsed_table_data.get('table_filename')
    }

    qc_rules = parsed_table_data.get('qc_rules', [])

    return generator.generate_datasets(
        table_schema,
        qc_rules,
        num_valid_rows,
        num_invalid_rows
    )


def main():
    """Test the dataset generator with sample data."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python dataset_generator.py <path_to_parsed_json>")
        sys.exit(1)

    # Load parsed QC JSON
    json_path = sys.argv[1]
    with open(json_path, 'r', encoding='utf-8') as f:
        parsed_data = json.load(f)

    # Get first table
    if 'tables' in parsed_data and len(parsed_data['tables']) > 0:
        table_data = parsed_data['tables'][0]

        print(f"Generating datasets for table: {table_data['table_name']}")
        print("=" * 60)

        # Generate datasets
        result = generate_datasets_for_table(table_data, num_valid_rows=5, num_invalid_rows=5)

        # Save results
        output_dir = 'output/datasets'
        os.makedirs(output_dir, exist_ok=True)

        table_name = result['table_name']

        # Save valid dataset
        valid_csv_path = f"{output_dir}/{table_name}_VALID.csv"
        with open(valid_csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(result['valid_dataset']['headers'])
            writer.writerows(result['valid_dataset']['rows'])

        print(f"✓ Valid dataset saved to: {valid_csv_path}")

        # Save invalid dataset
        invalid_csv_path = f"{output_dir}/{table_name}_INVALID.csv"
        with open(invalid_csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(result['invalid_dataset']['headers'])
            writer.writerows(result['invalid_dataset']['rows'])

        print(f"✓ Invalid dataset saved to: {invalid_csv_path}")

        # Save metadata
        metadata_path = f"{output_dir}/{table_name}_metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(result['metadata'], f, indent=2)

        print(f"✓ Metadata saved to: {metadata_path}")
        print("=" * 60)
        print("Dataset generation complete!")

    else:
        print("Error: No tables found in parsed JSON")
        sys.exit(1)


if __name__ == "__main__":
    main()
