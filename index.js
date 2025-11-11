const express = require('express')
const cors = require('cors')
require("dotenv").config();
const app = express()
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000;


// middleware
app.use(cors());
app.use(express.json());



app.get('/', (req, res) => {
    res.send('Movie Master Pro Server is running')
})



const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('movie_db');
        const moviesCollectino = db.collection('movies');



        //movie all api
        app.get('/movies', async (req, res) => {
            const cursor = moviesCollectino
            const result = await cursor.find().toArray();
            console.log(result);
            res.send(result);
        })

        app.get('/movie-slider', async (req, res) => {
            const movieSlider = moviesCollectino
                .find()
                .sort({ movieId: -1, })
                .limit(6);
            const result = await movieSlider.toArray();
            res.send(result);

        })






        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Movie Master Pro app listening on port ${port}`)
})

