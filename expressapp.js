// 6/2/2023 run using command `npm run dev` can be found in package.json under scripts
// Lincoln. initialize express app. nodemon expressapp.js to monitor

//How to connect MongoDB using the web interface: 
// 1. Ensure that you have MongoDB compass installed and mongo initialized in the terminal.
// 2. Open Mongo Atlas online, create your project, cluster, database. 
// 3. Press "Connect" next to your cluster name in the UI. Go to drivers. follow the instructions ensuring you have proper credentials, you may need to reset your password.
// Open MongoDB compass. New Connection. Advanced. Mongodb+srv. Input the same string from before with credentials. 
// Use the code below to connect via express app. You should now be connected to the database in the compass as well as in the app.

//How to connect to MongoDB via command line? 

const express = require('express')
const app = express()
const port = 8088
const path = require('path')
const fs = require('fs')
//used to read the user login
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
//cookie parser used for login
var cookieParser = require('cookie-parser')
app.use(cookieParser())
//middleware
function logger(req, res, next){
  console.log(`Received request ... [${Date.now()}] ${req.method} ${req.url}`);
  next();
}
app.use(logger);

app.use(express.json())


//error handling middleware to catch errors in page requests
function handleErrors(err, req, res, next){
  console.log(err)
  res.status(err.httpStatusCode || 500).send("Oh no, an error occurred!")
}

//redirect to login screen 
app.get('/', (req, res) => {
  res.redirect('/login')
})
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'))

})
app.get('/projects', (req, res) => {
  console.log(req.cookies.login)
  //check to see if credentials are successful and stored as a cookie
  if(req.cookies.login == 'true'){
    res.sendFile(path.join(__dirname, 'views/index.html'))
  }
  else{
    //redirect to login page if credentials are not successfully stored
    res.redirect('/login')
  }
  
})
//connect main page 
//route for POST request for login
//require cookies to save login
app.post('/login', (req, res)=>{
    var {username, password} = req.body
    console.log(username)
    if ( username == "admin" && password == "admin123"){
      res.cookie('login', true)
      res.redirect('/projects')
    } else{

      res.redirect('/login')
        }
    })
 
app.get('/upload', (req, res) => {
  console.log(req.cookies.login)
  //check to see if credentials are successful and stored as a cookie
  if(req.cookies.login == 'true'){
    res.sendFile(path.join(__dirname, 'views/import.html'))
  }
  else{
    //redirect to login page if credentials are not successfully stored
    res.redirect('/login')
  }
})
app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

//Lincoln. This is some code I assembled to connect the database to the javascript.
const { MongoClient, ServerApiVersion } = require('mongodb');
// find the uri by connecting your cluster to your node.js. replace with the link found in the instructions on the MongoDB cloud website. Must have proper credentials assigned to the cluster.
//can replace with local database host
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

//UI JAVASCRIPT
//check login credentials
var attempt = 3; // Variable to count number of attempts.
// Below function Executes on click of login button.



