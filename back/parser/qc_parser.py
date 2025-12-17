"""
QC SQL Rule Parser

Parses QC SQL rules from CSV files and produces normalized JSON structures
summarizing all semantic elements of each QC using sqlglot for AST parsing.
"""

import csv
import json
from typing import Dict, List, Any, Optional, Set
from pathlib import Path
import sqlglot
from sqlglot import exp
from sqlglot.optimizer import normalize
from .qc_semantic_analyzer import QCSemanticAnalyzer


class SQLSemanticExtractor:
    """Extracts semantic information from SQL AST using sqlglot."""

    def __init__(self):
        self.tables: Set[str] = set()
        self.columns: Set[str] = set()
        self.joins: List[Dict[str, Any]] = []
        self.where_conditions: List[Dict[str, Any]] = []
        self.select_expressions: List[Dict[str, Any]] = []
        self.aggregations: List[str] = []
        self.functions: Set[str] = set()
        self.literals: List[Any] = []
        self.operators: Set[str] = set()
        self.subqueries: int = 0

    def extract(self, sql: str, dialect: str = "postgres") -> Dict[str, Any]:
        """
        Parse SQL and extract all semantic elements.

        Args:
            sql: SQL query string
            dialect: SQL dialect (default: postgres)

        Returns:
            Dictionary containing all extracted semantic elements
        """
        try:
            parsed = sqlglot.parse_one(sql, dialect=dialect)
            self._walk_ast(parsed)

            return {
                "parsed_successfully": True,
                "tables": sorted(list(self.tables)),
                "columns": sorted(list(self.columns)),
                "joins": self.joins,
                "where_conditions": self.where_conditions,
                "select_expressions": self.select_expressions,
                "aggregations": self.aggregations,
                "functions": sorted(list(self.functions)),
                "operators": sorted(list(self.operators)),
                "literals": self.literals,
                "subquery_count": self.subqueries,
                "complexity_score": self._calculate_complexity()
            }
        except Exception as e:
            return {
                "parsed_successfully": False,
                "error": str(e),
                "error_type": type(e).__name__
            }

    def _walk_ast(self, node: exp.Expression, parent_type: Optional[str] = None) -> None:
        """Recursively walk the AST and extract semantic information."""
        node_type = type(node).__name__

        # Extract table references
        if isinstance(node, exp.Table):
            table_name = self._get_qualified_name(node)
            self.tables.add(table_name)

        # Extract column references
        elif isinstance(node, exp.Column):
            col_name = self._get_qualified_name(node)
            self.columns.add(col_name)

        # Extract JOIN information
        elif isinstance(node, exp.Join):
            join_info = {
                "type": node.args.get("kind", "INNER"),
                "table": str(node.this) if node.this else None,
                "on_condition": str(node.args.get("on")) if node.args.get("on") else None
            }
            self.joins.append(join_info)

        # Extract WHERE conditions
        elif isinstance(node, exp.Where):
            self.where_conditions.append({
                "condition": str(node.this),
                "type": type(node.this).__name__
            })

        # Extract SELECT expressions
        elif isinstance(node, exp.Select):
            for expr in node.expressions:
                select_info = {
                    "expression": str(expr),
                    "alias": expr.alias if hasattr(expr, 'alias') and expr.alias else None,
                    "type": type(expr).__name__
                }
                self.select_expressions.append(select_info)

        # Extract aggregation functions
        elif isinstance(node, (exp.Count, exp.Sum, exp.Avg, exp.Min, exp.Max)):
            self.aggregations.append({
                "function": node_type,
                "argument": str(node.this) if node.this else None
            })

        # Extract function calls
        elif isinstance(node, exp.Func):
            self.functions.add(node_type)

        # Extract operators
        elif isinstance(node, (exp.Binary, exp.Unary)):
            if hasattr(node, 'key'):
                self.operators.add(node.key)

        # Extract literals
        elif isinstance(node, exp.Literal):
            self.literals.append({
                "value": node.this,
                "type": "string" if node.is_string else "number"
            })

        # Count subqueries
        elif isinstance(node, exp.Subquery):
            self.subqueries += 1

        # Recursively process child nodes
        for child in node.iter_expressions():
            self._walk_ast(child, node_type)

    def _get_qualified_name(self, node: exp.Expression) -> str:
        """Get fully qualified name for table or column."""
        parts = []
        if hasattr(node, 'catalog') and node.catalog:
            parts.append(str(node.catalog))
        if hasattr(node, 'db') and node.db:
            parts.append(str(node.db))
        if hasattr(node, 'table') and node.table:
            parts.append(str(node.table))
        if hasattr(node, 'name') and node.name:
            parts.append(str(node.name))
        if hasattr(node, 'this') and node.this and not parts:
            parts.append(str(node.this))
        return '.'.join(parts) if parts else str(node)

    def _calculate_complexity(self) -> int:
        """Calculate a complexity score for the query."""
        score = 0
        score += len(self.tables) * 2
        score += len(self.joins) * 5
        score += len(self.where_conditions) * 3
        score += len(self.aggregations) * 4
        score += self.subqueries * 10
        score += len(self.functions) * 2
        return score


class QCParser:
    """Parse QC rules from CSV and produce normalized JSON output."""

    def __init__(self, csv_path: str):
        """
        Initialize parser with CSV file path.

        Args:
            csv_path: Path to the QC CSV file
        """
        self.csv_path = Path(csv_path)
        self.qc_rules: List[Dict[str, Any]] = []

    def parse(self) -> List[Dict[str, Any]]:
        """
        Parse the QC CSV file and extract all rules.

        Returns:
            List of normalized QC rule dictionaries
        """
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            for row in reader:
                qc_rule = self._parse_qc_rule(row)
                self.qc_rules.append(qc_rule)

        return self.qc_rules

    def _parse_qc_rule(self, row: Dict[str, str]) -> Dict[str, Any]:
        """
        Parse a single QC rule from CSV row.

        Args:
            row: CSV row as dictionary

        Returns:
            Normalized QC rule dictionary
        """
        qc_rule = {
            "metadata": {
                "table": row.get("Table", "").strip(),
                "field": row.get("Field", "").strip(),
                "code": row.get("Code", "").strip(),
                "name": row.get("QC Name", "").strip(),
                "description": row.get("QC Description", "").strip(),
                "message": row.get("Message", "").strip(),
                "type": row.get("Type of QC", "").strip(),
                "level": row.get("Level Error", "").strip(),
                "creation_mode": row.get("Creation Mode", "").strip().lower() == "true",
                "status": row.get("Status", "").strip().lower() == "true",
                "valid": row.get("Valid", "").strip().lower() == "true"
            },
            "expression": {
                "raw_sql": row.get("Expression", "").strip(),
                "has_sql": bool(row.get("Expression", "").strip()),
                "sql_analysis": None
            }
        }

        # Parse SQL if present
        if qc_rule["expression"]["has_sql"]:
            extractor = SQLSemanticExtractor()
            sql_analysis = extractor.extract(qc_rule["expression"]["raw_sql"])
            qc_rule["expression"]["sql_analysis"] = sql_analysis

        # Add semantic analysis
        analyzer = QCSemanticAnalyzer()
        qc_rule = analyzer.analyze(qc_rule)

        return qc_rule

    def to_json(self, output_path: Optional[str] = None, indent: int = 2) -> str:
        """
        Convert parsed QC rules to JSON format.

        Args:
            output_path: Optional path to save JSON file
            indent: JSON indentation level

        Returns:
            JSON string
        """
        json_output = {
            "metadata": {
                "source_file": str(self.csv_path),
                "total_rules": len(self.qc_rules),
                "rules_with_sql": sum(1 for r in self.qc_rules if r["expression"]["has_sql"]),
                "rules_without_sql": sum(1 for r in self.qc_rules if not r["expression"]["has_sql"])
            },
            "qc_rules": self.qc_rules
        }

        json_str = json.dumps(json_output, indent=indent, ensure_ascii=False)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(json_str)

        return json_str

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about parsed QC rules.

        Returns:
            Dictionary with statistics
        """
        stats = {
            "total_rules": len(self.qc_rules),
            "by_type": {},
            "by_level": {},
            "by_table": {},
            "with_sql": 0,
            "without_sql": 0,
            "sql_parse_errors": 0,
            "complexity": {
                "simple": 0,
                "medium": 0,
                "complex": 0
            }
        }

        for rule in self.qc_rules:
            # Count by type
            qc_type = rule["metadata"]["type"]
            stats["by_type"][qc_type] = stats["by_type"].get(qc_type, 0) + 1

            # Count by level
            level = rule["metadata"]["level"]
            stats["by_level"][level] = stats["by_level"].get(level, 0) + 1

            # Count by table
            table = rule["metadata"]["table"]
            stats["by_table"][table] = stats["by_table"].get(table, 0) + 1

            # SQL statistics
            if rule["expression"]["has_sql"]:
                stats["with_sql"] += 1

                sql_analysis = rule["expression"]["sql_analysis"]
                if sql_analysis and not sql_analysis.get("parsed_successfully", False):
                    stats["sql_parse_errors"] += 1
                elif sql_analysis and sql_analysis.get("parsed_successfully", False):
                    complexity = sql_analysis.get("complexity_score", 0)
                    if complexity < 10:
                        stats["complexity"]["simple"] += 1
                    elif complexity < 30:
                        stats["complexity"]["medium"] += 1
                    else:
                        stats["complexity"]["complex"] += 1
            else:
                stats["without_sql"] += 1

        return stats


def main():
    """Main entry point for the QC parser."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Parse QC SQL rules from CSV and produce normalized JSON"
    )
    parser.add_argument(
        "input_csv",
        help="Path to input QC CSV file"
    )
    parser.add_argument(
        "-o", "--output",
        help="Path to output JSON file (default: stdout)"
    )
    parser.add_argument(
        "-s", "--stats",
        action="store_true",
        help="Print statistics about parsed rules"
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indentation level (default: 2)"
    )

    args = parser.parse_args()

    # Parse QC rules
    qc_parser = QCParser(args.input_csv)
    qc_parser.parse()

    # Output JSON
    if args.output:
        qc_parser.to_json(args.output, indent=args.indent)
        print(f"Parsed {len(qc_parser.qc_rules)} QC rules")
        print(f"Output written to: {args.output}")
    else:
        print(qc_parser.to_json(indent=args.indent))

    # Print statistics if requested
    if args.stats:
        stats = qc_parser.get_statistics()
        print("\n=== QC Rules Statistics ===")
        print(f"Total rules: {stats['total_rules']}")
        print(f"Rules with SQL: {stats['with_sql']}")
        print(f"Rules without SQL: {stats['without_sql']}")
        print(f"SQL parse errors: {stats['sql_parse_errors']}")
        print(f"\nBy type: {json.dumps(stats['by_type'], indent=2)}")
        print(f"\nBy level: {json.dumps(stats['by_level'], indent=2)}")
        print(f"\nComplexity distribution: {json.dumps(stats['complexity'], indent=2)}")


if __name__ == "__main__":
    main()
