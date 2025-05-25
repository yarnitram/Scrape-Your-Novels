const express = require('express');
const path = require('path');
const axios = require('axios'); // Import axios
const cheerio = require('cheerio'); // Import cheerio
// const Epub = require('epub-gen'); // Import epub-gen (will use later)


const app = express();
const port = 3001;

// Serve static files from the 'web2epub-web' directory
app.use(express.static(path.join(__dirname, '/')));
app.use(express.json()); // Middleware to parse JSON bodies

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/convert', async (req, res) => { // Made async to use await
    const url = req.body.url;
    console.log('Received URL for conversion:', url);

    if (!url) {
        return res.status(400).json({ message: 'URL is required' });
    }

    try {
        // Fetch the web page content
        const response = await axios.get(url);
        const html = response.data;

        // Load the HTML into cheerio
        const $ = cheerio.load(html);

        // TODO: Implement parsing logic using cheerio to extract content (title, author, chapters, etc.)
        // This will be the most complex part, requiring specific parsers for different websites.
        // For now, let's just confirm we fetched the page.
        console.log(`Successfully fetched and loaded HTML from ${url}`);

        // TODO: Implement EPUB generation using epub-gen

        res.json({ message: 'Content fetched and loaded, parsing and conversion pending.' });

    } catch (error) {
        console.error('Error during conversion:', error.message);
        res.status(500).json({ message: 'Error processing URL', error: error.message });
    }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});