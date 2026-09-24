# md-viewer
markdown live preview server

## Requirements
- bun 1.4

## Installation
To install dependencies:

```bash
bun install
```

To run:

```bash
bun run run --help
```

## Deployment

```bash
bun run build
```
it will output mdview executable. You can use it as it is or in unix:
- create folder on your /usr/local `sudo mkdir /usr/local/md-viewer/`
- copy the mdview executable to that folder `sudo cp mdview /usr/local/md-viewer/`
- add the path to .bashrc
```sh
# MdViewer
export PATH="$PATH:/usr/local/md-viewer"
```
- source it `source ~/.bashrc`
- now you mdview can be access globally `mdview --help`

## Example Markdown for Testing
[example](example.md)

