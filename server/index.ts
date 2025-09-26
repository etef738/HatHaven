// Request type extension handled via declaration merging
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureDatabaseReady } from "./db";
import { 
  setupCSP, 
  setupCORS, 
  globalRateLimit, 
  securityHeaders, 
  sanitizeRequest,
  getSecureSessionConfig 
} from "./middleware/security";
import { nanoid } from "nanoid";

const app = express();

// Apply security middleware first
app.use(setupCSP());
app.use(setupCORS());
app.use(securityHeaders);
app.use(sanitizeRequest);
app.use(globalRateLimit);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add request ID middleware
app.use((req, res, next) => {
  const requestId = req.get('X-Request-ID') || nanoid();
  (req as any).requestId = requestId;
  res.set('X-Request-ID', requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database with indexes before starting routes
  await ensureDatabaseReady();
  
  const server = await registerRoutes(app);

  // API 404 handler - must come before Vite middleware
  app.use('/api/*', (req: Request, res: Response) => {
    const requestId = (req as any).requestId || nanoid();
    res.status(404).json({
      error: {
        code: 404,
        type: "NotFound", 
        message: `API endpoint not found: ${req.originalUrl}`,
        path: req.originalUrl,
        method: req.method,
        request_id: requestId
      }
    });
  });

  // Enhanced error handler with request IDs
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = (req as any).requestId || nanoid();

    // Log error with request ID for debugging
    console.error(`[${requestId}] Error ${status}:`, err.message, err.stack);

    // Determine error type
    let errorType = "InternalError";
    if (status === 400) errorType = "BadRequest";
    else if (status === 401) errorType = "Unauthorized";
    else if (status === 403) errorType = "Forbidden"; 
    else if (status === 404) errorType = "NotFound";
    else if (status === 422) errorType = "ValidationError";
    else if (status === 429) errorType = "RateLimitExceeded";

    res.status(status).json({ 
      error: {
        code: status,
        type: errorType,
        message: message,
        path: req.originalUrl,
        request_id: requestId
      }
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
