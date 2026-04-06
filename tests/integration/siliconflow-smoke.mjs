import { streamText } from 'ai';

import { getConfiguredAiMode, getStudioModel, getStudioModelName, hasRealCredentials } from '../../lib/ai/provider.ts';

async function main() {
  if (!hasRealCredentials() || getConfiguredAiMode() !== 'siliconflow') {
    console.error('SiliconFlow credentials not available or provider mode is not siliconflow.');
    process.exit(1);
  }

  const result = streamText({
    model: getStudioModel(),
    prompt: 'Reply with exactly: siliconflow-ok',
    maxOutputTokens: 20,
  });

  let output = '';
  for await (const chunk of result.textStream) {
    output += chunk;
  }

  const trimmed = output.trim();
  console.log(`model=${getStudioModelName()}`);
  console.log(`output=${trimmed}`);

  if (trimmed !== 'siliconflow-ok') {
    console.error('Unexpected SiliconFlow response.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
