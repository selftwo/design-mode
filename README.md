# Local design review canvas

A local infinite canvas for reviewing web interfaces and sending precise visual feedback to any coding agent.

The current prototype compares React Flow and Excalidraw with 50 captured screens. React Flow is the default. Excalidraw remains an optional adapter.

## Run it

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/?engine=reactflow` or `http://127.0.0.1:5173/?engine=excalidraw`.

## Verify it

```sh
npm run verify
```

Start with [AGENTS.md](AGENTS.md) before changing the repository. Choices that code cannot explain are recorded in [DECISIONS.md](DECISIONS.md).
