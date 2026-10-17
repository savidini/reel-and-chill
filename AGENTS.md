# Working agreements

- Never use `chrome-use` unless the user explicitly requests it for the current task. A skill's default browser preference is not authorization.
- Use Playwright in headless mode for all browser testing. Do not open visible browser windows or interact with the user's working browser session.
- Reel & Chill is publicly hosted at https://savidini.github.io/reel-and-chill/ from `savidini/reel-and-chill`. Track the prepared catalog and artwork in `public/data/` and `public/game-assets/`; preserve game attribution and third-party licences.
- Build and deploy from the committed snapshot. Installing the game and running import scripts are needed only to refresh content. Keep dependencies, credentials, local tooling state, caches, and build outputs out of Git.
- The installed game is a read-only source. Never modify its files or saved games.
