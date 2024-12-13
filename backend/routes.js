import express from "express";
import { authentication, uploadToGithub } from "./controller.js";

const router = express.Router();

router.post("/authenticate", authentication);

router.post("/upload-to-github", uploadToGithub);

export default router;
