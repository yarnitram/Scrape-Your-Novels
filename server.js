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

app.post('/convert', async (req, res) => {
    const sitemapUrl = req.body.url; // Expecting sitemap URL now
    console.log('Received Sitemap URL for scraping:', sitemapUrl);

    if (!sitemapUrl) {
        return res.status(400).json({ message: 'Sitemap URL is required' });
    }

    try {
        // Fetch the sitemap content
        const sitemapResponse = await axios.get(sitemapUrl);
        const sitemapXml = sitemapResponse.data;

        // Parse the sitemap XML to extract novel URLs
        const $sitemap = cheerio.load(sitemapXml, { xmlMode: true });
        const novelUrls = [];
        $sitemap('loc').each((i, element) => {
            const url = $sitemap(element).text();
            // Filter for novel URLs, assuming they contain '/novel/'
            if (url.includes('/novel/') && !url.includes('/chapter/')) {
                 novelUrls.push(url);
            }
        });

        console.log(`Found ${novelUrls.length} potential novel URLs in the sitemap.`);

        const scrapedNovels = [];
        const stmt = db.prepare('INSERT OR IGNORE INTO novels (title, source_url, synopsis, cover_image_url, author_id) VALUES (?, ?, ?, ?, ?)');
        const genreStmt = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)');
        const novelGenreStmt = db.prepare('INSERT OR IGNORE INTO novel_genres (novel_id, genre_id) VALUES (?, ?)');
        const authorStmt = db.prepare('INSERT OR IGNORE INTO authors (name) VALUES (?)');

        for (const novelUrl of novelUrls) {
            try {
                console.log(`Scraping novel page: ${novelUrl}`);
                const novelPageResponse = await axios.get(novelUrl);
                const novelPageHtml = novelPageResponse.data;
                const $novelPage = cheerio.load(novelPageHtml);

                const title = $novelPage('.col-info-desc .desc .title').text().trim();
                const synopsis = $novelPage('.desc-text').text().trim();
                const coverImageUrl = $novelPage('.books .book img.lazy').attr('data-src');
                const authorName = $novelPage('.info-meta a[href*="/nov-love-author/"]').text().trim();
                const genres = [];
                $novelPage('.info-meta a[href*="/nov-love-genres/"]').each((i, element) => {
                    genres.push($novelPage(element).text().trim());
                });

                if (title && novelUrl) {
                    // Insert or get author ID
                    let authorId = null;
                    if (authorName) {
                        const authorRow = await new Promise((resolve, reject) => {
                            db.get('SELECT id FROM authors WHERE name = ?', [authorName], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });

                        if (authorRow) {
                            authorId = authorRow.id;
                        } else {
                             await new Promise((resolve, reject) => {
                                authorStmt.run(authorName, function(err) {
                                    if (err) reject(err);
                                    else resolve(this.lastID);
                                });
                            }).then(lastID => authorId = lastID).catch(err => console.error('Error inserting author:', err.message));
                        }
                    }

                    // Insert or ignore novel
                    await new Promise((resolve, reject) => {
                        stmt.run(title, novelUrl, synopsis, coverImageUrl, authorId, function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        });
                    }).then(novelId => {
                        if (novelId) {
                            console.log(`Inserted novel: ${title}`);
                            scrapedNovels.push({ title, source_url: novelUrl, synopsis, cover_image_url: coverImageUrl, author_id: authorId, genres });

                            // Insert or ignore genres and link to novel
                            genres.forEach(async (genreName) => {
                                let genreId = null;
                                const genreRow = await new Promise((resolve, reject) => {
                                    db.get('SELECT id FROM genres WHERE name = ?', [genreName], (err, row) => {
                                        if (err) reject(err);
                                        else resolve(row);
                                    });
                                });

                                if (genreRow) {
                                    genreId = genreRow.id;
                                } else {
                                     await new Promise((resolve, reject) => {
                                        genreStmt.run(genreName, function(err) {
                                            if (err) reject(err);
                                            else resolve(this.lastID);
                                        });
                                    }).then(lastID => genreId = lastID).catch(err => console.error('Error inserting genre:', err.message));
                                }

                                if (genreId) {
                                    novelGenreStmt.run(novelId, genreId, function(err) {
                                        if (err) console.error(`Error linking novel ${title} to genre ${genreName}:`, err.message);
                                    });
                                }
                            });
                        } else {
                            console.log(`Novel already exists: ${title}`);
                        }
                    }).catch(err => console.error(`Error inserting novel ${title}:`, err.message));

                }
            } catch (scrapeError) {
                console.error(`Error scraping novel page ${novelUrl}:`, scrapeError.message);
            }
        }

        stmt.finalize();
        genreStmt.finalize();
        novelGenreStmt.finalize();
        authorStmt.finalize();

        console.log(`Attempted to scrape and save ${novelUrls.length} novels. Successfully processed ${scrapedNovels.length} new/updated novels.`);

        res.json({ message: `Attempted to scrape ${novelUrls.length} novels from sitemap. Successfully processed ${scrapedNovels.length} new/updated novels.`, novels_count: scrapedNovels.length });

    } catch (error) {
        console.error('Error during sitemap processing or scraping:', error.message);
        res.status(500).json({ message: 'Error processing sitemap or scraping novels', error: error.message });
    }
});
app.get('/api/novels', (req, res) => {
    const query = `
        SELECT
            n.id,
            n.title,
            n.source_url,
            n.synopsis,
            n.cover_image_url,
            a.name AS author_name
        FROM novels n
        LEFT JOIN authors a ON n.author_id = a.id
    `;
    db.all(query, [], async (err, novels) => {
        if (err) {
            console.error('Error retrieving novels:', err.message);
            res.status(500).json({ message: 'Error retrieving novels', error: err.message });
        } else {
            // For each novel, fetch its genres
            for (const novel of novels) {
                const genreQuery = `
                    SELECT g.name
                    FROM genres g
                    JOIN novel_genres ng ON g.id = ng.genre_id
                    WHERE ng.novel_id = ?
                `;
                novel.genres = await new Promise((resolve, reject) => {
                    db.all(genreQuery, [novel.id], (err, genreRows) => {
                        if (err) reject(err);
                        else resolve(genreRows.map(row => row.name));
                    });
                });
            }
            res.json(novels);
        }
    });
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});