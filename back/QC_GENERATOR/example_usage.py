"""
Example script demonstrating programmatic usage of the QC Parser.
"""

from qc_parser import QCParser, SQLSemanticExtractor
import json


def main():
    print("=" * 60)
    print("QC Parser - Example Usage")
    print("=" * 60)

    # Parse QC rules from CSV
    print("\n1. Parsing QC rules from CSV...")
    parser = QCParser("data/QC.csv")
    rules = parser.parse()
    print(f"   * Parsed {len(rules)} QC rules")

    # Get statistics
    print("\n2. Getting statistics...")
    stats = parser.get_statistics()
    print(f"   * Total rules: {stats['total_rules']}")
    print(f"   * With SQL: {stats['with_sql']}")
    print(f"   * Without SQL: {stats['without_sql']}")
    print(f"   * Parse errors: {stats['sql_parse_errors']}")

    # Find most complex query
    print("\n3. Finding most complex SQL query...")
    complex_rules = [
        r for r in rules
        if r["expression"]["has_sql"]
        and r["expression"]["sql_analysis"]
        and r["expression"]["sql_analysis"].get("parsed_successfully", False)
    ]

    if complex_rules:
        most_complex = max(
            complex_rules,
            key=lambda r: r["expression"]["sql_analysis"]["complexity_score"]
        )
        complexity = most_complex["expression"]["sql_analysis"]["complexity_score"]
        print(f"   * Most complex query: {most_complex['metadata']['code']}")
        print(f"   * Complexity score: {complexity}")
        print(f"   * Tables: {len(most_complex['expression']['sql_analysis']['tables'])}")
        print(f"   * Joins: {len(most_complex['expression']['sql_analysis']['joins'])}")

    # Analyze specific QC types
    print("\n4. Analyzing QC types...")
    for qc_type, count in stats['by_type'].items():
        print(f"   * {qc_type}: {count} rules")

    # Find rules with joins
    print("\n5. Finding rules with JOIN operations...")
    rules_with_joins = [
        r for r in rules
        if r["expression"]["has_sql"]
        and r["expression"]["sql_analysis"]
        and r["expression"]["sql_analysis"].get("parsed_successfully", False)
        and len(r["expression"]["sql_analysis"]["joins"]) > 0
    ]
    print(f"   * Found {len(rules_with_joins)} rules with JOINs")

    if rules_with_joins:
        example = rules_with_joins[0]
        print(f"\n   Example: {example['metadata']['code']}")
        print(f"   Tables joined: {example['expression']['sql_analysis']['tables']}")
        for join in example['expression']['sql_analysis']['joins']:
            print(f"   - {join['type']} JOIN: {join['table']}")

    # Find rules with aggregations
    print("\n6. Finding rules with aggregations...")
    rules_with_agg = [
        r for r in rules
        if r["expression"]["has_sql"]
        and r["expression"]["sql_analysis"]
        and r["expression"]["sql_analysis"].get("parsed_successfully", False)
        and len(r["expression"]["sql_analysis"]["aggregations"]) > 0
    ]
    print(f"   * Found {len(rules_with_agg)} rules with aggregations")

    if rules_with_agg:
        agg_functions = {}
        for rule in rules_with_agg:
            for agg in rule["expression"]["sql_analysis"]["aggregations"]:
                func = agg["function"]
                agg_functions[func] = agg_functions.get(func, 0) + 1

        print("   Aggregation functions used:")
        for func, count in sorted(agg_functions.items(), key=lambda x: x[1], reverse=True):
            print(f"   - {func}: {count} times")

    # Analyze by error level
    print("\n7. Analyzing by error level...")
    for level, count in sorted(stats['by_level'].items(), key=lambda x: x[1], reverse=True):
        percentage = (count / stats['total_rules']) * 100
        print(f"   * {level}: {count} rules ({percentage:.1f}%)")

    # Export to JSON
    print("\n8. Exporting to JSON...")
    output_file = "output/qc_rules.json"
    parser.to_json(output_file, indent=2)
    print(f"   * Exported to: {output_file}")

    # Sample a simple and complex rule
    print("\n9. Sample QC rules:")
    print("\n   --- Simple QC (no SQL) ---")
    simple_rule = next(r for r in rules if not r["expression"]["has_sql"])
    print(f"   Code: {simple_rule['metadata']['code']}")
    print(f"   Name: {simple_rule['metadata']['name']}")
    print(f"   Type: {simple_rule['metadata']['type']}")
    print(f"   Level: {simple_rule['metadata']['level']}")

    print("\n   --- Complex QC (with SQL) ---")
    if complex_rules:
        complex_rule = complex_rules[0]
        print(f"   Code: {complex_rule['metadata']['code']}")
        print(f"   Name: {complex_rule['metadata']['name']}")
        print(f"   Type: {complex_rule['metadata']['type']}")
        print(f"   Level: {complex_rule['metadata']['level']}")
        print(f"   Complexity: {complex_rule['expression']['sql_analysis']['complexity_score']}")
        print(f"   Tables: {', '.join(complex_rule['expression']['sql_analysis']['tables'])}")
        print(f"   Columns: {len(complex_rule['expression']['sql_analysis']['columns'])}")

    print("\n" + "=" * 60)
    print("Example completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
