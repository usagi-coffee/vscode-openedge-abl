# VS Code OpenEdge ABL Wrapper

Thin VS Code extension wrapper for [`usagi-coffee/abl-language-server`](https://github.com/usagi-coffee/abl-language-server).

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

## Development

- Run `npm install`
- Open this repository in VS Code
- Run the `Launch Client` debug target (F5)
