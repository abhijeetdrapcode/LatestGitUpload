import express from "express";
import apiRoutes from "./routes.js";
import cors from "cors";
const app = express();

app.use(cors("*"));
app.use(express.json());

app.use("/api", apiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
