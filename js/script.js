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

                    // Add Cover Image
                    if (novel.cover_image_url) {
                        const coverImage = document.createElement('img');
                        coverImage.src = novel.cover_image_url;
                        coverImage.alt = `${novel.title} Cover`;
                        coverImage.style.width = '100px'; // Example styling
                        coverImage.style.marginRight = '10px';
                        listItem.appendChild(coverImage);
                    }

                    // Add Title (as a link)
                    const titleLink = document.createElement('a');
                    titleLink.href = novel.source_url;
                    titleLink.textContent = novel.title;
                    titleLink.target = '_blank'; // Open link in new tab
                    listItem.appendChild(titleLink);

                    // Add Author
                    if (novel.author_name) {
                        const authorPara = document.createElement('p');
                        authorPara.textContent = `Author: ${novel.author_name}`;
                        listItem.appendChild(authorPara);
                    }

                    // Add Genres
                    if (novel.genres && novel.genres.length > 0) {
                        const genresPara = document.createElement('p');
                        genresPara.textContent = `Genres: ${novel.genres.join(', ')}`;
                        listItem.appendChild(genresPara);
                    }

                    // Add Synopsis
                    if (novel.synopsis) {
                        const synopsisPara = document.createElement('p');
                        synopsisPara.textContent = `Synopsis: ${novel.synopsis.substring(0, 200)}...`; // Truncate synopsis for display
                        listItem.appendChild(synopsisPara);
                    }


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