document.addEventListener('DOMContentLoaded', () => {
    const convertButton = document.getElementById('convertButton');
    const urlInput = document.getElementById('urlInput');
    const statusDiv = document.getElementById('status');

    convertButton.addEventListener('click', () => {
        const url = urlInput.value;
        if (url) {
            statusDiv.textContent = `Attempting to convert: ${url}`;
            console.log('URL entered:', url);
            statusDiv.textContent = `Sending URL to backend: ${url}`;

            fetch('/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url }),
            })
            .then(response => response.json())
            .then(data => {
                console.log('Backend response:', data);
                statusDiv.textContent = `Backend response: ${data.message}`;
            })
            .catch((error) => {
                console.error('Error:', error);
                statusDiv.textContent = `Error: ${error.message}`;
            });

        } else {
            statusDiv.textContent = 'Please enter a URL.';
            console.log('No URL entered.');
        }
    });
});