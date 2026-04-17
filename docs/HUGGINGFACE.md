# Hugging Face Deployment

Create a Docker Space and push this repository to it.

```powershell
git remote add hf https://huggingface.co/spaces/YOUR_NAME/YOUR_SPACE
git push hf main
```

The Space reads the root `Dockerfile`, installs the backend and shared packages, exposes port `7860`, and starts `backend/src/server.js`.

Webhook URLs look like this after deployment:

```text
https://YOUR_SPACE.hf.space/webhook1?username={username}
https://YOUR_SPACE.hf.space/webhook2?username={username}&coins={coins}
```
