import requests
import json

headers = {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json'
}
data = {
    'model': 'nvidia/nemotron-3-ultra-550b-a55b',
    'messages': [{'role': 'user', 'content': 'explain this'}],
    'stream': True
}
response = requests.post('https://integrate.api.nvidia.com/v1/chat/completions', headers=headers, json=data, stream=True)
print(response.status_code)
for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
