"""
Test script for the QC Parser Service - Tests with all tables
"""

import requests
import json
import os

def test_service():
    """Test the QC Parser Service with all table files."""

    print("Testing QC Parser Service...")
    print("-" * 60)

    # 1. Test health endpoint
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get('http://localhost:5005/health')
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ERROR: {e}")
        print("   Make sure the service is running:")
        print("   python qc_parser_service.py")
        return

    # 2. Test parse endpoint with ALL tables
    print("\n2. Testing parse endpoint with ALL tables...")
    try:
        # Prepare files
        files = [
            ('qc_file', open('data/QC.csv', 'rb')),
        ]

        # Add all table files
        for filename in os.listdir('data/table'):
            if filename.endswith('.csv'):
                filepath = os.path.join('data', 'table', filename)
                files.append(('table_files[]', open(filepath, 'rb')))

        print(f"   Uploading {len(files)-1} table files...")

        response = requests.post('http://localhost:5005/api/v1/parse', files=files)

        print(f"   Status: {response.status_code}")

        if response.status_code == 200:
            result = response.json()

            print(f"   * Success: {result['success']}")
            print(f"   * QC file: {result['qc_filename']}")
            print(f"   * Total QC rules: {result['total_qc_rules']}")
            print(f"   * Total tables: {result['total_tables']}")

            print(f"\n   Results by Table:")
            print("   " + "-" * 56)

            for table in result['tables']:
                print(f"\n   Table: {table['table_name']}")
                print(f"   - Rules: {table['summary']['rules_count']}")
                print(f"   - With SQL: {table['summary']['rules_with_sql']}")
                print(f"   - Without SQL: {table['summary']['rules_without_sql']}")
                print(f"   - By Level: {table['summary']['by_level']}")
                print(f"   - By Type: {table['summary']['by_type']}")

            # Save output to file
            output_file = 'output/all_tables_qc_rules.json'
            os.makedirs('output', exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            print(f"\n   * Output saved to: {output_file}")
            print(f"\n   * TEST PASSED!")

        else:
            print(f"   ERROR: {response.text}")

    except FileNotFoundError as e:
        print(f"   ERROR: File not found - {e}")
        print("   Make sure you're in the project directory with data/table/ folder")
    except Exception as e:
        print(f"   ERROR: {e}")

    print("\n" + "-" * 60)

if __name__ == "__main__":
    test_service()
