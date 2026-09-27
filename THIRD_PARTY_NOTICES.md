# Third-party notices

Gemini-use patches, installs, and builds these upstream repositories (pinned commits are listed in `install.mjs`):

- **MCP SuperAssistant** — <https://github.com/srbhptl39/MCP-SuperAssistant>, MIT License. The repository and installed source tree retain the upstream license and notices.
- **mcp-chrome** — <https://github.com/hangwin/mcp-chrome>, MIT License. The repository and installed source tree retain the upstream license and notices.

`assets/mcp-superassistant-icon-16.png` is a 16×16 build asset resized from the MCP SuperAssistant icon because the pinned upstream manifest references that missing size. It is included only to make the upstream build reproducible.

`keys/chrome-extension-public-key.base64` is a public Chrome extension manifest key used to keep the mcp-chrome unpacked extension ID stable for Native Messaging registration. It is not a private signing key. No signing private key, credentials, or tokens are included.
