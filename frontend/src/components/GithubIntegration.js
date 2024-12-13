import React, { useState, useEffect } from "react";

const GitHubIntegration = () => {
  const [token, setToken] = useState(
    localStorage.getItem("github_token") || null
  );
  const [userData, setUserData] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [folderPath, setFolderPath] = useState("");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
  const REDIRECT_URI = "http://localhost:3000";
  const SCOPE = "repo,user:email,read:user"; //changed the scope here

  //code for fetchign user data and repos
  //for getting the private repository i changed the SCOPE two lines above and the other change in the reposurl
  const fetchUserDataAndRepos = async (accessToken) => {
    try {
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch user data");
      }
      const userData = await userResponse.json();
      setUserData(userData);

      const reposResponse = await fetch(
        "https://api.github.com/user/repos?visibility=all", //and the other change was here
        {
          headers: {
            Authorization: `token ${accessToken}`,
          },
        }
      );

      if (!reposResponse.ok) {
        throw new Error("Failed to fetch repositories");
      }
      const repos = await reposResponse.json();
      setRepositories(repos || []);
    } catch (error) {
      console.error("Error fetching user data and repositories:", error);
      setRepositories([]);
    }
  };

  //code for handling the github login
  const handleGitHubLogin = () => {
    const githubOAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPE}`;
    window.location.href = githubOAuthUrl;
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      let accessToken = "";

      if (token) {
        accessToken = token;
        localStorage.setItem("github_token", accessToken);
        await fetchUserDataAndRepos(accessToken);
        window.history.replaceState({}, document.title, "/");
        return;
      }

      if (code && !token) {
        try {
          const response = await fetch(
            "http://localhost:5000/api/authenticate",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ code }),
            }
          );

          const data = await response.json();
          accessToken = data.access_token;

          if (accessToken) {
            setToken(accessToken);
            localStorage.setItem("github_token", accessToken);
            await fetchUserDataAndRepos(accessToken);
            window.history.replaceState({}, document.title, "/");
          }
        } catch (error) {
          console.error("GitHub authentication error:", error);
        }
      }
    };

    handleOAuthCallback();
  }, [token]);

  const uploadFolderToGitHub = async () => {
    if (!selectedRepo || !token || !folderPath) {
      alert(
        "Please select a repository, provide a folder path, and ensure you are logged in"
      );
      return;
    }

    try {
      setIsUploading(true);
      setUploadStatus("Uploading...");

      const response = await fetch(
        "http://localhost:5000/api/upload-to-github",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            githubToken: token,
            repoOwner: selectedRepo.owner.login,
            repoName: selectedRepo.name,
            folderPath: folderPath,
            mainBranch: selectedRepo.default_branch,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setUploadStatus(`Successfully uploaded to branch: ${data.branch}`);
        alert(`Files uploaded to branch: ${data.branch}`);
      } else {
        setUploadStatus(`Error: ${data.error}`);
        alert(`Upload failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error uploading folder:", error);
      setUploadStatus("Upload failed");
      alert("Failed to upload folder to GitHub");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUserData(null);
    setRepositories([]);
    setSelectedRepo(null);
    setFolderPath("");
    setUploadStatus(null);
    localStorage.removeItem("github_token");
  };

  //This is the code which will handle the page content if the token is available the user profile and user repositories will be availabel

  //if the token is not available, it will show the login button

  //i have saved the token that is being recieved from the backend to the local storage
  //so i am checking the token from the localstorage
  let content;
  if (!token) {
    content = (
      <button onClick={handleGitHubLogin} className="github-login-button">
        Login with GitHub
      </button>
    );
  } else {
    content = (
      <div>
        {userData && (
          <div className="user-profile">
            <img
              src={userData.avatar_url}
              alt="GitHub Avatar"
              className="user-avatar"
            />
            <p>Logged in as {userData.login}</p>
          </div>
        )}

        <div className="repository-section">
          <label className="repository-label">Select Repository</label>
          <select
            className="repository-select"
            onChange={(e) => setSelectedRepo(repositories[e.target.value])}
          >
            <option value="">Select a Repository</option>
            {repositories.map((repo, index) => {
              let repoType = "(Public)";
              if (repo.private) {
                repoType = "(Private)";
              }

              return (
                <option key={repo.id} value={index}>
                  {repo.name} {repoType}
                </option>
              );
            })}
          </select>

          <label className="folder-path-label">Folder Path to Upload</label>
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="Path to folder"
            className="folder-path-input"
          />

          {uploadStatus &&
            (() => {
              let statusClassName = "upload-status success";
              if (uploadStatus.includes("Error")) {
                statusClassName = "upload-status error";
              }

              return <div className={statusClassName}>{uploadStatus}</div>;
            })}
        </div>

        <div className="action-buttons">
          <button
            onClick={uploadFolderToGitHub}
            disabled={!selectedRepo || !folderPath || isUploading}
            className="upload-button"
          >
            {isUploading ? "Uploading..." : "Upload Folder to GitHub"}
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="github-integration-container">
      <h2 className="github-integration-heading">GitHub Integration</h2>
      {content}
    </div>
  );
};

export default GitHubIntegration;
