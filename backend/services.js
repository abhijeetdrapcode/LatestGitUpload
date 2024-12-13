import { Octokit } from "@octokit/rest";
import path from "path";
import fetch from "node-fetch";
import fs from "fs/promises";
// i tried using import fs from "fs" but it was giving an error so i used fs/promises

function createOctokitInstance(githubToken) {
  return new Octokit({
    auth: githubToken,
    request: { fetch },
  });
}

//This function is to generate the name of the repo i have added seconds as well because, it was giving an error sometimes that the repos is already created and adding seconds will create a completely new repo
function generateTimestamp() {
  const timestamp = new Date();
  return `build-${timestamp.getFullYear()}-${String(
    timestamp.getMonth() + 1
  ).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}-${String(
    timestamp.getHours()
  ).padStart(2, "0")}-${String(timestamp.getMinutes()).padStart(
    2,
    "0"
  )}-${String(timestamp.getSeconds()).padStart(2, "0")}`;
}

//This code is for initializing an empty repo that is there is no branch even the main branch is not there
async function initializeEmptyRepo(octokit, owner, repo, branch, description) {
  try {
    console.log("Initializing empty repository...");

    const readmeContent = `# ${repo}\n\n${
      description || "New repository created via GitHub API."
    }`;
    const readmeBase64 = Buffer.from(readmeContent).toString("base64");

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: "ReadME.md",
      message: "Initial commit: Added README",
      content: readmeBase64,
      branch,
    });

    console.log("Repository initialized with ReadME.md.");
  } catch (error) {
    console.error(
      "Failed to initialize repository:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function gatherFiles(dirPath, basePath = "") {
  const files = [];
  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.join(basePath, item.name);

    if (item.isDirectory()) {
      files.push(...(await gatherFiles(fullPath, relativePath)));
    } else {
      const content = await fs.readFile(fullPath, "utf-8");
      files.push({ path: relativePath, content });
    }
  }

  return files;
}

//Below is the entire code that will handle the upload to github process
export const uploadWithNewBranch = async (
  githubToken,
  repoOwner,
  repoName,
  folderPath,
  mainBranch = "main"
) => {
  const octokit = createOctokitInstance(githubToken);
  let isRepoEmpty = false;

  try {
    await octokit.git.getRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${mainBranch}`,
    });
  } catch (error) {
    if (error.status === 409) {
      isRepoEmpty = true;
    } else {
      throw error;
    }
  }

  if (isRepoEmpty) {
    await initializeEmptyRepo(
      octokit,
      repoOwner,
      repoName,
      mainBranch,
      "Initial repository setup"
    );
  }

  const timestampName = generateTimestamp();
  const filesToUpload = await gatherFiles(folderPath);
  console.log(`Uploading ${filesToUpload.length} files...`);

  const { data: refData } = await octokit.git.getRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${mainBranch}`,
  });

  const latestCommitSha = refData.object.sha;

  await octokit.git.createRef({
    owner: repoOwner,
    repo: repoName,
    ref: `refs/heads/${timestampName}`,
    sha: latestCommitSha,
  });

  const { data: commitData } = await octokit.git.getCommit({
    owner: repoOwner,
    repo: repoName,
    commit_sha: latestCommitSha,
  });

  const baseTreeSha = commitData.tree.sha;

  const treeEntries = await Promise.all(
    filesToUpload.map(async (file) => {
      const { data: blobData } = await octokit.git.createBlob({
        owner: repoOwner,
        repo: repoName,
        content: file.content,
        encoding: "utf-8",
      });
      return {
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      };
    })
  );

  const { data: treeData } = await octokit.git.createTree({
    owner: repoOwner,
    repo: repoName,
    base_tree: baseTreeSha,
    tree: treeEntries,
  });

  const { data: commitResponse } = await octokit.git.createCommit({
    owner: repoOwner,
    repo: repoName,
    message: `Latest code with ${timestampName}`,
    tree: treeData.sha,
    parents: [latestCommitSha],
  });

  await octokit.git.updateRef({
    owner: repoOwner,
    repo: repoName,
    ref: `heads/${timestampName}`,
    sha: commitResponse.sha,
  });

  console.log(`Files uploaded to branch: ${timestampName}`);
  return timestampName;
};
