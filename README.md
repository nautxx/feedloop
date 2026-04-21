# Feedloop

[![Fontawesome](https://img.shields.io/badge/fontawesome-538DD7?style=for-the-badge&logo=fontawesome&logoColor=white)](https://fontawesome.com/)
[![HTML5](https://img.shields.io/badge/html5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)

## About

Feedloop is a minimal, customizable content carousel designed to surface meaningful, memorable, and dynamic information over time.

It transforms structured data—such as family history, personal notes, quotes, and milestones—into a clean, evolving display.

Built with simplicity and flexibility in mind, Feedloop focuses on readability, pacing, and long-form ambient viewing.

## Features

- Dynamic content carousel with multiple display modes (instant, fade, pop, typing)
- Weighted randomness to prioritize important items
- Smart rotation logic to avoid recently shown content
- Type balancing to prevent repetitive categories
- Time-aware display duration based on reading speed and punctuation
- Multiline support for quotes and longer content
- Quote support with author attribution
- Customizable theming system
- Persistent settings (theme, mode, speed)
- Responsive layout for desktop and mobile
- Clean, distraction-free UI

## Tech Stack

- nginx (alpine) via Docker  
- Static HTML, CSS, and JavaScript  

## Running Locally

```bash
docker compose up -d
```

Then open:

<http://localhost:8089>

## Feed Data

Feedloop uses a local `feed.json` file for content.

This file is **ignored by git**, so you can safely store personal or private data.

### Setup

```bash
cp feed.template.json feed.json
```

Then edit `feed.json`.

## Data Structure

```json
{
  "items": [
    {
      "id": "fact-001",
      "text": "Example fact",
      "type": "fact",
      "active": true,
      "priority": 1
    },
    {
      "id": "quote-001",
      "text": "This is a sample quote.",
      "author": "Your Name",
      "type": "quote",
      "active": true,
      "priority": 2
    }
  ]
}
```

## Item Fields

- `id` (string) — unique identifier  
- `text` (string) — main content  
- `type` (string) — e.g. `fact`, `quote`  
- `author` (string, optional) — used for quotes  
- `priority` (number, optional) — affects frequency  
- `active` (boolean, optional) — disable without deleting  

## Guidelines

- Keep content concise and meaningful  
- Avoid vague wording  
- Ensure all `id` values are unique  
- Use `priority` to control frequency  
- Use quotes for personal notes or messages  

## Links

- Live: <https://barnachea.fyi>  
- Repo: <https://github.com/nautxx/feedloop>

## Support

If you wish to support development, you can donate: <https://ko-fi.com/nautxx>
