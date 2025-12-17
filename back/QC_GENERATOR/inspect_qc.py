"""
Utility script to inspect specific QC rules by code.
"""

import sys
import json
from qc_parser import QCParser


def print_rule_details(rule):
    """Pretty print a QC rule with all its details."""
    print("\n" + "=" * 80)
    print(f"QC Code: {rule['metadata']['code']}")
    print("=" * 80)

    # Metadata
    print("\n[METADATA]")
    print(f"  Table:        {rule['metadata']['table']}")
    print(f"  Field:        {rule['metadata']['field']}")
    print(f"  Name:         {rule['metadata']['name']}")
    print(f"  Description:  {rule['metadata']['description']}")
    print(f"  Message:      {rule['metadata']['message']}")
    print(f"  Type:         {rule['metadata']['type']}")
    print(f"  Level:        {rule['metadata']['level']}")
    print(f"  Status:       {'Active' if rule['metadata']['status'] else 'Inactive'}")

    # SQL Expression
    print("\n[EXPRESSION]")
    if rule['expression']['has_sql']:
        print(f"  Has SQL:      Yes")
        print(f"\n  SQL Query:")
        print("  " + "-" * 76)
        for line in rule['expression']['raw_sql'].split('\n'):
            print(f"  {line}")
        print("  " + "-" * 76)

        # SQL Analysis
        sql_analysis = rule['expression']['sql_analysis']
        if sql_analysis and sql_analysis.get('parsed_successfully', False):
            print("\n[SQL ANALYSIS]")
            print(f"  Parse Status:     SUCCESS")
            print(f"  Complexity Score: {sql_analysis['complexity_score']}")

            if sql_analysis['tables']:
                print(f"\n  Tables ({len(sql_analysis['tables'])}):")
                for table in sql_analysis['tables']:
                    print(f"    - {table}")

            if sql_analysis['columns']:
                print(f"\n  Columns ({len(sql_analysis['columns'])}):")
                for col in sorted(sql_analysis['columns']):
                    print(f"    - {col}")

            if sql_analysis['joins']:
                print(f"\n  Joins ({len(sql_analysis['joins'])}):")
                for join in sql_analysis['joins']:
                    print(f"    - {join['type']} JOIN: {join['table']}")
                    if join['on_condition']:
                        print(f"      ON: {join['on_condition']}")

            if sql_analysis['where_conditions']:
                print(f"\n  WHERE Conditions ({len(sql_analysis['where_conditions'])}):")
                for i, condition in enumerate(sql_analysis['where_conditions'], 1):
                    print(f"    {i}. Type: {condition['type']}")
                    print(f"       Condition: {condition['condition'][:100]}...")

            if sql_analysis['aggregations']:
                print(f"\n  Aggregations ({len(sql_analysis['aggregations'])}):")
                for agg in sql_analysis['aggregations']:
                    print(f"    - {agg['function']}({agg['argument']})")

            if sql_analysis['functions']:
                print(f"\n  Functions Used: {', '.join(sorted(sql_analysis['functions']))}")

            if sql_analysis['operators']:
                print(f"\n  Operators Used: {', '.join(sorted(sql_analysis['operators']))}")

            if sql_analysis['subquery_count'] > 0:
                print(f"\n  Subqueries: {sql_analysis['subquery_count']}")

        elif sql_analysis:
            print("\n[SQL ANALYSIS]")
            print(f"  Parse Status: FAILED")
            print(f"  Error Type:   {sql_analysis.get('error_type', 'Unknown')}")
            print(f"  Error:        {sql_analysis.get('error', 'Unknown error')}")
    else:
        print(f"  Has SQL:      No")
        print(f"  Note:         This is a simple field validation rule")

    print("\n" + "=" * 80)


def main():
    if len(sys.argv) < 2:
        print("Usage: python inspect_qc.py <QC_CODE> [QC_CODE2 ...]")
        print("\nExample:")
        print("  python inspect_qc.py FC3")
        print("  python inspect_qc.py 01a_mandatory_resultUom_missing FC3")
        print("\nOr use 'list' to show all QC codes:")
        print("  python inspect_qc.py list")
        sys.exit(1)

    # Parse all QC rules
    print("Loading QC rules from CSV...")
    parser = QCParser("data/QC.csv")
    rules = parser.parse()
    print(f"Loaded {len(rules)} QC rules\n")

    # Build index by code
    rules_by_code = {rule['metadata']['code']: rule for rule in rules}

    # Handle list command
    if sys.argv[1].lower() == 'list':
        print("Available QC Codes:")
        print("-" * 80)

        # Group by type
        by_type = {}
        for rule in rules:
            qc_type = rule['metadata']['type']
            if qc_type not in by_type:
                by_type[qc_type] = []
            by_type[qc_type].append(rule)

        for qc_type in sorted(by_type.keys()):
            print(f"\n{qc_type} ({len(by_type[qc_type])} rules):")
            for rule in by_type[qc_type]:
                has_sql = "SQL" if rule['expression']['has_sql'] else "No SQL"
                print(f"  {rule['metadata']['code']:40} [{rule['metadata']['level']:8}] [{has_sql}]")

        print("\n" + "-" * 80)
        print(f"\nTotal: {len(rules)} QC rules")
        print(f"  - With SQL: {sum(1 for r in rules if r['expression']['has_sql'])}")
        print(f"  - Without SQL: {sum(1 for r in rules if not r['expression']['has_sql'])}")
        sys.exit(0)

    # Inspect specified QC codes
    for qc_code in sys.argv[1:]:
        if qc_code in rules_by_code:
            print_rule_details(rules_by_code[qc_code])
        else:
            print(f"\nERROR: QC code '{qc_code}' not found!")
            print(f"Use 'python inspect_qc.py list' to see all available codes")


if __name__ == "__main__":
    main()
