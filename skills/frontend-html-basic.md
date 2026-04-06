
#frontend-html-basic

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

- Output must align with this contract:

Return ONLY valid JSON:
{
  "files": [
    {
      "path": "index.html",
      "content": "..."
    }
  ]
}

- Keep the file short and strict.

Output only the markdown content of the skill.