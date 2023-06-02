// Lincoln. initialize express app. nodemon expressapp.js to monitor

//How to connect MongoDB using the web interface: 
// 1. Ensure that you have MongoDB compass installed and mongo initialized in the terminal.
// 2. Open Mongo Atlas online, create your project, cluster, database. 
// 3. Press "Connect" next to your cluster name in the UI. Go to drivers. follow the instructions ensuring you have proper credentials, you may need to reset your password.
// Open MongoDB compass. New Connection. Advanced. Mongodb+srv. Input the same string from before with credentials. 
// Use the code below to connect via express app. You should now be connected to the database in the compass as well as in the app.

const express = require('express')
const app = express()
const port = 8088
const path = require('path')
const fs = require('fs')

//middleware
function logger(req, res, next){
  console.log(`Received request ... [${Date.now()}] ${req.method} ${req.url}`);
  next();
}
app.use(logger);
//error handling middleware to catch errors in page requests
function handleErrors(err, req, res, next){
  console.log(err)
  res.status(err.httpStatusCode || 500).send("Oh no, an error occurred!")
}

//connect main page 
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '/login.html'))
  // res.writeHead(200, {'Content-Type': 'text/plain'})
  // fs.readFile('./index.html', null, function(err, data){
  //   if(error){
  //     res.writeHead(404);
  //     res.write('File not found!');
  //   }else{
  //     res.write(data)
  //   }
  //   res.end();
  // })

})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

//Lincoln. This is some code I assembled to connect the database to the javascript.
const { MongoClient, ServerApiVersion } = require('mongodb');
// find the uri by connecting your cluster to your node.js. replace with the link found in the instructions on the MongoDB cloud website. Must have proper credentials assigned to the cluster.
const uri = "mongodb+srv://ellahlincoln:examplepass@excluster.d8hkgut.mongodb.net/?retryWrites=true&w=majority";

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


//check login credentials
var attempt = 3; // Variable to count number of attempts.
// Below function Executes on click of login button.
function validate(){
    var username = document.getElementById("username").value;
    var password = document.getElementById("password").value;
    if ( username == "admin" && password == "admin123"){
        alert ("Login successfully");
        window.location = "success.html"; // Redirecting to other page.
        return false;
    } else{
        attempt --;// Decrementing by one.
        alert("You have left "+attempt+" attempt;");
    // Disabling fields after 3 attempts.
        if( attempt == 0){
            document.getElementById("username").disabled = true;
            document.getElementById("password").disabled = true;
            document.getElementById("submit").disabled = true;
            return false;
        }
    }
}