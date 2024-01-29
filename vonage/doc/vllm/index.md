# vLLM
## Install
You can install vLLM using pip:
```bash
pip install vllm
```

## Serving
vLLM offers official docker image for deployment. The image can be used to run OpenAI compatible server. The image is available on Docker Hub as [vllm/vllm-openai](https://hub.docker.com/r/vllm/vllm-openai/tags).

```bash
docker run --runtime nvidia --gpus all \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --env "HUGGING_FACE_HUB_TOKEN=<secret>" \
    -p 8000:8000 \
    --ipc=host \
    vllm/vllm-openai:latest \
    --model mistralai/Mistral-7B-Instruct-v0.2 \
    --max-model-len 4096
```


## Issue
You can solve some issues with following link:

✅ [docker: Error response from daemon: unknown or invalid runtime name: nvidia.](https://github.com/Massive-AI/VoiceBot/issues/3)

✅ [docker: Error response from daemon: could not select device driver "" with capabilities: [[gpu]] ](https://github.com/Massive-AI/VoiceBot/issues/4)

