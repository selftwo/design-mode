import { startDesignModeHost } from './design-mode-host.ts'

const port = Number(process.env.DESIGN_MODE_PORT ?? 4400)

startDesignModeHost({ port })
  .then(({ origin }) => {
    process.stdout.write(`design-mode is running at ${origin}\n`)
    process.stdout.write(`Boards, runs, and projects live in ${process.env.DESIGN_MODE_HOME ?? '~/.design-mode'}\n`)
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
