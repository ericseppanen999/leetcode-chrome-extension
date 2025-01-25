import config from './config.js';



// handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "saveProblemInfo") {
        // clear any existing data before saving new submission
        chrome.storage.local.clear(() => {
            // then save only the new submission
            chrome.storage.local.set({ 
                problemInfo: request.data,
                lastUpdated: new Date().toISOString()
            }, function() {
                sendResponse({ success: true, message: 'New submission saved successfully' });
            });
        });
        return true;
    }


    if (request.action === "analyzeCode") {
        analyzeWithGPT(request.code, request.problemInfo)
            .then(response => sendResponse({ success: true, analysis: response }))
            .catch(error => {
                console.error('OpenAI API Error:', error);
                sendResponse({ 
                    success: false, 
                    error: `API Error: ${error.message}` 
                });
            });
        return true;
    }
});


// function to analyze code using gpt api
async function analyzeWithGPT(code, problemInfo) {
    try {
        // make api request to openai
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        "role": "system",
                        "content": `You are a helpful code reviewer specializing in algorithm problems. 
                        When analyzing code, focus on the most critical issues first. 
                        If there are syntax errors, point those out first. 
                        If the code is syntactically correct, analyze the logic and efficiency.
                        Keep responses concise and prioritized.
                        Format your response with numbered points for critical issues.
                        Include time and space complexity analysis when relevant.`
                    },
                    {
                        "role": "user",
                        "content": `Problem Title: ${problemInfo.title}
                        
Problem Description: ${problemInfo.description || 'Not available'}

Submission Result: ${problemInfo.submissionResult?.success ? 'Accepted' : 'Failed'}
${problemInfo.submissionResult?.error ? `Error: ${problemInfo.submissionResult.error}` : ''}

Please analyze this code solution:

${code}

Focus on:
1. Any immediate issues that caused the submission to fail (if applicable)
2. Time and space complexity analysis
3. Potential optimizations
4. Edge cases that might not be handled
5. Code style and readability improvements`
                    }
                ],
                temperature: 0.7
            })
        });


        // check if response is successful
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }


        // parse and return the response data
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Full API Error:', error);
        throw error;
    }
}
