[![](https://github.com/nautxx/feedloop/tree/main/frontend/static/images/feedloop_ghbanner.png?raw=true)](https://barnachea.fyi/)
<br />

[![Fontawesome](https://img.shields.io/badge/fontawesome-538DD7?style=for-the-badge&logo=fontawesome&logoColor=white)](https://fontawesome.com/)
[![HTML5](https://img.shields.io/badge/html5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)

# About

Feedloop is a minimalistic, customizable content carousel designed to surface meaningful, memorable, and dynamic information over time.

Built with simplicity and flexibility in mind, it allows you to curate structured datasets—ranging from family history and personal anecdotes to timelines and milestones—and present them in a clean, distraction-free interface.

With support for theming, weighted randomness, and dynamic content generation (such as time-based updates), Feedloop transforms static information into a living, evolving experience.

## Features

- Dynamic content carousel with smooth fade and blur transitions
- Weighted randomness to prioritize more important facts
- Smart rotation logic that avoids recently shown facts
- Type balancing to prevent repetitive categories
- Time-aware display duration based on reading speed and punctuation
- Dynamic fact generation using templates (e.g. years since an event)
- Customizable theming system with multiple visual styles
- Persistent theme selection using local storage
- Interactive theme selector modal with live preview swatches
- Responsive layout with orientation-aware spacing
- Fixed fact container to prevent layout shifting
- Clean, minimal UI focused on readability and storytelling
- Structured JSON dataset with support for types, tags, and priorities

## Tech Stack

- nginx (alpine) via Docker
- Static HTML, CSS, and JavaScript

## Running Locally

Run:
docker compose up -d

Then open:
http://localhost:8089

## Editing Facts

All facts are stored in:
facts.json

Each fact follows this structure:

{
  "id": 1,
  "text": "Example fact",
  "type": "category",
  "tags": ["tag1", "tag2"],
  "active": true,
  "priority": 2
}

### Guidelines

- Keep facts specific and meaningful
- Avoid vague wording ("some", "many", etc.)
- Ensure all `id` values are unique
- Do not reuse IDs
- Set `"active": false` to disable a fact without deleting it

## Links

- Live: <https://your-site.com>
- Repo: <https://github.com/yourusername/feedloop>

# Support

If you wish to support further development, you can [donate](https://ko-fi.com/nautxx).
