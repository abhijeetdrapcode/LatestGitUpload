import axios from "axios";
import { uploadWithNewBranch } from "./services.js";
import dotenv from "dotenv";

dotenv.config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export const authentication = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Missing 'code' parameter" });
  }

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
    res.json(tokenResponse.data);
  } catch (error) {
    console.error(
      "Authentication error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Authentication failed" });
  }
};

export const uploadToGithub = async (req, res) => {
  const {
    githubToken,
    repoOwner,
    repoName,
    folderPath,
    mainBranch = "main",
  } = req.body;

  if (!githubToken || !repoOwner || !repoName || !folderPath) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const branchName = await uploadWithNewBranch(
      githubToken,
      repoOwner,
      repoName,
      folderPath,
      mainBranch
    );

    res.json({
      message: "Files uploaded successfully",
      branch: branchName,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: "Failed to upload files",
      details: error.message,
    });
  }
};
