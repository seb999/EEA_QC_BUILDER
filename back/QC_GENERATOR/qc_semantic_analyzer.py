"""
QC Semantic Analyzer

Maps parsed SQL to high-level QC categories and extracts structured constraints.
Detects: null-checks, range-checks, uniqueness, referential integrity, cardinality, outliers.
"""

from typing import Dict, List, Any, Optional
import re


class QCSemanticAnalyzer:
    """Analyzes QC rules and categorizes them into semantic types."""

    # QC Categories
    CATEGORIES = {
        'NULL_CHECK': 'Validates that values are not null or empty',
        'RANGE_CHECK': 'Validates that values are within acceptable ranges',
        'UNIQUENESS': 'Validates that values are unique within a dataset',
        'REFERENTIAL_INTEGRITY': 'Validates relationships between tables',
        'CARDINALITY': 'Validates required fields are present',
        'DATA_TYPE': 'Validates data type and format',
        'VALUE_LIST': 'Validates against a list of allowed values',
        'PATTERN_MATCH': 'Validates against a pattern or format',
        'CONSISTENCY': 'Validates logical consistency between fields',
        'OUTLIER': 'Detects statistical outliers or unusual values',
        'CROSS_FIELD': 'Validates relationships between multiple fields',
        'TEMPORAL': 'Validates date/time constraints',
        'MANDATORY': 'Validates mandatory field requirements',
        'CONFLICT': 'Detects conflicting or contradictory values'
    }

    def analyze(self, qc_rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a QC rule and categorize it semantically.

        Args:
            qc_rule: Parsed QC rule dictionary

        Returns:
            Enhanced QC rule with semantic analysis
        """
        metadata = qc_rule['metadata']
        expression = qc_rule['expression']

        # Initialize semantic analysis
        semantic = {
            'category': None,
            'subcategory': None,
            'constraints': [],
            'fields_checked': [],
            'reference_tables': [],
            'description': ''
        }

        # Analyze based on metadata and SQL
        semantic = self._categorize_qc(metadata, expression, semantic)
        semantic = self._extract_constraints(metadata, expression, semantic)

        # Add semantic analysis to the rule
        qc_rule['semantic_analysis'] = semantic

        return qc_rule

    def _categorize_qc(self, metadata: Dict, expression: Dict, semantic: Dict) -> Dict:
        """Categorize the QC rule based on metadata and SQL patterns."""

        qc_type = metadata.get('type', '')
        qc_name = metadata.get('name', '').lower()
        qc_code = metadata.get('code', '').lower()
        qc_desc = metadata.get('description', '').lower()
        raw_sql = expression.get('raw_sql', '').lower()

        # Field cardinality checks
        if 'cardinality' in qc_name or 'fc' in qc_code:
            semantic['category'] = 'CARDINALITY'
            semantic['subcategory'] = 'REQUIRED_FIELD'
            semantic['description'] = 'Checks if required field is present and not empty'

        # Field type checks
        elif 'field type' in qc_name or 'ft' in qc_code:
            semantic['category'] = 'DATA_TYPE'
            if 'date' in qc_name:
                semantic['subcategory'] = 'DATE_FORMAT'
            elif 'number' in qc_name or 'integer' in qc_name or 'decimal' in qc_name:
                semantic['subcategory'] = 'NUMERIC_TYPE'
            elif 'codelist' in qc_name:
                semantic['subcategory'] = 'CODELIST_VALUE'
            else:
                semantic['subcategory'] = 'TYPE_VALIDATION'
            semantic['description'] = f'Validates field has correct data type: {qc_name}'

        # Table uniqueness
        elif 'uniqueconstraint' in qc_name or 'tu' in qc_code:
            semantic['category'] = 'UNIQUENESS'
            semantic['subcategory'] = 'COMPOSITE_KEY'
            semantic['description'] = 'Validates uniqueness of field combination'

        # Link/referential integrity
        elif 'link' in qc_name or 'tc' in qc_code:
            semantic['category'] = 'REFERENTIAL_INTEGRITY'
            semantic['subcategory'] = 'FOREIGN_KEY'
            semantic['description'] = 'Validates reference to another table/list'

        # Mandatory field checks
        elif 'mandatory' in qc_name or 'mandatory' in qc_desc:
            semantic['category'] = 'MANDATORY'
            if 'missing' in qc_name:
                semantic['subcategory'] = 'MISSING_UNJUSTIFIED'
            elif 'reported' in qc_name:
                semantic['subcategory'] = 'UNEXPECTED_VALUE'
            semantic['description'] = 'Validates mandatory field rules'

        # Conflict checks
        elif 'conflict' in qc_name or 'conflict' in qc_desc:
            semantic['category'] = 'CONFLICT'
            semantic['subcategory'] = 'LOGICAL_INCONSISTENCY'
            semantic['description'] = 'Detects conflicting or contradictory values'

        # Range/limit checks
        elif 'limit' in qc_name or 'range' in qc_name:
            semantic['category'] = 'RANGE_CHECK'
            if 'acceptable' in qc_name:
                semantic['subcategory'] = 'ACCEPTABLE_RANGE'
            elif 'expected' in qc_name:
                semantic['subcategory'] = 'EXPECTED_RANGE'
            semantic['description'] = 'Validates value is within acceptable range'

        # Constraint checks
        elif 'constraint' in qc_name:
            semantic['category'] = 'CONSISTENCY'
            semantic['subcategory'] = 'VALUE_CONSTRAINT'
            semantic['description'] = 'Validates defined constraints'

        # Analyze SQL patterns if category not determined
        if not semantic['category'] and expression.get('has_sql'):
            sql_analysis = expression.get('sql_analysis', {})

            # NULL checks
            if 'is null' in raw_sql or 'is not null' in raw_sql:
                semantic['category'] = 'NULL_CHECK'
                semantic['subcategory'] = 'NULL_VALIDATION'
                semantic['description'] = 'Checks for null or missing values'

            # IN clause - value list validation
            elif ' in (' in raw_sql:
                semantic['category'] = 'VALUE_LIST'
                semantic['subcategory'] = 'ALLOWED_VALUES'
                semantic['description'] = 'Validates against list of allowed values'

            # BETWEEN or comparison operators - range checks
            elif 'between' in raw_sql or any(op in raw_sql for op in ['>', '<', '>=', '<=']):
                semantic['category'] = 'RANGE_CHECK'
                semantic['subcategory'] = 'NUMERIC_RANGE'
                semantic['description'] = 'Validates numeric range constraints'

            # JOIN - referential integrity
            elif sql_analysis.get('joins') and len(sql_analysis['joins']) > 0:
                semantic['category'] = 'REFERENTIAL_INTEGRITY'
                semantic['subcategory'] = 'CROSS_TABLE_VALIDATION'
                semantic['description'] = 'Validates data across multiple tables'

            # Multiple fields in WHERE - cross-field validation
            elif sql_analysis.get('columns') and len(sql_analysis['columns']) > 2:
                semantic['category'] = 'CROSS_FIELD'
                semantic['subcategory'] = 'MULTI_FIELD_VALIDATION'
                semantic['description'] = 'Validates relationships between multiple fields'

        # Default if still not categorized
        if not semantic['category']:
            semantic['category'] = 'CONSISTENCY'
            semantic['subcategory'] = 'GENERAL_VALIDATION'
            semantic['description'] = 'General data validation rule'

        return semantic

    def _extract_constraints(self, metadata: Dict, expression: Dict, semantic: Dict) -> Dict:
        """Extract structured constraints from the QC rule."""

        field = metadata.get('field', '')
        raw_sql = expression.get('raw_sql', '').lower()
        sql_analysis = expression.get('sql_analysis', {})

        # Add checked field
        if field:
            semantic['fields_checked'].append(field)

        # Extract additional fields from SQL
        if sql_analysis and sql_analysis.get('parsed_successfully'):
            columns = sql_analysis.get('columns', [])
            for col in columns:
                col_name = col.split('.')[-1]  # Get column name without table prefix
                if col_name not in semantic['fields_checked']:
                    semantic['fields_checked'].append(col_name)

        # Extract constraints based on category
        if semantic['category'] == 'RANGE_CHECK':
            semantic['constraints'].extend(self._extract_range_constraints(raw_sql, metadata))

        elif semantic['category'] == 'VALUE_LIST':
            semantic['constraints'].extend(self._extract_value_list_constraints(raw_sql))

        elif semantic['category'] == 'NULL_CHECK' or semantic['category'] == 'CARDINALITY':
            semantic['constraints'].append({
                'type': 'NOT_NULL',
                'field': field,
                'required': True
            })

        elif semantic['category'] == 'UNIQUENESS':
            semantic['constraints'].append({
                'type': 'UNIQUE',
                'fields': self._extract_unique_fields(metadata.get('description', '')),
                'scope': 'TABLE'
            })

        elif semantic['category'] == 'REFERENTIAL_INTEGRITY':
            if sql_analysis and sql_analysis.get('tables'):
                semantic['reference_tables'] = sql_analysis['tables']
            semantic['constraints'].append({
                'type': 'FOREIGN_KEY',
                'field': field,
                'references': semantic['reference_tables']
            })

        elif semantic['category'] == 'DATA_TYPE':
            dtype = self._extract_data_type(metadata.get('name', ''))
            semantic['constraints'].append({
                'type': 'DATA_TYPE',
                'field': field,
                'expected_type': dtype
            })

        return semantic

    def _extract_range_constraints(self, raw_sql: str, metadata: Dict) -> List[Dict]:
        """Extract range constraints from SQL."""
        constraints = []

        # Look for numeric comparisons
        patterns = [
            (r'(\w+)\s*>=\s*([0-9.]+)', 'MIN', 'inclusive'),
            (r'(\w+)\s*>\s*([0-9.]+)', 'MIN', 'exclusive'),
            (r'(\w+)\s*<=\s*([0-9.]+)', 'MAX', 'inclusive'),
            (r'(\w+)\s*<\s*([0-9.]+)', 'MAX', 'exclusive'),
        ]

        for pattern, bound_type, inclusive in patterns:
            matches = re.findall(pattern, raw_sql)
            for field, value in matches:
                constraints.append({
                    'type': 'RANGE',
                    'field': field,
                    'bound_type': bound_type,
                    'value': float(value),
                    'inclusive': inclusive == 'inclusive'
                })

        return constraints

    def _extract_value_list_constraints(self, raw_sql: str) -> List[Dict]:
        """Extract value list constraints from SQL."""
        constraints = []

        # Extract IN clause values
        in_pattern = r'in\s*\((.*?)\)'
        matches = re.findall(in_pattern, raw_sql, re.IGNORECASE)

        for match in matches:
            # Extract values (quoted strings or numbers)
            values = re.findall(r"'([^']*)'|(\d+)", match)
            value_list = [v[0] or v[1] for v in values]

            if value_list:
                constraints.append({
                    'type': 'VALUE_LIST',
                    'allowed_values': value_list,
                    'operator': 'IN'
                })

        return constraints

    def _extract_unique_fields(self, description: str) -> List[str]:
        """Extract field names from uniqueness constraint description."""
        # Look for field names in description
        # Example: "waterBodyIdentifier, waterBodyIdentifierScheme, ... are uniques"
        words = description.split()
        fields = []

        for word in words:
            # Look for camelCase field names
            if word and word[0].islower() and any(c.isupper() for c in word):
                # Clean up punctuation
                field = re.sub(r'[,.]', '', word)
                if field:
                    fields.append(field)

        return fields

    def _extract_data_type(self, qc_name: str) -> str:
        """Extract expected data type from QC name."""
        qc_name = qc_name.lower()

        if 'date' in qc_name:
            return 'DATE'
        elif 'integer' in qc_name:
            return 'INTEGER'
        elif 'decimal' in qc_name or 'number' in qc_name:
            return 'DECIMAL'
        elif 'text' in qc_name or 'string' in qc_name:
            return 'TEXT'
        elif 'boolean' in qc_name:
            return 'BOOLEAN'
        else:
            return 'UNKNOWN'


def analyze_qc_rules(qc_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze a list of QC rules and add semantic categorization.

    Args:
        qc_rules: List of parsed QC rules

    Returns:
        List of QC rules with semantic analysis added
    """
    analyzer = QCSemanticAnalyzer()

    analyzed_rules = []
    for rule in qc_rules:
        analyzed_rule = analyzer.analyze(rule)
        analyzed_rules.append(analyzed_rule)

    return analyzed_rules


def get_rules_by_category(qc_rules: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
    """Group QC rules by semantic category."""
    by_category = {}

    for rule in qc_rules:
        if 'semantic_analysis' in rule:
            category = rule['semantic_analysis']['category']
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(rule)

    return by_category


if __name__ == "__main__":
    print("QC Semantic Analyzer")
    print("Categories:", list(QCSemanticAnalyzer.CATEGORIES.keys()))
