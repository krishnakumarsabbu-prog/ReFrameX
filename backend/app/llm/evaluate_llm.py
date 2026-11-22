"""CLI Evaluation Harness (B6).

Usage:
  python -m app.llm.evaluate_llm --app <id> --task T1 --limit 10 --runs 3 --provider mock
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add backend to path if needed
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database import get_db_context
from app.models.models import Application, Finding, Component
from app.llm.evaluator import execute_evaluation
from app.llm.metrics import compute_llm_metrics


def main():
    parser = argparse.ArgumentParser(description="ReFrameX LLM Evaluation Harness")
    parser.add_argument("--app", required=True, help="Application ID to evaluate")
    parser.add_argument("--task", default="T1", choices=["T1", "T2", "T3", "ALL"], help="Task type")
    parser.add_argument("--limit", type=int, default=10, help="Maximum targets to evaluate")
    parser.add_argument("--runs", type=int, default=1, help="Repetitions for consistency evaluation (default 1)")
    parser.add_argument("--provider", default="mock", help="Provider (mock or openai_compatible)")
    parser.add_argument("--output", help="Optional output JSON path")

    args = parser.parse_args()

    with get_db_context() as db:
        app = db.query(Application).filter(Application.id == args.app).first()
        if not app:
            print(f"Error: Application '{args.app}' not found.", file=sys.stderr)
            sys.exit(1)

        tasks = ["T1", "T2", "T3"] if args.task == "ALL" else [args.task]
        evaluated_records = []

        for task_type in tasks:
            print(f"--- Running {task_type} evaluation on {app.name} (limit={args.limit}, runs={args.runs}) ---")
            if task_type == "T1":
                targets = db.query(Finding).filter(Finding.application_id == args.app).limit(args.limit).all()
                target_ids = [t.id for t in targets]
            elif task_type in ("T2", "T3"):
                targets = db.query(Component).filter(Component.application_id == args.app).limit(args.limit).all()
                target_ids = [t.id for t in targets]
            else:
                target_ids = []

            for tid in target_ids:
                for run_idx in range(args.runs):
                    try:
                        rec = execute_evaluation(
                            db=db,
                            task_type=task_type,
                            target_id=tid,
                            provider_override=args.provider,
                        )
                        evaluated_records.append(rec)
                        print(f"[{task_type}][run {run_idx+1}] Target {tid[:12]}... -> {rec['status']}")
                    except Exception as e:
                        print(f"[{task_type}] Error evaluating {tid}: {e}", file=sys.stderr)

        metrics = compute_llm_metrics(db, args.app)
        print("\n=== Evaluation Harness Summary ===")
        print(f"Total Evaluations: {metrics['total_evaluations']}")
        print(f"Schema Validity Rate: {metrics['validity_rate']*100:.1f}%")
        print(f"Citation Accuracy: {metrics['citation_accuracy']*100:.1f}%")
        print(f"Engine Agreement Rate: {metrics['engine_agreement_rate']*100:.1f}%")
        print(f"Human Agreement Rate: {metrics['human_agreement_rate']*100:.1f}%")
        print(f"Consistency Score: {metrics['consistency_score']*100:.1f}%")

        if args.output:
            out_path = Path(args.output)
            out_path.write_text(json.dumps({"metrics": metrics, "evaluations": evaluated_records}, indent=2))
            print(f"Results written to {out_path}")


if __name__ == "__main__":
    main()
