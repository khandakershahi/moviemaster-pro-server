const app = require('./index');

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Movie Master Pro running locally on ${port}`);
});
