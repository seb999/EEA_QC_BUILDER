"""
QC Parser Service - File Upload REST API

A Flask-based REST API that accepts uploaded CSV files,
parses QC rules, and returns normalized JSON for all tables.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
from qc_parser import QCParser

app = Flask(__name__)
CORS(app)

# Configuration
ALLOWED_EXTENSIONS = {'csv'}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size

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
    Parse uploaded QC CSV file and multiple table CSV files.

    Request (multipart/form-data):
        - qc_file: QC CSV file (required)
        - table_files[]: One or more table schema CSV files (required)

    Response:
        JSON with parsed QC rules grouped by table
    """
    # Check if QC file is present
    if 'qc_file' not in request.files:
        return jsonify({'error': 'qc_file is required'}), 400

    qc_file = request.files['qc_file']

    if qc_file.filename == '':
        return jsonify({'error': 'No QC file selected'}), 400

    if not allowed_file(qc_file.filename):
        return jsonify({'error': 'QC file must be a CSV file'}), 400

    # Get all table files (can be multiple)
    table_files = request.files.getlist('table_files[]')

    # If no table_files[], try table_file (single)
    if not table_files:
        if 'table_file' in request.files:
            table_files = [request.files['table_file']]

    if not table_files or len(table_files) == 0:
        return jsonify({'error': 'At least one table file is required (use table_files[] or table_file)'}), 400

    try:
        # Save QC file to temporary location
        qc_filename = secure_filename(qc_file.filename)
        qc_temp = tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False)
        qc_file.save(qc_temp.name)
        qc_temp.close()

        # Parse QC file once
        parser = QCParser(qc_temp.name)
        all_rules = parser.parse()

        # Process each table file
        tables_data = []

        for table_file in table_files:
            if table_file.filename == '':
                continue

            if not allowed_file(table_file.filename):
                continue

            table_filename = secure_filename(table_file.filename)
            table_name = os.path.splitext(table_filename)[0]

            # Filter rules for this table
            table_rules = [r for r in all_rules if r['metadata']['table'] == table_name]

            # Calculate statistics for this table
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

        # Overall summary
        response = {
            'success': True,
            'qc_filename': qc_filename,
            'total_tables': len(tables_data),
            'total_qc_rules': len(all_rules),
            'tables': tables_data
        }

        # Clean up QC temp file
        os.unlink(qc_temp.name)

        return jsonify(response), 200

    except Exception as e:
        # Clean up on error
        try:
            if 'qc_temp' in locals():
                os.unlink(qc_temp.name)
        except:
            pass

        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }), 500


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='QC Parser Service')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=5000, help='Port to bind to (default: 5000)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()

    print("=" * 60)
    print("QC Parser Service - File Upload API")
    print("=" * 60)
    print(f"URL: http://{args.host}:{args.port}")
    print(f"Health Check: http://{args.host}:{args.port}/health")
    print(f"Parse Endpoint: http://{args.host}:{args.port}/api/v1/parse")
    print(f"Method: POST (multipart/form-data)")
    print(f"Fields: qc_file, table_files[]")
    print("=" * 60)

    app.run(host=args.host, port=args.port, debug=args.debug)
