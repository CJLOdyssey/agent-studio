---
name: customize-opencode
description: Use when modifying opencode.jsonc, adding providers or MCP servers, configuring agents, setting permissions, migrating config keys, or validating opencode configuration. Also use when setting up opencode for the first time or onboarding team members.
---
# OpenCode Configuration

Guides through correctly reading, updating, migrating, and validating OpenCode configuration files.

## Config File Locations
- **Project**: `.opencode/opencode.jsonc`
- **User**: `~/.config/opencode/opencode.jsonc`
- **TUI**: `tui.json` (same location as config)
- **Instructions**: `AGENTS.md` in project root or ~/.config/opencode/

## Common Operations
- Add/configure providers
- Set up MCP servers
- Configure agent settings and permissions
- Customize TUI themes and keybindings
- Create and manage AGENTS.md instruction files

## Format Rules
- Format is JSONC (JSON with Comments)
- Always include `"$schema": "https://opencode.ai/config.json"`
- Use `"${env.VAR_NAME}"` for environment variables
- Never strip comments when editing existing files
