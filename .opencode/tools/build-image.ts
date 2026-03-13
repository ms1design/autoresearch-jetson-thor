import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Build the training Docker image for the Jetson Thor autoresearch setup. This tool builds a pre-configured Docker image with all dependencies synced and ready for training. Use this tool instead of running docker commands directly.",
  async execute(args, context) {
    const worktree = context.worktree
    const tag = "latest"
    const forceBuild = false
    const verbose = false
    
    try {
      // Check if image already exists
      const checkResult = await Bun.$`docker images -q narandill/autoresearch-jetson-thor:${tag}`.text()
      const imageExists = checkResult.trim() !== ""
      
      if (imageExists && !forceBuild) {
        return {
          success: true,
          image_exists: true,
          tag: tag,
          message: `Image narandill/autoresearch-jetson-thor:${tag} already exists. Use force_build: true to rebuild.`,
        }
      }
      
      // Build the image using docker compose (internal implementation)
      const buildArgs = verbose ? [] : ["--quiet"]
      const result = await Bun.$`docker compose build train`.text()
      
      return {
        success: true,
        image_exists: false,
        built_new: true,
        tag: tag,
        output: result,
        message: `Successfully built Docker image narandill/autoresearch-jetson-thor:${tag}`,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      }
    }
  },
})
