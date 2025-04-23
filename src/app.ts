import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import chatRoutes from "./routes/chatRoutes";

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api", chatRoutes);

// Health check endpoint
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.status(200).json({ status: "ok" });
});

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: "An unexpected error occurred",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

export default app;
