export const cleanupResponse = (response) => {
  let cleanedResponse = response;

  const endThinkIndex = response.indexOf('</think>');
  if (endThinkIndex !== -1) {
    cleanedResponse = response.slice(endThinkIndex + '</think>'.length);
  }

  if (cleanedResponse.startsWith('```')) {
    cleanedResponse =
      cleanedResponse.match(/`{3,}json\s*([\s\S]*?)\s*`{3,}/)?.[1] ?? cleanedResponse;
  }

  return cleanedResponse.trim();
};
