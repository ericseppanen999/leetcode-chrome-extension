/***************************************************
 * content.js – Revised to detect code when error occurs
 ***************************************************/

/**
 * The single, very specific selector you gave for the code block 
 * that appears only on error.
 */
const ERROR_CODE_SELECTOR = `
  #\\36 d67eff6-a6e0-9fa1-ee77-9c34d81c9e9f 
  > div 
  > div 
  > div 
  > div.w-full.flex-1.overflow-y-auto 
  > div 
  > div:nth-child(2) 
  > div.relative.w-full.overflow-hidden.rounded-lg.bg-fill-quaternary.dark\\:bg-fill-quaternary.pb-7 
  > div.px-4.py-3 
  > div 
  > pre 
  > code
`.replace(/\s+/g, ' ');

/**
 * Another specific selector for the submit button 
 * (this might differ from your real environment).
 */
const SUBMIT_BUTTON_SELECTOR = `
  #editor > div.flex.items-center.justify-between.px-3.h-auto.py-1.pl-3.pr-1
  > div.relative.flex.overflow-hidden.rounded.bg-fill-tertiary.dark\\:bg-fill-tertiary.\\!bg-transparent
  > div.flex-none.flex
  > div:nth-child(2) > div:nth-child(2) > div > button
`.replace(/\s+/g, ' ');


// Attempt to extract user code from the DOM
function getUserCode() {
    console.log("Attempting to get user code...");

    /***************************************************
     * 1) If there's an error-based code block
     ***************************************************/
    const errorCodeBlock = document.querySelector(ERROR_CODE_SELECTOR);
    if (errorCodeBlock) {
        const errCode = errorCodeBlock.textContent;
        if (errCode && errCode.trim()) {
            console.log(
                "Found code in error block using ERROR_CODE_SELECTOR:\n",
                errCode.substring(0, 100), "..."
            );
            return errCode.trim();
        }
    }

    /***************************************************
     * 2) Attempt to read from Monaco editor lines
     ***************************************************/
    const monacoContainer = document.querySelector('.monaco-editor .view-lines');
    if (monacoContainer) {
        const lineElements = monacoContainer.querySelectorAll('.view-line');
        if (lineElements.length > 0) {
            const codeLines = Array.from(lineElements).map(line => line.innerText);
            const joinedCode = codeLines.join('\n').trim();
            if (joinedCode) {
                console.log("Found code in Monaco editor:", joinedCode.substring(0, 100), "...");
                return joinedCode;
            }
        }
    }

    /***************************************************
     * 3) Fallback: try multiple known <pre><code> selectors
     ***************************************************/
    const codeSelectors = [
        'div.overflow-hidden pre > code',
        'div.relative.w-full.overflow-hidden pre > code',
        'pre > code',
        '[class*="code-container"] code',
        '[class*="editor"] code'
    ];
    for (const selector of codeSelectors) {
        const codeElement = document.querySelector(selector);
        if (codeElement) {
            const code = codeElement.textContent;
            if (code && code.trim()) {
                console.log("Found code using selector:", selector);
                return code.trim();
            }
        }
    }

    /***************************************************
     * 4) If still no code, try an XPath expression
     ***************************************************/
    const xpath = "//pre/code[contains(text(), 'class') or contains(text(), 'def')]";
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (result.singleNodeValue) {
        const code = result.singleNodeValue.textContent;
        if (code && code.trim()) {
            console.log("Found code using XPath");
            return code.trim();
        }
    }

    // If everything fails:
    console.log("No code found in the DOM.");
    return null;
}


// Check if submission was successful or if there's an error result
function getSubmissionResult() {
    console.log("Checking submission result...");

    const resultSelectors = [
        // success
        '.text-green-s span',
        '[class*="success"]',

        // error/fail
        '.space-y-4.m-0 .flex.items-center span',
        '[class*="error"]',
        '[class*="wrong"]',
        '[data-e2e-locator="submission-result"] span'
    ];

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

    // fallback: look for any error containers
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

    console.log("No definitive submission result found.");
    return {
        success: false,
        error: null,
        resultText: 'Submission status unknown'
    };
}


// Gather all relevant problem info (title, description, code, etc.)
function getProblemInfo() {
    const title =
        document.querySelector('[data-cy="question-title"]')?.textContent ||
        document.querySelector('.css-v3d350')?.textContent ||
        'Unknown Problem';

    const description =
        document.querySelector('[data-cy="question-content"]')?.textContent ||
        document.querySelector('.content__u3I1.question-content__JfgR')?.textContent ||
        '';

    const problemInfo = {
        title,
        description,
        examples: [],
        userCode: getUserCode(),
        submissionResult: getSubmissionResult(),
        timestamp: new Date().toISOString()
    };

    console.log("Gathered problem info:", problemInfo);

    // Attempt to extract example test cases from the problem description
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

// Main logic to handle the "Submit" button click
function handleSubmitClick() {
    console.log("Submit button clicked!");

    setTimeout(() => {
        let attempts = 0;
        const maxAttempts = 20; // ~10 seconds
        const checkInterval = setInterval(() => {
            attempts++;
            console.log(`Checking submission (Attempt ${attempts})...`);

            const code = getUserCode();
            const result = getSubmissionResult();
            console.log("Current code (first 100 chars):", code?.substring(0, 100) || "N/A");
            console.log("Current result:", result);

            const haveDefinitiveResult = result.success || result.error;
            if ((code && haveDefinitiveResult) || attempts >= maxAttempts) {
                clearInterval(checkInterval);

                if (code) {
                    const problemInfo = {
                        ...getProblemInfo(),
                        userCode: code,
                        submissionResult: result,
                        timestamp: new Date().toISOString()
                    };

                    console.log("Sending submission info to background:", problemInfo);
                    if (chrome?.runtime?.sendMessage) {
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
                    } else {
                        console.error("chrome.runtime.sendMessage is not available.");
                    }
                } else {
                    console.log("No code found after maximum attempts");
                }
            }
        }, 500); // check every half second
    }, 1000); // initial 1 second delay
}


// We keep track of the last button we attached to, to avoid duplicates
let lastButton = null;

// Function to find (and attach to) the new or replaced "Submit" button
function attachSubmitButtonHandler() {
    const button = document.querySelector(SUBMIT_BUTTON_SELECTOR);
    if (button && button !== lastButton) {
        console.log("Found submit button:", button);

        // remove old listener if we had a previous button
        if (lastButton) {
            lastButton.removeEventListener('click', handleSubmitClick);
        }
        // attach new
        button.addEventListener('click', handleSubmitClick);
        lastButton = button;
        console.log("Submit button detection initialized");
    }
}

// We'll continuously observe the DOM in case the button changes
const observer = new MutationObserver(() => {
    attachSubmitButtonHandler();
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

// Attempt an initial attach
attachSubmitButtonHandler();

// (Optional) Backup event listener
document.addEventListener('click', (e) => {
    const button = document.querySelector(SUBMIT_BUTTON_SELECTOR);
    if (button && (e.target === button || button.contains(e.target))) {
        console.log("Submit button clicked through backup listener!");
        handleSubmitClick();
    }
});

console.log("Content script loaded");
