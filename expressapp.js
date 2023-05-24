// Lincoln. initialize express app. nodemon expressapp.js to monitor

const express = require('express')
const app = express()
const port = 8088

app.get('/', (req, res) => {
  res.send('Hello World! This is an express app running with MongoDB!')
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

//Lincoln. This is some code I assembled to connect the database to the javascript.
const { MongoClient, ServerApiVersion } = require('mongodb');
// find the uri by connecting your cluster to your node.js. replace with the link found in the instructions on the MongoDB cloud website. Must have proper credentials assigned to the cluster.
const uri = "mongodb+srv://<username>:<password>@cluster0.jdcsztd.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//This is a try/catch to ensure that the database connection is successful. 
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);