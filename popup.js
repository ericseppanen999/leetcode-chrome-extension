console.log("Popup script loaded");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded");

    const showDataButton = document.getElementById('showData');
    if (showDataButton) {
        showDataButton.addEventListener('click', function() {
            console.log("Show Data button clicked");
            const button = this;
            const originalText = button.textContent;
            button.innerHTML = '<div class="loading"></div>Loading...';

            chrome.storage.local.get(['problemInfo', 'lastUpdated'], function(result) {
                console.log("Got data:", result);
                button.textContent = originalText;
                const output = document.getElementById('output');

                if (result.problemInfo) {
                    const timestamp = result.lastUpdated ? new Date(result.lastUpdated).toLocaleString() : 'Unknown';
                    const submissionStatus = result.problemInfo.submissionResult?.success
                        ? '<span class="success-badge">Success</span>'
                        : '<span class="error-badge">Failed</span>';

                    let codeDisplay = result.problemInfo.userCode || 'No code found';

                    output.innerHTML = `
                        <div class="section">
                            <h3>Latest Submission ${submissionStatus}</h3>
                            <div class="timestamp">Saved on: ${timestamp}</div>
                            <p><strong>Problem:</strong> ${result.problemInfo.title}</p>
                            ${result.problemInfo.submissionResult?.error
                                ? `<div class="error-details">
                                      <p><strong>Error:</strong> ${result.problemInfo.submissionResult.error}</p>
                                      ${result.problemInfo.submissionResult.testCases
                                          ? `<p><strong>Test Cases:</strong> ${result.problemInfo.submissionResult.testCases}</p>` 
                                          : ''
                                      }
                                  </div>`
                                : ''
                            }
                            <div class="code-section">
                                <h3>Your Code:</h3>
                                <pre><code>${codeDisplay}</code></pre>
                            </div>
                        </div>
                    `;
                } else {
                    output.innerHTML = '<div class="error">No submissions stored yet</div>';
                }
            });
        });
    }

    const analyzeButton = document.getElementById('analyzeCode');
    if (analyzeButton) {
        analyzeButton.addEventListener('click', function() {
            console.log("Analyze button clicked");
            const button = this;
            const originalText = button.textContent;
            button.innerHTML = '<div class="loading"></div>Analyzing...';

            chrome.storage.local.get(['problemInfo'], function(result) {
                const analysis = document.getElementById('analysis');
                if (result.problemInfo && result.problemInfo.userCode) {
                    analysis.innerHTML = '<div class="loading"></div>Analyzing code...';

                    chrome.runtime.sendMessage({
                        action: "analyzeCode",
                        code: result.problemInfo.userCode,
                        problemInfo: result.problemInfo
                    }, function(response) {
                        button.textContent = originalText;
                        if (response.success) {
                            const formattedAnalysis = formatAnalysis(response.analysis);
                            analysis.innerHTML = `
                                <div class="section analysis-section">
                                    <h3>Analysis Results</h3>
                                    <div class="analysis">${formattedAnalysis}</div>
                                </div>
                            `;
                        } else {
                            analysis.innerHTML = `
                                <div class="error">Error: ${response.error}</div>
                            `;
                        }
                    });
                } else {
                    button.textContent = originalText;
                    analysis.innerHTML = '<div class="error">No code available to analyze</div>';
                }
            });
        });
    }
});

function formatAnalysis(text) {
    // Split the analysis into sections
    const sections = text.split(/(?=\d+\.\s+\*\*)/);

    return sections.map(section => {
        // Skip empty sections
        if (!section.trim()) return '';

        // Format each section
        const formattedSection = section
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
            .replace(/`(.*?)`/g, '<code>$1</code>')            // Inline code
            .replace(/\n\n/g, '</p><p>')                       // Paragraphs
            .replace(/\n/g, '<br>');                           // Line breaks

        return `<div class="analysis-item">${formattedSection}</div>`;
    }).join('');
}
