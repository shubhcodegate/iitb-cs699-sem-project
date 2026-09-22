# Campus Pulse

We propose to build **Campus Pulse**, a location-aware campus discovery platform that aggregates institute events from multiple sources and presents them through an interactive campus map and personalized dashboard.

### Motivation

Students at IIT Bombay receive numerous emails regarding seminars, workshops, guest lectures, club activities, placement talks, book sales, sports events, and other campus announcements. These announcements are distributed across multiple mailing lists and inboxes, making it difficult to discover interesting events happening nearby or at the current time.

For example, a student may have an hour free between classes but may not know that there is an interesting seminar in a nearby lecture hall or a book sale taking place a short walk away.

Our goal is to answer a simple question:

> **Given who I am, where I am, and what time it is, what interesting opportunities are available to me right now?**

### Proposed Architecture

Instead of designing an application around email scraping, we envision a modular **event ingestion and discovery platform**.

```text
Institute Emails      Club Portals      Manual Event Entry
        │                  │                    │
        └──────────────────┴────────────────────┘
                         │
               Event Extraction Engine
                         │
               Audience & Permission Engine
                         │
                  Central Event Database
                         │
        ┌────────────────┼────────────────┐
        │                │                │
  Personal View     Group View      Public View
                         │
      Interactive Campus Map + Timeline + Search
```

Although institute emails will be the initial source of information, the architecture is intentionally designed so that additional sources (club portals, organizer submissions, etc.) can be integrated later without modifying the core system.

### Permission Model

One aspect we find particularly interesting is modelling event visibility similar to Linux file permissions.

Each event would carry an audience or visibility field, for example:

- Public
- Institute-wide
- Department-specific
- Club-specific
- Personal

This allows users to view only the events they are eligible to attend while maintaining a common event database.

### Core Features

- Automatic extraction of event information (title, venue, date, time, organizer and intended audience).
- Interactive campus map showing nearby ongoing and upcoming events.
- Timeline and search interface for event discovery.
- Personalized recommendations based on location, time and event visibility.
- Notifications for events happening nearby.

### Software Engineering Components

The project would involve several topics covered in CS699, including:

- Python
- HTML/CSS and web development
- SQL/database design
- REST APIs
- Git-based collaborative development
- Testing and debugging
- Documentation and deployment

We intend to design the project as a modular system consisting of independent components (event ingestion, information extraction, permission management, backend services and frontend visualization), making it easy to extend in the future.
