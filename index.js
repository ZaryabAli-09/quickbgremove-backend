import express from "express";
import cors from "cors";
import toolsOperationRouter from "./routes/toolsOperations.route.js";
import dotenv from "dotenv";
import compression from "compression";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes.js";
import { dbConnection } from "./db/db.js";
import { errorMiddleware } from "./middlewares/error.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// built in middlewares
app.use(compression()); // Gzip compression
app.use(helmet()); // Secure HTTP headers
app.use(express.json());
app.use(cors(["https://quickbgremove.netlify.app", "http://localhost:5173"])); // CORS for specific origins

// middlewares
app.use(errorMiddleware);

// api checker
app.get("/", (req, res) => {
  res.json("QuickBgRemove Api is working");
});

// all routes
app.use("/api/tools", toolsOperationRouter);
app.use("/api/auth", authRoutes);

// Wildcard route for handling 404 errors
app.get("*", (req, res) => {
  res.status(404).json("not found");
});

app.listen(port, () => {
  console.log(`Server is running on ${port} port `);

  // database connection
  // dbConnection()
  //   .then(() => {
  //     console.log("db connected");
  //   })
  //   .catch((err) => {
  //     console.log("db not connected");
  //   });
});
