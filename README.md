# VS Code OpenEdge ABL

ABL Language support for OpenEdge ABL.

- LSP Server: [`usagi-coffee/abl-language-server`](https://github.com/usagi-coffee/abl-language-server)
- `ABL` grammar: [`usagi-coffee/tree-sitter-abl`](https://github.com/usagi-coffee/tree-sitter-abl)
- `ABL` syntax highlighting: [`abl-tmlanguage`](https://github.com/chriscamicas/abl-tmlanguage)
- `DF` grammar: [`usagi-coffee/tree-sitter-df`](https://github.com/usagi-coffee/tree-sitter-df)
- `DF` syntax higlighting: quick textmate sketch based on `DF` tree-sitter grammar.

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

