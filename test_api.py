import requests
headers = {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json'
}
data = {
    'model': 'nvidia/nemotron-3-ultra-550b-a55b',
    'messages': [{'role': 'user', 'content': 'explain this'}],
    'stream': False
}
response = requests.post('https://integrate.api.nvidia.com/v1/chat/completions', headers=headers, json=data)
print(response.status_code)
print(response.text)
