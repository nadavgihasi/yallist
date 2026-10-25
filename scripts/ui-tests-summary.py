"""Markdown table of UI test results from Maestro JUnit files, for the GitHub job summary.

    python3 scripts/ui-tests-summary.py junit.xml [more.xml ...] >> "$GITHUB_STEP_SUMMARY"

ARTIFACTS, if set, is a line of Markdown linking to the videos and logs.
"""

import os
import sys
import xml.etree.ElementTree as ET

rows = []
for path in sys.argv[1:]:
    if not os.path.exists(path):
        rows.append((f"`{path}` missing: the run didn't get to the flows", "❌", ""))
        continue
    for case in ET.parse(path).iter("testcase"):
        failure = case.find("failure")
        ok = failure is None and case.get("status") == "SUCCESS"
        reason = "" if ok else (failure.text if failure is not None else case.get("status", ""))
        rows.append((case.get("name"), "✅" if ok else "❌", f"{float(case.get('time', 0)):.0f}s {reason}".strip()))

print("### UI tests (web)\n")
print("| Flow | Result | Time / failure |\n| --- | --- | --- |")
for name, result, detail in sorted(rows):
    print(f"| {name} | {result} | {detail.replace('|', '/')} |")
print(f"\n{sum(r[1] == '✅' for r in rows)}/{len(rows)} passed.")
if os.environ.get("ARTIFACTS"):
    print(f"\n{os.environ['ARTIFACTS']}")
