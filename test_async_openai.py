import asyncio
import os
from openai import AsyncOpenAI

async def main():
    client = AsyncOpenAI(
        api_key='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',
        base_url='https://integrate.api.nvidia.com/v1'
    )
    
    extra_body = {
        "chat_template_kwargs": {"enable_thinking": True},
        "reasoning_budget": 32768
    }
    
    try:
        completion = await asyncio.wait_for(
            client.chat.completions.create(
                model='nvidia/nemotron-3-ultra-550b-a55b',
                messages=[{'role': 'user', 'content': 'explain this'}],
                temperature=0.7,
                top_p=0.95,
                extra_body=extra_body,
                stream=True
            ),
            timeout=180
        )
        
        async for chunk in completion:
            print(chunk.model_dump_json())
    except Exception as e:
        print("EXCEPTION CAUGHT:")
        print(repr(e))

asyncio.run(main())
