// function to get the user's code submission from the page
function getUserCode() {
    // try multiple selectors for code elements since the page structure might vary
    const codeSelectors = [
        'div.overflow-hidden pre > code',
        'div.relative.w-full.overflow-hidden pre > code', 
        'pre > code',
        '[class*="code-container"] code',
        '[class*="editor"] code'
    ];

    console.log("Attempting to get user code...");


    // try each selector until we find a code element
    for (const selector of codeSelectors) {
        const codeElement = document.querySelector(selector);
        if (codeElement) {
            const code = codeElement.textContent;
            console.log("Found code using selector:", selector);
            if (code) {
                return code;
            }
        }
    }


    // if no code found through selectors, try xpath as a last resort
    const xpath = "//pre/code[contains(text(), 'class') or contains(text(), 'def')]";
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (result.singleNodeValue) {
        const code = result.singleNodeValue.textContent;
        console.log("Found code using XPath");
        return code;
    }

    console.log("No code found");
    return null;
}


// function to check if submission was successful and get any error messages
function getSubmissionResult() {
    // try different selectors that might contain the submission status
    const resultSelectors = [
        // success state selectors
        '.text-green-s span',
        '[class*="success"]',
        
        // error state selectors
        '.space-y-4.m-0 .flex.items-center span',
        '[class*="error"]',
        '[class*="wrong"]',
        '[data-e2e-locator="submission-result"] span'
    ];

    console.log("Checking submission result...");


    // check each selector for a result element
    for (const selector of resultSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            console.log("Found result element:", selector, text);

            return {
                success: text.includes('Accepted'),
                error: !text.includes('Accepted') ? text : null,
                resultText: text
            };
        }
    }


    // fallback: look for any error-related elements if no result found
    const possibleErrorContainers = document.querySelectorAll('[class*="error"], [class*="wrong"], [class*="fail"]');
    for (const container of possibleErrorContainers) {
        const text = container.textContent.trim();
        if (text) {
            console.log("Found error container:", text);
            return {
                success: false,
                error: text,
                resultText: text
            };
        }
    }

    console.log("No result found");
    return {
        success: false,
        error: null,
        resultText: 'Submission status unknown'
    };
}


// function to gather all relevant problem information
function getProblemInfo() {
    const title = document.querySelector('[data-cy="question-title"]')?.textContent || 
                 document.querySelector('.css-v3d350')?.textContent || 
                 'Unknown Problem';

    // Try to get problem description
    const description = document.querySelector('[data-cy="question-content"]')?.textContent || 
                       document.querySelector('.content__u3I1.question-content__JfgR')?.textContent ||
                       '';

    // create object with basic problem details
    const problemInfo = {
        title,
        description,
        examples: [],
        userCode: getUserCode(),
        submissionResult: getSubmissionResult(),
        timestamp: new Date().toISOString()
    };

    console.log("Gathered problem info:", problemInfo);


    // try to extract example test cases from problem description
    const descriptionArea = document.querySelector('[data-track-load="description_content"]');
    if (descriptionArea) {
        const text = descriptionArea.textContent;
        const exampleMatches = text.match(/Example \d+:[\s\S]*?(?=Example \d+:|$)/g);
        
        if (exampleMatches) {
            problemInfo.examples = exampleMatches.map(example => {
                const inputMatch = example.match(/Input:.*$/m);
                const outputMatch = example.match(/Output:.*$/m);
                return {
                    input: inputMatch ? inputMatch[0] : '',
                    output: outputMatch ? outputMatch[0] : ''
                };
            });
        }
    }

    return problemInfo;
}


// function to handle when user submits their code
function handleSubmitClick() {
    console.log("Submit button clicked!");
    
    // wait a bit for submission to start processing
    setTimeout(() => {
        // poll for submission results
        let attempts = 0;
        const maxAttempts = 20; // give up after 10 seconds
        
        const checkInterval = setInterval(() => {
            attempts++;
            console.log(`Checking submission (Attempt ${attempts})`);
            
            // get current state
            const code = getUserCode();
            const result = getSubmissionResult();
            
            console.log("Current code:", code?.substring(0, 100) + "...");
            console.log("Current result:", result);
            
            // check if we have everything we need or should stop trying
            if ((code && (result.success || result.error)) || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                
                if (code) {
                    // prepare submission data
                    const problemInfo = {
                        ...getProblemInfo(),
                        userCode: code,
                        submissionResult: result,
                        timestamp: new Date().toISOString()
                    };
                    
                    console.log("Saving submission:", problemInfo);
                    
                    // clear old data and save new submission
                    chrome.storage.local.clear(() => {
                        chrome.runtime.sendMessage({
                            action: "saveProblemInfo",
                            data: problemInfo
                        }, function(response) {
                            if (chrome.runtime.lastError) {
                                console.error('Error:', chrome.runtime.lastError);
                                return;
                            }
                            console.log('Submission saved:', response);
                        });
                    });
                } else {
                    console.log("No code found after maximum attempts");
                }
            }
        }, 500); // check every half second
    }, 1000); // initial 1 second delay
}


// startup initialization
console.log("Content script loaded");


// watch for submit button to appear
const observer = new MutationObserver((mutations, obs) => {
    const submitButton = document.querySelector('button[data-e2e-locator="console-submit-button"]');
    if (submitButton) {
        console.log("Found submit button");
        submitButton.addEventListener('click', handleSubmitClick);
        obs.disconnect();
        console.log("Submit button detection initialized");
    }
});


// start observing dom changes
observer.observe(document, {
    childList: true,
    subtree: true
});


// backup click handler for dynamic button creation
document.addEventListener('click', (e) => {
    if (e.target.matches('button[data-e2e-locator="console-submit-button"]')) {
        console.log("Submit button clicked through backup listener!");
        handleSubmitClick();
    }
});
