const app = require("./app");
const http = require("http");
const { initializeSocket } = require("./socket/socket.server");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize WebSocket
initializeSocket(server);

const mockGithubService = require("./services/mock-github.service");

server.listen(PORT, () => {
  console.log(`🚀 Auth server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);

  // Start mock service only in non-production environments
  if (process.env.NODE_ENV !== "production") {
    console.log("[MockService] Starting mock GitHub service (development/test mode)");
    mockGithubService.start();
  } else {
    console.log("[MockService] Skipping mock GitHub service in production environment");
  }

  // Start Analytics Queue Worker
  require('./worker/analytics.worker');
});