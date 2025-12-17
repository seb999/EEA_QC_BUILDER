"""
QC Parser Service - Simple Entry Point

Two main functions:
1. Parse QC rules from CSV → Generate JSON
2. Use JSON + LLM → Generate test datasets
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
import csv
import io

# Import parser modules (for JSON generation)
from parser.qc_parser import QCParser

# Import dataset generator modules (for LLM dataset generation)
from dataset_generator.generator import generate_datasets_for_table

app = Flask(__name__)
CORS(app)

# Configuration
ALLOWED_EXTENSIONS = {'csv'}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'QC Parser Service',
        'version': '1.0.0'
    })


@app.route('/api/v1/parse', methods=['POST'])
def parse_qc_and_tables():
    """
    STEP 1: Parse QC rules and generate JSON

    Takes: CSV files (QC rules + table schemas)
    Returns: JSON with parsed QC rules
    """
    # Check if QC file is present
    if 'qc_file' not in request.files:
        return jsonify({'error': 'qc_file is required'}), 400

    qc_file = request.files['qc_file']
    if qc_file.filename == '':
        return jsonify({'error': 'No QC file selected'}), 400
    if not allowed_file(qc_file.filename):
        return jsonify({'error': 'QC file must be a CSV file'}), 400

    # Get table files
    table_files = request.files.getlist('table_files[]')
    if not table_files:
        if 'table_file' in request.files:
            table_files = [request.files['table_file']]
    if not table_files or len(table_files) == 0:
        return jsonify({'error': 'At least one table file is required'}), 400

    try:
        # Save QC file temporarily
        qc_filename = secure_filename(qc_file.filename)
        qc_temp = tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False)
        qc_file.save(qc_temp.name)
        qc_temp.close()

        # Parse QC file using QCParser
        parser = QCParser(qc_temp.name)
        all_rules = parser.parse()

        # Process each table
        tables_data = []
        for table_file in table_files:
            if table_file.filename == '' or not allowed_file(table_file.filename):
                continue

            table_filename = secure_filename(table_file.filename)
            table_name = os.path.splitext(table_filename)[0]

            # Filter rules for this table
            table_rules = [r for r in all_rules if r['metadata']['table'] == table_name]

            # Calculate statistics
            table_summary = {
                'table_name': table_name,
                'table_filename': table_filename,
                'rules_count': len(table_rules),
                'rules_with_sql': sum(1 for r in table_rules if r['expression']['has_sql']),
                'rules_without_sql': sum(1 for r in table_rules if not r['expression']['has_sql']),
                'by_level': {},
                'by_type': {}
            }

            for rule in table_rules:
                level = rule['metadata']['level']
                qc_type = rule['metadata']['type']
                table_summary['by_level'][level] = table_summary['by_level'].get(level, 0) + 1
                table_summary['by_type'][qc_type] = table_summary['by_type'].get(qc_type, 0) + 1

            tables_data.append({
                'table_name': table_name,
                'table_filename': table_filename,
                'summary': table_summary,
                'qc_rules': table_rules
            })

        # Clean up
        os.unlink(qc_temp.name)

        return jsonify({
            'success': True,
            'qc_filename': qc_filename,
            'total_tables': len(tables_data),
            'total_qc_rules': len(all_rules),
            'tables': tables_data
        }), 200

    except Exception as e:
        if 'qc_temp' in locals():
            try:
                os.unlink(qc_temp.name)
            except:
                pass
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }), 500


@app.route('/api/v1/generate-datasets', methods=['POST'])
def generate_test_datasets():
    """
    STEP 2: Generate test datasets using LLM

    Takes: JSON from STEP 1 + number of rows
    Returns: Valid & Invalid datasets
    """
    try:
        data = request.get_json()

        if not data or 'table_data' not in data:
            return jsonify({'error': 'table_data is required'}), 400

        table_data = data['table_data']
        num_valid_rows = data.get('num_valid_rows', 10)
        num_invalid_rows = data.get('num_invalid_rows', 10)

        # Validate
        if not isinstance(num_valid_rows, int) or num_valid_rows < 1 or num_valid_rows > 100:
            return jsonify({'error': 'num_valid_rows must be between 1 and 100'}), 400
        if not isinstance(num_invalid_rows, int) or num_invalid_rows < 1 or num_invalid_rows > 100:
            return jsonify({'error': 'num_invalid_rows must be between 1 and 100'}), 400

        # Generate datasets using LLM
        print(f"Generating datasets for table: {table_data.get('table_name', 'Unknown')}")
        result = generate_datasets_for_table(
            table_data,
            num_valid_rows=num_valid_rows,
            num_invalid_rows=num_invalid_rows
        )

        return jsonify({
            'success': True,
            'table_name': result['table_name'],
            'valid_dataset': result['valid_dataset'],
            'invalid_dataset': result['invalid_dataset'],
            'metadata': result['metadata']
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }), 500


@app.route('/api/v1/download-dataset/<dataset_type>/<table_name>', methods=['POST'])
def download_dataset(dataset_type, table_name):
    """
    STEP 3: Download generated dataset as CSV

    Takes: Dataset data (headers + rows)
    Returns: CSV file
    """
    try:
        data = request.get_json()

        if not data or 'headers' not in data or 'rows' not in data:
            return jsonify({'error': 'headers and rows are required'}), 400

        headers = data['headers']
        rows = data['rows']

        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)

        # Convert to bytes
        csv_bytes = io.BytesIO(output.getvalue().encode('utf-8'))
        filename = f"{table_name}_{dataset_type.upper()}.csv"

        return send_file(
            csv_bytes,
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='QC Parser Service')
    parser.add_argument('--host', default='0.0.0.0', help='Host (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=5000, help='Port (default: 5000)')
    parser.add_argument('--debug', action='store_true', help='Debug mode')

    args = parser.parse_args()

    print("=" * 60)
    print("QC Parser Service")
    print("=" * 60)
    print(f"URL: http://{args.host}:{args.port}")
    print(f"\nEndpoints:")
    print(f"  Health:       GET  /health")
    print(f"  Parse JSON:   POST /api/v1/parse")
    print(f"  Generate DS:  POST /api/v1/generate-datasets")
    print(f"  Download CSV: POST /api/v1/download-dataset/<type>/<table>")
    print("=" * 60)

    app.run(host=args.host, port=args.port, debug=args.debug)
