# VS Code OpenEdge ABL Wrapper

Thin VS Code extension for [`usagi-coffee/abl-language-server`](https://github.com/usagi-coffee/abl-language-server)

For LSP features check feature section in [`usagi-coffee/abl-language-server`](https://github.com/usagi-coffee/abl-language-server). 

## How it works

- On activation, the extension queries the latest GitHub release.
- It downloads the platform-specific `abl-language-server` binary into VS Code global storage.
- It starts the language server using `--stdio`.

## Local binary override

Set `openedgeAbl.languageServerPath` to use a local binary (or symlink) and skip download.

Example:

```json
{
  "openedgeAbl.languageServerPath": "~/.local/bin/abl-language-server"
}
```

