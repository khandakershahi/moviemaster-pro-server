const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
const admin = require('firebase-admin');

// Firebase initialization (unchanged, commented out as in original)
// const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, 'base64').toString('utf8');
// const serviceAccount = JSON.parse(decoded);
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

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
        console.error('Error in /users:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Movie all API
app.get('/movies', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const result = await moviesCollection.find().toArray();
        res.send(result);
    } catch (error) {
        console.error('Error in /movies:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Movie slider API
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
        console.error('Error in /movie-slider:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Top rated movie API
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
        console.error('Error in /movie-toprated:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Recent movies API
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
        console.error('Error in /movie-recent:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// NEW: Movie detail API
app.get('/movies/:id', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const { id } = req.params;

        // Query by MongoDB _id (assumes id is ObjectId)
        const query = { _id: new ObjectId(id) };
        const movie = await moviesCollection.findOne(query);

        if (!movie) {
            return res.status(404).send({ message: 'Movie not found' });
        }

        res.send(movie);
    } catch (error) {
        console.error('Error in /movies/:id:', error.message);
        // Handle invalid ObjectId format
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Reviews: Get reviews for a movie
app.get('/reviews/:movieId', async (req, res) => {
    try {
        const db = await connectToMongo();
        const reviewsCollection = db.collection('reviews');
        const { movieId } = req.params;
        const reviews = await reviewsCollection
            .find({ movieId: new ObjectId(movieId) })
            .sort({ createdAt: -1 })
            .toArray();
        res.send(reviews);
    } catch (error) {
        console.error('Error in /reviews/:movieId:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Reviews: Submit a review
app.post('/reviews', async (req, res) => {
    try {
        const db = await connectToMongo();
        const reviewsCollection = db.collection('reviews');
        const { movieId, userEmail, comment, rating } = req.body;
        if (!movieId || !userEmail || !comment || !rating) {
            return res.status(400).send({ message: 'All fields are required' });
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
        console.error('Error in /reviews:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Watchlist: Check if movie is in user's watchlist
app.get('/watchlist/check/:movieId', async (req, res) => {
    try {
        const db = await connectToMongo();
        const watchlistCollection = db.collection('watchlist');
        const { movieId } = req.params;
        const { userEmail } = req.query; // Assumes userEmail is passed
        const entry = await watchlistCollection.findOne({
            movieId: new ObjectId(movieId),
            userEmail,
        });
        res.send({ inWatchlist: !!entry });
    } catch (error) {
        console.error('Error in /watchlist/check/:movieId:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Watchlist: Add movie to watchlist
app.post('/watchlist', async (req, res) => {
    try {
        const db = await connectToMongo();
        const watchlistCollection = db.collection('watchlist');
        const { movieId, userEmail } = req.body;
        if (!movieId || !userEmail) {
            return res.status(400).send({ message: 'Movie ID and user email are required' });
        }
        const existingEntry = await watchlistCollection.findOne({
            movieId: new ObjectId(movieId),
            userEmail,
        });
        if (existingEntry) {
            return res.send({ message: 'Movie already in watchlist' });
        }
        const entry = {
            movieId: new ObjectId(movieId),
            userEmail,
            addedAt: new Date(),
        };
        const result = await watchlistCollection.insertOne(entry);
        res.send(result);
    } catch (error) {
        console.error('Error in /watchlist:', error.message);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Delete movie
app.delete('/movies/:id', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const { id } = req.params;
        const { userEmail } = req.body; // Assumes userEmail is sent for authorization
        const result = await moviesCollection.deleteOne({
            _id: new ObjectId(id),
            addedBy: userEmail, // Only delete if user added the movie
        });
        if (result.deletedCount === 0) {
            return res.status(403).send({ message: 'Unauthorized or movie not found' });
        }
        res.send({ message: 'Movie deleted successfully' });
    } catch (error) {
        console.error('Error in DELETE /movies/:id:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

// Edit movie (example, assumes frontend sends updated movie data)
app.put('/movies/:id', async (req, res) => {
    try {
        const db = await connectToMongo();
        const moviesCollection = db.collection('movies');
        const { id } = req.params;
        const { userEmail, ...updateData } = req.body;
        const result = await moviesCollection.updateOne(
            { _id: new ObjectId(id), addedBy: userEmail },
            { $set: updateData }
        );
        if (result.matchedCount === 0) {
            return res.status(403).send({ message: 'Unauthorized or movie not found' });
        }
        res.send({ message: 'Movie updated successfully' });
    } catch (error) {
        console.error('Error in PUT /movies/:id:', error.message);
        if (error.name === 'BSONTypeError') {
            return res.status(400).send({ message: 'Invalid movie ID format' });
        }
        res.status(500).send({ message: 'Internal server error' });
    }
});

connectToMongo().catch(console.dir);

app.listen(port, () => {
    console.log(`Movie Master Pro app listening on port ${port}`);
});