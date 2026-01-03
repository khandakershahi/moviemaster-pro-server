const express = require('express');
const cors = require('cors');

require('dotenv').config({
    path:
        process.env.NODE_ENV === 'production'
            ? '.env.production'
            : '.env.local',
});

const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
const admin = require('firebase-admin');
// const serviceAccount = require('./movie-master-pro-ks-firebase-adminsdk-key.json');


// Firebase initialization
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// Firebase token verification middleware
const verifyFireBaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;    // console.log(req.headers);
    // console.log(authorization);
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.token_email = decoded.email;
        // console.log('decode email',decoded);
        next();
    } catch (error) {
        console.error('Token verification error:', error.message);
        return res.status(401).send({ message: 'unauthorized access' });
    }
};

// MongoDB connection helper

async function connectToMongo() {
    try {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
            console.log('Connected to MongoDB');
        }
        return client.db('movie_db');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.send('Movie Master Pro Server is running');
});

// USERS APIs
app.post('/users', async (req, res) => {
    try {
        const db = await connectToMongo();
        const usersCollection = db.collection('users');
        const newUser = req.body;
        const email = req.body.email;
        if (!email) {
            return res.status(400).send({ message: 'Email is required' });
        }
        const query = { email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
            return res.send({ message: 'User already exists. Do not need to insert again' });
        }
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
    } catch (error) {
        console.error('Error in POST /users:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

app.get('/users/:email', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const usersCollection = db.collection('users');
        const { email } = req.params;
        if (email !== req.token_email) {
            return res.status(403).send({ message: 'Unauthorized access' });
        }
        const user = await usersCollection.findOne({ email });
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }
        res.send({ image: user.image, name: user.name });
    } catch (error) {
        console.error('Error in GET /users/:email:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Get all users (protected)
app.get('/users', async (req, res) => {
    try {
        const db = await connectToMongo();
        const usersCollection = db.collection('users');
        const users = await usersCollection.find().toArray();
        res.send(users);
    } catch (error) {
        console.error('Error in GET /users:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});


// Search movies by title (MOVED BEFORE /movies/:id)
app.get('/movies/search', async (req, res) => {
    try {
        const { title } = req.query;
        if (!title) {
            return res.status(400).send({ message: 'Title is required' });
        }
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movies = await moviesCollection
            .find({ title: { $regex: title, $options: 'i' } })
            .toArray();
        res.send(movies);
    } catch (error) {
        console.error('Error in /movies/search:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// MOVIE APIs
// Get all movies (public)
app.get('/movies', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const result = await moviesCollection.find().toArray();
        res.send(result);
    } catch (error) {
        console.error('Error in GET /movies:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Get user's own movies (protected)
app.get('/movies/my-collection', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movies = await moviesCollection
            .find({ addedBy: req.token_email })
            .toArray();
        res.send(movies);
    } catch (error) {
        console.error('Error in GET /movies/my-collection:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Get movie by ID (public)
app.get('/movies/:id', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        const query = { _id: new ObjectId(id) };
        const movie = await moviesCollection.findOne(query);
        if (!movie) {
            return res.status(404).send({ message: 'Movie not found' });
        }
        res.status(200).send(movie);
    } catch (error) {
        console.error('Error in GET /movies/:id:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Add new movie (protected)
app.post('/movies/add', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movieData = req.body;
        const requiredFields = [
            'title',
            'genre',
            'releaseYear',
            'director',
            'cast',
            'rating',
            'duration',
            'plotSummary',
            'posterUrl',
            'posterWideUrl',
            'language',
            'country',
        ];
        for (const field of requiredFields) {
            if (!movieData[field]) {
                return res.status(400).send({ message: `${field} is required` });
            }
        }
        movieData.addedBy = req.token_email;
        const lastMovie = await moviesCollection.find().sort({ movieId: -1 }).limit(1).toArray();
        const newMovieId = lastMovie.length > 0 ? lastMovie[0].movieId + 1 : 101;
        movieData.movieId = newMovieId;
        const result = await moviesCollection.insertOne(movieData);
        res.status(201).send({ message: 'Movie added successfully', movie: result.insertedId });
    } catch (error) {
        console.error('Error in POST /movies/add:', error.message, error.stack);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Update movie by ID (protected, owner only)
app.patch('/movies/update/:id', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movieData = req.body;
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        const requiredFields = [
            'title',
            'genre',
            'releaseYear',
            'director',
            'cast',
            'rating',
            'duration',
            'plotSummary',
            'posterUrl',
            'posterWideUrl',
            'language',
            'country',
        ];
        for (const field of requiredFields) {
            if (!movieData[field]) {
                return res.status(400).send({ message: `${field} is required` });
            }
        }
        const movie = await moviesCollection.findOne({ _id: new ObjectId(id) });
        if (!movie) {
            return res.status(404).send({ message: 'Movie not found' });
        }
        if (movie.addedBy !== req.token_email) {
            return res.status(403).send({ message: 'Unauthorized: You can only edit your own movies' });
        }
        const { _id, ...updateData } = movieData;
        const result = await moviesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...updateData, addedBy: req.token_email } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).send({ message: 'Movie not found' });
        }
        res.status(200).send({ message: 'Movie updated successfully' });
    } catch (error) {
        console.error('Error in PATCH /movies/update/:id:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Delete movie (only owner can delete)
app.delete('/movies/:id', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const { id } = req.params;
        const userEmail = req.token_email; // verified from token

        const result = await moviesCollection.deleteOne({
            _id: new ObjectId(id),
            addedBy: userEmail,
        });

        if (result.deletedCount === 0) {
            return res.status(403).send({ message: 'Unauthorized or movie not found' });
        }

        res.send({ message: 'Movie deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /movies/:id:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});


// Reviews: Get reviews for a movie (public)
app.get('/reviews/:movieId', async (req, res) => {
    try {
        const db = await connectToMongo();
        const reviewsCollection = db.collection('reviews');
        const { movieId } = req.params;
        if (!ObjectId.isValid(movieId)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        const reviews = await reviewsCollection
            .find({ movieId: new ObjectId(movieId) })
            .sort({ createdAt: -1 })
            .toArray();
        res.send(reviews);
    } catch (error) {
        console.error('Error in GET /reviews/:movieId:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Reviews: Submit a review (protected)
app.post('/reviews', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const reviewsCollection = db.collection('reviews');
        const { movieId, userEmail, comment, rating } = req.body;
        if (!movieId || !userEmail || !comment || !rating) {
            return res.status(400).send({ message: 'All fields are required' });
        }
        if (!ObjectId.isValid(movieId)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        if (userEmail !== req.token_email) {
            return res.status(403).send({ message: 'Unauthorized: Email mismatch' });
        }
        const review = {
            movieId: new ObjectId(movieId),
            userEmail,
            comment,
            rating: Number(rating),
            createdAt: new Date(),
        };
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
    } catch (error) {
        console.error('Error in POST /reviews:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Watchlist: Check if movie is in user's watchlist (protected)
app.get('/watchlist/check/:movieId', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const watchlistCollection = db.collection('watchlists');
        const { movieId } = req.params;
        if (!ObjectId.isValid(movieId)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        const entry = await watchlistCollection.findOne({
            movieId: new ObjectId(movieId),
            userEmail: req.token_email,
        });
        res.send({ inWatchlist: !!entry });
    } catch (error) {
        console.error('Error in GET /watchlist/check/:movieId:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Watchlist: Add movie to watchlist (protected)
app.post('/watchlist', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const watchlistCollection = db.collection('watchlists');
        const { movieId, userEmail } = req.body;
        console.log(req.body, userEmail)
        if (!movieId || !userEmail) {
            return res.status(400).send({ message: 'Movie ID and user email are required' });
        }
        if (!ObjectId.isValid(movieId)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        console.log(userEmail, req.token_email);
        if (userEmail !== req.token_email) {
            return res.status(403).send({ message: 'Unauthorized: Email mismatch' });
        }
        const existingEntry = await watchlistCollection.findOne({
            movieId: new ObjectId(movieId),
            userEmail,
        });
        if (existingEntry) {
            return res.send({ message: 'Movie already in watchlists' });
        }
        const entry = {
            movieId: new ObjectId(movieId),
            userEmail,
            addedAt: new Date(),
        };
        const result = await watchlistCollection.insertOne(entry);
        res.send(result);
    } catch (error) {
        console.error('Error in POST /watchlist:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});



// Get user's watchlist (protected)
app.get('/watchlist/my', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const watchlistCollection = db.collection('watchlists');
        const moviesCollection = db.collection('movies');

        // Find all watchlist entries for user
        const watchlistEntries = await watchlistCollection
            .find({ userEmail: req.token_email })
            .toArray();

        // Extract movie IDs
        const movieIds = watchlistEntries.map((entry) => entry.movieId);

        // Get movie details
        const movies = await moviesCollection
            .find({ _id: { $in: movieIds } })
            .toArray();
        console.log(req.token_email);
        res.send(movies);
    } catch (error) {
        console.error('Error in GET /watchlist/my:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Remove from watchlist (protected)
app.delete('/watchlist/:movieId', verifyFireBaseToken, async (req, res) => {
    try {
        const db = await connectToMongo();
        const watchlistCollection = db.collection('watchlists');
        const { movieId } = req.params;

        if (!ObjectId.isValid(movieId)) {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }

        const result = await watchlistCollection.deleteOne({
            movieId: new ObjectId(movieId),
            userEmail: req.token_email,
        });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: 'Movie not found in watchlist' });
        }

        res.send({ message: 'Movie removed from watchlist' });
    } catch (error) {
        console.error('Error in DELETE /watchlist/:movieId:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});


// Non-CRUD Movie APIs (retained)
app.get('/movie-slider', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movieSlider = moviesCollection
            .find()
            .sort({ movieId: 1 })
            .limit(6);
        const result = await movieSlider.toArray();
        res.send(result);
    } catch (error) {
        console.error('Error in GET /movie-slider:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

app.get('/movie-toprated', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movieTopRated = moviesCollection
            .find()
            .sort({ rating: -1 })
            .limit(6);
        const result = await movieTopRated.toArray();
        res.send(result);
    } catch (error) {
        console.error('Error in GET /movie-toprated:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

app.get('/movie-recent', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const movieRecent = moviesCollection
            .find()
            .sort({ movieId: -1 })
            .limit(6);
        const result = await movieRecent.toArray();
        res.send(result);
    } catch (error) {
        console.error('Error in GET /movie-recent:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});






// connectToMongo().catch(console.dir);
// app.listen(port, () => {
//     console.log(`Movie Master Pro app listening on port ${port}`);
// });


// Export for Vercel
module.exports = app;