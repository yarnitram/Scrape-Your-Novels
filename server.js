const express = require('express');
const path = require('path');
const axios = require('axios'); // Import axios
const cheerio = require('cheerio'); // Import cheerio
// const Epub = require('epub-gen'); // Import epub-gen (will use later)
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./novels.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Create tables if they don't exist
            db.run(`CREATE TABLE IF NOT EXISTS authors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS genres (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS novels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                source_url TEXT UNIQUE,
                synopsis TEXT,
                cover_image_url TEXT,
                author_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES authors(id)
            )`);
             db.run(`CREATE TABLE IF NOT EXISTS novel_genres (
                novel_id INTEGER,
                genre_id INTEGER,
                PRIMARY KEY (novel_id, genre_id),
                FOREIGN KEY (novel_id) REFERENCES novels(id),
                FOREIGN KEY (genre_id) REFERENCES genres(id)
            )`);
            console.log('Database tables checked/created.');
        });
    }
});


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

        const novels = [];
        $('.list.list-novel.col-xs-12 .row .col-xs-7 .novel-title a').each((i, element) => {
            const title = $(element).text().trim();
            const novelUrl = $(element).attr('href');
            if (title && novelUrl) {
                novels.push({ title, source_url: novelUrl });
            }
        });

        console.log(`Found ${novels.length} novels on ${url}`);

        // Save novels to the database
        const stmt = db.prepare('INSERT OR IGNORE INTO novels (title, source_url) VALUES (?, ?)');
        novels.forEach(novel => {
            stmt.run(novel.title, novel.source_url, function(err) {
                if (err) {
                    console.error(`Error inserting novel ${novel.title}:`, err.message);
                } else if (this.changes > 0) {
                    console.log(`Inserted novel: ${novel.title}`);
                } else {
                    console.log(`Novel already exists: ${novel.title}`);
                }
            });
        });
        stmt.finalize();

        console.log(`Attempted to save ${novels.length} novels to the database.`);

        // TODO: Implement EPUB generation using epub-gen

        res.json({ message: `Scraped ${novels.length} novels and attempted to save to database.`, novels_count: novels.length });

    } catch (error) {
        console.error('Error during conversion:', error.message);
        res.status(500).json({ message: 'Error processing URL', error: error.message });
    }
});
app.get('/api/novels', (req, res) => {
    db.all('SELECT id, title, source_url FROM novels', [], (err, rows) => {
        if (err) {
            console.error('Error retrieving novels:', err.message);
            res.status(500).json({ message: 'Error retrieving novels', error: err.message });
        } else {
            res.json(rows);
        }
    });
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});