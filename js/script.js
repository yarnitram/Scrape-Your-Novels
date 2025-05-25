document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const convertButton = document.getElementById('convertButton');
    const statusDiv = document.getElementById('status');
    const novelsListUl = document.getElementById('novelsList');

    // Event listener for the convert button
    convertButton.addEventListener('click', async () => {
        const url = urlInput.value;
        if (!url) {
            statusDiv.textContent = 'Please enter a URL.';
            return;
        }

        statusDiv.textContent = 'Converting...';

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();
            statusDiv.textContent = data.message;

            // After conversion attempt, refresh the list of scraped novels
            fetchAndDisplayNovels();

        } catch (error) {
            console.error('Error:', error);
            statusDiv.textContent = 'Error during conversion.';
        }
    });

    // Function to fetch and display scraped novels
    async function fetchAndDisplayNovels() {
        try {
            const response = await fetch('/api/novels');
            const novels = await response.json();

            // Clear current list
            novelsListUl.innerHTML = '';

            if (novels.length === 0) {
                const listItem = document.createElement('li');
                listItem.textContent = 'No novels scraped yet.';
                novelsListUl.appendChild(listItem);
            } else {
                // Populate the list
                novels.forEach(novel => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = novel.source_url;
                    link.textContent = novel.title;
                    link.target = '_blank'; // Open link in new tab
                    listItem.appendChild(link);
                    novelsListUl.appendChild(listItem);
                });
            }

        } catch (error) {
            console.error('Error fetching novels:', error);
            const listItem = document.createElement('li');
            listItem.textContent = 'Error loading scraped novels.';
            novelsListUl.appendChild(listItem);
        }
    }

    // Fetch and display novels when the page loads
    fetchAndDisplayNovels();
});