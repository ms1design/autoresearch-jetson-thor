import { tool } from "@opencode-ai/plugin"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

// Read documentation: https://opencode.ai/docs/custom-tools.md

export default tool({
  description: "Build the training Docker image for the Jetson Thor autoresearch setup. This tool builds a pre-configured Docker image with all dependencies synced and ready for training. Use this tool instead of running docker commands directly. Output is automatically saved to logs.build.log.",
  async execute(args, context) {
    const worktree = context.worktree
    const tag = "latest"
    const forceBuild = args.force_build ?? false
    const verbose = args.verbose ?? false
    
    // Build log file path
    const logPath = join(worktree, "logs", "build.log")
    
    try {
      // Ensure logs directory exists
      const logsDir = join(worktree, "logs")
      Bun.mkdirSync(logsDir, { recursive: true })
      
      // Check if image already exists
      const checkResult = await Bun.$`docker images -q narandill/autoresearch-jetson-thor:${tag}`.text()
      const imageExists = checkResult.trim() !== ""
      
      if (imageExists && !forceBuild) {
        const message = `Image narandill/autoresearch-jetson-thor:${tag} already exists. Use force_build: true to rebuild.`
        writeFileSync(logPath, `Docker image build log\n===\n${message}\n`)
        return {
          success: true,
          image_exists: true,
          tag: tag,
          message: message,
        }
      }
      
      // Build the image using docker compose (internal implementation)
      const buildArgs = verbose ? [] : ["--quiet"]
      const result = await Bun.$`docker compose build train`.text()
      
      const message = `Successfully built Docker image narandill/autoresearch-jetson-thor:${tag}`
      writeFileSync(logPath, `Docker image build log\n===\n${result}\n\n${message}\n`)
      
      return {
        success: true,
        image_exists: false,
        built_new: true,
        tag: tag,
        output: result,
        message: message,
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const stdout = error.stdout ? String(error.stdout) : ""
      const stderr = error.stderr ? String(error.stderr) : ""
      
      // Write error log
      writeFileSync(logPath, `Docker image build log\n===\nBUILD FAILED\n\nSTDERR:\n${stderr}\n\nSTDOUT:\n${stdout}\n\nERROR: ${errorMsg}\n`)
      
      return {
        success: false,
        error: errorMsg,
        stdout: stdout,
        stderr: stderr,
      }
    }
  },
})
