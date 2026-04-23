---
name: frontend-html-basic
description: Generates scoped HTML, CSS, and JS files for simple browser-openable frontends.
output_contract: json_files
max_lines_per_file: 100
---

## Constraints

Purpose:
Generate simple, valid HTML files (no frameworks, no dependencies).

Content requirements:

- The skill must instruct the LLM to:
  - Generate clean, minimal HTML5
  - Include <head> and <body>
  - Use inline CSS only if needed
  - Avoid external libraries
  - Ensure the file is directly openable in a browser
- Must prioritize:
  - Simplicity
  - Valid structure
  - Readability
- Must explicitly forbid:
  - React, Vue, or any framework
  - External CDN scripts
  - Explanations
- Keep each file short, strict, and scoped to the declared task output.

## Output bounds

- Keep any single CSS or JS file at 100 lines or fewer.
- If CSS needs more than 100 lines, split it into section files: layout, components, typography, and responsive.
- Generate only one CSS section per task; do not produce a full stylesheet from a section task.
- A separate integration task may merge section files into `styles.css` and link it from `index.html`.
- If JS needs more than 100 lines, split by interaction area and generate only one area per task.
- Output must align with this contract:
